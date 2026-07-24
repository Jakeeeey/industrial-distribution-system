import {
  addMetrics,
  emptyMetrics,
} from "./cylinder-purchase-report.metrics";
import type {
  CylinderPurchaseRow,
  QuantityMetrics,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export const UNASSIGNED_CUSTOMER_KEY = "UNASSIGNED";
export const UNASSIGNED_CUSTOMER_LABEL = "Unassigned Customer";

export interface CustomerAccumulator extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  products: Map<number, ProductAccumulator>;
  branches: Map<number, BranchAccumulator>;
  salespeople: Map<number, SalespersonAccumulator>;
}

export interface ProductAccumulator extends QuantityMetrics {
  productId: number;
  productCode: string;
  productName: string;
  customerKeys: Set<string>;
}

export interface BranchAccumulator extends QuantityMetrics {
  branchId: number;
  branchCode: string;
  branchName: string;
  customerKeys: Set<string>;
  productIds: Set<number>;
}

export interface SalespersonAccumulator extends QuantityMetrics {
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
  customerKeys: Set<string>;
  productIds: Set<number>;
  customers: Map<string, SalespersonCustomerAccumulator>;
  products: Map<number, ProductAccumulator>;
  customerProducts: Map<string, SalespersonCustomerProductAccumulator>;
}

export interface SalespersonCustomerAccumulator extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  productIds: Set<number>;
}

export interface SalespersonCustomerProductAccumulator extends QuantityMetrics {
  key: string;
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  productId: number;
  productCode: string;
  productName: string;
}

function customerIdentity(row: CylinderPurchaseRow): {
  key: string;
  code: string | null;
  name: string;
} {
  if (row.customerCode === null) {
    return {
      key: UNASSIGNED_CUSTOMER_KEY,
      code: null,
      name: UNASSIGNED_CUSTOMER_LABEL,
    };
  }

  return {
    key: row.customerCode,
    code: row.customerCode,
    name: row.customerName ?? row.customerCode,
  };
}

function productAccumulator(row: CylinderPurchaseRow): ProductAccumulator {
  return {
    ...emptyMetrics(),
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    customerKeys: new Set(),
  };
}

function branchAccumulator(row: CylinderPurchaseRow): BranchAccumulator {
  return {
    ...emptyMetrics(),
    branchId: row.branchId,
    branchCode: row.branchCode,
    branchName: row.branchName,
    customerKeys: new Set(),
    productIds: new Set(),
  };
}

function salespersonAccumulator(row: CylinderPurchaseRow): SalespersonAccumulator {
  return {
    ...emptyMetrics(),
    salesmanId: row.salesmanId,
    salesmanCode: row.salesmanCode,
    salesmanName: row.salesmanName,
    customerKeys: new Set(),
    productIds: new Set(),
    customers: new Map(),
    products: new Map(),
    customerProducts: new Map(),
  };
}

export function accumulateProduct(
  products: Map<number, ProductAccumulator>,
  row: CylinderPurchaseRow,
  customerKey: string,
): void {
  const product = products.get(row.productId) ?? productAccumulator(row);
  addMetrics(product, row);
  product.customerKeys.add(customerKey);
  products.set(row.productId, product);
}

export function accumulateBranch(
  branches: Map<number, BranchAccumulator>,
  row: CylinderPurchaseRow,
  customerKey: string,
): void {
  const branch = branches.get(row.branchId) ?? branchAccumulator(row);
  addMetrics(branch, row);
  branch.customerKeys.add(customerKey);
  branch.productIds.add(row.productId);
  branches.set(row.branchId, branch);
}

export function accumulateSalesperson(
  salespeople: Map<number, SalespersonAccumulator>,
  row: CylinderPurchaseRow,
  customerKey: string,
): void {
  const salesperson =
    salespeople.get(row.salesmanId) ?? salespersonAccumulator(row);
  addMetrics(salesperson, row);
  salesperson.customerKeys.add(customerKey);
  salesperson.productIds.add(row.productId);
  const identity = customerIdentity(row);
  const customer = salesperson.customers.get(customerKey) ?? {
    ...emptyMetrics(),
    customerKey,
    customerCode: identity.code,
    customerName: identity.name,
    productIds: new Set<number>(),
  };
  addMetrics(customer, row);
  customer.productIds.add(row.productId);
  salesperson.customers.set(customerKey, customer);
  accumulateProduct(salesperson.products, row, customerKey);

  const customerProductKey = `${customerKey}::${row.productId}`;
  const customerProduct =
    salesperson.customerProducts.get(customerProductKey) ?? {
      ...emptyMetrics(),
      key: customerProductKey,
      customerKey,
      customerCode: identity.code,
      customerName: identity.name,
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
    };
  addMetrics(customerProduct, row);
  salesperson.customerProducts.set(customerProductKey, customerProduct);
  salespeople.set(row.salesmanId, salesperson);
}

export function accumulateCustomer(
  customers: Map<string, CustomerAccumulator>,
  row: CylinderPurchaseRow,
): string {
  const identity = customerIdentity(row);
  const customer = customers.get(identity.key) ?? {
    ...emptyMetrics(),
    customerKey: identity.key,
    customerCode: identity.code,
    customerName: identity.name,
    products: new Map<number, ProductAccumulator>(),
    branches: new Map<number, BranchAccumulator>(),
    salespeople: new Map<number, SalespersonAccumulator>(),
  };
  addMetrics(customer, row);
  accumulateProduct(customer.products, row, identity.key);
  accumulateBranch(customer.branches, row, identity.key);
  accumulateSalesperson(customer.salespeople, row, identity.key);
  customers.set(identity.key, customer);
  return identity.key;
}
