import type { SalespersonCustomerProductPurchaseSummary } from "../types/cylinder-purchase-report.types";

export type SalespersonDetailTab =
  | "customers"
  | "products"
  | "customer-products";

export function selectSalespersonCustomer(customerKey: string): {
  activeTab: "customer-products";
  selectedCustomerKey: string;
} {
  return {
    activeTab: "customer-products",
    selectedCustomerKey: customerKey,
  };
}

export function filterCustomerProducts(
  rows: readonly SalespersonCustomerProductPurchaseSummary[],
  selectedCustomerKey: string | null,
): readonly SalespersonCustomerProductPurchaseSummary[] {
  if (selectedCustomerKey === null) {
    return rows;
  }

  return rows.filter((row) => row.customerKey === selectedCustomerKey);
}
