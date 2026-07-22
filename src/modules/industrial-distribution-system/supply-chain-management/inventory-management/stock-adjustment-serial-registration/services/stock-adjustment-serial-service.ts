import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/directus";
import {
  StockAdjustmentHeader,
  StockAdjustmentDetail,
  StockAdjustmentItem,
  StockAdjustmentProduct,
  StockAdjustmentAttachment,
} from "../types/stock-adjustment-serial.schema";

/** Shape of a record returned from cylinder_assets_draft */
interface DraftCylinder {
  id: number;
  product_id: number;
  cylinder_status?: string;
  [key: string]: unknown;
}

interface RawItem {
  id?: number;
  doc_no: string;
  quantity: number;
  product_id?: {
    id: number;
    product_id: number;
    product_name?: string;
    product_code?: string;
    cost_per_unit?: number;
    price_per_unit?: number;
    product_brand?: { brand_name: string };
    product_category?: { category_name: string };
    unit_of_measurement?: { unit_name: string; order: number };
    barcode?: string;
    description?: string;
    is_serialized?: boolean;
  };
  unit_id?: { unit_name: string };
  cost_per_unit?: number;
  brand_name?: string;
  unit_name?: string;
  serial_numbers?: string[];
  serial_count?: number;
  inferred_supplier_id?: number;
  current_stock?: number;
}

interface RawAttachment {
  id?: number;
  stock_adjustment_id?: number;
  // Adjusted to include RawFile to support mapped file details after lookup
  attachment: string | Record<string, unknown> | RawFile | null;
  [key: string]: unknown;
}

interface RawFile {
  id: string;
  type?: string;
  filename_download?: string;
  filesize?: number;
}


interface PPSData {
  product_id: number | { id: number };
  supplier_id: number | { id: number };
}

interface SerialItem {
  id?: number;
  serial_number: string;
  stock_adjustment_id: number;
}

interface InventoryItem {
  product_id: number;
  running_inventory?: number;
}

interface SerialStatusItem {
  productId: number;
  quantity?: number;
  count?: number;
}

const DIRECTUS_URL = getDirectusBase();
const SPRING_API_URL = process.env.SPRING_API_BASE_URL;

/**
 * Service for handling Stock Adjustment data interactions.
 */
export const stockAdjustmentService = {
  /**
   * Fetch all stock adjustment headers with optional filtering
   */
  async fetchAllHeaders(params?: { search?: string; branchId?: number; type?: string; status?: string }) {
    let query = `fields=*,branch_id.branch_name,branch_id.id,supplier_id.id,supplier_id.supplier_name,created_by.user_fname,created_by.user_lname,created_by.user_id,posted_by.user_fname,posted_by.user_lname,items.id,stock_adjustment.id&sort=-created_at`;

    const filters: Record<string, unknown> = {
      is_delete: { _neq: true },
      doc_no: { _nstarts_with: "CONV" }
    };

    if (params?.branchId) filters.branch_id = { _eq: params.branchId };
    if (params?.type) filters.type = { _eq: params.type };

    if (params?.status) {
      if (params.status === "Posted") {
        filters.isPosted = { _eq: true };
      } else if (params.status === "Unposted") {
        filters.isPosted = { _neq: true };
      }
    }

    if (params?.search) {
      filters._or = [
        { doc_no: { _icontains: params.search } },
        { remarks: { _icontains: params.search } }
      ];
    }

    if (Object.keys(filters).length > 0) {
      query += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const res = await directusFetch<{ data: StockAdjustmentHeader[] }>(`${DIRECTUS_URL}/items/stock_adjustment_header?${query}`);
    const headers = res.data;

    if (headers.length === 0) return [];

    // Pre-parse remarks metadata for each header to resolve exact supplier
    const parsedHeaders = headers.map(header => {
      let supplierId: number | null = null;
      let cleanedRemarks = String(header.remarks || "").trim();
      const match = cleanedRemarks.match(/\[SUPPLIER_ID:\s*(\d+)\]/);
      if (match) {
        supplierId = Number(match[1]);
        cleanedRemarks = cleanedRemarks.replace(/\s*\[SUPPLIER_ID:\s*(\d+)\]/g, "").trim();
      }
      return {
        ...header,
        remarks: cleanedRemarks,
        parsed_supplier_id: supplierId
      };
    });

    const docNos = parsedHeaders.map(h => h.doc_no);
    const itemsRes = await directusFetch<{ data: RawItem[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_in":${JSON.stringify(docNos)}}}&fields=doc_no,quantity,product_id.product_id,product_id.price_per_unit,product_id.cost_per_unit,unit_id.unit_name&limit=-1`
    );
    const allItems = itemsRes.data || [];

    const itemsMap = new Map<string, RawItem[]>();
    allItems.forEach((item: RawItem) => {
      if (!itemsMap.has(item.doc_no)) itemsMap.set(item.doc_no, []);
      itemsMap.get(item.doc_no)!.push(item);
    });

    const productIds = allItems
      .map((item: RawItem) => {
        const p = item.product_id;
        if (typeof p === 'object' && p !== null) return p.product_id || p.id;
        return p;
      })
      .filter((pid): pid is number => typeof pid === 'number' || (typeof pid === 'string' && !isNaN(Number(pid))));

    const productToSupplierMap = new Map<number, number>();
    const supplierMap = new Map<number, string>();

    if (productIds.length > 0) {
      try {
        const ppsRes = await directusFetch<{ data: PPSData[] }>(
          `${DIRECTUS_URL}/items/product_per_supplier?filter={"product_id":{"_in":${JSON.stringify(productIds)}}}&fields=product_id,supplier_id&limit=-1`
        );
        const ppsData: PPSData[] = ppsRes.data || [];
        ppsData.forEach((pps: PPSData) => {
          const pId = typeof pps.product_id === 'object' ? pps.product_id.id : pps.product_id;
          const sId = typeof pps.supplier_id === 'object' ? pps.supplier_id.id : pps.supplier_id;
          if (pId && sId && !productToSupplierMap.has(Number(pId))) {
            productToSupplierMap.set(Number(pId), Number(sId));
          }
        });
      } catch (err) {
        console.error("Error inferring suppliers in fetchAllHeaders:", err);
      }
    }

    // Collect all parsed supplier IDs along with any inferred ones
    const supplierIds = Array.from(new Set([
      ...parsedHeaders.map(h => h.parsed_supplier_id).filter((id): id is number => id !== null),
      ...Array.from(productToSupplierMap.values())
    ]));

    if (supplierIds.length > 0) {
      try {
        const suppliersRes = await directusFetch<{ data: Array<{ id: number; supplier_name: string }> }>(
          `${DIRECTUS_URL}/items/suppliers?filter={"id":{"_in":${JSON.stringify(supplierIds)}}}&fields=id,supplier_name&limit=-1`
        );
        const suppliersData = suppliersRes.data || [];
        suppliersData.forEach((s) => {
          supplierMap.set(Number(s.id), s.supplier_name);
        });
      } catch (err) {
        console.error("Error fetching suppliers in fetchAllHeaders:", err);
      }
    }

    return parsedHeaders.map(header => {
      const headerItems = itemsMap.get(header.doc_no) || [];
      const totalAmount = headerItems.reduce((sum: number, item: RawItem) => {
        const cost = item.product_id?.cost_per_unit || item.product_id?.price_per_unit || 0;
        return sum + ((item.quantity || 0) * cost);
      }, 0);

      // Resolve supplier from remarks metadata first
      let resolvedSupplier: { id: number; supplier_name: string } | null = null;
      if (header.parsed_supplier_id) {
        const sName = supplierMap.get(header.parsed_supplier_id);
        if (sName) {
          resolvedSupplier = { id: header.parsed_supplier_id, supplier_name: sName };
        }
      }

      // Fallback to legacy inference
      if (!resolvedSupplier && headerItems.length > 0) {
        for (const item of headerItems) {
          const pId = Number(typeof item.product_id === 'object' ? (item.product_id?.product_id || item.product_id?.id) : item.product_id);
          const sId = productToSupplierMap.get(pId);
          if (sId) {
            const sName = supplierMap.get(sId);
            if (sName) {
              resolvedSupplier = { id: sId, supplier_name: sName };
              break;
            }
          }
        }
      }

      return {
        ...header,
        items: headerItems,
        amount: totalAmount > 0 ? totalAmount : (Number(header.amount) || 0),
        supplier_id: resolvedSupplier as unknown
      };
    });
  },

  /**
   * Fetch a single stock adjustment with all its items and serial numbers
   */
  async fetchById(id: number): Promise<StockAdjustmentDetail> {
    const headerRes = await directusFetch<{ data: StockAdjustmentHeader }>(
      `${DIRECTUS_URL}/items/stock_adjustment_header/${id}?fields=*,branch_id.id,branch_id.branch_name,supplier_id.id,supplier_id.supplier_name,created_by.user_fname,created_by.user_lname,posted_by.user_fname,posted_by.user_lname`
    );
    const header = headerRes.data;

    const itemsRes = await directusFetch<{ data: RawItem[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${header.doc_no}"}}&fields=*,product_id.product_id,product_id.product_name,product_id.product_code,product_id.cost_per_unit,product_id.price_per_unit,product_id.unit_of_measurement.unit_name,product_id.unit_of_measurement.order,product_id.product_brand.brand_name,product_id.product_category.category_name,product_id.barcode,product_id.description,unit_id.unit_name&limit=-1`
    );
    const items = (itemsRes.data || []).map((item: RawItem) => {
      const cost = item.cost_per_unit || item.product_id?.cost_per_unit || item.product_id?.price_per_unit || 0;
      return {
        ...item,
        product_name: item.product_id?.product_name,
        product_code: item.product_id?.product_code,
        cost_per_unit: cost,
        unit_name: item.unit_id?.unit_name || item.product_id?.unit_of_measurement?.unit_name || item.unit_name || "pcs",
        brand_name: item.product_id?.product_brand?.brand_name || item.brand_name || "N/A",
        category_name: item.product_id?.product_category?.category_name || "N/A"
      };
    });

    const productIds = items
      .map((item: RawItem) => {
        const p = item.product_id;
        if (typeof p === 'object' && p !== null) return p.product_id || p.id;
        return p;
      })
      .filter((pid): pid is number => typeof pid === 'number' || (typeof pid === 'string' && !isNaN(Number(pid))));

    if (productIds.length > 0) {
      try {
        const ppsRes = await directusFetch<{ data: PPSData[] }>(
          `${DIRECTUS_URL}/items/product_per_supplier?filter={"product_id":{"_in":${JSON.stringify(productIds)}}}&fields=product_id,supplier_id&limit=-1`
        );
        const ppsData: PPSData[] = ppsRes.data || [];
        const productToSupplierMap = new Map<number, number>();
        ppsData.forEach((pps: PPSData) => {
          const pId = typeof pps.product_id === 'object' ? pps.product_id.id : pps.product_id;
          const sId = typeof pps.supplier_id === 'object' ? pps.supplier_id.id : pps.supplier_id;
          if (pId && sId && !productToSupplierMap.has(Number(pId))) {
            productToSupplierMap.set(Number(pId), Number(sId));
          }
        });

        items.forEach((item: RawItem) => {
          const pId = Number(typeof item.product_id === 'object' ? (item.product_id?.product_id || item.product_id?.id) : item.product_id);
          if (productToSupplierMap.has(pId)) {
            item.inferred_supplier_id = productToSupplierMap.get(pId);
          }
        });
      } catch (err) {
        console.error("Error inferring suppliers:", err);
      }
    }

    const totalAmount = items.reduce((sum: number, item: RawItem) => {
      return sum + ((item.quantity || 0) * (item.cost_per_unit || 0));
    }, 0);

    // Resolve supplier from remarks metadata
    let supplierId: number | null = null;
    let cleanedRemarks = String(header.remarks || "").trim();
    const match = cleanedRemarks.match(/\[SUPPLIER_ID:\s*(\d+)\]/);
    if (match) {
      supplierId = Number(match[1]);
      cleanedRemarks = cleanedRemarks.replace(/\s*\[SUPPLIER_ID:\s*(\d+)\]/g, "").trim();
    }

    let resolvedSupplier: { id: number; supplier_name: string } | null = null;
    if (supplierId) {
      try {
        const sRes = await directusFetch<{ data: { id: number; supplier_name: string } }>(
          `${DIRECTUS_URL}/items/suppliers/${supplierId}?fields=id,supplier_name`
        );
        if (sRes.data) {
          resolvedSupplier = { id: Number(sRes.data.id), supplier_name: sRes.data.supplier_name };
        }
      } catch (err) {
        console.error("Failed to fetch resolved supplier in fetchById:", err);
      }
    }

    if (!resolvedSupplier && items.length > 0) {
      // Fallback: try legacy inference
      const firstWithInferred = items.find(item => item.inferred_supplier_id);
      if (firstWithInferred && firstWithInferred.inferred_supplier_id) {
        try {
          const sRes = await directusFetch<{ data: { id: number; supplier_name: string } }>(
            `${DIRECTUS_URL}/items/suppliers/${firstWithInferred.inferred_supplier_id}?fields=id,supplier_name`
          );
          if (sRes.data) {
            resolvedSupplier = { id: Number(sRes.data.id), supplier_name: sRes.data.supplier_name };
          }
        } catch (err) {
          console.error("Failed to fetch legacy inferred supplier in fetchById:", err);
        }
      }
    }

    const itemIds = items.map((i: RawItem) => i.id).filter(Boolean) as number[];
    let allSerialNumbers: SerialItem[] = [];
    if (itemIds.length > 0) {
      try {
        const serialRes = await directusFetch<{ data: SerialItem[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_serial?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&limit=-1`
        );
        allSerialNumbers = serialRes.data || [];
      } catch (err) {
        console.error("Error fetching serial numbers for items:", err);
      }
    }

    const itemsWithSerials = items.map((item: RawItem) => {
      const itemSerials = allSerialNumbers
        .filter((t: SerialItem) => t.stock_adjustment_id === item.id)
        .map((t: SerialItem) => t.serial_number);
      return {
        ...item,
        serial_numbers: itemSerials,
        serial_count: itemSerials.length
      };
    });

    let attachments: RawAttachment[] = [];
    try {
      if (itemIds.length > 0) {
        const attachmentsRes = await directusFetch<{ data: RawAttachment[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_attachment?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&limit=-1`
        );
        attachments = attachmentsRes.data || [];

        const fileIds = attachments.map(a => typeof a.attachment === 'string' ? a.attachment : null).filter(Boolean);
        if (fileIds.length > 0) {
          try {
            const filesRes = await directusFetch<{ data: RawFile[] }>(
              `${DIRECTUS_URL}/files?filter={"id":{"_in":${JSON.stringify(fileIds)}}}&fields=id,type,filename_download,filesize`
            );
            const filesMap = new Map((filesRes.data || []).map(f => [f.id, f]));
            attachments = attachments.map(a => ({
              ...a,
              attachment: filesMap.get(a.attachment as string) || a.attachment
            }));
          } catch (fileErr) {
            console.warn("Failed to fetch file metadata:", fileErr);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch stock adjustment attachments:", err);
    }

    return {
      ...header,
      remarks: cleanedRemarks,
      items: itemsWithSerials,
      amount: totalAmount > 0 ? totalAmount : (Number(header.amount) || 0),
      supplier_id: resolvedSupplier as unknown,
      stock_adjustment_attachment: attachments,
    } as unknown as StockAdjustmentDetail;
  },

  async fetchProductInventory(productId: number, branchId: number, token: string): Promise<number> {
    try {
      const url = `${SPRING_API_URL}/api/view-running-inventory/all?branch_id=${branchId}`;

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) return 0;

      const data = await res.json();
      if (Array.isArray(data)) {
        const item = data.find((item: InventoryItem) => item.product_id === productId);
        return item ? (item.running_inventory || 0) : 0;
      }
      return 0;
    } catch (error) {
      console.error("Failed to fetch product inventory:", error);
      return 0;
    }
  },

  async fetchBranchInventory(branchId: number, token: string): Promise<{ product_id: number; running_inventory: number }[]> {
    try {
      const url = `${SPRING_API_URL}/api/view-running-inventory/all?branch_id=${branchId}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: InventoryItem) => ({
          product_id: Number(item.product_id),
          running_inventory: Number(item.running_inventory || 0),
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch branch inventory:", error);
      return [];
    }
  },

  async fetchBranchSerialStatus(branchId: number, token: string): Promise<SerialStatusItem[]> {
    try {
      const url = `${SPRING_API_URL}/api/v-serial-onhand/all?branchId=${branchId}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (error) {
      console.error("Failed to fetch branch serial status:", error);
      return [];
    }
  },

  async checkSerialStatus(productId: number, branchId: number, token: string): Promise<SerialStatusItem | null> {
    try {
      const url = `${SPRING_API_URL}/api/v-serial-onhand/all?branchId=${branchId}`;

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) return null;

      const data = await res.json();
      if (Array.isArray(data)) {
        return data.find((item: SerialStatusItem) => item.productId === productId) || null;
      }
      return null;
    } catch (error) {
      console.error("Failed to check serial status:", error);
      return null;
    }
  },

  async fetchLastSerialNumber(productId: number, token: string, branchId?: number): Promise<string | null> {
    try {
      const latestSerials: string[] = [];

      // 1. Check Spring API (Inventory On Hand)
      const springUrl = new URL(`${SPRING_API_URL}/api/v-serial-onhand/all`);
      springUrl.searchParams.set("productId", String(productId));
      if (branchId) springUrl.searchParams.set("branchId", String(branchId));

      const springRes = await fetch(springUrl.toString(), {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (springRes.ok) {
        const data = await springRes.json();
        if (Array.isArray(data)) {
          data.forEach(item => {
            const s = item.serialNumber || item.serial_number;
            if (s) latestSerials.push(String(s));
          });
        }
      }

      // 2. Check Directus Historical Records
      try {
        const collections = ["stock_adjustment_serial"];
        for (const coll of collections) {
          const res = await directusFetch<{ data: Record<string, unknown>[] }>(
            `${DIRECTUS_URL}/items/${coll}?fields=serial_number&sort=-serial_number&limit=1`
          );
          if (res.data?.[0]?.serial_number) {
            latestSerials.push(String(res.data[0].serial_number));
          }
        }
      } catch {
        // Silently fail historical check
      }

      if (latestSerials.length > 0) {
        const sorted = latestSerials.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        return sorted[0];
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch last serial number:", err);
      return null;
    }
  },

  async checkSerialExists(serial: string, token: string, branchId?: number): Promise<{ exists: boolean; location?: string; productId?: number }> {
    try {
      // 1. Check Spring API (Inventory On Hand)
      const springUrl = new URL(`${SPRING_API_URL}/api/v-serial-onhand/all`);
      springUrl.searchParams.set("serialNumber", serial);
      if (branchId) springUrl.searchParams.set("branchId", String(branchId));

      const springRes = await fetch(springUrl.toString(), {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (springRes.ok) {
        const data = await springRes.json();
        const results = Array.isArray(data) ? data : [data];

        // MANUALLY FILTER to ensure exact match
        const exactMatch = results.find(item =>
          String(item.serialNumber || item.serial_number).toUpperCase() === serial.toUpperCase()
        );

        if (exactMatch) {
          const locationName = exactMatch.branch_name || "Inventory";
          return { exists: true, location: locationName, productId: Number(exactMatch.productId || exactMatch.product_id) };
        }
      }

      // 2. Check Directus Historical Records (Cross-Module)
      const collections = [
        { name: "stock_adjustment_serial", label: "Stock Adjustment" },
        { name: "rts_item_serial", label: "Return to Supplier" },
        { name: "sales_return_serial", label: "Sales Return" }
      ];

      const historicalChecks = await Promise.all(
        collections.map(async (coll) => {
          try {
            const res = await directusFetch<{ data: unknown[] }>(
              `${DIRECTUS_URL}/items/${coll.name}?filter={"serial_number":{"_eq":"${serial}"}}&fields=id&limit=1`
            );
            return { name: coll.label, exists: res.data && res.data.length > 0 };
          } catch (e) {
            console.warn(`Failed to check historical serial in ${coll.name}:`, e);
            return { name: coll.label, exists: false };
          }
        })
      );

      const found = historicalChecks.find(c => c.exists);
      if (found) {
        return { exists: true, location: `Registered in ${found.name}` };
      }

      return { exists: false };
    } catch (error) {
      console.error("Failed to check serial availability:", error);
      return { exists: false };
    }
  },

  /**
   * Validate serial number for Stock In and Stock Out adjustments
   */
  async validateSerialForAdjustment(params: {
    serial: string;
    token: string;
    branchId?: number;
    productId?: number;
    type: "IN" | "OUT";
  }): Promise<{ exists: boolean; location?: string; productId?: number; isBlocked?: boolean; errorMsg?: string }> {
    const { serial, token, branchId, productId, type } = params;
    const cleanSerial = serial.trim().toUpperCase();

    try {
      // 1. Check if present in v_serial_onhand using filter endpoint (case-insensitive checks)
      let onHand = false;
      let onHandProdId: number | undefined = undefined;
      let onHandBranch: string | undefined = undefined;

      const checkOnHand = async (searchSerial: string) => {
        const filterUrl = new URL(`${SPRING_API_URL}/api/v-serial-onhand/filter`);
        filterUrl.searchParams.set("serialNumber", searchSerial);
        if (branchId) filterUrl.searchParams.set("branchId", String(branchId));
        if (productId) filterUrl.searchParams.set("productId", String(productId));

        const springRes = await fetch(filterUrl.toString(), {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (springRes.ok) {
          const data = await springRes.json();
          const results = Array.isArray(data)
            ? data
            : (data && typeof data === "object")
              ? Array.isArray(data.v_serial_onhand)
                ? data.v_serial_onhand
                : Array.isArray(data.content)
                  ? data.content
                  : Array.isArray(data.data)
                    ? data.data
                    : [data]
              : [];

          // Define typed interface for items in v_serial_onhand to resolve lint errors
          interface SerialOnHandItem {
            serialNumber?: string;
            serial_number?: string;
            productId?: string | number;
            product_id?: string | number;
            branch_name?: string;
            branch_id?: string | number;
          }

          const exactMatch = (results as SerialOnHandItem[]).find((item) =>
            String(item.serialNumber || item.serial_number || "").toUpperCase() === cleanSerial
          );

          if (exactMatch) {
            onHand = true;
            onHandProdId = Number(exactMatch.productId || exactMatch.product_id);
            onHandBranch = exactMatch.branch_name || (exactMatch.branch_id ? `Branch #${exactMatch.branch_id}` : "Inventory");
            return true;
          }
        }
        return false;
      };

      // Try original (all-caps format)
      await checkOnHand(cleanSerial);
      // Fallback: try lowercase format
      if (!onHand) {
        await checkOnHand(serial.trim().toLowerCase());
      }

      // 2. Check if present in cylinder_assets (case-insensitive query using OR)
      // Typed product_id specifically instead of 'any' to fix lint errors
      const assetRes = await directusFetch<{ data: Array<{ id: number; cylinder_status?: string; product_id?: number | { id: number } | null; serial_number?: string }> }>(
        `${DIRECTUS_URL}/items/cylinder_assets?filter={"_or":[{"serial_number":{"_eq":"${serial.trim().toUpperCase()}"}},{"serial_number":{"_eq":"${serial.trim().toLowerCase()}"}}]}&fields=id,cylinder_status,product_id,serial_number`
      );
      
      const asset = assetRes.data?.find((a) =>
        String(a.serial_number || "").toUpperCase() === cleanSerial
      );

      if (type === "IN") {
        // STOCK IN validation:
        // "if the serial is present on v_serial_onhand and present on cylinder_assets and/or its cylinder_assets.cylinder_status = 'WITH_CUSTOMER' dont accept it"
        if (onHand) {
          return {
            exists: true,
            isBlocked: true,
            errorMsg: `Serial "${serial}" is already present on-hand in ${onHandBranch}.`,
            productId: onHandProdId
          };
        }

        if (asset && asset.cylinder_status === "WITH_CUSTOMER") {
          const pId = typeof asset.product_id === "object" ? asset.product_id?.id : asset.product_id;
          return {
            exists: true,
            isBlocked: true,
            errorMsg: `Serial "${serial}" is currently WITH_CUSTOMER and cannot be adjusted in.`,
            productId: pId ? Number(pId) : undefined
          };
        }

        if (asset) {
          const pId = typeof asset.product_id === "object" ? asset.product_id?.id : asset.product_id;
          return {
            exists: true,
            productId: pId ? Number(pId) : undefined,
            location: `Registered in Cylinder Assets (${asset.cylinder_status})`
          };
        }

        // If it does not exist anywhere, it is unregistered
        return { exists: false };
      } else {
        // STOCK OUT validation:
        // "the serial should be present on the v_serial_onhand if not open register modal and register the serial"
        if (onHand) {
          return {
            exists: true,
            productId: onHandProdId,
            location: onHandBranch
          };
        }

        // Not present on hand
        return {
          exists: false,
          location: `Serial "${serial}" is not on-hand in this branch.`
        };
      }
    } catch (err) {
      console.error("Failed validation check for serial:", err);
      return { exists: false };
    }
  },

  /**
   * Create a new Stock Adjustment (Header + Items)
   */
  async create(payload: { header: Record<string, unknown>; items: StockAdjustmentItem[]; userId?: number }) {
    const { header, items } = payload;

    let finalRemarks = String(header.remarks || "").trim();
    // Clean any existing supplier tags to be safe
    finalRemarks = finalRemarks.replace(/\s*\[SUPPLIER_ID:\s*(\d+)\]/g, "").trim();
    if (header.supplier_id) {
      finalRemarks = `${finalRemarks}\n[SUPPLIER_ID: ${header.supplier_id}]`.trim();
    }

    const headerRes = await directusFetch<{ data: { id: number } }>(`${DIRECTUS_URL}/items/stock_adjustment_header`, {
      method: "POST",
      body: JSON.stringify({
        doc_no: header.doc_no,
        branch_id: header.branch_id,
        supplier_id: header.supplier_id,
        type: header.type,
        remarks: finalRemarks,
        amount: header.amount || items.reduce((acc: number, item: StockAdjustmentItem) => acc + (item.quantity * (item.cost_per_unit || 0)), 0),
        isPosted: 0,
        created_by: payload.userId,
      }),
    });
    const headerId = headerRes.data.id;

    const itemsPayload = items.map((item: StockAdjustmentItem) => ({
      doc_no: header.doc_no,
      stock_adjustment_id: headerId,
      product_id: Number(item.product_id),
      branch_id: Number(header.branch_id),
      type: header.type,
      quantity: Number(item.quantity),
      remarks: item.remarks,
      unit_id: item.unit_id ? Number(item.unit_id) : null,
      created_by: payload.userId
    }));

    const itemsRes = await directusFetch<{ data: Array<{ id: number }> | { id: number } }>(`${DIRECTUS_URL}/items/stock_adjustment`, {
      method: "POST",
      body: JSON.stringify(itemsPayload),
    });
    const createdItems = Array.isArray(itemsRes.data) ? itemsRes.data : [itemsRes.data];

    const serialPayload: { serial_number: string; stock_adjustment_id: number; created_by?: number }[] = [];
    items.forEach((item: StockAdjustmentItem, index: number) => {
      if (item.serial_numbers && Array.isArray(item.serial_numbers) && createdItems[index]) {
        const itemId = createdItems[index].id;
        item.serial_numbers.forEach((serial: string) => {
          serialPayload.push({
            serial_number: serial,
            stock_adjustment_id: itemId,
            created_by: payload.userId
          });
        });
      }
    });

    if (serialPayload.length > 0) {
      await directusFetch<{ data: unknown }>(`${DIRECTUS_URL}/items/stock_adjustment_serial`, {
        method: "POST",
        body: JSON.stringify(serialPayload),
      });
    }

    if (header.stock_adjustment_attachment && Array.isArray(header.stock_adjustment_attachment) && (header.stock_adjustment_attachment as StockAdjustmentAttachment[]).length > 0) {
      const firstItemId = createdItems[0]?.id;
      if (firstItemId) {
        const atts = (header.stock_adjustment_attachment as StockAdjustmentAttachment[]).map((att: StockAdjustmentAttachment) => ({
          stock_adjustment_id: firstItemId,
          attachment: typeof att.attachment === 'object' ? (att.attachment as { id?: string | number }).id : att.attachment,
          created_by: payload.userId
        }));
        await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_attachment`, {
          method: "POST",
          body: JSON.stringify(atts),
        }).catch(err => console.error("Failed to save attachments:", err));
      } else {
        console.warn("No item id returned — attachments could not be linked.");
      }
    }

    return headerRes.data;
  },

  /**
   * Update an existing Stock Adjustment
   */
  async update(id: number, payload: { header: Record<string, unknown>; items: StockAdjustmentItem[]; userId?: number }) {
    let finalRemarks = String(payload.header.remarks || "").trim();
    finalRemarks = finalRemarks.replace(/\s*\[SUPPLIER_ID:\s*(\d+)\]/g, "").trim();
    if (payload.header.supplier_id) {
      finalRemarks = `${finalRemarks}\n[SUPPLIER_ID: ${payload.header.supplier_id}]`.trim();
    }

    const headerPayload = {
      doc_no: payload.header.doc_no,
      type: payload.header.type,
      branch_id: Number(payload.header.branch_id),
      remarks: finalRemarks,
      supplier_id: payload.header.supplier_id ? Number(payload.header.supplier_id) : null,
      amount: Number(payload.header.amount),
    };

    await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}`, {
      method: "PATCH",
      body: JSON.stringify(headerPayload),
    });

    const docNo = payload.header.doc_no;
    const existingItemsRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${docNo}"}}&fields=id`
    );
    const itemIds = existingItemsRes.data.map((i: { id: number }) => i.id);

    if (itemIds.length > 0) {
      // Delete old attachments first using old item IDs
      try {
        const existingAttRes = await directusFetch<{ data: { id: number }[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_attachment?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&fields=id&limit=-1`
        );
        const attIds = existingAttRes.data.map(a => a.id);
        if (attIds.length > 0) {
          await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_attachment`, {
            method: "DELETE",
            body: JSON.stringify(attIds),
          });
        }
      } catch (err) {
        console.warn("Failed to delete old attachments during update:", err);
      }

      // First delete associated serials
      try {
        const existingSerialsRes = await directusFetch<{ data: { id: number }[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_serial?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&fields=id&limit=-1`
        );
        const serialIds = existingSerialsRes.data.map(s => s.id);
        if (serialIds.length > 0) {
          await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_serial`, {
            method: "DELETE",
            body: JSON.stringify(serialIds)
          });
        }
      } catch (err) {
        console.warn("Failed to delete serial numbers during update:", err);
      }

      await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment`, {
        method: "DELETE",
        body: JSON.stringify(itemIds),
      });
    }

    const itemsPayload = payload.items.map((item: StockAdjustmentItem) => ({
      doc_no: payload.header.doc_no,
      stock_adjustment_id: id,
      product_id: Number(item.product_id),
      branch_id: Number(payload.header.branch_id),
      type: payload.header.type,
      quantity: Number(item.quantity),
      remarks: item.remarks,
      unit_id: item.unit_id ? Number(item.unit_id) : null,
      created_by: payload.userId
    }));

    const itemsRes = await directusFetch<{ data: Array<{ id: number }> | { id: number } }>(`${DIRECTUS_URL}/items/stock_adjustment`, {
      method: "POST",
      body: JSON.stringify(itemsPayload),
    });
    const createdItems = Array.isArray(itemsRes.data) ? itemsRes.data : [itemsRes.data];

    const serialPayload: { serial_number: string; stock_adjustment_id: number; created_by?: number }[] = [];
    payload.items.forEach((item: StockAdjustmentItem, index: number) => {
      if (item.serial_numbers && Array.isArray(item.serial_numbers) && createdItems[index]) {
        const itemId = createdItems[index].id;
        item.serial_numbers.forEach((serial: string) => {
          serialPayload.push({
            serial_number: serial,
            stock_adjustment_id: itemId,
            created_by: payload.userId
          });
        });
      }
    });

    if (serialPayload.length > 0) {
      await directusFetch<{ data: unknown }>(`${DIRECTUS_URL}/items/stock_adjustment_serial`, {
        method: "POST",
        body: JSON.stringify(serialPayload),
      });
    }

    // Save new attachments linked to first new item's id
    if (payload.header.stock_adjustment_attachment && Array.isArray(payload.header.stock_adjustment_attachment) && (payload.header.stock_adjustment_attachment as StockAdjustmentAttachment[]).length > 0) {
      const firstItemId = createdItems[0]?.id;
      if (firstItemId) {
        const atts = (payload.header.stock_adjustment_attachment as StockAdjustmentAttachment[]).map((att: StockAdjustmentAttachment) => ({
          stock_adjustment_id: firstItemId,
          attachment: typeof att.attachment === 'object' ? (att.attachment as { id?: string | number }).id : att.attachment,
          created_by: payload.userId
        }));
        await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_attachment`, {
          method: "POST",
          body: JSON.stringify(atts),
        }).catch(err => console.error("Failed to update attachments:", err));
      } else {
        console.warn("No item id returned on update — attachments could not be linked.");
      }
    }

    return { success: true };
  },

  /**
   * Post (finalize) a Stock Adjustment (promoting cylinder drafts to assets)
   */
  async postStockAdjustment(id: number, userId?: number) {
    try {
      const headerRes = await directusFetch<{ data: { doc_no: string } }>(
        `${DIRECTUS_URL}/items/stock_adjustment_header/${id}?fields=doc_no`
      );
      const docNo = headerRes.data?.doc_no;

      if (docNo) {
        const itemsRes = await directusFetch<{
          data: Array<{
            id: number;
            product_id: number | {
              product_id: number;
              unit_of_measurement?: { unit_name?: string } | null;
            };
            unit_id?: { unit_name?: string } | null;
          }>;
        }>(
          `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${docNo}"}}&fields=id,product_id.product_id,product_id.unit_of_measurement.unit_name,unit_id.unit_name&limit=-1`
        );

        const productUomMap = new Map<number, string>();
        const itemIds = (itemsRes.data || []).map((item) => {
          const isProductObject = typeof item.product_id === "object" && item.product_id !== null;
          const pId = isProductObject
            ? Number((item.product_id as { product_id: number }).product_id)
            : Number(item.product_id);
          const productUom = isProductObject
            ? (item.product_id as { unit_of_measurement?: { unit_name?: string } | null }).unit_of_measurement?.unit_name
            : "";
          const uom = String(item.unit_id?.unit_name || productUom || "").toUpperCase();
          if (pId && uom) {
            productUomMap.set(pId, uom);
          }
          return item.id;
        });

        if (itemIds.length > 0) {
          // Fetch dynamic units from Directus
          const unitsRes = await directusFetch<{ data: { unit_id: number; unit_name: string; unit_shortcut: string }[] }>(
            `${DIRECTUS_URL}/items/units?fields=unit_id,unit_name,unit_shortcut&limit=-1`
          );
          const unitsList = unitsRes.data || [];
          const emptyUnit = unitsList.find(u => u.unit_name.toUpperCase() === "EMPTY" || u.unit_shortcut.toUpperCase() === "EMPTY");
          const emptyName = emptyUnit ? emptyUnit.unit_name.toUpperCase() : "EMPTY";

          const serialRes = await directusFetch<{ data: { serial_number: string }[] }>(
            `${DIRECTUS_URL}/items/stock_adjustment_serial?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&fields=serial_number&limit=-1`
          );
          const serials = (serialRes.data || []).map((s) => s.serial_number);

          if (serials.length > 0) {
            const draftRes = await directusFetch<{ data: DraftCylinder[] }>(
              `${DIRECTUS_URL}/items/cylinder_assets_draft?filter={"serial_number":{"_in":${JSON.stringify(serials)}}}&limit=-1`
            );
            const draftCylinders = draftRes.data || [];

            if (draftCylinders.length > 0) {
              const cylindersToInsert = draftCylinders.map((c) => {
                const pId = Number(c.product_id);
                const uom = productUomMap.get(pId);
                let finalStatus = (c.cylinder_status as string) || "AVAILABLE";
                if (uom) {
                  if (uom === emptyName) {
                    finalStatus = "EMPTY";
                  } else {
                    finalStatus = "AVAILABLE";
                  }
                }

                const postingDate = new Date().toISOString().split("T")[0];
                const copy: Record<string, unknown> = {};
                for (const key in c) {
                  if (key !== "id" && key !== "acquisition_date") {
                    copy[key] = c[key];
                  }
                }

                const record = {
                  ...copy,
                  cylinder_status: finalStatus,
                  acquisition_date: postingDate,
                };

                return record;
              });

              await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets`, {
                method: "POST",
                body: JSON.stringify(cylindersToInsert),
              });

              const draftIdsToDelete = draftCylinders.map((c) => c.id);
              await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets_draft`, {
                method: "DELETE",
                body: JSON.stringify(draftIdsToDelete),
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to promote draft cylinder assets during posting:", err);
      throw err;
    }

    const res = await directusFetch<{ data: unknown }>(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        isPosted: 1,
        posted_by: userId,
        postedAt: new Date().toISOString()
      }),
    });
    return res;
  },

  /**
   * Delete a draft Stock Adjustment
   */
  async deleteStockAdjustment(id: number) {
    const headerRes = await directusFetch<{ data: { doc_no: string, id: number } }>(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}?fields=doc_no,id`);
    const docNo = headerRes.data.doc_no;

    const itemsRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${docNo}"}}&fields=id`
    );
    const itemIds = itemsRes.data.map((i: { id: number }) => i.id);

    // Delete attachments using item IDs (FK references stock_adjustment.id)
    if (itemIds.length > 0) {
      try {
        const attRes = await directusFetch<{ data: { id: number }[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_attachment?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&fields=id&limit=-1`
        );
        const attIds = attRes.data.map(a => a.id);
        if (attIds.length > 0) {
          await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_attachment`, {
            method: "DELETE",
            body: JSON.stringify(attIds),
          });
        }
      } catch (err) {
        console.warn("Failed to delete attachments during stock adjustment deletion:", err);
      }
    }

    if (itemIds.length > 0) {
      await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment`, {
        method: "DELETE",
        body: JSON.stringify(itemIds),
      });

      // Delete associated serials
      try {
        const serialRes = await directusFetch<{ data: { id: number }[] }>(
          `${DIRECTUS_URL}/items/stock_adjustment_serial?filter={"stock_adjustment_id":{"_in":${JSON.stringify(itemIds)}}}&fields=id`
        );
        const serialIds = serialRes.data.map((i: { id: number }) => i.id);
        if (serialIds.length > 0) {
          await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_serial`, {
            method: "DELETE",
            body: JSON.stringify(serialIds),
          });
        }
      } catch (err) {
        console.warn("Failed to delete serial numbers during stock adjustment deletion:", err);
      }
    }

    await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Fetch all branches for the dropdown
   */
  async fetchBranches(params?: { divisionId?: number }) {
    let url = `${DIRECTUS_URL}/items/branches?fields=id,branch_name,branch_code&sort=branch_name&limit=-1`;
    if (params?.divisionId) {
      url += `&filter[division_id][_eq]=${params.divisionId}`;
    }
    const res = await directusFetch<{ data: { id: number; branch_name: string; branch_code: string }[] }>(url);
    return res.data;
  },

  /**
   * Fetch approved products (SKUs) for the dropdown
   */
  async fetchProducts(params?: { search?: string }) {
    let query = `fields=product_id,product_name,product_code,price_per_unit,cost_per_unit,barcode,description,unit_of_measurement.unit_name,unit_of_measurement.order,product_brand.brand_name&limit=100&sort=product_name`;

    const filters: Record<string, unknown> = {
      isActive: { _eq: 1 }
    };

    if (params?.search) {
      filters._or = [
        { product_name: { _icontains: params.search } },
        { product_code: { _icontains: params.search } },
        { barcode: { _icontains: params.search } }
      ];
    }

    query += `&filter=${JSON.stringify(filters)}`;

    const res = await directusFetch<{ data: unknown[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    const products = res.data || [];

    const excludedUnits = ['REFILL', 'OUTRIGHT', 'DEPOSIT', 'SWAP'];

    return products
      .filter((item: unknown) => {
        const p = item as Record<string, unknown>;
        const uom = p['unit_of_measurement'] as Record<string, unknown> | undefined;
        const unitName = typeof uom?.['unit_name'] === 'string' ? uom['unit_name'].toUpperCase() : '';
        const fallbackName = typeof p['unit_name'] === 'string' ? p['unit_name'].toUpperCase() : '';
        return !excludedUnits.includes(unitName) && !excludedUnits.includes(fallbackName);
      })
      .map((item: unknown) => {
      const p = item as Record<string, unknown>;
      const uom = p['unit_of_measurement'] as Record<string, unknown> | undefined;
      const brand = p['product_brand'] as Record<string, unknown> | undefined;

      return {
        ...p,
        id: p['product_id'],
        unit_name: uom?.['unit_name'] || p['unit_name'] || "pcs",
        unit_id: uom?.['unit_id'] || p['unit_id'] || null,
        brand_name: brand?.['brand_name'] || p['brand_name'] || "N/A"
      };
    }) as unknown as StockAdjustmentProduct[];
  },

  /**
   * Fetch active suppliers (nonBuy = 0) for the supplier dropdown.
   */
  async fetchSuppliers(divisionId?: number) {
    let url = `${DIRECTUS_URL}/items/suppliers?fields=id,supplier_name,supplier_shortcut,nonBuy,division_id&filter[nonBuy][_eq]=0&sort=supplier_name&limit=-1`;
    if (divisionId !== undefined) {
      url += `&filter[division_id][_eq]=${divisionId}`;
    }
    const res = await directusFetch<{ data: Array<{ id: number; supplier_name: string; supplier_shortcut: string }> }>(url);
    return res.data.map((s) => ({
      id: s.id,
      supplier_name: s.supplier_name,
      supplier_shortcut: s.supplier_shortcut,
    }));
  },

  /**
   * Fetch all available units (UoM)
   */
  async fetchUnits() {
    const res = await directusFetch<{ data: { unit_id: number; unit_name: string; unit_shortcut: string; order: number }[] }>(`${DIRECTUS_URL}/items/units?fields=unit_id,unit_name,unit_shortcut,order&sort=unit_name&limit=-1`);
    return res.data || [];
  },

  /**
   * Fetch products linked to a specific supplier via the
   * product_per_supplier junction table.
   */
  async fetchProductsBySupplier(supplierId: number, search?: string) {
    const ppsRes = await directusFetch<{ data: PPSData[] }>(
      `${DIRECTUS_URL}/items/product_per_supplier?filter[supplier_id][_eq]=${supplierId}&fields=product_id&limit=-1`
    );
    const supplierProductIds: number[] = (ppsRes.data || []).map((r) => {
      const pid = typeof r.product_id === 'object' ? (r.product_id as Record<string, unknown>)['id'] : r.product_id;
      return Number(pid);
    });

    if (supplierProductIds.length === 0) return [];

    const filters: Record<string, unknown> = {
      _and: [
        { isActive: { _eq: 1 } },
        {
          _or: [
            { product_id: { _in: supplierProductIds } },
            { parent_id: { _in: supplierProductIds } },
          ],
        },
      ],
    };

    if (search) {
      (filters._and as unknown[]).push({
        _or: [
          { product_name: { _icontains: search } },
          { product_code: { _icontains: search } },
          { barcode: { _icontains: search } },
        ],
      });
    }

    const query = `fields=product_id,product_name,product_code,price_per_unit,cost_per_unit,barcode,description,unit_of_measurement.unit_name,unit_of_measurement.order,product_brand.brand_name&limit=500&sort=product_name&filter=${JSON.stringify(filters)}`;
    const res = await directusFetch<{ data: unknown[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    const products = res.data || [];

    const excludedUnits = ['REFILL', 'OUTRIGHT', 'DEPOSIT', 'SWAP'];

    return products
      .filter((item: unknown) => {
        const p = item as Record<string, unknown>;
        const uom = p['unit_of_measurement'] as Record<string, unknown> | undefined;
        const unitName = typeof uom?.['unit_name'] === 'string' ? uom['unit_name'].toUpperCase() : '';
        const fallbackName = typeof p['unit_name'] === 'string' ? p['unit_name'].toUpperCase() : '';
        return !excludedUnits.includes(unitName) && !excludedUnits.includes(fallbackName);
      })
      .map((item: unknown) => {
      const p = item as Record<string, unknown>;
      const uom = p['unit_of_measurement'] as Record<string, unknown> | undefined;
      const brand = p['product_brand'] as Record<string, unknown> | undefined;

      return {
        ...p,
        id: p['product_id'],
        unit_name: uom?.['unit_name'] || p['unit_name'] || "pcs",
        unit_id: uom?.['unit_id'] || p['unit_id'] || null,
        brand_name: brand?.['brand_name'] || p['brand_name'] || "N/A",
      };
    }) as unknown as StockAdjustmentProduct[];
  },

  /**
   * Fetch the next available document number for a given adjustment type.
   */
  async fetchNextDocNo(type: "IN" | "OUT"): Promise<string> {
    const prefix = type === "IN" ? "SAIN-SERIAL" : "SAOUT-SERIAL";
    const year = new Date().getFullYear();
    const searchPrefix = `${prefix}-${year}-`;

    const res = await directusFetch<{ data: Array<{ doc_no: string }> }>(
      `${DIRECTUS_URL}/items/stock_adjustment_header?filter[doc_no][_starts_with]=${searchPrefix}&fields=doc_no&sort=-doc_no&limit=1`
    );

    const latest = res.data?.[0]?.doc_no;
    let nextNumber = 1;

    if (latest) {
      const parts = latest.split("-");
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    return `${searchPrefix}${nextNumber.toString().padStart(3, "0")}`;
  },

  async fetchProductById(productId: number): Promise<StockAdjustmentProduct | null> {
    try {
      const res = await directusFetch<{
        data: {
          product_id: number;
          product_name?: string | null;
          product_code?: string | null;
          price_per_unit?: number | null;
          cost_per_unit?: number | null;
          barcode?: string | null;
          description?: string | null;
          unit_of_measurement?: { unit_name?: string; order?: number; unit_id?: number } | null;
          product_brand?: { brand_name?: string } | null;
          unit_name?: string | null;
          unit_id?: number | null;
          brand_name?: string | null;
        };
      }>(
        `${DIRECTUS_URL}/items/products/${productId}?fields=product_id,product_name,product_code,price_per_unit,cost_per_unit,barcode,description,unit_of_measurement.unit_name,unit_of_measurement.order,product_brand.brand_name`
      );
      const p = res.data;
      if (!p) return null;
      const uom = p.unit_of_measurement;
      const brand = p.product_brand;
      return {
        ...p,
        id: p.product_id,
        unit_name: uom?.unit_name || p.unit_name || "pcs",
        unit_id: uom?.unit_id || p.unit_id || null,
        brand_name: brand?.brand_name || p.brand_name || "N/A"
      } as unknown as StockAdjustmentProduct;
    } catch (err) {
      console.error("Error fetching product by id:", err);
      return null;
    }
  }
};
