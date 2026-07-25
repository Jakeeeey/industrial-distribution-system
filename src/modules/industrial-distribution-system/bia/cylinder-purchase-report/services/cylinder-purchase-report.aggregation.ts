import {
  accumulateBranch,
  accumulateCustomer,
  accumulateProduct,
  accumulateSalesperson,
  type BranchAccumulator,
  type CustomerAccumulator,
  type ProductAccumulator,
  type SalespersonAccumulator,
} from "./cylinder-purchase-report.accumulators";
import {
  buildReturnAnalysis,
  finalizeBranches,
  finalizeCustomers,
  finalizeProducts,
  finalizeSalespeople,
} from "./cylinder-purchase-report.finalizers";
import {
  addMetrics,
  emptyMetrics,
} from "./cylinder-purchase-report.metrics";
import type {
  BranchPurchaseSummary,
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseRow,
  ProductPurchaseSummary,
  QuantityMetrics,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export interface CylinderPurchaseAggregates {
  overview: QuantityMetrics;
  customerRanking: CustomerPurchaseSummary[];
  productPerformance: ProductPurchaseSummary[];
  branchPerformance: BranchPurchaseSummary[];
  salespersonPerformance: SalespersonPurchaseSummary[];
  returnAnalysis: CylinderPurchaseDashboardResponse["returnAnalysis"];
}

export function buildCylinderPurchaseAggregates(
  rows: CylinderPurchaseRow[],
): CylinderPurchaseAggregates {
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
    overview,
    customerRanking,
    productPerformance,
    branchPerformance,
    salespersonPerformance,
    returnAnalysis: buildReturnAnalysis(
      overview,
      customerRanking,
      productPerformance,
      branchPerformance,
      salespersonPerformance,
    ),
  };
}
