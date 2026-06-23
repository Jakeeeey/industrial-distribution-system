import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/directus";
import {
  LpgSite,
  SiteCylinder,
  ConsumptionBilling
} from "../types";

const DIRECTUS_URL = getDirectusBase();

export const lpgBillingService = {
  async fetchSitesByCustomer(customerCode: string) {
    const query = `filter[customer_code][_eq]=${customerCode}&filter[is_active][_eq]=1&sort=site_name`;
    const res = await directusFetch<{ data: LpgSite[] }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites?${query}`);
    return res.data;
  },

  async fetchCylindersBySite(siteId: number) {
    const query = `filter[lpg_site_id][_eq]=${siteId}&filter[site_cylinder_status][_eq]=CONNECTED&fields=*,asset.id,asset.serial_number,asset.tare_weight,asset.product_id,asset.product.product_id,asset.product.product_name,asset.product.product_code`;
    const res = await directusFetch<{ data: SiteCylinder[] }>(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders?${query}`);
    return res.data;
  },

  async fetchBillings(params?: { search?: string; status?: string; page?: number; limit?: number; sort?: string }) {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;
    const sort = params?.sort || "-id";

    let query = `fields=*,customer.customer_name,site.site_name&sort=${sort}&limit=${limit}&offset=${offset}&meta=total_count`;

    type FilterVal = { _eq?: string } | { _icontains?: string } | Array<Record<string, { _icontains: string }>>;
    const filters: Record<string, FilterVal> = {};
    if (params?.status) filters.status = { _eq: params.status };
    if (params?.search) {
      filters._or = [
        { billing_no: { _icontains: params.search } },
        { customer_code: { _icontains: params.search } },
        { "customer.customer_name": { _icontains: params.search } },
      ];
    }

    if (Object.keys(filters).length > 0) {
      query += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const res = await directusFetch<{ data: ConsumptionBilling[]; meta?: { total_count: number } }>(`${DIRECTUS_URL}/items/lpg_consumption_billing?${query}`);
    return {
      data: res.data,
      total: res.meta?.total_count || res.data.length
    };
  },

  async fetchBillingById(id: number) {
    const query = `fields=*,lines.*,lines.product.product_name,lines.product.product_code,customer.customer_name,site.site_name`;
    const res = await directusFetch<{ data: ConsumptionBilling }>(`${DIRECTUS_URL}/items/lpg_consumption_billing/${id}?${query}`);
    return res.data;
  },

  async createBilling(payload: Partial<ConsumptionBilling>) {
    // Directus handles nested creation if configured, but often it's safer to separate or use a custom endpoint
    // Here we assume standard Directus nested create for lines
    const res = await directusFetch<{ data: ConsumptionBilling }>(`${DIRECTUS_URL}/items/lpg_consumption_billing`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateBilling(id: number, payload: Partial<ConsumptionBilling>) {
    const res = await directusFetch<{ data: ConsumptionBilling }>(`${DIRECTUS_URL}/items/lpg_consumption_billing/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async deleteBilling(id: number) {
    await directusFetch(`${DIRECTUS_URL}/items/lpg_consumption_billing/${id}`, {
      method: "DELETE",
    });
  },

  async fetchCustomers(search?: string) {
    let query = `fields=customer_code,customer_name&filter[isActive][_eq]=1&limit=-1&sort=customer_name`;
    if (search) {
      const filter = {
        _or: [
          { customer_code: { _icontains: search } },
          { customer_name: { _icontains: search } },
        ],
      };
      query += `&filter=${encodeURIComponent(JSON.stringify(filter))}`;
    }
    const res = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(`${DIRECTUS_URL}/items/customer?${query}`);
    return res.data;
  },

  async fetchBranches() {
    const res = await directusFetch<{ data: { id: number; branch_name: string }[] }>(`${DIRECTUS_URL}/items/branches?fields=id,branch_name&filter[isActive][_eq]=1`);
    return res.data;
  },

  async fetchSalesmen() {
    const res = await directusFetch<{ data: { id: number; salesman_name: string }[] }>(`${DIRECTUS_URL}/items/salesman?fields=id,salesman_name&filter[isActive][_eq]=1`);
    return res.data;
  },

  async fetchSuppliers() {
    const res = await directusFetch<{ data: { id: number; supplier_name: string }[] }>(`${DIRECTUS_URL}/items/suppliers?fields=id,supplier_name&filter[isActive][_eq]=1`);
    return res.data;
  },

  async fetchOperations() {
    const res = await directusFetch<{ data: { id: number; operation_name: string }[] }>(`${DIRECTUS_URL}/items/operation?fields=id,operation_name`);
    return res.data;
  },

  async fetchInvoiceTypes() {
    const res = await directusFetch<{ data: { id: number; type_name: string }[] }>(`${DIRECTUS_URL}/items/sales_invoice_type?fields=id,type_name`);
    return res.data;
  }
};
