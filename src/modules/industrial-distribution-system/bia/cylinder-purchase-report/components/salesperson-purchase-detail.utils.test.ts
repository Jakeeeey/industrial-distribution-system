import assert from "node:assert/strict";
import test from "node:test";

import {
  filterCustomerProducts,
  selectSalespersonCustomer,
} from "./salesperson-purchase-detail.utils.ts";
import type { SalespersonCustomerProductPurchaseSummary } from "../types/cylinder-purchase-report.types.ts";

const purchase = (
  key: string,
  customerKey: string,
): SalespersonCustomerProductPurchaseSummary => ({
  key,
  customerKey,
  customerCode: customerKey,
  customerName: customerKey,
  productId: Number(key.split("::")[1]),
  productCode: key,
  productName: key,
  grossPurchasedQty: 1,
  returnedQty: 0,
  netPurchasedQty: 1,
  returnRate: 0,
});

test("selecting a customer targets the customer purchases tab", () => {
  assert.deepEqual(selectSalespersonCustomer("MAIN-32577"), {
    activeTab: "customer-products",
    selectedCustomerKey: "MAIN-32577",
  });
});

test("customer cylinder filtering keeps only the selected customer", () => {
  const rows = [
    purchase("MAIN-32577::11", "MAIN-32577"),
    purchase("MAIN-32577::50", "MAIN-32577"),
    purchase("MAIN-52502::11", "MAIN-52502"),
  ];

  assert.deepEqual(
    filterCustomerProducts(rows, "MAIN-32577").map((row) => row.key),
    ["MAIN-32577::11", "MAIN-32577::50"],
  );
  assert.equal(filterCustomerProducts(rows, null), rows);
});
