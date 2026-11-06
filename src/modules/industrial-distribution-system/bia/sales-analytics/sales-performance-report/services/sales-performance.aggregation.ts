// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/services/sales-performance.aggregation.ts
// ==============================================================================
// Sales Performance Report - Pure Aggregation Engine
// Computes net sales, deducted return credits, kg sold (where is_serialized > 0),
// executive KPIs, time-series charts, and customer / product rankings.
// ==============================================================================

import type {
  SalesPerformanceRecord,
  SalesPerformanceKPIs,
  SalesPerformanceChartsData,
  SalesPerformanceRankings,
  SalesTrendPoint,
  GasDistributionPoint,
  BranchComparisonPoint,
  CustomerRanking,
  ProductRanking,
} from "../types/sales-performance.types";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";

export interface RawSalesInvoice {
  invoice_id: number;
  order_id: string | null;
  customer_code: string | null;
  invoice_no: string | null;
  salesman_id: number | null;
  branch_id: number | null;
  invoice_date: string | null;
  dispatch_date: string | null;
  due_date: string | null;
  payment_terms: number | null;
  transaction_status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  sales_type: number | null;
  invoice_type: number | null;
  price_type: string | null;
  vat_amount: number | null;
  gross_amount: number | null;
  discount_amount: number | null;
  net_amount: number | null;
  isReceipt: boolean | number | { data?: number[] } | null;
  isPosted: boolean | number | { data?: number[] } | null;
  isDispatched: boolean | number | { data?: number[] } | null;
  isRemitted: boolean | number | { data?: number[] } | null;
  isReplaced: boolean | number | { data?: number[] } | null;
}

export interface RawSalesInvoiceDetail {
  detail_id: number;
  order_id: string | null;
  invoice_no: number | string | null;
  serial_no: string | null;
  discount_type: number | null;
  product_id: number | { product_id: number } | null;
  unit: number | null;
  unit_price: number | null;
  quantity: number | null;
  discount_amount: number | null;
  gross_amount: number | null;
  total_amount: number | null;
}

export interface RawSalesReturn {
  return_id: number;
  return_number: string;
  customer_code: string | null;
  salesman_id: number | null;
  branch_id: number | null;
  return_date: string | null;
  total_amount: number | null;
  discount_amount: number | null;
  gross_amount: number | null;
  order_id: string | null;
  invoice_no: string | null;
  received_at: string | null;
  status: string | null;
  isPosted: boolean | number | null;
  isApplied: boolean | number | null;
  isReceived: boolean | number | null;
}

export interface RawSalesReturnDetail {
  detail_id: number;
  return_no: string | null;
  product_id: number | { product_id: number } | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  gross_amount: number | null;
  sales_return_type_id: number | null;
  status: string | null;
}

export interface RawProduct {
  product_id: number;
  product_name: string | null;
  product_code: string | null;
  description: string | null;
  product_weight: number | null;
  weight?: number | null; // DEV-RULE: Support weight decimal column from products DDL
  price_per_unit: number | null;
  cost_per_unit: number | null;
  is_serialized: boolean | number | null;
  isActive: number | null;
}

export interface RawCustomer {
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
  city: string | null;
  province: string | null;
  isActive: number | null;
}

export interface RawBranch {
  id: number;
  branch_name: string | null;
  branch_code: string | null;
  isActive: number | null;
}

export interface RawSalesman {
  id: number;
  salesman_code: string | null;
  salesman_name: string | null;
  isActive: number | null;
}

export interface AggregationSourceData {
  invoices: RawSalesInvoice[];
  invoiceDetails: RawSalesInvoiceDetail[];
  returns: RawSalesReturn[];
  returnDetails: RawSalesReturnDetail[];
  products: RawProduct[];
  customers: RawCustomer[];
  branches: RawBranch[];
  salesmen: RawSalesman[];
}

function parseBit(val: unknown): boolean {
  if (val === true || val === 1 || val === "1") return true;
  if (val && typeof val === "object" && "data" in val && Array.isArray((val as { data: number[] }).data)) {
    return (val as { data: number[] }).data[0] === 1;
  }
  return false;
}

const GAS_PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
];

// DEV-RULE: Robust date-to-ISO formatter supporting ISO timestamps, SQL timestamps, and standard date strings
function toISODate(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = String(raw).trim();
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export function aggregateSalesPerformanceReport(
  source: AggregationSourceData,
  filters: SalesPerformanceFilterInput
) {
  // DEV-RULE: Support string-normalized keys to guarantee exact matches across DB number and string IDs
  const productsMap = new Map<string, RawProduct>();
  for (const p of source.products) {
    if (p.product_id != null) productsMap.set(String(p.product_id).trim(), p);
  }

  const customersMap = new Map<string, RawCustomer>();
  for (const c of source.customers) {
    if (c.customer_code) customersMap.set(String(c.customer_code).trim(), c);
  }

  const branchesMap = new Map<string, RawBranch>();
  for (const b of source.branches) {
    if (b.id != null) branchesMap.set(String(b.id).trim(), b);
  }

  const salesmenMap = new Map<string, RawSalesman>();
  for (const s of source.salesmen) {
    if (s.id != null) salesmenMap.set(String(s.id).trim(), s);
  }

  // 1. Build lookup for verified returns by invoice_no and by order_id
  // Returns with isReceived = 1 or isPosted = 1
  const returnCreditsByInvoiceId = new Map<number, number>();
  const returnCreditsByInvoiceNo = new Map<string, number>();

  for (const sr of source.returns) {
    const isVerified = parseBit(sr.isReceived) || parseBit(sr.isPosted);
    if (!isVerified) continue;
    const amount = Number(sr.total_amount || 0);
    if (amount <= 0) continue;

    if (sr.invoice_no) {
      const invNoClean = String(sr.invoice_no).trim();
      const asNum = Number(invNoClean);
      if (!isNaN(asNum) && asNum > 0) {
        returnCreditsByInvoiceId.set(asNum, (returnCreditsByInvoiceId.get(asNum) || 0) + amount);
      }
      returnCreditsByInvoiceNo.set(invNoClean, (returnCreditsByInvoiceNo.get(invNoClean) || 0) + amount);
    }
  }

  // 2. Map invoice details to invoices
  // In Directus schema: invoice_no in sales_invoice_details points to sales_invoice.invoice_id (FK_sales_invoice_details_sales_invoice)
  // Also index by order_id as fallback support
  const detailsByInvoiceId = new Map<number, RawSalesInvoiceDetail[]>();
  const detailsByOrderNo = new Map<string, RawSalesInvoiceDetail[]>();

  for (const det of source.invoiceDetails) {
    const invId = Number(det.invoice_no || 0);
    if (invId) {
      const list = detailsByInvoiceId.get(invId) || [];
      list.push(det);
      detailsByInvoiceId.set(invId, list);
    }
    if (det.order_id && String(det.order_id).trim()) {
      const ordKey = String(det.order_id).trim();
      const list = detailsByOrderNo.get(ordKey) || [];
      list.push(det);
      detailsByOrderNo.set(ordKey, list);
    }
  }

  // 3. Filter and process sales invoices
  const allRecords: SalesPerformanceRecord[] = [];

  for (const inv of source.invoices) {
    // DEV-RULE: Exclude only explicit VOID or CANCELLED transactions in memory, preserving NULL/Prepared/POSTED
    const txStatus = String(inv.transaction_status || "").trim().toUpperCase();
    if (txStatus === "VOID" || txStatus === "CANCELLED") continue;

    const invoiceDateStr = toISODate(inv.invoice_date);
    if (!invoiceDateStr) continue;

    // Date range filter
    if (filters.startDate && invoiceDateStr < filters.startDate) continue;
    if (filters.endDate && invoiceDateStr > filters.endDate) continue;

    // Branch filter
    const branchId = Number(inv.branch_id || 0);
    if (filters.branchId && filters.branchId !== "ALL" && String(branchId) !== filters.branchId) {
      continue;
    }

    // Customer filter
    const customerCode = String(inv.customer_code || "").trim();
    if (filters.customerCode && filters.customerCode !== "ALL" && customerCode !== filters.customerCode) {
      continue;
    }

    // Salesman filter
    const salesmanId = Number(inv.salesman_id || 0);
    if (filters.salesmanId && filters.salesmanId !== "ALL" && String(salesmanId) !== filters.salesmanId) {
      continue;
    }

    // Tax treatment filter (isReceipt: 1 = VAT, 0 = Non-VAT)
    const isVatReceipt = parseBit(inv.isReceipt);
    if (filters.taxTreatment === "VAT" && !isVatReceipt) continue;
    if (filters.taxTreatment === "NON_VAT" && isVatReceipt) continue;

    // DEV-RULE: Retrieve branch, customer, and salesman using normalized string keys with intelligent ID fallbacks
    const branchKey = String(branchId);
    const branch = branchId > 0 ? branchesMap.get(branchKey) : undefined;
    const branchName = branch?.branch_name || (branchId > 0 ? `Branch #${branchId}` : "Unassigned Branch");
    const branchCode = branch?.branch_code || (branchId > 0 ? `#${branchId}` : "—");

    const customer = customerCode ? customersMap.get(customerCode) : undefined;

    const salesmanKey = String(salesmanId);
    const salesman = salesmanId > 0 ? salesmenMap.get(salesmanKey) : undefined;
    const salesmanName = salesman?.salesman_name || (salesmanId > 0 ? `Salesman #${salesmanId}` : "Unassigned");

    let details = detailsByInvoiceId.get(inv.invoice_id) || [];
    if (details.length === 0 && inv.order_id && String(inv.order_id).trim()) {
      details = detailsByOrderNo.get(String(inv.order_id).trim()) || [];
    }
    // DEV-RULE: Exclusively filter lines for serialized industrial gas & cylinder products. Ignore grocery/FMCG lines.
    const gasDetails = details.filter((d) => {
      const pId = typeof d.product_id === "object" && d.product_id ? d.product_id.product_id : Number(d.product_id || 0);
      const prod = productsMap.get(String(pId));
      return prod && parseBit(prod.is_serialized);
    });

    // If an invoice contains zero gas cylinder items, skip it entirely
    if (gasDetails.length === 0) {
      continue;
    }

    const totalLineGross = gasDetails.reduce(
      (sum, d) => sum + Number(d.gross_amount || Number(d.quantity || 0) * Number(d.unit_price || 0)),
      0
    );

    // Calculate total credit deductions for this invoice
    const creditByNum = returnCreditsByInvoiceId.get(inv.invoice_id) || 0;
    const creditByStr = inv.invoice_no ? (returnCreditsByInvoiceNo.get(String(inv.invoice_no).trim()) || 0) : 0;
    const invoiceCreditTotal = Math.max(creditByNum, creditByStr);

    // Process exclusively gas cylinder line details
    for (const d of gasDetails) {
      const pId = typeof d.product_id === "object" && d.product_id ? d.product_id.product_id : Number(d.product_id || 0);
      const pIdStr = String(pId);
      
      // DEV-RULE: Support multi-select product IDs (comma-separated or single ID)
      if (filters.productId && filters.productId !== "ALL") {
        const allowedProductIds = filters.productId.split(",").map((s) => s.trim()).filter(Boolean);
        if (allowedProductIds.length > 0 && !allowedProductIds.includes(pIdStr)) {
          continue;
        }
      }

      const product = productsMap.get(pIdStr);
      const isSerialized = true;
      // DEV-RULE: Support both weight and product_weight columns from products DDL table definition
      const weight = Number(product?.weight ?? product?.product_weight ?? 0);
      const qty = Number(d.quantity || 0);
      const lineGross = Number(d.gross_amount || (qty * Number(d.unit_price || 0)));
      const lineDiscount = Number(d.discount_amount || 0);

      // Proportionate credit deduction
      const lineProportion = totalLineGross > 0 ? (lineGross / totalLineGross) : (1 / gasDetails.length);
      const lineCredit = Math.round((invoiceCreditTotal * lineProportion) * 100) / 100;
      const lineNet = Math.max(0, lineGross - lineDiscount - lineCredit);
      const lineVat = isVatReceipt ? Math.round(((lineNet / 1.12) * 0.12) * 100) / 100 : 0;

      // Kg sold applies directly for cylinder gas products
      const kgSold = weight > 0 ? Math.round((qty * weight) * 100) / 100 : 0;

      const hasExceptions = weight <= 0;

      allRecords.push({
        id: `${inv.invoice_id}-${d.detail_id}`,
        invoiceId: inv.invoice_id,
        invoiceNo: String(inv.invoice_no || `SI-${inv.invoice_id}`),
        orderId: String(inv.order_id || d.order_id || "—"),
        invoiceDate: invoiceDateStr,
        dispatchDate: inv.dispatch_date ? inv.dispatch_date.split(/[ T]/)[0] : null,
        customerCode,
        customerName: customer?.customer_name || "Unknown Customer",
        storeName: customer?.store_name || "",
        branchId,
        branchName,
        branchCode,
        salesmanId,
        salesmanName,
        productId: pId,
        productCode: product?.product_code || "—",
        productName: product?.product_name || `Product #${pId}`,
        isSerialized,
        productWeight: weight,
        quantitySold: qty,
        kgSold,
        unitPrice: Number(d.unit_price || 0),
        grossAmount: lineGross,
        discountAmount: lineDiscount,
        creditAmount: lineCredit,
        netSales: lineNet,
        vatAmount: lineVat,
        taxTreatment: isVatReceipt ? "VAT 12%" : "Non-VAT / Exempt",
        recognitionBasis: parseBit(inv.isDispatched) ? "Invoice (Dispatched)" : "Official Receipt (Remitted)",
        transactionStatus: txStatus || "POSTED",
        isPosted: parseBit(inv.isPosted),
        hasExceptions,
        exceptionReason: hasExceptions ? "Serialized cylinder is missing product weight specification" : undefined,
      });
    }
  }

  // 4. Apply free-text search filter if present
  let filteredRecords = allRecords;
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    filteredRecords = filteredRecords.filter(
      (r) =>
        r.invoiceNo.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerCode.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q)
    );
  }

  // 5. Compute KPIs
  const totalGross = filteredRecords.reduce((sum, r) => sum + r.grossAmount, 0);
  const totalNet = filteredRecords.reduce((sum, r) => sum + r.netSales, 0);
  const totalCredits = filteredRecords.reduce((sum, r) => sum + r.creditAmount, 0);
  const totalKg = filteredRecords.reduce((sum, r) => sum + r.kgSold, 0);
  const uniqueInvoices = new Set(filteredRecords.map((r) => r.invoiceId));
  const vatSales = filteredRecords.filter((r) => r.taxTreatment === "VAT 12%").reduce((sum, r) => sum + r.netSales, 0);
  const nonVatSales = totalNet - vatSales;
  const avgOrderValue = uniqueInvoices.size > 0 ? totalNet / uniqueInvoices.size : 0;
  const overallKgRate = totalKg > 0 ? totalNet / totalKg : 0;

  const kpis: SalesPerformanceKPIs = {
    totalNetSales: Math.round(totalNet * 100) / 100,
    totalGrossSales: Math.round(totalGross * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalKgSold: Math.round(totalKg * 100) / 100,
    totalInvoices: uniqueInvoices.size,
    totalReturns: source.returns.filter((r) => parseBit(r.isReceived) || parseBit(r.isPosted)).length,
    averageOrderValue: Math.round(avgOrderValue * 100) / 100,
    vatSalesTotal: Math.round(vatSales * 100) / 100,
    nonVatSalesTotal: Math.round(nonVatSales * 100) / 100,
    overallKgRate: Math.round(overallKgRate * 100) / 100,
  };

  // 6. Compute Charts: Sales Trend
  const trendMap = new Map<string, { net: number; gross: number; kg: number; invs: Set<number> }>();
  for (const r of filteredRecords) {
    const d = r.invoiceDate;
    if (!d) continue;
    const entry = trendMap.get(d) || { net: 0, gross: 0, kg: 0, invs: new Set<number>() };
    entry.net += r.netSales;
    entry.gross += r.grossAmount;
    entry.kg += r.kgSold;
    entry.invs.add(r.invoiceId);
    trendMap.set(d, entry);
  }

  const sortedDates = Array.from(trendMap.keys()).sort();
  const salesTrend: SalesTrendPoint[] = sortedDates.map((date) => {
    const val = trendMap.get(date)!;
    return {
      date,
      netSales: Math.round(val.net * 100) / 100,
      grossSales: Math.round(val.gross * 100) / 100,
      kgSold: Math.round(val.kg * 100) / 100,
      invoicesCount: val.invs.size,
    };
  });

  // 7. Compute Charts: Gas Distribution (strictly gas volume in kilograms)
  const gasMap = new Map<string, { kg: number; net: number }>();
  for (const r of filteredRecords) {
    if (r.kgSold <= 0) continue;
    const key = r.productName || "Other Industrial Gas";
    const entry = gasMap.get(key) || { kg: 0, net: 0 };
    entry.kg += r.kgSold;
    entry.net += r.netSales;
    gasMap.set(key, entry);
  }

  const totalGasKg = Array.from(gasMap.values()).reduce((sum, v) => sum + v.kg, 0);

  const gasDistribution: GasDistributionPoint[] = Array.from(gasMap.entries())
    .sort((a, b) => b[1].kg - a[1].kg)
    .slice(0, 8)
    .map(([gasType, val], index) => {
      const pct = totalGasKg > 0 ? Math.round((val.kg / totalGasKg) * 1000) / 10 : 0;
      return {
        gasType,
        kgSold: Math.round(val.kg * 100) / 100,
        netSales: Math.round(val.net * 100) / 100,
        percentage: pct,
        color: GAS_PALETTE[index % GAS_PALETTE.length],
      };
    });

  // 8. Compute Charts: Branch Comparison
  const branchCompMap = new Map<number, { name: string; code: string; net: number; kg: number; invs: Set<number> }>();
  for (const r of filteredRecords) {
    const bId = r.branchId;
    const entry = branchCompMap.get(bId) || {
      name: r.branchName,
      code: r.branchCode,
      net: 0,
      kg: 0,
      invs: new Set<number>(),
    };
    entry.net += r.netSales;
    entry.kg += r.kgSold;
    entry.invs.add(r.invoiceId);
    branchCompMap.set(bId, entry);
  }

  const branchComparison: BranchComparisonPoint[] = Array.from(branchCompMap.entries())
    .map(([bId, val]) => ({
      branchId: bId,
      branchName: val.name,
      branchCode: val.code,
      netSales: Math.round(val.net * 100) / 100,
      kgSold: Math.round(val.kg * 100) / 100,
      invoiceCount: val.invs.size,
      averageTicket: val.invs.size > 0 ? Math.round((val.net / val.invs.size) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.netSales - a.netSales);

  const charts: SalesPerformanceChartsData = {
    salesTrend,
    gasDistribution,
    branchComparison,
  };

  // 9. Compute Rankings: Top Customers
  const customerRankMap = new Map<string, CustomerRanking>();
  for (const r of filteredRecords) {
    const code = r.customerCode || "UNKNOWN";
    const entry = customerRankMap.get(code) || {
      customerCode: code,
      customerName: r.customerName,
      storeName: r.storeName,
      branchName: r.branchName,
      totalInvoices: 0,
      totalKgSold: 0,
      totalNetSales: 0,
    };
    entry.totalKgSold += r.kgSold;
    entry.totalNetSales += r.netSales;
    customerRankMap.set(code, entry);
  }

  const topCustomers = Array.from(customerRankMap.values())
    .sort((a, b) => b.totalNetSales - a.totalNetSales)
    .slice(0, 10)
    .map((c) => ({
      ...c,
      totalKgSold: Math.round(c.totalKgSold * 100) / 100,
      totalNetSales: Math.round(c.totalNetSales * 100) / 100,
    }));

  // 10. Compute Rankings: Top Products
  const productRankMap = new Map<number, ProductRanking>();
  for (const r of filteredRecords) {
    const pId = r.productId;
    const entry = productRankMap.get(pId) || {
      productId: pId,
      productCode: r.productCode,
      productName: r.productName,
      isSerialized: r.isSerialized,
      totalUnitsSold: 0,
      totalKgSold: 0,
      totalNetSales: 0,
    };
    entry.totalUnitsSold += r.quantitySold;
    entry.totalKgSold += r.kgSold;
    entry.totalNetSales += r.netSales;
    productRankMap.set(pId, entry);
  }

  const topProducts = Array.from(productRankMap.values())
    .sort((a, b) => b.totalNetSales - a.totalNetSales)
    .slice(0, 10)
    .map((p) => ({
      ...p,
      totalKgSold: Math.round(p.totalKgSold * 100) / 100,
      totalNetSales: Math.round(p.totalNetSales * 100) / 100,
    }));

  const rankings: SalesPerformanceRankings = {
    topCustomers,
    topProducts,
  };

  // 11. Sort records
  filteredRecords.sort((a, b) => {
    let cmp = 0;
    if (filters.sortBy === "invoiceDate") cmp = a.invoiceDate.localeCompare(b.invoiceDate);
    else if (filters.sortBy === "netSales") cmp = a.netSales - b.netSales;
    else if (filters.sortBy === "kgSold") cmp = a.kgSold - b.kgSold;
    else if (filters.sortBy === "customerName") cmp = a.customerName.localeCompare(b.customerName);
    else if (filters.sortBy === "branchName") cmp = a.branchName.localeCompare(b.branchName);
    return filters.sortOrder === "desc" ? -cmp : cmp;
  });

  // 12. Paginate records
  const page = Math.max(1, filters.page);
  const pageSize = Math.max(1, filters.pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

  return {
    records: paginatedRecords,
    totalRecords: filteredRecords.length,
    kpis,
    charts,
    rankings,
    metadata: {
      generatedAt: new Date().toISOString(),
      cutoffTimestamp: `${filters.endDate} 23:59:59`,
      appliedFiltersSummary: `Branch: ${filters.branchId}, Period: ${filters.startDate} to ${filters.endDate}`,
    },
  };
}
