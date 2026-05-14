import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import {
  StockAdjustmentHeader,
  StockAdjustmentDetail,
  StockAdjustmentItem,
  StockAdjustmentProduct,
} from "../types/stock-adjustment.schema";

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

    const filters: Record<string, unknown> = {};

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

    const docNos = headers.map(h => h.doc_no);
    const itemsRes = await directusFetch<{ data: RawItem[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_in":${JSON.stringify(docNos)}}}&fields=doc_no,quantity,product_id.price_per_unit,product_id.cost_per_unit,unit_id.unit_name&limit=-1`
    );
    const allItems = itemsRes.data || [];

    const itemsMap = new Map<string, RawItem[]>();
    allItems.forEach((item: RawItem) => {
      if (!itemsMap.has(item.doc_no)) itemsMap.set(item.doc_no, []);
      itemsMap.get(item.doc_no)!.push(item);
    });

    return headers.map(header => {
      const headerItems = itemsMap.get(header.doc_no) || [];
      const totalAmount = headerItems.reduce((sum: number, item: RawItem) => {
        const cost = item.product_id?.cost_per_unit || item.product_id?.price_per_unit || 0;
        return sum + ((item.quantity || 0) * cost);
      }, 0);

      return {
        ...header,
        items: headerItems,
        amount: totalAmount > 0 ? totalAmount : (Number(header.amount) || 0)
      };
    });
  },

  /**
   * Fetch a single stock adjustment with all its items and serial numbers
   */
  async fetchById(id: number): Promise<StockAdjustmentDetail> {
    const headerRes = await directusFetch<{ data: StockAdjustmentHeader }>(
      `${DIRECTUS_URL}/items/stock_adjustment_header/${id}?fields=*,branch_id.id,branch_id.branch_name,supplier_id.id,supplier_id.supplier_name,created_by.*,posted_by.*`
    );
    const header = headerRes.data;

    const itemsRes = await directusFetch<{ data: RawItem[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${header.doc_no}"}}&fields=*,product_id.product_id,product_id.product_name,product_id.product_code,product_id.cost_per_unit,product_id.price_per_unit,product_id.unit_of_measurement.unit_name,product_id.unit_of_measurement.order,product_id.product_brand.brand_name,product_id.product_category.category_name,product_id.barcode,product_id.description,product_id.is_serialized,unit_id.unit_name&limit=-1`
    );
    const items = (itemsRes.data || []).map((item: RawItem) => {
      const cost = item.cost_per_unit || item.product_id?.cost_per_unit || item.product_id?.price_per_unit || 0;
      return {
        ...item,
        product_name: item.product_id?.product_name,
        product_code: item.product_id?.product_code,
        is_serialized: item.product_id?.is_serialized || false,
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

    return {
      ...header,
      items: itemsWithSerials,
      amount: totalAmount > 0 ? totalAmount : (Number(header.amount) || 0),
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
        const collections = ["stock_adjustment_serial"]; // Only use verified collections
        for (const coll of collections) {
          const res = await directusFetch<{ data: Record<string, unknown>[] }>(
            `${DIRECTUS_URL}/items/${coll}?fields=serial_number&sort=-serial_number&limit=1`
          );
          if (res.data?.[0]?.serial_number) {
            latestSerials.push(String(res.data[0].serial_number));
          }
        }
      } catch {
        // Silently fail if historical fetch fails (e.g. permission issues)
      }

      if (latestSerials.length > 0) {
        // Sort all found serials and pick the highest one
        const sorted = latestSerials.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        return sorted[0];
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch last serial number:", err);
      return null;
    }
  },

  async checkSerialExists(serial: string, token: string, branchId?: number): Promise<{ exists: boolean; location?: string }> {
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
          return { exists: true, location: locationName };
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
   * Create a new Stock Adjustment (Header + Items)
   */
  async create(payload: { header: Record<string, unknown>; items: StockAdjustmentItem[]; userId?: number }) {
    const { header, items } = payload;

    const headerRes = await directusFetch<{ data: { id: number } }>(`${DIRECTUS_URL}/items/stock_adjustment_header`, {
      method: "POST",
      body: JSON.stringify({
        doc_no: header.doc_no,
        branch_id: header.branch_id,
        supplier_id: header.supplier_id,
        type: header.type,
        remarks: header.remarks,
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

    return headerRes.data;
  },

  /**
   * Update an existing Stock Adjustment
   */
  async update(id: number, payload: { header: Record<string, unknown>; items: StockAdjustmentItem[]; userId?: number }) {
    const headerPayload = {
      doc_no: payload.header.doc_no,
      type: payload.header.type,
      branch_id: Number(payload.header.branch_id),
      remarks: payload.header.remarks,
      supplier_id: payload.header.supplier_id ? Number(payload.header.supplier_id) : null,
      amount: Number(payload.header.amount),
    };

    await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}`, {
      method: "PATCH",
      body: JSON.stringify(headerPayload),
    });

    const existingItemsRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment?filter={"doc_no":{"_eq":"${payload.header.doc_no}"}}&fields=id`
    );
    const itemIds = existingItemsRes.data.map((i: { id: number }) => i.id);

    if (itemIds.length > 0) {
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

    return { success: true };
  },

  /**
   * Post (finalize) a Stock Adjustment
   */
  async postStockAdjustment(id: number, userId?: number) {
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
    if (itemIds.length > 0) {
      await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment`, {
        method: "DELETE",
        body: JSON.stringify(itemIds),
      });
    }

    const serialRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/stock_adjustment_serial?filter={"stock_adjustment_id":{"_eq":${id}}}&fields=id`
    );
    const serialIds = serialRes.data.map((i: { id: number }) => i.id);
    if (serialIds.length > 0) {
      await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_serial`, {
        method: "DELETE",
        body: JSON.stringify(serialIds),
      });
    }

    await directusFetch(`${DIRECTUS_URL}/items/stock_adjustment_header/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Fetch all branches for the dropdown
   */
  async fetchBranches() {
    const res = await directusFetch<{ data: { id: number; branch_name: string; branch_code: string }[] }>(`${DIRECTUS_URL}/items/branches?fields=id,branch_name,branch_code&sort=branch_name`);
    return res.data;
  },

  /**
   * Fetch approved products (SKUs) for the dropdown.
   * If supplierId is provided, it filters by product_per_supplier.
   */
  async fetchProducts(params?: { search?: string; supplierId?: number }) {
    let query = `fields=product_id,product_name,product_code,price_per_unit,cost_per_unit,barcode,description,is_serialized,unit_of_measurement.unit_name,unit_of_measurement.order,product_brand.brand_name&limit=100&sort=product_name`;

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

    if (params?.supplierId) {
      // Filter by supplier via product_per_supplier table
      try {
        const ppsRes = await directusFetch<{ data: { product_id: number | { id: number } }[] }>(
          `${DIRECTUS_URL}/items/product_per_supplier?filter={"supplier_id":{"_eq":${params.supplierId}}}&fields=product_id&limit=-1`
        );
        const productIds = (ppsRes.data || []).map(pps => 
          typeof pps.product_id === 'object' ? pps.product_id.id : pps.product_id
        ).filter(Boolean);

        if (productIds.length > 0) {
          filters.product_id = { _in: productIds };
        } else {
          // If no products found for this supplier, return empty list
          return [];
        }
      } catch (err) {
        console.error("Failed to fetch products for supplier:", err);
      }
    }

    query += `&filter=${JSON.stringify(filters)}`;

    const res = await directusFetch<{ data: unknown[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    const products = res.data || [];

    return products.map((item: unknown) => {
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
  async fetchSuppliers() {
    const res = await directusFetch<{ data: Array<{ id: number; supplier_name: string; supplier_shortcut: string; division_id: number | null }> }>(
      `${DIRECTUS_URL}/items/suppliers?fields=id,supplier_name,supplier_shortcut,nonBuy,division_id&filter[nonBuy][_eq]=0&filter[division_id][_eq]=1&sort=supplier_name&limit=-1`
    );
    return res.data.map((s) => ({
      id: s.id,
      supplier_name: s.supplier_name,
      supplier_shortcut: s.supplier_shortcut,
      division_id: s.division_id,
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

    const query = `fields=product_id,product_name,product_code,price_per_unit,cost_per_unit,barcode,description,is_serialized,unit_of_measurement.unit_name,unit_of_measurement.order,product_brand.brand_name&limit=500&sort=product_name&filter=${JSON.stringify(filters)}`;
    const res = await directusFetch<{ data: unknown[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    const products = res.data || [];

    return products.map((item: unknown) => {
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
    const prefix = type === "IN" ? "SAIN" : "SAOUT";
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

    // Format with padding: 001, 002, etc.
    return `${searchPrefix}${nextNumber.toString().padStart(3, "0")}`;
  },
};

