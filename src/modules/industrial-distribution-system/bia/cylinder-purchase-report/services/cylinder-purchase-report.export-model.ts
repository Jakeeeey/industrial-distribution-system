import type {
  BranchPurchaseSummary,
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseDashboardView,
  ProductPurchaseSummary,
  ReturnAnalysisDataset,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export type ReportExportCell = string | number;

export interface ReportExportSection {
  title: string;
  columns: string[];
  rows: ReportExportCell[][];
}

function buildOverviewSection(
  report: CylinderPurchaseDashboardResponse,
): ReportExportSection {
  return {
    title: "Cylinder Purchase Overview",
    columns: ["Metric", "Value"],
    rows: [
      ["Gross Purchased", report.overview.grossPurchasedQty],
      ["Returned Cylinders", report.overview.returnedQty],
      ["Net Purchased", report.overview.netPurchasedQty],
      ["Unique Customers", report.overview.uniqueCustomers],
      ["Serialized Products", report.overview.serializedProducts],
    ],
  };
}

function buildCustomerSection(
  customers: CustomerPurchaseSummary[],
): ReportExportSection {
  return {
    title: "Customer Cylinder Ranking",
    columns: [
      "Rank",
      "Customer Code",
      "Customer Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
    ],
    rows: customers.map((customer, index) => [
      index + 1,
      customer.customerCode ?? "No customer code",
      customer.customerName,
      customer.grossPurchasedQty,
      customer.returnedQty,
      customer.netPurchasedQty,
      customer.returnRate,
    ]),
  };
}

function buildCustomerDetailSection(
  customers: CustomerPurchaseSummary[],
): ReportExportSection {
  return {
    title: "Customer Purchase Detail",
    columns: [
      "Customer Code",
      "Customer Name",
      "Product Code",
      "Product Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
    ],
    rows: customers.flatMap((customer) =>
      customer.productBreakdown.map((product) => [
        customer.customerCode ?? "No customer code",
        customer.customerName,
        product.productCode,
        product.productName,
        product.grossPurchasedQty,
        product.returnedQty,
        product.netPurchasedQty,
        product.returnRate,
      ]),
    ),
  };
}

function buildProductSection(
  products: ProductPurchaseSummary[],
): ReportExportSection {
  return {
    title: "Cylinder Product Performance",
    columns: [
      "Rank",
      "Product Code",
      "Product Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
      "Unique Customers",
    ],
    rows: products.map((product, index) => [
      index + 1,
      product.productCode,
      product.productName,
      product.grossPurchasedQty,
      product.returnedQty,
      product.netPurchasedQty,
      product.returnRate,
      product.uniqueCustomers,
    ]),
  };
}

function buildReturnSection(
  analysis: ReturnAnalysisDataset,
): ReportExportSection {
  const groups = [
    ["Customer", analysis.byCustomer],
    ["Product", analysis.byProduct],
    ["Branch", analysis.byBranch],
    ["Salesperson", analysis.bySalesperson],
  ] as const;

  return {
    title: "Cylinder Return Analysis",
    columns: [
      "Grouping",
      "Code",
      "Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
    ],
    rows: groups.flatMap(([grouping, items]) =>
      items.map((item) => [
        grouping,
        item.code,
        item.label,
        item.grossPurchasedQty,
        item.returnedQty,
        item.netPurchasedQty,
        item.returnRate,
      ]),
    ),
  };
}

function buildBranchSection(
  branches: BranchPurchaseSummary[],
): ReportExportSection {
  return {
    title: "Branch Performance",
    columns: [
      "Rank",
      "Branch Code",
      "Branch Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
      "Unique Customers",
      "Unique Products",
    ],
    rows: branches.map((branch, index) => [
      index + 1,
      branch.branchCode,
      branch.branchName,
      branch.grossPurchasedQty,
      branch.returnedQty,
      branch.netPurchasedQty,
      branch.returnRate,
      branch.uniqueCustomers,
      branch.uniqueProducts,
    ]),
  };
}

function buildSalespersonSection(
  salespeople: SalespersonPurchaseSummary[],
): ReportExportSection {
  return {
    title: "Salesperson Performance",
    columns: [
      "Rank",
      "Salesperson Code",
      "Salesperson Name",
      "Gross",
      "Returned",
      "Net",
      "Return Rate",
      "Unique Customers",
      "Unique Products",
    ],
    rows: salespeople.map((salesperson, index) => [
      index + 1,
      salesperson.salesmanCode,
      salesperson.salesmanName,
      salesperson.grossPurchasedQty,
      salesperson.returnedQty,
      salesperson.netPurchasedQty,
      salesperson.returnRate,
      salesperson.uniqueCustomers,
      salesperson.uniqueProducts,
    ]),
  };
}

export function buildDashboardExportSections(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): ReportExportSection[] {
  switch (view) {
    case "customers":
      return [
        selectedCustomer
          ? buildCustomerDetailSection([selectedCustomer])
          : buildCustomerSection(report.customerRanking),
      ];
    case "products":
      return [buildProductSection(report.productPerformance)];
    case "returns":
      return [buildReturnSection(report.returnAnalysis)];
    case "branches":
      return [buildBranchSection(report.branchPerformance)];
    case "salespeople":
      return [buildSalespersonSection(report.salespersonPerformance)];
  }
}

export function buildConsolidatedExportSections(
  report: CylinderPurchaseDashboardResponse,
): ReportExportSection[] {
  return [
    buildOverviewSection(report),
    buildCustomerSection(report.customerRanking),
    buildCustomerDetailSection(report.customerRanking),
    buildProductSection(report.productPerformance),
    buildReturnSection(report.returnAnalysis),
    buildBranchSection(report.branchPerformance),
    buildSalespersonSection(report.salespersonPerformance),
  ];
}
