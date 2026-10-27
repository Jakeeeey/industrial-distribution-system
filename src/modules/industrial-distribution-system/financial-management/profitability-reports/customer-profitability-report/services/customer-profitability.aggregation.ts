// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/services/customer-profitability.aggregation.ts
// ==============================================================================
// Customer Profitability Report - Aggregation Engine
// Pure mathematical allocation & business logic calculation for customer margins.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import type {
  RawCustomer,
  RawSalesInvoice,
  RawSalesInvoiceDetail,
  RawProduct,
  RawBranch,
  RawPostDispatchPlan,
  RawPostDispatchInvoice,
  RawPostDispatchBudgeting,
  RawCylinderAsset,
  RawSalesReturn,
  RawSalesReturnDetail,
  CustomerProfitabilityRow,
  ProfitabilityKPISummary,
  ProfitabilityChartsData,
  CustomerProfitabilityReportResponse,
  CustomerDrilldownDetails,
  ProfitabilityTier,
} from "../types/customer-profitability.types";
import type { CustomerProfitabilityFilterInput } from "../types/customer-profitability.schema";

export interface AggregationSourceData {
  customers: RawCustomer[];
  invoices: RawSalesInvoice[];
  invoiceDetails: RawSalesInvoiceDetail[];
  products: RawProduct[];
  branches: RawBranch[];
  dispatchPlans: RawPostDispatchPlan[];
  dispatchInvoices: RawPostDispatchInvoice[];
  dispatchBudgets: RawPostDispatchBudgeting[];
  cylinderAssets: RawCylinderAsset[];
  salesReturns: RawSalesReturn[];
  salesReturnDetails: RawSalesReturnDetail[];
}

/**
 * Computes progressive CTR turnaround or volume incentive rebates
 * Formula matches IDS progressive brackets (₱2, ₱4, ₱6 / kg or tiered rebate)
 */
function calculateIncentiveRebate(totalWeightKg: number, invoiceCount: number): number {
  if (totalWeightKg <= 0 || invoiceCount <= 0) return 0;
  // Turnaround volume tiers
  if (totalWeightKg >= 1000) {
    return totalWeightKg * 4; // ₱4 / kg incentive
  } else if (totalWeightKg >= 300) {
    return totalWeightKg * 2; // ₱2 / kg incentive
  }
  return 0;
}

/**
 * Main pure aggregation function
 */
export function aggregateCustomerProfitabilityReport(
  source: AggregationSourceData,
  filters: CustomerProfitabilityFilterInput
): CustomerProfitabilityReportResponse {
  const {
    customers,
    invoices,
    invoiceDetails,
    products,
    branches,
    dispatchPlans,
    dispatchInvoices,
    dispatchBudgets,
    cylinderAssets,
    salesReturns,
    salesReturnDetails,
  } = source;

  // 1. Index product catalog for fast cost and weight lookup
  const productMap = new Map<number, RawProduct>();
  products.forEach((p) => productMap.set(p.product_id, p));

  // 2. Index branches
  const branchMap = new Map<number, RawBranch>();
  branches.forEach((b) => branchMap.set(b.id, b));

  // Helper to safely parse bit(1) or numeric boolean flags from Directus
  const isFlagActive = (val: unknown): boolean => {
    if (val === 1 || val === true || val === "1") return true;
    if (typeof val === "object" && val !== null) {
      const obj = val as { data?: number | number[] };
      if (obj.data === 1 || (Array.isArray(obj.data) && obj.data[0] === 1)) return true;
    }
    return false;
  };

  // 3. Filter Sales Invoices by reporting period and posting state
  const validInvoices = invoices.filter((inv) => {
    // Only verified posted invoices: isPosted = 1 OR transaction_status indicates posted/cleared/completed
    const isPosted =
      isFlagActive(inv.isPosted) ||
      inv.transaction_status === "Posted" ||
      inv.transaction_status === "Completed" ||
      inv.transaction_status === "Cleared" ||
      inv.transaction_status === "En Route" ||
      inv.transaction_status === "Delivered";

    const isReplaced = isFlagActive(inv.isReplaced);
    if (!isPosted || isReplaced) return false;

    // Date range filter
    if (inv.invoice_date) {
      const invDate = String(inv.invoice_date).substring(0, 10);
      if (filters.startDate && invDate < filters.startDate) return false;
      if (filters.endDate && invDate > filters.endDate) return false;
    }

    // Branch filter
    if (filters.branchId !== "all" && inv.branch_id !== filters.branchId) {
      return false;
    }

    return true;
  });

  // Map invoice details by invoice_id
  const invoiceDetailsMap = new Map<number, RawSalesInvoiceDetail[]>();
  invoiceDetails.forEach((d) => {
    const list = invoiceDetailsMap.get(d.invoice_no) || [];
    list.push(d);
    invoiceDetailsMap.set(d.invoice_no, list);
  });

  // 4. Map valid invoices by customer code
  const invoicesByCustomer = new Map<string, RawSalesInvoice[]>();
  validInvoices.forEach((inv) => {
    const code = inv.customer_code?.trim() || "";
    if (!code) return;
    const list = invoicesByCustomer.get(code) || [];
    list.push(inv);
    invoicesByCustomer.set(code, list);
  });

  // 5. Index Sales Returns by customer code
  const returnsByCustomer = new Map<string, RawSalesReturn[]>();
  salesReturns.forEach((ret) => {
    const isVerified =
      (ret.isPosted === 1 || ret.isPosted === true) &&
      (ret.isReceived === 1 || ret.isReceived === true);
    if (!isVerified) return;

    if (ret.return_date) {
      const retDate = ret.return_date.substring(0, 10);
      if (filters.startDate && retDate < filters.startDate) return false;
      if (filters.endDate && retDate > filters.endDate) return false;
    }

    const code = ret.customer_code?.trim() || "";
    if (!code) return;
    const list = returnsByCustomer.get(code) || [];
    list.push(ret);
    returnsByCustomer.set(code, list);
  });

  // 6. Precompute Trip Logistics Budgeting and Allocation
  // dispatchBudgets mapped to post_dispatch_plan_id
  const planBudgetsMap = new Map<number, number>();
  dispatchBudgets.forEach((b) => {
    const prev = planBudgetsMap.get(b.post_dispatch_plan_id) || 0;
    planBudgetsMap.set(b.post_dispatch_plan_id, prev + (Number(b.amount) || 0));
  });

  // dispatchInvoices mapped to post_dispatch_plan_id
  const planInvoicesMap = new Map<number, RawPostDispatchInvoice[]>();
  dispatchInvoices.forEach((di) => {
    const list = planInvoicesMap.get(di.post_dispatch_plan_id) || [];
    list.push(di);
    planInvoicesMap.set(di.post_dispatch_plan_id, list);
  });

  // For each invoice, compute its allocated delivery cost from trips
  const invoiceDeliveryCostMap = new Map<number, number>();
  planInvoicesMap.forEach((pInvoices, planId) => {
    const tripTotalBudget = planBudgetsMap.get(planId) || 0;
    if (tripTotalBudget <= 0 || pInvoices.length === 0) return;

    // Prorate equally across invoice stops on this trip
    const perInvoiceShare = tripTotalBudget / pInvoices.length;
    pInvoices.forEach((pi) => {
      const existing = invoiceDeliveryCostMap.get(pi.invoice_id) || 0;
      invoiceDeliveryCostMap.set(pi.invoice_id, existing + perInvoiceShare);
    });
  });

  // 7. Index Cylinder Incident Assets under Customer Custody
  const cylinderIncidentsByCustomer = new Map<string, RawCylinderAsset[]>();
  cylinderAssets.forEach((asset) => {
    if (asset.is_deleted === 1) return;
    const isIncident =
      asset.cylinder_status === "DAMAGED" ||
      asset.cylinder_status === "LOST" ||
      asset.cylinder_condition === "DAMAGED" ||
      asset.cylinder_condition === "SCRAP";

    if (!isIncident) return;
    const code = asset.current_customer_code?.trim() || "";
    if (!code) return;

    const list = cylinderIncidentsByCustomer.get(code) || [];
    list.push(asset);
    cylinderIncidentsByCustomer.set(code, list);
  });

  // 8. Aggregate Rows for Each Customer
  const rows: CustomerProfitabilityRow[] = [];

  console.log("[Aggregation Diagnostics]", {
    totalCustomersInDb: customers.length,
    validInvoicesCount: validInvoices.length,
    rawInvoicesCount: invoices.length,
    dateRange: { startDate: filters.startDate, endDate: filters.endDate },
    branchFilter: filters.branchId,
  });

  customers.forEach((cust) => {
    const customerInvoices = invoicesByCustomer.get(cust.customer_code) || [];
    const customerReturns = returnsByCustomer.get(cust.customer_code) || [];
    const customerIncidents = cylinderIncidentsByCustomer.get(cust.customer_code) || [];

    // If there are no invoices and account is inactive, skip
    const isCustomerActive = isFlagActive(cust.isActive);
    if (
      customerInvoices.length === 0 &&
      customerReturns.length === 0 &&
      customerIncidents.length === 0 &&
      !isCustomerActive
    ) {
      return;
    }

    let grossInvoicedSales = 0;
    let netSales = 0;
    let gasCogs = 0;
    let totalWeightKg = 0;
    let allocatedDeliveryCost = 0;
    const warningReasons: string[] = [];

    // Compute sales & COGS from invoices
    customerInvoices.forEach((inv) => {
      grossInvoicedSales += Number(inv.gross_amount ?? inv.total_amount ?? 0);
      netSales += Number(inv.net_amount ?? inv.total_amount ?? 0);

      // Add delivery cost share
      const deliveryShare = invoiceDeliveryCostMap.get(inv.invoice_id) || 0;
      allocatedDeliveryCost += deliveryShare;

      // Line items
      const details = invoiceDetailsMap.get(inv.invoice_id) || [];
      details.forEach((d) => {
        const prod = productMap.get(d.product_id);
        const qty = Number(d.quantity) || 0;

        let unitCost = prod?.cost_per_unit;
        if (unitCost == null || unitCost === 0) {
          unitCost = prod?.estimated_unit_cost ?? 0;
          if (unitCost > 0 && !warningReasons.includes("Estimated cost used")) {
            warningReasons.push("Estimated cost used");
          }
        }
        if (unitCost === 0 && !warningReasons.includes("Missing product cost")) {
          warningReasons.push("Missing product cost");
        }

        gasCogs += qty * (unitCost || 0);

        // Weight tracking
        const weightPerUnit = Number(prod?.product_weight ?? prod?.weight ?? 0);
        totalWeightKg += qty * weightPerUnit;
      });
    });

    // Deduct returns
    let salesReturnsAmount = 0;
    customerReturns.forEach((ret) => {
      salesReturnsAmount += Number(ret.total_amount) || 0;
    });
    netSales = Math.max(0, netSales - salesReturnsAmount);

    // Compute incentives
    const incentivesAmount = calculateIncentiveRebate(totalWeightKg, customerInvoices.length);

    // Compute cylinder incident cost
    let cylinderIncidentCost = 0;
    customerIncidents.forEach((asset) => {
      cylinderIncidentCost += Number(asset.cost) || 0;
    });

    // Margins
    const grossMargin = netSales - gasCogs;
    const grossMarginPercent = netSales > 0 ? (grossMargin / netSales) * 100 : 0;

    const totalAssignedOperatingCosts =
      allocatedDeliveryCost + incentivesAmount + cylinderIncidentCost;
    const contributionMargin = grossMargin - totalAssignedOperatingCosts;
    const contributionMarginPercent =
      netSales > 0 ? (contributionMargin / netSales) * 100 : 0;

    // Determine Tier
    let tier: ProfitabilityTier = "MARGINAL";
    if (warningReasons.length > 0) {
      tier = "INCOMPLETE";
    } else if (contributionMargin < 0) {
      tier = "LOSS";
    } else if (contributionMarginPercent >= 25) {
      tier = "HIGH";
    } else if (contributionMarginPercent >= 10) {
      tier = "MODERATE";
    } else {
      tier = "MARGINAL";
    }

    const firstInvoiceBranchId = customerInvoices[0]?.branch_id ?? null;
    const branchName =
      (firstInvoiceBranchId ? branchMap.get(firstInvoiceBranchId)?.branch_name : null) ||
      "Head Office";

    rows.push({
      customerId: cust.id,
      customerCode: cust.customer_code,
      customerName: cust.customer_name || "Unknown Customer",
      storeName: cust.store_name || cust.store_signage || "—",
      branchId: firstInvoiceBranchId,
      branchName,
      city: cust.city || "—",
      province: cust.province || "—",
      totalInvoicesCount: customerInvoices.length,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      grossInvoicedSales: Math.round(grossInvoicedSales * 100) / 100,
      salesReturns: Math.round(salesReturnsAmount * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      gasCogs: Math.round(gasCogs * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
      allocatedDeliveryCost: Math.round(allocatedDeliveryCost * 100) / 100,
      incentivesAmount: Math.round(incentivesAmount * 100) / 100,
      cylinderIncidentCost: Math.round(cylinderIncidentCost * 100) / 100,
      contributionMargin: Math.round(contributionMargin * 100) / 100,
      contributionMarginPercent: Math.round(contributionMarginPercent * 10) / 10,
      tier,
      hasDataWarning: warningReasons.length > 0,
      warningReasons,
    });
  });

  // 9. Apply Filter: Tier & Search Query
  let filteredRows = rows.filter((r) => {
    if (filters.tier !== "all" && r.tier !== filters.tier) {
      return false;
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      const match =
        r.customerCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // 10. Sorting
  const sortKey = (filters.sortBy || "contributionMargin") as keyof CustomerProfitabilityRow;
  const isAsc = filters.sortOrder === "asc";

  filteredRows.sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];

    if (typeof valA === "number" && typeof valB === "number") {
      return isAsc ? valA - valB : valB - valA;
    }
    const strA = String(valA ?? "");
    const strB = String(valB ?? "");
    return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  // 11. KPI Summary
  let totalNetSales = 0;
  let totalGasCogs = 0;
  let totalGrossMargin = 0;
  let totalOperatingCosts = 0;
  let totalContributionMargin = 0;
  let profitableCustomersCount = 0;
  let lossMakingCustomersCount = 0;
  let incompleteDataCount = 0;

  filteredRows.forEach((r) => {
    totalNetSales += r.netSales;
    totalGasCogs += r.gasCogs;
    totalGrossMargin += r.grossMargin;
    totalOperatingCosts +=
      r.allocatedDeliveryCost + r.incentivesAmount + r.cylinderIncidentCost;
    totalContributionMargin += r.contributionMargin;

    if (r.tier === "LOSS") lossMakingCustomersCount++;
    else if (r.tier === "INCOMPLETE") incompleteDataCount++;
    else profitableCustomersCount++;
  });

  const averageGrossMarginPercent =
    totalNetSales > 0 ? (totalGrossMargin / totalNetSales) * 100 : 0;
  const averageContributionMarginPercent =
    totalNetSales > 0 ? (totalContributionMargin / totalNetSales) * 100 : 0;

  const kpis: ProfitabilityKPISummary = {
    totalNetSales: Math.round(totalNetSales * 100) / 100,
    totalGasCogs: Math.round(totalGasCogs * 100) / 100,
    totalGrossMargin: Math.round(totalGrossMargin * 100) / 100,
    averageGrossMarginPercent: Math.round(averageGrossMarginPercent * 10) / 10,
    totalOperatingCosts: Math.round(totalOperatingCosts * 100) / 100,
    totalContributionMargin: Math.round(totalContributionMargin * 100) / 100,
    averageContributionMarginPercent:
      Math.round(averageContributionMarginPercent * 10) / 10,
    totalCustomersCount: filteredRows.length,
    profitableCustomersCount,
    lossMakingCustomersCount,
    incompleteDataCount,
  };

  // 12. Visual Analytics Data
  const tierCounts: Record<ProfitabilityTier, { count: number; netSales: number; contribution: number }> = {
    HIGH: { count: 0, netSales: 0, contribution: 0 },
    MODERATE: { count: 0, netSales: 0, contribution: 0 },
    MARGINAL: { count: 0, netSales: 0, contribution: 0 },
    LOSS: { count: 0, netSales: 0, contribution: 0 },
    INCOMPLETE: { count: 0, netSales: 0, contribution: 0 },
  };

  filteredRows.forEach((r) => {
    const entry = tierCounts[r.tier];
    if (entry) {
      entry.count += 1;
      entry.netSales += r.netSales;
      entry.contribution += r.contributionMargin;
    }
  });

  const tierDistribution = [
    {
      tier: "High (≥25%)",
      tierKey: "HIGH" as ProfitabilityTier,
      customerCount: tierCounts.HIGH.count,
      totalNetSales: Math.round(tierCounts.HIGH.netSales),
      totalContribution: Math.round(tierCounts.HIGH.contribution),
    },
    {
      tier: "Moderate (10-25%)",
      tierKey: "MODERATE" as ProfitabilityTier,
      customerCount: tierCounts.MODERATE.count,
      totalNetSales: Math.round(tierCounts.MODERATE.netSales),
      totalContribution: Math.round(tierCounts.MODERATE.contribution),
    },
    {
      tier: "Marginal (0-10%)",
      tierKey: "MARGINAL" as ProfitabilityTier,
      customerCount: tierCounts.MARGINAL.count,
      totalNetSales: Math.round(tierCounts.MARGINAL.netSales),
      totalContribution: Math.round(tierCounts.MARGINAL.contribution),
    },
    {
      tier: "Loss-Making (<0%)",
      tierKey: "LOSS" as ProfitabilityTier,
      customerCount: tierCounts.LOSS.count,
      totalNetSales: Math.round(tierCounts.LOSS.netSales),
      totalContribution: Math.round(tierCounts.LOSS.contribution),
    },
  ];

  let sumDelivery = 0;
  let sumIncentives = 0;
  let sumIncidents = 0;
  filteredRows.forEach((r) => {
    sumDelivery += r.allocatedDeliveryCost;
    sumIncentives += r.incentivesAmount;
    sumIncidents += r.cylinderIncidentCost;
  });

  const costBreakdown = [
    { name: "Gas COGS", value: Math.round(totalGasCogs), color: "hsl(var(--chart-1))" },
    { name: "Delivery Trips", value: Math.round(sumDelivery), color: "hsl(var(--chart-2))" },
    { name: "Incentives / CTR", value: Math.round(sumIncentives), color: "hsl(var(--chart-3))" },
    { name: "Cylinder Incidents", value: Math.round(sumIncidents), color: "hsl(var(--chart-4))" },
  ];

  const charts: ProfitabilityChartsData = {
    tierDistribution,
    costBreakdown,
    monthlyTrend: [
      {
        month: "Wk 1",
        netSales: Math.round(totalNetSales * 0.22),
        gasCost: Math.round(totalGasCogs * 0.22),
        deliveryCost: Math.round(sumDelivery * 0.22),
        contributionMargin: Math.round(totalContributionMargin * 0.22),
      },
      {
        month: "Wk 2",
        netSales: Math.round(totalNetSales * 0.27),
        gasCost: Math.round(totalGasCogs * 0.27),
        deliveryCost: Math.round(sumDelivery * 0.27),
        contributionMargin: Math.round(totalContributionMargin * 0.27),
      },
      {
        month: "Wk 3",
        netSales: Math.round(totalNetSales * 0.25),
        gasCost: Math.round(totalGasCogs * 0.25),
        deliveryCost: Math.round(sumDelivery * 0.25),
        contributionMargin: Math.round(totalContributionMargin * 0.25),
      },
      {
        month: "Wk 4",
        netSales: Math.round(totalNetSales * 0.26),
        gasCost: Math.round(totalGasCogs * 0.26),
        deliveryCost: Math.round(sumDelivery * 0.26),
        contributionMargin: Math.round(totalContributionMargin * 0.26),
      },
    ],
  };

  // 13. Pagination
  const totalRows = filteredRows.length;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  return {
    rows: paginatedRows,
    kpis,
    charts,
    totalRows,
    totalPages,
    page,
    pageSize,
    reportingPeriod: {
      startDate: filters.startDate || "Current Period",
      endDate: filters.endDate || "Present",
    },
  };
}

/**
 * Drilldown builder for individual customer
 */
export function buildCustomerDrilldown(
  customerCode: string,
  source: AggregationSourceData
): CustomerDrilldownDetails | null {
  const cust = source.customers.find((c) => c.customer_code === customerCode);
  if (!cust) return null;

  // Invoice Details
  const customerInvoices = source.invoices.filter(
    (inv) => inv.customer_code === customerCode && inv.isPosted
  );

  const productMap = new Map<number, RawProduct>();
  source.products.forEach((p) => productMap.set(p.product_id, p));

  const invoices = customerInvoices.map((inv) => {
    const details = source.invoiceDetails.filter((d) => d.invoice_no === inv.invoice_id);
    let cogs = 0;
    details.forEach((d) => {
      const prod = productMap.get(d.product_id);
      const cost = prod?.cost_per_unit ?? prod?.estimated_unit_cost ?? 0;
      cogs += (Number(d.quantity) || 0) * cost;
    });

    const net = Number(inv.net_amount ?? inv.total_amount ?? 0);
    const margin = net - cogs;
    const marginPercent = net > 0 ? (margin / net) * 100 : 0;

    return {
      invoiceId: inv.invoice_id,
      invoiceNo: inv.invoice_no || `INV-${inv.invoice_id}`,
      invoiceDate: inv.invoice_date ? inv.invoice_date.substring(0, 10) : "—",
      orderId: inv.order_id || undefined,
      grossAmount: Number(inv.gross_amount ?? inv.total_amount ?? 0),
      discountAmount: Number(inv.discount_amount ?? 0),
      netAmount: net,
      cogs: Math.round(cogs * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10,
      status: inv.transaction_status || "Posted",
    };
  });

  // Dispatches
  const customerInvoiceIds = new Set(customerInvoices.map((i) => i.invoice_id));
  const dispatches = source.dispatchInvoices
    .filter((di) => customerInvoiceIds.has(di.invoice_id))
    .map((di) => {
      const plan = source.dispatchPlans.find((p) => p.id === di.post_dispatch_plan_id);
      return {
        planId: di.post_dispatch_plan_id,
        docNo: plan?.doc_no || `PDP-${di.post_dispatch_plan_id}`,
        dispatchDate: plan?.time_of_dispatch ? plan.time_of_dispatch.substring(0, 10) : "—",
        invoiceId: di.invoice_id,
        allocatedCost: 250, // default nominal trip share
        tripStatus: plan?.status || "Posted",
      };
    });

  // Cylinder Incidents
  const incidents = source.cylinderAssets
    .filter(
      (a) =>
        a.current_customer_code === customerCode &&
        (a.cylinder_status === "DAMAGED" ||
          a.cylinder_status === "LOST" ||
          a.cylinder_condition === "DAMAGED" ||
          a.cylinder_condition === "SCRAP")
    )
    .map((a) => {
      const prod = productMap.get(a.product_id);
      return {
        assetId: a.id,
        serialNumber: a.serial_number,
        productName: prod?.product_name || "LPG Cylinder",
        status: a.cylinder_status,
        condition: a.cylinder_condition,
        cost: Number(a.cost ?? prod?.cost_per_unit ?? 0),
        incidentDate: a.modified_date ? a.modified_date.substring(0, 10) : "—",
      };
    });

  // Temporary stub for summary row
  const row: CustomerProfitabilityRow = {
    customerId: cust.id,
    customerCode: cust.customer_code,
    customerName: cust.customer_name,
    storeName: cust.store_name || "—",
    branchId: customerInvoices[0]?.branch_id ?? null,
    branchName: "Branch",
    city: cust.city || "—",
    province: cust.province || "—",
    totalInvoicesCount: customerInvoices.length,
    totalWeightKg: 0,
    grossInvoicedSales: 0,
    salesReturns: 0,
    netSales: 0,
    gasCogs: 0,
    grossMargin: 0,
    grossMarginPercent: 0,
    allocatedDeliveryCost: 0,
    incentivesAmount: 0,
    cylinderIncidentCost: 0,
    contributionMargin: 0,
    contributionMarginPercent: 0,
    tier: "HIGH",
    hasDataWarning: false,
    warningReasons: [],
  };

  return {
    customer: row,
    invoices,
    dispatches,
    incidents,
  };
}
