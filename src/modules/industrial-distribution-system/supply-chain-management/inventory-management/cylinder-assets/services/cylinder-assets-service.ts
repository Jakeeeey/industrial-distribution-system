import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/directus";
import { CylinderAsset } from "../types";

const DIRECTUS_URL = getDirectusBase();

export const cylinderAssetsService = {
  async fetchAll(params?: { search?: string; status?: string; branchId?: number; productId?: number; condition?: string; page?: number; limit?: number; sort?: string; serials?: string }) {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;
    const sort = params?.sort || "-id";

    // Change meta parameter from total_count to filter_count to fetch correct matching records count for pagination
    let query = `fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,acquisition_date,expiration_date,tare_weight,cost,remarks,created_date,created_by.user_fname,created_by.user_lname&sort=${sort}&limit=${limit}&offset=${offset}&meta=filter_count`;

    const filters: Record<string, unknown> = {};

    if (params?.branchId) filters.current_branch_id = { _eq: params.branchId };
    if (params?.status) filters.cylinder_status = { _eq: params.status };
    if (params?.productId) filters.product_id = { _eq: params.productId };
    if (params?.condition) filters.cylinder_condition = { _eq: params.condition };
    if (params?.search) {
      filters._or = [
        { serial_number: { _icontains: params.search } },
        { remarks: { _icontains: params.search } },
      ];
    }
    if (params?.serials) {
      const serialsList = params.serials.split(",");
      filters.serial_number = { _in: serialsList };
    }

    if (Object.keys(filters).length > 0) {
      query += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const res = await directusFetch<{ data: CylinderAsset[]; meta?: { filter_count?: number; total_count?: number } }>(`${DIRECTUS_URL}/items/cylinder_assets?${query}`);
    const assets = res.data;
    // Fallback to filter_count, then total_count, then data length
    const total = res.meta?.filter_count ?? res.meta?.total_count ?? assets.length;

    if (assets.length === 0) return { data: [], total: 0 };

    // Manual expansion of relationships to avoid "Invalid numeric value" query errors
    const productIds = Array.from(new Set(assets.map(a => a.product_id).filter(Boolean)));
    const branchIds = Array.from(new Set(assets.map(a => a.current_branch_id).filter(Boolean)));
    const customerCodes = Array.from(new Set(assets.map(a => a.current_customer_code).filter(Boolean)));

    let products: { product_id: number; product_name: string; product_code: string }[] = [];
    let branches: { id: number; branch_name: string }[] = [];
    let customers: { customer_code: string; customer_name: string }[] = [];

    if (productIds.length > 0) {
      const pRes = await directusFetch<{ data: { product_id: number; product_name: string; product_code: string; unit_of_measurement: number | null }[] }>(`${DIRECTUS_URL}/items/products?fields=product_id,product_name,product_code,unit_of_measurement&filter=${JSON.stringify({ product_id: { _in: productIds } })}`);
      products = pRes.data || [];
    }

    if (branchIds.length > 0) {
      const bRes = await directusFetch<{ data: { id: number; branch_name: string }[] }>(`${DIRECTUS_URL}/items/branches?fields=id,branch_name&filter=${JSON.stringify({ id: { _in: branchIds } })}`);
      branches = bRes.data || [];
    }

    if (customerCodes.length > 0) {
      const cRes = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(`${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter=${JSON.stringify({ customer_code: { _in: customerCodes } })}`);
      customers = cRes.data || [];
    }

    const data = assets.map(item => ({
      ...item,
      product: products.find(p => p.product_id === item.product_id),
      branch: branches.find(b => b.id === item.current_branch_id),
      customer: customers.find(c => c.customer_code === item.current_customer_code),
    })) as CylinderAsset[];

    return { data, total };
  },

  async create(payload: Partial<CylinderAsset>) {
    const res = await directusFetch<{ data: CylinderAsset }>(`${DIRECTUS_URL}/items/cylinder_assets`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async createBulk(payloads: Partial<CylinderAsset>[]) {
    const res = await directusFetch<{ data: CylinderAsset[] }>(`${DIRECTUS_URL}/items/cylinder_assets`, {
      method: "POST",
      body: JSON.stringify(payloads),
    });
    return res.data;
  },

  async update(id: number, payload: Partial<CylinderAsset>) {
    const res = await directusFetch<{ data: CylinderAsset }>(`${DIRECTUS_URL}/items/cylinder_assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async fetchSerializedProducts() {
    const filter = JSON.stringify({
      isActive: { _eq: 1 },
      is_serialized: { _eq: 1 },
      unit_of_measurement: { _in: [18, 23] }, // 18 = EMPTY, 23 = FULL
    });
    const query = `fields=product_id,product_name,product_code,unit_of_measurement&filter=${encodeURIComponent(filter)}&limit=-1&sort=product_name`;
    const res = await directusFetch<{ data: { product_id: number; product_name: string; product_code: string; unit_of_measurement: number | null }[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    return res.data;
  },

  async fetchCustomers(search?: string) {
    const filterObj: Record<string, unknown> = {
      isActive: { _eq: 1 }
    };

    if (search) {
      filterObj._or = [
        { customer_code: { _icontains: search } },
        { customer_name: { _icontains: search } },
      ];
    }

    const query = `fields=customer_code,customer_name&limit=100&sort=customer_name&filter=${encodeURIComponent(JSON.stringify(filterObj))}`;
    const res = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(`${DIRECTUS_URL}/items/customer?${query}`);
    return res.data;
  },

  async delete(id: number) {
    await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${id}`, {
      method: "DELETE",
    });
  }
};
