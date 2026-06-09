import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/directus";
import { LpgSite, SiteCylinder } from "../types";

export const lpgSiteService = {
  async fetchSites(params?: { search?: string; customer_code?: string; page?: number; limit?: number; sort?: string }) {
    const DIRECTUS_URL = getDirectusBase();
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;
    const sort = params?.sort || "-id";

    let query = `fields=*,customer.customer_name&sort=${sort}&limit=${limit}&offset=${offset}&meta=total_count`;

    type FilterValue = { _eq?: string | number } | { _icontains?: string } | Array<Record<string, { _icontains: string }>>;
    const filters: Record<string, FilterValue> = {
      is_active: { _eq: 1 }
    };

    if (params?.customer_code) {
      filters.customer_code = { _eq: params.customer_code };
    }

    if (params?.search) {
      filters._or = [
        { site_name: { _icontains: params.search } },
        { customer_code: { _icontains: params.search } },
        { "customer.customer_name": { _icontains: params.search } },
        { meter_no: { _icontains: params.search } },
      ];
    }

    query += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;

    const res = await directusFetch<{ data: LpgSite[]; meta?: { total_count: number } }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites?${query}`);
    const mappedData = (res.data ?? []).map(site => ({
      ...site,
      default_pressure_line: site.default_pressure_line ?? 2.0183,
      default_psi: site.default_psi ?? 10.0,
      default_atmospheric_pressure: site.default_atmospheric_pressure ?? 14.7,
    }));
    return {
      data: mappedData,
      total: res.meta?.total_count || mappedData.length
    };
  },

  async fetchSiteById(id: number) {
    const DIRECTUS_URL = getDirectusBase();
    // We fetch basic details; cylinders are handled by the SiteCylinderManager's own fetch
    const query = `fields=*,customer.customer_name`;
    const res = await directusFetch<{ data: LpgSite }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${id}?${query}`);
    if (res.data) {
      res.data.default_pressure_line = res.data.default_pressure_line ?? 2.0183;
      res.data.default_psi = res.data.default_psi ?? 10.0;
      res.data.default_atmospheric_pressure = res.data.default_atmospheric_pressure ?? 14.7;
    }
    return res.data;
  },

  async createSite(payload: Partial<LpgSite>) {
    const DIRECTUS_URL = getDirectusBase();
    const res = await directusFetch<{ data: LpgSite }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateSite(id: number, payload: Partial<LpgSite>) {
    const DIRECTUS_URL = getDirectusBase();
    const res = await directusFetch<{ data: LpgSite }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async deleteSite(id: number) {
    const DIRECTUS_URL = getDirectusBase();
    // Soft delete by setting is_active to false
    await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
  },

  async fetchCylindersAtSite(siteId: number) {
    const DIRECTUS_URL = getDirectusBase();
    // Use cylinder_asset_id.* to expand the relationship
    const query = `filter[lpg_site_id][_eq]=${siteId}&fields=*,cylinder_asset_id.*,cylinder_asset_id.product.*`;
    const res = await directusFetch<{ data: SiteCylinder[] }>(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders?${query}`);
    return res.data;
  },

  async installCylinder(payload: Partial<SiteCylinder>) {
    const DIRECTUS_URL = getDirectusBase();
    // 1. Create site cylinder record
    const res = await directusFetch<{ data: SiteCylinder }>(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        site_cylinder_status: payload.site_cylinder_status || 'CONNECTED',
        current_estimated_lpg_kg: payload.current_estimated_lpg_kg ?? payload.opening_lpg_kg,
        installed_date: payload.installed_date || new Date().toISOString().split('T')[0]
      }),
    });

    // 2. Update asset status to WITH_CUSTOMER
    if (payload.cylinder_asset_id) {
      await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${payload.cylinder_asset_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cylinder_status: 'WITH_CUSTOMER',
          current_customer_code: payload.customer_code
        }),
      });
    }

    return res.data;
  },

  async updateSiteCylinder(id: number, payload: Partial<SiteCylinder>) {
    const DIRECTUS_URL = getDirectusBase();
    const res = await directusFetch<{ data: SiteCylinder }>(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async removeCylinder(id: number, assetId: number, status: string = 'RETURNED') {
    const DIRECTUS_URL = getDirectusBase();
    // 1. Update site cylinder record
    await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        site_cylinder_status: status,
        removed_date: new Date().toISOString().split('T')[0]
      }),
    });

    // 2. Update asset status to AVAILABLE or as specified
    // In many cases, it goes to EMPTY if returned from customer
    await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({
        cylinder_status: status === 'RETURNED' ? 'EMPTY' : 'AVAILABLE',
        current_customer_code: null
      }),
    });
  },

  async fetchAvailableCylinders(search?: string, productId?: number) {
    const DIRECTUS_URL = getDirectusBase();
    type CylinderFilter = { _eq?: string | number } | { _icontains?: string };
    const filters: Record<string, CylinderFilter> = {
      cylinder_status: { _eq: "AVAILABLE" }
    };

    if (search) {
      filters.serial_number = { _icontains: search };
    }

    if (productId) {
      filters.product_id = { _eq: productId };
    }

    const query = `fields=id,serial_number,tare_weight,product.product_name&filter=${encodeURIComponent(JSON.stringify(filters))}&limit=100`;
    const res = await directusFetch<{ data: { id: number; serial_number: string; tare_weight?: number; product?: { product_name: string } }[] }>(`${DIRECTUS_URL}/items/cylinder_assets?${query}`);
    return res.data;
  },

  async fetchSerializedProducts(search?: string) {
    const DIRECTUS_URL = getDirectusBase();
    type ProductFilter = { _eq?: string | number } | { _icontains?: string };
    const filters: Record<string, ProductFilter> = {
      is_serialized: { _eq: 1 },
      isActive: { _eq: 1 }
    };

    if (search) {
      filters.product_name = { _icontains: search };
    }

    const query = `fields=product_id,product_name,product_code&filter=${encodeURIComponent(JSON.stringify(filters))}&limit=100`;
    const res = await directusFetch<{ data: { product_id: number; product_name: string; product_code: string }[] }>(`${DIRECTUS_URL}/items/products?${query}`);
    return res.data;
  },

  async fetchCustomers(search?: string) {
    const DIRECTUS_URL = getDirectusBase();
    let query = `fields=customer_code,customer_name,brgy,city,province&filter[isActive][_eq]=1&limit=-1&sort=customer_name`;
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
  }
};
