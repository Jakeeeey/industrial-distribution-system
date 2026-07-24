import {
  UNASSIGNED_CUSTOMER_KEY,
  type BranchAccumulator,
  type CustomerAccumulator,
  type ProductAccumulator,
  type SalespersonCustomerAccumulator,
  type SalespersonCustomerProductAccumulator,
  type SalespersonAccumulator,
} from "./cylinder-purchase-report.accumulators";
import {
  byRank,
  returnRate,
} from "./cylinder-purchase-report.metrics";
import type {
  BranchPurchaseSummary,
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  ProductPurchaseSummary,
  QuantityMetrics,
  ReturnAnalysisItem,
  SalespersonCustomerProductPurchaseSummary,
  SalespersonCustomerPurchaseSummary,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export function finalizeProducts(
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

export function finalizeBranches(
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

export function finalizeSalespeople(
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
      customerBreakdown: finalizeSalespersonCustomers(salesperson.customers),
      productBreakdown: finalizeProducts(salesperson.products),
      customerProductBreakdown: finalizeSalespersonCustomerProducts(
        salesperson.customerProducts,
      ),
    }))
    .sort(
      byRank(
        (salesperson) => salesperson.salesmanName,
        (salesperson) => salesperson.salesmanId,
      ),
    );
}

function finalizeSalespersonCustomers(
  customers: Map<string, SalespersonCustomerAccumulator>,
): SalespersonCustomerPurchaseSummary[] {
  return [...customers.values()]
    .map((customer) => ({
      grossPurchasedQty: customer.grossPurchasedQty,
      returnedQty: customer.returnedQty,
      netPurchasedQty: customer.netPurchasedQty,
      customerKey: customer.customerKey,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      returnRate: returnRate(customer),
      uniqueProducts: customer.productIds.size,
    }))
    .sort(
      byRank(
        (customer) => customer.customerName,
        (customer) => customer.customerKey,
      ),
    );
}

function finalizeSalespersonCustomerProducts(
  customerProducts: Map<string, SalespersonCustomerProductAccumulator>,
): SalespersonCustomerProductPurchaseSummary[] {
  return [...customerProducts.values()]
    .map((item) => ({
      grossPurchasedQty: item.grossPurchasedQty,
      returnedQty: item.returnedQty,
      netPurchasedQty: item.netPurchasedQty,
      key: item.key,
      customerKey: item.customerKey,
      customerCode: item.customerCode,
      customerName: item.customerName,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      returnRate: returnRate(item),
    }))
    .sort(
      byRank(
        (item) => `${item.customerName}\u0000${item.productName}`,
        (item) => item.key,
      ),
    );
}

export function finalizeCustomers(
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

export function buildReturnAnalysis(
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
