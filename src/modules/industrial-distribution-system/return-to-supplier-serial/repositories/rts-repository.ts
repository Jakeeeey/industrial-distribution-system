import type { 
  InventoryViewRow,
} from "../types/rts.schema";

// =============================================================================
// INTERNAL HELPERS — Directus Client (Module-Isolated)
// =============================================================================

/** Returns the Directus base URL (no trailing slash). Throws if not set. */
function getDirectusBase(): string {
  const raw =
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  const cleaned = raw.trim().replace(/\/$/, "");
  if (!cleaned) {
    throw new Error("DIRECTUS_URL is not set. Add it to .env.local and restart the dev server.");
  }
  return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

/** Returns the Directus static token. Throws if not set. */
function getDirectusToken(): string {
  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
  if (!token) {
    throw new Error("DIRECTUS_STATIC_TOKEN is not set. Add it to .env.local and restart the dev server.");
  }
  return token;
}

/** Returns headers for authenticated Directus requests. */
function directusHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getDirectusToken()}`,
  };
}

/** Fetches a Directus URL with JSON response handling. Throws on non-2xx. */
async function directusFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...directusHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json?.errors as Array<{ message: string }> | undefined;
    const msg =
      errors?.[0]?.message ||
      (json?.error as string) ||
      `Directus responded ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Helper for Directus GET requests */
async function directusGet<T>(path: string): Promise<T> {
  const base = getDirectusBase();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  return directusFetch(url, { method: "GET" });
}

/** Helper for Directus POST/PATCH/DELETE requests */
async function directusMutate<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const base = getDirectusBase();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return directusFetch(url, options);
}

// =============================================================================
// REPOSITORY METHODS
// =============================================================================

/**
 * Fetches raw Return-to-Supplier header records.
 */
export async function getRawRtsHeaders() {
  return directusGet<{ data: Record<string, unknown>[] }>(
    "/items/return_to_supplier?limit=-1&filter[supplier_id][division_id][_eq]=1&filter[branch_id][division_id][_eq]=1&fields=id,doc_no,transaction_date,is_posted,remarks,supplier_id.supplier_name,branch_id.branch_name,total_net_amount,encoder_id,date_posted&sort=-date_created"
  );
}

/**
 * Fetches raw RTS line items, including totals for summary calculation.
 */
export async function getRawRtsAllItems() {
  return directusGet<{ data: Record<string, unknown>[] }>(
    "/items/rts_items?limit=-1&fields=rts_id,net_amount,gross_amount,discount_amount"
  );
}

/**
 * Fetches raw items for a specific transaction ID.
 */
export async function getRawItemsByRtsId(id: string) {
  const params = new URLSearchParams({
    "filter[rts_id][_eq]": id,
    fields:
      "id,quantity,gross_unit_price,discount_rate,discount_amount,net_amount,return_type_id,discount_type_id,product_id.product_name,product_id.product_code,product_id.product_id,product_id.unit_of_measurement_count,uom_id.unit_shortcut,uom_id.unit_id",
  });
  return directusGet<{ data: Record<string, unknown>[] }>(`/items/rts_items?${params}`);
}

/**
 * Fetches RFID tags associated with specific RTS item IDs.
 */
export async function getRawRfidsByItemIds(itemIds: number[]) {
  const params = new URLSearchParams({
    "filter[rts_item_id][_in]": itemIds.join(","),
    fields: "rts_item_id,rfid_tag",
  });
  return directusGet<{ data: { rts_item_id: number; rfid_tag: string }[] }>(`/items/rts_item_rfid?${params}`);
}

/**
 * Fetches Serial Numbers associated with specific RTS item IDs.
 */
export async function getRawSerialsByItemIds(itemIds: number[]) {
  const params = new URLSearchParams({
    "filter[rts_item_id][_in]": itemIds.join(","),
    fields: "rts_item_id,serial_number",
  });
  return directusGet<{ data: { rts_item_id: number; serial_number: string }[] }>(`/items/rts_item_serial?${params}`);
}

/**
 * Fetches all reference data required for the modue.
 */
export async function getRawReferences() {
  return Promise.all([
    directusGet<{ data: Record<string, unknown>[] }>("/items/suppliers?limit=-1&filter[supplier_type][_eq]=Trade&filter[division_id][_eq]=1"),
    directusGet<{ data: Record<string, unknown>[] }>("/items/branches?limit=-1&filter[division_id][_eq]=1"),
    directusGet<{ data: Record<string, unknown>[] }>(
      "/items/products?limit=-1&fields=product_id,product_name,description,product_code,parent_id,unit_of_measurement,unit_of_measurement_count,cost_per_unit",
    ),
    directusGet<{ data: Record<string, unknown>[] }>("/items/units?limit=-1&fields=unit_id,unit_name,unit_shortcut,order"),
    directusGet<{ data: Record<string, unknown>[] }>("/items/line_discount?limit=-1"),
    directusGet<{ data: Record<string, unknown>[] }>(
      "/items/product_per_supplier?limit=-1&fields=id,product_id,supplier_id,discount_type",
    ),
    directusGet<{ data: Record<string, unknown>[] }>("/items/rts_return_type?limit=-1"),
    directusGet<{ data: Record<string, unknown>[] }>("/items/discount_type?limit=-1"),
    directusGet<{ data: Record<string, unknown>[] }>("/items/line_per_discount_type?limit=-1&fields=id,type_id,line_id"),
  ]);
}

/**
 * Fetches raw product details (prices, parents) for a set of product IDs.
 */
export async function getRawProductsByIds(productIds: number[]) {
  const productFilter = JSON.stringify({ product_id: { _in: productIds } });
  return directusGet<{ data: Record<string, unknown>[] }>(
    `/items/products?limit=-1&fields=product_id,parent_id,cost_per_unit&filter=${encodeURIComponent(productFilter)}`,
  );
}

/**
 * Fetches inventory from the Spring Boot VOS API.
 * This is kept in the repository as it is an external infrastructure call.
 */
export async function getSpringInventory(branchId: number, supplierId: number, token: string): Promise<InventoryViewRow[]> {
  const SPRING_URL = process.env.SPRING_API_BASE_URL;
  if (!SPRING_URL) throw new Error("SPRING_API_BASE_URL is not defined");

  const startDate = "2000-01-01";
  const endDate = "2099-12-31";
  const targetUrl = `${SPRING_URL.replace(/\/$/, "")}/api/view-running-inventory-by-unit/all?startDate=${startDate}&endDate=${endDate}`;

  const springRes = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!springRes.ok) {
    const text = await springRes.text().catch(() => `HTTP ${springRes.status}`);
    throw new Error(`Spring Boot inventory fetch failed (${springRes.status}): ${text}`);
  }

  return springRes.json();
}

/**
 * Looks up an RFID tag via Spring Boot VOS API.
 */
export async function getSpringRfidLookup(rfidTag: string, branchId: number, token: string) {
  const SPRING_URL = process.env.SPRING_API_BASE_URL;
  if (!SPRING_URL) throw new Error("SPRING_API_BASE_URL is not defined");

  const targetUrl = `${SPRING_URL.replace(/\/$/, "")}/api/view-rfid-onhand?rfid=${encodeURIComponent(rfidTag)}&branchId=${branchId}`;

  const springRes = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!springRes.ok) {
    const text = await springRes.text().catch(() => `HTTP ${springRes.status}`);
    throw new Error(`RFID lookup failed (${springRes.status}): ${text}`);
  }

  return springRes.json();
}

/**
 * Persistence: Checks if an RFID tag is already bound to any RTS item.
 */
export async function checkRfidAlreadyBound(rfidTag: string) {
  const res = await directusGet<{ data: Record<string, unknown>[] }>(
    `/items/rts_item_rfid?filter[rfid_tag][_eq]=${encodeURIComponent(rfidTag)}&limit=1&fields=id`
  );
  return res.data && res.data.length > 0;
}

/**
 * Persistence: Checks if a Serial Number is already bound to any RTS item (Pending, Scanned, or Returned).
 */
export async function checkSerialAlreadyReturned(serialNumber: string) {
  const res = await directusGet<{ data: Record<string, unknown>[] }>(
    `/items/rts_item_serial?filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&limit=1&fields=id`
  );
  return res.data && res.data.length > 0;
}

/**
 * Inventory: Checks if a serial number is on-hand and returns its Product ID.
 * Follows the robust pattern from Active Picking with fallbacks for field naming.
 */
export async function getSpringSerialLookup(serialNumber: string, branchId: number, token: string): Promise<{ productId: number } | null> {
  const SPRING_URL = process.env.SPRING_API_BASE_URL;
  if (!SPRING_URL) throw new Error("SPRING_API_BASE_URL is not defined");

  const inputSerial = serialNumber.trim().toUpperCase();
  const extractData = (raw: unknown): unknown[] => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (obj.content && Array.isArray(obj.content)) return obj.content;
      if (obj.data && Array.isArray(obj.data)) return obj.data;
    }
    return [];
  };

  const tryFetch = async (queryParams: string) => {
    const url = `${SPRING_URL.replace(/\/$/, "")}/api/v-serial-onhand/all?${queryParams}&size=1000`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return extractData(json);
    } catch {
      return [];
    }
  };

  // 1. Try Serial + Branch (Standard)
  let data = await tryFetch(`serialNumber=${encodeURIComponent(serialNumber.trim())}&branchId=${branchId}`);
  
  // 2. Try Serial + Branch (snake_case fallback)
  if (data.length === 0) {
    data = await tryFetch(`serial_number=${encodeURIComponent(serialNumber.trim())}&branch_id=${branchId}`);
  }

  // 3. Try Serial Only (Global)
  if (data.length === 0) {
    data = await tryFetch(`serialNumber=${encodeURIComponent(serialNumber.trim())}`);
    if (data.length === 0) {
      data = await tryFetch(`serial_number=${encodeURIComponent(serialNumber.trim())}`);
    }
  }

  if (data.length === 0) return null;

  interface SpringSerialOnhandItem {
    serialNumber?: string;
    serial_number?: string;
    serialNo?: string;
    serial?: string;
    productId?: number;
    product_id?: number;
    product?: {
      id?: number;
      product_id?: number;
    };
    branchId?: number;
    branch_id?: number;
  }

  // Find the exact match in the returned set
  const onhand = (data as SpringSerialOnhandItem[]).find((item) => {
    const dbVal = item.serialNumber ?? item.serial_number ?? item.serialNo ?? item.serial;
    if (dbVal === undefined || dbVal === null) return false;
    
    const dbSerial = String(dbVal).trim().toUpperCase();
    const dbBranchId = item.branchId ?? item.branch_id;
    
    // Must match serial exactly, and branch if provided in record
    const branchMatch = dbBranchId === undefined || dbBranchId === null || Number(dbBranchId) === branchId;
    return dbSerial === inputSerial && branchMatch;
  });

  if (onhand) {
    const pId = onhand.productId ?? onhand.product_id ?? onhand.product?.id ?? onhand.product?.product_id;
    if (pId !== undefined && pId !== null) {
      return { productId: Number(pId) };
    }
  }

  return null;
}

/**
 * Persistence: Creates the RTS Header.
 */
export async function createRtsHeader(header: Record<string, unknown>) {
  return directusMutate<{ data: { id: number } }>("/items/return_to_supplier", "POST", header);
}

/**
 * Persistence: Creates an RTS Line Item.
 */
export async function createRtsItem(item: Record<string, unknown>) {
  return directusMutate<{ data: { id: number } }>("/items/rts_items", "POST", item);
}

/**
 * Persistence: Binds an RFID tag to an RTS Item.
 */
export async function createRtsRfidBinding(binding: Record<string, unknown>) {
  return directusMutate("/items/rts_item_rfid", "POST", binding);
}

/**
 * Persistence: Binds a Serial Number to an RTS Item.
 */
export async function createRtsItemSerial(payload: Record<string, unknown>) {
  return directusMutate("/items/rts_item_serial", "POST", payload);
}

/**
 * Persistence: Updates an RTS Header.
 */
export async function updateRtsHeader(id: string, header: Record<string, unknown>) {
  return directusMutate(`/items/return_to_supplier/${id}`, "PATCH", header);
}

/**
 * Persistence: Fetches IDs of existing items/rfids for deletion during update.
 */
export async function getExistingRelatedIds(id: string) {
  const itemsJson = await directusGet<{ data: { id: number }[] }>(`/items/rts_items?filter[rts_id][_eq]=${id}&fields=id`);
  const itemIds = (itemsJson.data || []).map(i => i.id);
  
  let rfidIds: number[] = [];
  if (itemIds.length > 0) {
    const rfidJson = await directusGet<{ data: { id: number }[] }>(
        `/items/rts_item_rfid?filter[rts_item_id][_in]=${itemIds.join(",")}&fields=id`
    );
    rfidIds = (rfidJson.data || []).map(r => r.id);
  }

  let serialIds: number[] = [];
  if (itemIds.length > 0) {
    const serialJson = await directusGet<{ data: { id: number }[] }>(
        `/items/rts_item_serial?filter[rts_item_id][_in]=${itemIds.join(",")}&fields=id`
    );
    serialIds = (serialJson.data || []).map(s => s.id);
  }

  return { itemIds, rfidIds, serialIds };
}

/**
 * Persistence: Bulk deletes records.
 */
export async function deleteRecords(collection: "rts_items" | "rts_item_rfid" | "rts_item_serial", ids: number[]) {
  return directusMutate(`/items/${collection}`, "DELETE", ids);
}
