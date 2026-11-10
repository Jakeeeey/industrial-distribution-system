import type {
  ReturnToSupplier,
  RTSItem,
  InventoryRecord,
  ReferenceData,
  RfidLookupResult,
  CreateReturnDTO,
} from "../types/rts.schema";

const API_BASE = "/api/ids/return-to-supplier-serial";

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Parses a fetch response and throws on error.
 * Extracts the `data` field from the JSON body.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const errMsg = json.error || json.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return json.data as T;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetches all Return-to-Supplier transactions for the list view.
 * @returns Array of ReturnToSupplier records.
 */
export async function listTransactions(): Promise<ReturnToSupplier[]> {
  const res = await fetch(`${API_BASE}?action=list`, { cache: "no-store" });
  return handleResponse<ReturnToSupplier[]>(res);
}

/**
 * Fetches the line items for a specific RTS transaction.
 * @param id - The return_to_supplier record ID.
 * @returns Array of RTSItem records.
 */
export async function getTransactionDetails(
  id: string,
): Promise<RTSItem[]> {
  const res = await fetch(`${API_BASE}?action=details&id=${id}`, {
    cache: "no-store",
  });
  return handleResponse<RTSItem[]>(res);
}

// Promise-level cache for reference data
let referencesCachePromise: Promise<ReferenceData> | null = null;

/**
 * Invalidates the references cache so that the next request will pull fresh data.
 */
export function clearReferencesCache(): void {
  referencesCachePromise = null;
}

// AG-COMMENT: Cache and in-flight deduplication for inventory to prevent repeated rapid requests (e.g. 1 req / 2s)
interface CachedInventory {
  data: InventoryRecord[];
  timestamp: number;
}
const inventoryCache = new Map<string, CachedInventory>();
const inventoryInFlight = new Map<string, Promise<InventoryRecord[]>>();
const INVENTORY_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

/**
 * Clears the inventory cache.
 */
export function clearInventoryCache(): void {
  inventoryCache.clear();
  inventoryInFlight.clear();
}

/**
 * Fetches all reference data (suppliers, branches, products, discounts, etc.).
 * Implements a Promise-level singleton cache to prevent connection pool exhaustion.
 * @returns ReferenceData bundle.
 */
export async function getReferences(): Promise<ReferenceData> {
  if (!referencesCachePromise) {
    referencesCachePromise = fetch(`${API_BASE}?action=references`, {
      cache: "no-store",
    })
      .then((res) => handleResponse<ReferenceData>(res))
      .catch((err) => {
        // Clear the cache on failure so future attempts can retry
        referencesCachePromise = null;
        throw err;
      });
  }
  return referencesCachePromise;
}

/**
 * Fetches running inventory for a specific branch and supplier.
 * Returns display-ready records with remainder cascade applied.
 * Uses in-memory cache and accepts an AbortSignal to cancel old/superseded requests.
 * @param branchId - The branch ID.
 * @param supplierId - The supplier ID.
 * @param forceRefresh - If true, ignores cache and forces a fresh request.
 * @param signal - Optional AbortSignal to cancel the HTTP request on socket level.
 * @returns Array of InventoryRecord with floored stock values.
 */
export async function getInventory(
  branchId: number,
  supplierId: number,
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<InventoryRecord[]> {
  const key = `${branchId}-${supplierId}`;

  if (!forceRefresh) {
    const cached = inventoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < INVENTORY_CACHE_TTL_MS) {
      return cached.data;
    }
    const inFlight = inventoryInFlight.get(key);
    if (inFlight) {
      return inFlight;
    }
  }

  // AG-COMMENT: If signal is already aborted before fetch begins, fail fast
  if (signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  const fetchPromise = (async () => {
    try {
      // AG-COMMENT: Pass signal directly to fetch to terminate the network connection when cancelled
      const res = await fetch(
        `${API_BASE}?action=inventory&branchId=${branchId}&supplierId=${supplierId}`,
        { 
          cache: "no-store",
          signal,
        },
      );
      const data = await handleResponse<InventoryRecord[]>(res);
      inventoryCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inventoryInFlight.delete(key);
    }
  })();

  inventoryInFlight.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Looks up an RFID tag to find the associated product at a branch.
 * @param rfidTag - The scanned RFID tag string.
 * @param branchId - The branch to check.
 * @returns { productId } or null if not found on-hand.
 */
export async function lookupRfid(
  rfidTag: string,
  branchId: number,
): Promise<RfidLookupResult | null> {
  const res = await fetch(
    `${API_BASE}?action=rfid-lookup&rfid=${encodeURIComponent(rfidTag)}&branchId=${branchId}`,
    { cache: "no-store" },
  );
  return handleResponse<RfidLookupResult | null>(res);
}

/**
 * Creates a new Return-to-Supplier transaction.
 * @param dto - The create payload (validated on the server via Zod).
 * @returns The created record data, or throws on error.
 */
export async function createTransaction(dto: CreateReturnDTO): Promise<unknown> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  return handleResponse(res);
}

/**
 * Updates an existing Return-to-Supplier transaction.
 * @param id - The return_to_supplier record ID.
 * @param dto - The update payload (validated on the server via Zod).
 * @returns Success confirmation, or throws on error.
 */
export async function updateTransaction(
  id: string,
  dto: CreateReturnDTO,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  return handleResponse(res);
}

/**
 * Validates a serial number against database and inventory.
 * @param serialNumber - The serial number to validate.
 * @param productId - The product ID.
 * @param branchId - The branch ID.
 * @returns Success confirmation and unregistered flag, or throws on error.
 */
export async function validateSerialNumber(
  serialNumber: string,
  productId: number,
  branchId: number,
): Promise<{ success: boolean; isUnregistered?: boolean }> {
  const res = await fetch(
    `${API_BASE}?action=serial-validate&serialNumber=${encodeURIComponent(serialNumber)}&productId=${productId}&branchId=${branchId}`,
    { cache: "no-store" },
  );
  return handleResponse<{ success: boolean; isUnregistered?: boolean }>(res);
}

// [MODIFIED] Removed registerAssets function as asset registration is no longer allowed in Return to Supplier.

