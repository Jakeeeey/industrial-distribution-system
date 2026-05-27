/** LPG Site Management Client Service - v1.1 */
import { LpgSite, SiteCylinder } from "../types";

export const lpgSiteService = {
  async fetchSites(params?: { search?: string; customer_code?: string; page?: number; limit?: number; sort?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.customer_code) query.append("customer_code", params.customer_code);
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.sort) query.append("sort", params.sort);

    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management?${query}`);
    return await res.json();
  },

  async fetchSiteById(id: number) {
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/${id}`);
    const d = await res.json();
    return d.data;
  },

  async createSite(payload: Partial<LpgSite>) {
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    return d.data;
  },

  async updateSite(id: number, payload: Partial<LpgSite>) {
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    return d.data;
  },

  async deleteSite(id: number) {
    await fetch(`/api/ids/scm/inventory-management/lpg-site-management/${id}`, {
      method: "DELETE",
    });
  },

  async fetchCylindersAtSite(siteId: number) {
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/cylinders?siteId=${siteId}`);
    const d = await res.json();
    return d.data;
  },

  async installCylinder(payload: Partial<SiteCylinder>) {
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/cylinders`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    return d.data;
  },

  async updateSiteCylinder(id: number, payload: Partial<SiteCylinder>) {
    // Not strictly implemented in API yet but follows pattern
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/cylinders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    return d.data;
  },

  async removeCylinder(id: number, assetId: number, status: string = 'RETURNED') {
    await fetch(`/api/ids/scm/inventory-management/lpg-site-management/cylinders?id=${id}&assetId=${assetId}&status=${status}`, {
      method: "DELETE",
    });
  },

  async fetchAvailableCylinders(search?: string, productId?: number) {
    const query = new URLSearchParams();
    if (search) query.append("search", search);
    if (productId) query.append("productId", productId.toString());
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/available-cylinders?${query}`);
    const d = await res.json();
    return d.data;
  },

  async fetchSerializedProducts(search?: string) {
    const query = new URLSearchParams();
    if (search) query.append("search", search);
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/products?${query}`);
    const d = await res.json();
    return d.data;
  },

  async fetchCustomers(search?: string) {
    const query = new URLSearchParams();
    if (search) query.append("search", search);
    const res = await fetch(`/api/ids/scm/inventory-management/lpg-site-management/customers?limit=-1,${query}`);
    const d = await res.json();
    return d.data;
  }
};
