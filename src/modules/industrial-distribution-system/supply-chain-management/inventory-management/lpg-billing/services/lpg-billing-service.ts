/**
 * Placeholder service for LPG Billing.
 * NOTE: This is a reconstructed placeholder to resolve compilation errors.
 * The actual logic should be implemented based on Directus collections.
 */
export const lpgBillingService = {
  async fetchBillings(_params: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return { data: [], total: 0 };
  },

  async createBilling(_payload: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return {};
  },

  async fetchBillingById(_id: number) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return {};
  },

  async updateBilling(_id: number, _payload: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return {};
  },

  async deleteBilling(_id: number) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return {};
  },

  async fetchCylindersBySite(_siteId: number) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return [];
  },

  async fetchSitesByCustomer(_customerCode: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return [];
  },

  async fetchSalesmen() {
    // Implementation placeholder
    return [];
  },

  async fetchCustomers(_search?: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Implementation placeholder
    return [];
  },

  async fetchBranches() {
    // Implementation placeholder
    return [];
  }
};
