import type {
  BranchPurchaseSummary,
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseReportFilters,
  CylinderPurchaseRow,
  ProductPurchaseSummary,
  QuantityMetrics,
  ReturnAnalysisItem,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

const UNASSIGNED_CUSTOMER_KEY = "UNASSIGNED";
const UNASSIGNED_CUSTOMER_LABEL = "Unassigned Customer";

interface CustomerAccumulator extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  products: Map<number, ProductAccumulator>;
  branches: Map<number, BranchAccumulator>;
  salespeople: Map<number, SalespersonAccumulator>;
}

interface ProductAccumulator extends QuantityMetrics {
  productId: number;
  productCode: string;
  productName: string;
  customerKeys: Set<string>;
}

interface BranchAccumulator extends QuantityMetrics {
  branchId: number;
  branchCode: string;
  branchName: string;
  customerKeys: Set<string>;
  productIds: Set<number>;
}

interface SalespersonAccumulator extends QuantityMetrics {
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
  customerKeys: Set<string>;
  productIds: Set<number>;
}

interface RollingThirtyDayRange {
  startDate: string;
  endDate: string;
}

function emptyMetrics(): QuantityMetrics {
  return { grossPurchasedQty: 0, returnedQty: 0, netPurchasedQty: 0 };
}

function addMetrics(target: QuantityMetrics, row: QuantityMetrics): void {
  target.grossPurchasedQty += row.grossPurchasedQty;
  target.returnedQty += row.returnedQty;
  target.netPurchasedQty += row.netPurchasedQty;
}

function returnRate(metrics: QuantityMetrics): number {
  return metrics.grossPurchasedQty > 0
    ? metrics.returnedQty / metrics.grossPurchasedQty
    : 0;
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
  };
}

function accumulateProduct(
  products: Map<number, ProductAccumulator>,
  row: CylinderPurchaseRow,
  customerKey: string,
): void {
  const product = products.get(row.productId) ?? productAccumulator(row);
  addMetrics(product, row);
  product.customerKeys.add(customerKey);
  products.set(row.productId, product);
}

function accumulateBranch(
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

function accumulateSalesperson(
  salespeople: Map<number, SalespersonAccumulator>,
  row: CylinderPurchaseRow,
  customerKey: string,
): void {
  const salesperson =
    salespeople.get(row.salesmanId) ?? salespersonAccumulator(row);
  addMetrics(salesperson, row);
  salesperson.customerKeys.add(customerKey);
  salesperson.productIds.add(row.productId);
  salespeople.set(row.salesmanId, salesperson);
}

function accumulateCustomer(
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

function byRank<T extends QuantityMetrics>(
  displayName: (item: T) => string,
  identity: (item: T) => string | number,
): (left: T, right: T) => number {
  return (left, right) =>
    right.netPurchasedQty - left.netPurchasedQty ||
    displayName(left).localeCompare(displayName(right)) ||
    compareIdentity(identity(left), identity(right));
}

function compareIdentity(left: string | number, right: string | number): number {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));
}

function finalizeProducts(
  products: Map<number, ProductAccumulator>,
): ProductPurchaseSummary[] {
  return [...products.values()]
    .map((product) => ({
      grossPurchasedQty: product.grossPurchasedQty,
      returnedQty: product.returnedQty,
      netPurchasedQty: product.netPurchasedQty,
      productId: product.productId,
      productCode: product.productCode,
      productName: product.productName,
      returnRate: returnRate(product),
      uniqueCustomers: product.customerKeys.size,
    }))
    .sort(byRank((product) => product.productName, (product) => product.productId));
}

function finalizeBranches(
  branches: Map<number, BranchAccumulator>,
): BranchPurchaseSummary[] {
  return [...branches.values()]
    .map((branch) => ({
      grossPurchasedQty: branch.grossPurchasedQty,
      returnedQty: branch.returnedQty,
      netPurchasedQty: branch.netPurchasedQty,
      branchId: branch.branchId,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      returnRate: returnRate(branch),
      uniqueCustomers: branch.customerKeys.size,
      uniqueProducts: branch.productIds.size,
    }))
    .sort(byRank((branch) => branch.branchName, (branch) => branch.branchId));
}

function finalizeSalespeople(
  salespeople: Map<number, SalespersonAccumulator>,
): SalespersonPurchaseSummary[] {
  return [...salespeople.values()]
    .map((salesperson) => ({
      grossPurchasedQty: salesperson.grossPurchasedQty,
      returnedQty: salesperson.returnedQty,
      netPurchasedQty: salesperson.netPurchasedQty,
      salesmanId: salesperson.salesmanId,
      salesmanCode: salesperson.salesmanCode,
      salesmanName: salesperson.salesmanName,
      returnRate: returnRate(salesperson),
      uniqueCustomers: salesperson.customerKeys.size,
      uniqueProducts: salesperson.productIds.size,
    }))
    .sort(
      byRank(
        (salesperson) => salesperson.salesmanName,
        (salesperson) => salesperson.salesmanId,
      ),
    );
}

function finalizeCustomers(
  customers: Map<string, CustomerAccumulator>,
): CustomerPurchaseSummary[] {
  return [...customers.values()]
    .map((customer) => ({
      grossPurchasedQty: customer.grossPurchasedQty,
      returnedQty: customer.returnedQty,
      netPurchasedQty: customer.netPurchasedQty,
      customerKey: customer.customerKey,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      returnRate: returnRate(customer),
      productBreakdown: finalizeProducts(customer.products),
      branchBreakdown: finalizeBranches(customer.branches),
      salespersonBreakdown: finalizeSalespeople(customer.salespeople),
    }))
    .sort(byRank((customer) => customer.customerName, (customer) => customer.customerKey));
}

function returnAnalysisItem(
  key: string,
  code: string,
  label: string,
  metrics: QuantityMetrics,
): ReturnAnalysisItem {
  return { ...metrics, key, code, label, returnRate: returnRate(metrics) };
}

function buildReturnAnalysis(
  overview: QuantityMetrics,
  customers: CustomerPurchaseSummary[],
  products: ProductPurchaseSummary[],
  branches: BranchPurchaseSummary[],
  salespeople: SalespersonPurchaseSummary[],
): CylinderPurchaseDashboardResponse["returnAnalysis"] {
  return {
    overall: { ...overview, returnRate: returnRate(overview) },
    byCustomer: customers.map((customer) =>
      returnAnalysisItem(
        customer.customerKey,
        customer.customerCode ?? UNASSIGNED_CUSTOMER_KEY,
        customer.customerName,
        customer,
      ),
    ),
    byProduct: products.map((product) =>
      returnAnalysisItem(
        String(product.productId),
        product.productCode,
        product.productName,
        product,
      ),
    ),
    byBranch: branches.map((branch) =>
      returnAnalysisItem(
        String(branch.branchId),
        branch.branchCode,
        branch.branchName,
        branch,
      ),
    ),
    bySalesperson: salespeople.map((salesperson) =>
      returnAnalysisItem(
        String(salesperson.salesmanId),
        salesperson.salesmanCode,
        salesperson.salesmanName,
        salesperson,
      ),
    ),
  };
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getRollingThirtyDayRange(now: Date = new Date()): RollingThirtyDayRange {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

export function aggregateCylinderPurchases(
  rows: CylinderPurchaseRow[],
  filters: CylinderPurchaseReportFilters,
  generatedAt: string = new Date().toISOString(),
): CylinderPurchaseDashboardResponse {
  const overview = emptyMetrics();
  const customers = new Map<string, CustomerAccumulator>();
  const products = new Map<number, ProductAccumulator>();
  const branches = new Map<number, BranchAccumulator>();
  const salespeople = new Map<number, SalespersonAccumulator>();

  for (const row of rows) {
    addMetrics(overview, row);
    const customerKey = accumulateCustomer(customers, row);
    accumulateProduct(products, row, customerKey);
    accumulateBranch(branches, row, customerKey);
    accumulateSalesperson(salespeople, row, customerKey);
  }

  const customerRanking = finalizeCustomers(customers);
  const productPerformance = finalizeProducts(products);
  const branchPerformance = finalizeBranches(branches);
  const salespersonPerformance = finalizeSalespeople(salespeople);

  return {
    filters,
    generatedAt,
    sourceRowCount: rows.length,
    overview: {
      ...overview,
      uniqueCustomers: customers.size,
      serializedProducts: products.size,
    },
    customerRanking,
    productPerformance,
    returnAnalysis: buildReturnAnalysis(
      overview,
      customerRanking,
      productPerformance,
      branchPerformance,
      salespersonPerformance,
    ),
    branchPerformance,
    salespersonPerformance,
  };
}
