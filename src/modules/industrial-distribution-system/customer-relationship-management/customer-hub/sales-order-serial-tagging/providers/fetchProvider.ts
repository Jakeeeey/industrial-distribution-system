import { SalesOrderTaggingDetails, MappedSerial, CustomerAsset, SalesOrderListItem } from "../types";

export const fetchProvider = {
  async listOrders(): Promise<SalesOrderListItem[]> {
    const res = await fetch(`/api/ids/crm/customer-hub/sales-order-serial-tagging?action=list-orders`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch Sales Orders list (Status: ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  async getOrderDetails(orderId: string): Promise<SalesOrderTaggingDetails> {
    const res = await fetch(`/api/ids/crm/customer-hub/sales-order-serial-tagging?action=order-details&orderId=${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch Sales Order details (Status: ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  async getMappedSerials(orderId: string): Promise<MappedSerial[]> {
    const res = await fetch(`/api/ids/crm/customer-hub/sales-order-serial-tagging?action=mapped-serials&orderId=${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch consolidator mappings (Status: ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  async getCustomerAssets(customerCode: string): Promise<CustomerAsset[]> {
    const res = await fetch(`/api/ids/crm/customer-hub/sales-order-serial-tagging?action=customer-assets&customerCode=${encodeURIComponent(customerCode)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch customer cylinder assets (Status: ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  async saveTagging(
    orderId: number,
    customerCode: string,
    serials: { sales_order_detail_id: number; serial_number: string }[]
  ): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`/api/ids/crm/customer-hub/sales-order-serial-tagging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        customerCode,
        serials,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to tag cylinder serials (Status: ${res.status})`);
    }
    return await res.json();
  },
};
