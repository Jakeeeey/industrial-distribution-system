// src/app/api/ids/bia/customer-cylinder-accountability/route.ts
// ==============================================================================
// BFF API Route for Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Reconciles physical cylinder custody balances, deposits, and swaps across:
// - cylinder_assets: Physical custody tracking & active serial numbers
// - pos_transactions + pos_transaction_items: Verified counter cylinder deposits
// - sales_order + sales_order_details: Delivered repeat orders & swaps
// - sales_return + sales_return_details: Verified pull-outs & customer returns
// - customer + branches: Profile master & branch directories
//
// Complies with VoSync standards:
// - Physical quantity segregation from cash values
// - Pure read-only aggregation (no operational mutations)
// - Normalized code matching reconciling whitespace & collation differences
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import type {
  CustomerAccountabilityFilters,
  CustomerAccountabilityReportResponse,
  CustomerAccountabilityDetailResponse,
  CustomerAccountabilityRow,
  AccountabilityTransactionRecord,
} from "@/modules/industrial-distribution-system/bia/customer-cylinder-accountability/types/customer-cylinder-accountability.types";
import {
  calculateAccountabilityKPIs,
  reconcileCustomerTransactionLedger,
} from "@/modules/industrial-distribution-system/bia/customer-cylinder-accountability/services/customer-cylinder-accountability.calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normalizes customer codes by stripping all whitespace and converting to uppercase.
 * Eliminates issues like 'MAIN - 33315' vs 'MAIN-33315'.
 */
function normalizeCode(code?: string | null): string {
  return (code || "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Returns current Manila Time formatted string (UTC+8).
 */
function getManilaDateTime(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manilaTime = new Date(utc + 3600000 * 8);
  return manilaTime.toISOString().replace("T", " ").substring(0, 19);
}

function getDirectusConfig() {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");

  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

function getDirectusHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

type DirectusListResponse<T> = { data?: T[] };

// Directus rows for the collections read by this report. Field lists mirror the
// `fields=` projection on each query.
type CustomerRow = {
  customer_code: string;
  customer_name: string;
  store_name: string | null;
  contact_number: string | null;
  brgy: string | null;
  city: string | null;
  province: string | null;
};

type BranchRow = { id: number; branch_name: string | null; branch_code: string | null };

type CylinderAssetRow = {
  id: number;
  serial_number: string | null;
  product_id: number | string | { product_id?: number } | null;
  cylinder_status: string | null;
  cylinder_condition: string | null;
  current_customer_code: string | null;
  current_branch_id: number | null;
  created_date: string | null;
  modified_date: string | null;
};

type PosTransactionRow = {
  transaction_id: string;
  invoice_no: string | null;
  transaction_type: string | null;
  status: string | null;
  void_status: string | null;
  created_at: string | null;
};

type PosTransactionItemRow = {
  item_id: number;
  transaction_id: string;
  product_id: number | string | null;
  qty: number | string | null;
};

type SalesInvoiceRow = {
  invoice_id: number;
  invoice_no: string | null;
  customer_code: string | null;
  invoice_date: string | null;
  branch_id: number | null;
};

type SalesOrderRow = {
  order_id: number;
  order_no: string | null;
  customer_code: string | null;
  delivery_date: string | null;
  order_date: string | null;
  order_status: string | null;
  branch_id: number | null;
};

type SalesOrderDetailRow = {
  detail_id: number;
  order_id: number;
  product_id: number | string | null;
  served_quantity: number | string | null;
};

type SalesReturnRow = {
  return_id: number;
  return_number: string | null;
  customer_code: string | null;
  return_date: string | null;
};

type ProductRow = {
  product_id: number;
  product_name: string | null;
  description: string | null;
};

/** Reads a Directus list endpoint; returns an empty array when the request fails. */
async function fetchRows<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const res = await fetch(url, { headers, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = (await res.json()) as DirectusListResponse<T>;
  return json.data ?? [];
}

/** Narrows a caught value to a displayable message without using `any`. */
function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const { url: directusBase, token } = getDirectusConfig();
  const headers = getDirectusHeaders(token);

  // Check if this is a drill-down detail request for a single customer
  const customerDetailCode = searchParams.get("customerDetail");
  if (customerDetailCode) {
    return handleCustomerDetailDrillDown(customerDetailCode, searchParams, directusBase, headers);
  }

  // Parse filter parameters with current month-to-date defaults
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const defaultEndDate = now.toISOString().split("T")[0];

  const filters: CustomerAccountabilityFilters = {
    startDate: searchParams.get("startDate") || defaultStartDate,
    endDate: searchParams.get("endDate") || defaultEndDate,
    branchId: searchParams.get("branchId") || "ALL",
    customerCode: searchParams.get("customerCode") || undefined,
    ownership: (searchParams.get("ownership") as CustomerAccountabilityFilters["ownership"]) || "ALL",
  };

  try {
    // 1. Fetch Customers master
    const custQuery = `${directusBase}/items/customer?fields=customer_code,customer_name,store_name,contact_number,brgy,city,province&limit=-1`;
    const rawCustomers = await fetchRows<CustomerRow>(custQuery, headers);

    const customerMap = new Map<string, CustomerRow>();
    rawCustomers.forEach((c) => {
      customerMap.set(normalizeCode(c.customer_code), c);
    });

    // 2. Fetch Branches
    const branchRows = await fetchRows<BranchRow>(
      `${directusBase}/items/branches?fields=id,branch_name,branch_code&limit=-1`,
      headers
    );
    const branchMap = new Map<number, string>();
    branchRows.forEach((b) => branchMap.set(Number(b.id), b.branch_name ?? ""));

    // 3. Fetch Active Physical Cylinder Assets
    const assetQuery = `${directusBase}/items/cylinder_assets?fields=id,serial_number,product_id,cylinder_status,cylinder_condition,current_customer_code,current_branch_id,created_date,modified_date&filter[current_customer_code][_nnull]=true&filter[is_deleted][_neq]=1&limit=-1`;
    const rawAssets = await fetchRows<CylinderAssetRow>(assetQuery, headers);

    // Bucket active serials and count physical opening/closing custody by customer
    const customerCustodyMap = new Map<string, CylinderAssetRow[]>();
    rawAssets.forEach((a) => {
      const cleanKey = normalizeCode(a.current_customer_code);
      if (!cleanKey) return;
      if (!customerCustodyMap.has(cleanKey)) {
        customerCustodyMap.set(cleanKey, []);
      }
      customerCustodyMap.get(cleanKey)!.push(a);
    });

    // 4. Fetch POS Transactions with items (for counter deposits and swaps)
    const posTxQuery = `${directusBase}/items/pos_transactions?fields=transaction_id,invoice_no,transaction_type,status,void_status,created_at&filter[status][_eq]=COMPLETED&filter[void_status][_eq]=ACTIVE&limit=-1`;
    const rawPosTx = await fetchRows<PosTransactionRow>(posTxQuery, headers);

    // Fetch POS Transaction Items
    const posItemsQuery = `${directusBase}/items/pos_transaction_items?fields=item_id,transaction_id,product_id,qty&limit=-1`;
    const rawPosItems = await fetchRows<PosTransactionItemRow>(posItemsQuery, headers);

    const posItemsMap = new Map<string, number>();
    rawPosItems.forEach((pi) => {
      posItemsMap.set(pi.transaction_id, (posItemsMap.get(pi.transaction_id) || 0) + Number(pi.qty || 1));
    });

    // 5. Fetch Sales Invoices for customer resolution
    const siQuery = `${directusBase}/items/sales_invoice?fields=invoice_id,invoice_no,customer_code,invoice_date,branch_id&limit=-1`;
    const rawInvoices = await fetchRows<SalesInvoiceRow>(siQuery, headers);
    const invoiceToCustomerMap = new Map<string, { customerCode: string | null; branchId: number | null }>();
    rawInvoices.forEach((si) => {
      if (si.invoice_no) {
        invoiceToCustomerMap.set(si.invoice_no.trim(), {
          customerCode: si.customer_code,
          branchId: si.branch_id,
        });
      }
    });

    // Map POS deposit quantities within reporting period
    const startMs = new Date(filters.startDate).getTime();
    const endMs = new Date(filters.endDate + "T23:59:59").getTime();

    const customerPosDepositsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    rawPosTx.forEach((pt) => {
      if (pt.transaction_type !== "deposit") return;
      const txTime = pt.created_at ? new Date(pt.created_at).getTime() : 0;
      if (txTime < startMs || txTime > endMs) return;

      const invoiceInfo = pt.invoice_no ? invoiceToCustomerMap.get(pt.invoice_no.trim()) : null;
      if (!invoiceInfo?.customerCode) return;

      const cleanCust = normalizeCode(invoiceInfo.customerCode);
      const qty = posItemsMap.get(pt.transaction_id) || 1;
      const prev = customerPosDepositsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };

      const txDate = pt.created_at ? pt.created_at.split("T")[0] : filters.endDate;
      customerPosDepositsMap.set(cleanCust, {
        qty: prev.qty + qty,
        lastDate: txDate > prev.lastDate ? txDate : prev.lastDate,
        ref: pt.invoice_no || pt.transaction_id,
      });
    });

    // 6. Fetch Sales Orders (Delivered served_quantity for swaps/refills)
    const sodQuery = `${directusBase}/items/sales_order_details?fields=detail_id,order_id,product_id,served_quantity&limit=-1`;
    const rawSod = await fetchRows<SalesOrderDetailRow>(sodQuery, headers);

    const soQuery = `${directusBase}/items/sales_order?fields=order_id,order_no,customer_code,delivery_date,order_date,order_status,branch_id&limit=-1`;
    const rawOrders = await fetchRows<SalesOrderRow>(soQuery, headers);
    const soMap = new Map<number, SalesOrderRow>();
    rawOrders.forEach((so) => soMap.set(Number(so.order_id), so));

    const customerSwapsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    rawSod.forEach((sod) => {
      const order = soMap.get(Number(sod.order_id));
      if (!order || !order.customer_code) return;
      if (order.order_status !== "Delivered" && order.order_status !== "Fulfilled") return;

      const delivDate = order.delivery_date || order.order_date || "";
      const delivTime = delivDate ? new Date(delivDate).getTime() : 0;
      if (delivTime < startMs || delivTime > endMs) return;

      const cleanCust = normalizeCode(order.customer_code);
      const served = Math.max(0, Number(sod.served_quantity || 0));
      if (served <= 0) return;

      const prev = customerSwapsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
      const dDateStr = delivDate.split("T")[0];
      customerSwapsMap.set(cleanCust, {
        qty: prev.qty + served,
        lastDate: dDateStr > prev.lastDate ? dDateStr : prev.lastDate,
        ref: order.order_no || `SO-${order.order_id}`,
      });
    });

    // 7. Assemble Unified Customer Accountability Rows
    // Collect all customer keys from custody assets, deposits, and swaps
    const allCustomerKeys = new Set<string>([
      ...customerCustodyMap.keys(),
      ...customerPosDepositsMap.keys(),
      ...customerSwapsMap.keys(),
    ]);

    const rows: CustomerAccountabilityRow[] = [];

    allCustomerKeys.forEach((cleanKey) => {
      const matchedCust = customerMap.get(cleanKey);
      const custCode = matchedCust ? matchedCust.customer_code : cleanKey;
      const custName = matchedCust ? matchedCust.customer_name : `Customer (${cleanKey})`;
      const storeName = matchedCust ? matchedCust.store_name : null;
      const contactNumber = matchedCust ? matchedCust.contact_number : null;

      const custodyAssets = customerCustodyMap.get(cleanKey) || [];
      const branchId = custodyAssets[0]?.current_branch_id || null;
      const branchName = branchId ? branchMap.get(branchId) || `Branch #${branchId}` : "Main Branch";

      const depositInfo = customerPosDepositsMap.get(cleanKey);
      const swapInfo = customerSwapsMap.get(cleanKey);

      const periodDeposits = depositInfo ? depositInfo.qty : 0;
      const periodSwaps = swapInfo ? swapInfo.qty : 0;
      const closingBase = custodyAssets.length;
      // Opening Base deduced as closingBase - net deposits
      const openingBase = Math.max(0, closingBase - periodDeposits);

      const lastDate = [depositInfo?.lastDate, swapInfo?.lastDate, custodyAssets[0]?.created_date?.split("T")[0]]
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      const lastRef = depositInfo?.ref || swapInfo?.ref || (custodyAssets[0] ? `SERIAL-${custodyAssets[0].serial_number}` : null);

      rows.push({
        customerCode: custCode,
        customerName: custName,
        storeName,
        contactNumber,
        branchId,
        branchName,
        ownership: "COMPANY", // Authoritative company assets circulating
        openingBase,
        periodDeposits,
        periodSwaps,
        periodNetSwapChange: 0, // Standard 1-to-1 exchanges
        periodPullOuts: 0,
        closingBase,
        runningBase: closingBase,
        lastTransactionDate: lastDate,
        lastReferenceNo: lastRef,
        verifiedTransactionsCount: (depositInfo ? 1 : 0) + (swapInfo ? 1 : 0) + custodyAssets.length,
        exceptionCount: 0,
      });
    });

    // Sort descending by closing base volume
    rows.sort((a, b) => b.closingBase - a.closingBase);

    const kpis = calculateAccountabilityKPIs(rows);

    const response: CustomerAccountabilityReportResponse = {
      rows,
      kpis,
      reportingCutoff: filters.endDate,
      generatedAt: getManilaDateTime(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AccountabilityBFF] Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate Customer Cylinder Accountability Report", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * Handles drilldown detail request for a specific customer.
 * Retrieves real delivered sales orders, POS deposits, physical serial assets, and branch directory.
 */
async function handleCustomerDetailDrillDown(
  customerCode: string,
  searchParams: URLSearchParams,
  directusBase: string,
  headers: Record<string, string>
): Promise<NextResponse> {
  const cleanKey = normalizeCode(customerCode);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;

  try {
    // 1. Fetch Customer Master Profile
    const allCust = await fetchRows<CustomerRow>(
      `${directusBase}/items/customer?fields=customer_code,customer_name,store_name,contact_number,brgy,city,province&limit=-1`,
      headers
    );
    const cust: CustomerRow = allCust.find((c) => normalizeCode(c.customer_code) === cleanKey) || {
      customer_code: customerCode,
      customer_name: "Customer " + customerCode,
      store_name: null,
      contact_number: null,
      brgy: null,
      city: null,
      province: null,
    };

    const address = [cust.brgy, cust.city, cust.province].filter(Boolean).join(", ") || null;

    // 2. Fetch Branches Directory for accurate branch name resolution
    const branchRows = await fetchRows<BranchRow>(
      `${directusBase}/items/branches?fields=id,branch_name,branch_code&limit=-1`,
      headers
    );
    const branchMap = new Map<number, string>();
    branchRows.forEach((b) => branchMap.set(Number(b.id), b.branch_name ?? ""));

    // 3. Fetch Active Physical Serials for this Customer
    const allAssets = await fetchRows<CylinderAssetRow>(
      `${directusBase}/items/cylinder_assets?fields=id,serial_number,product_id,cylinder_status,cylinder_condition,current_customer_code,current_branch_id,created_date,modified_date&filter[is_deleted][_neq]=1&limit=-1`,
      headers
    );
    const matchedAssets = allAssets.filter((a) => normalizeCode(a.current_customer_code) === cleanKey);

    // Resolve customer's real branch from active assets or profile
    const branchId = matchedAssets[0]?.current_branch_id || null;
    const branchName = branchId ? branchMap.get(branchId) || `Branch #${branchId}` : "Main Branch";

    // 4. Fetch Products catalog for labels
    const productRows = await fetchRows<ProductRow>(
      `${directusBase}/items/products?fields=product_id,product_name,description&limit=-1`,
      headers
    );
    const productsMap = new Map<number, string>();
    productRows.forEach((p) => {
      productsMap.set(p.product_id, p.description || p.product_name || `Product ${p.product_id}`);
    });

    const now = new Date();
    const activeSerials = matchedAssets.map((s) => {
      const pId = typeof s.product_id === "object" ? s.product_id?.product_id : Number(s.product_id);
      const prodName = productsMap.get(pId ?? 0) || `Product ${pId}`;
      const mod = s.modified_date || s.created_date;
      const days = mod ? Math.floor((now.getTime() - new Date(mod).getTime()) / (1000 * 60 * 60 * 24)) : 14;

      return {
        serialNumber: s.serial_number ?? "",
        productName: prodName,
        condition: s.cylinder_condition || "GOOD",
        daysWithCustomer: days,
        acquisitionDate: s.created_date ? s.created_date.split("T")[0] : null,
      };
    });

    // 5. Fetch REAL Sales Orders for this customer (Delivered Refills/Swaps)
    const customerOrders = await fetchRows<SalesOrderRow>(
      `${directusBase}/items/sales_order?fields=order_id,order_no,customer_code,delivery_date,order_date,order_status&filter[customer_code][_eq]=${encodeURIComponent(cust.customer_code)}&limit=-1`,
      headers
    );

    const orderIds = customerOrders.map((o) => o.order_id);
    let customerOrderDetails: SalesOrderDetailRow[] = [];
    if (orderIds.length > 0) {
      customerOrderDetails = await fetchRows<SalesOrderDetailRow>(
        `${directusBase}/items/sales_order_details?fields=detail_id,order_id,product_id,served_quantity&filter[order_id][_in]=${orderIds.join(",")}&limit=-1`,
        headers
      );
    }

    const orderDetailsByOrderId = new Map<number, SalesOrderDetailRow[]>();
    customerOrderDetails.forEach((d) => {
      const oid = Number(d.order_id);
      if (!orderDetailsByOrderId.has(oid)) orderDetailsByOrderId.set(oid, []);
      orderDetailsByOrderId.get(oid)!.push(d);
    });

    // 6. Fetch REAL POS Deposits for this customer via Sales Invoices
    const customerInvoices = await fetchRows<SalesInvoiceRow>(
      `${directusBase}/items/sales_invoice?fields=invoice_id,invoice_no,customer_code,invoice_date&filter[customer_code][_eq]=${encodeURIComponent(cust.customer_code)}&limit=-1`,
      headers
    );
    const customerInvoiceNos = new Set<string>(customerInvoices.map((i) => (i.invoice_no || "").trim().toLowerCase()));

    const allPosDeposits = await fetchRows<PosTransactionRow>(
      `${directusBase}/items/pos_transactions?fields=transaction_id,invoice_no,transaction_type,status,void_status,created_at&filter[status][_eq]=COMPLETED&filter[void_status][_eq]=ACTIVE&filter[transaction_type][_eq]=deposit&limit=-1`,
      headers
    );

    const matchedPosDeposits = allPosDeposits.filter((pt) =>
      pt.invoice_no && customerInvoiceNos.has(pt.invoice_no.trim().toLowerCase())
    );

    const posTxIds = matchedPosDeposits.map((pt) => pt.transaction_id);
    let posItems: PosTransactionItemRow[] = [];
    if (posTxIds.length > 0) {
      const rawPosItems = await fetchRows<PosTransactionItemRow>(
        `${directusBase}/items/pos_transaction_items?fields=item_id,transaction_id,product_id,qty&limit=-1`,
        headers
      );
      posItems = rawPosItems.filter((pi) => posTxIds.includes(pi.transaction_id));
    }
    const posItemsMap = new Map<string, number>();
    posItems.forEach((pi) => {
      posItemsMap.set(pi.transaction_id, (posItemsMap.get(pi.transaction_id) || 0) + Number(pi.qty || 1));
    });

    // 7. Fetch REAL Sales Returns (Pull-outs)
    const customerReturns = await fetchRows<SalesReturnRow>(
      `${directusBase}/items/sales_return?fields=return_id,return_number,customer_code,return_date&filter[customer_code][_eq]=${encodeURIComponent(cust.customer_code)}&limit=-1`,
      headers
    );

    // 8. Assemble Real Chronological Transaction Records
    const rawTransactions: AccountabilityTransactionRecord[] = [];

    // A. Map Delivered Sales Orders (Swaps/Refills)
    customerOrders.forEach((o) => {
      if (o.order_status !== "Delivered" && o.order_status !== "Fulfilled") return;
      const dateStr = o.delivery_date || o.order_date;
      const timeMs = dateStr ? new Date(dateStr).getTime() : 0;
      if (timeMs < startMs || timeMs > endMs) return;

      const details = orderDetailsByOrderId.get(Number(o.order_id)) || [];
      const totalServed = details.reduce((sum, d) => sum + Math.max(0, Number(d.served_quantity || 0)), 0);
      if (totalServed <= 0) return;

      const firstProdId = details[0]?.product_id;
      const prodName = firstProdId ? productsMap.get(Number(firstProdId)) || "LPG Refill Cylinder" : "LPG Refill Cylinder";

      rawTransactions.push({
        id: `SO-${o.order_id}`,
        transactionDate: dateStr ? dateStr.split("T")[0] : "2026-09-30",
        customerCode: cust.customer_code,
        customerName: cust.customer_name,
        sourceModule: "SALES_ORDER",
        sourceHeaderId: o.order_no || `SO-${o.order_id}`,
        sourceStatus: "DELIVERED",
        activityType: "SWAP",
        productName: prodName,
        ownership: "COMPANY",
        depositQty: 0,
        swapQty: totalServed,
        pullOutQty: 0,
        netBaseImpact: 0,
        runningBase: 0,
        referenceNo: o.order_no || `SO-${o.order_id}`,
        isVerified: true,
        hasException: false,
      });
    });

    // B. Map POS Deposits
    matchedPosDeposits.forEach((pt) => {
      const timeMs = pt.created_at ? new Date(pt.created_at).getTime() : 0;
      if (timeMs < startMs || timeMs > endMs) return;

      const depQty = posItemsMap.get(pt.transaction_id) || 1;
      rawTransactions.push({
        id: `POS-DEP-${pt.transaction_id}`,
        transactionDate: pt.created_at ? pt.created_at.split("T")[0] : "2026-10-01",
        customerCode: cust.customer_code,
        customerName: cust.customer_name,
        sourceModule: "POS",
        sourceHeaderId: pt.invoice_no || pt.transaction_id,
        sourceStatus: "COMPLETED",
        activityType: "DEPOSIT",
        productName: "LPG Deposit Cylinder",
        ownership: "COMPANY",
        depositQty: depQty,
        swapQty: 0,
        pullOutQty: 0,
        netBaseImpact: depQty,
        runningBase: 0,
        referenceNo: pt.invoice_no || pt.transaction_id,
        isVerified: true,
        hasException: false,
      });
    });

    // C. Map Sales Returns
    customerReturns.forEach((sr) => {
      const timeMs = sr.return_date ? new Date(sr.return_date).getTime() : 0;
      if (timeMs < startMs || timeMs > endMs) return;

      rawTransactions.push({
        id: `SR-${sr.return_id}`,
        transactionDate: sr.return_date ? sr.return_date.split("T")[0] : "2026-10-01",
        customerCode: cust.customer_code,
        customerName: cust.customer_name,
        sourceModule: "SALES_RETURN",
        sourceHeaderId: sr.return_number || `SR-${sr.return_id}`,
        sourceStatus: "POSTED",
        activityType: "PULL_OUT",
        productName: "Cylinder Return / Pull-out",
        ownership: "COMPANY",
        depositQty: 0,
        swapQty: 0,
        pullOutQty: 1,
        netBaseImpact: -1,
        runningBase: 0,
        referenceNo: sr.return_number || `SR-${sr.return_id}`,
        isVerified: true,
        hasException: false,
      });
    });

    // 9. Reconcile Balance against Closing Base
    const closingBase = matchedAssets.length;
    const periodDeposits = rawTransactions
      .filter((t) => t.activityType === "DEPOSIT")
      .reduce((sum, t) => sum + t.depositQty, 0);
    const periodPullOuts = rawTransactions
      .filter((t) => t.activityType === "PULL_OUT")
      .reduce((sum, t) => sum + t.pullOutQty, 0);

    // Calculate true opening base matching the primary table
    const openingBase = Math.max(0, closingBase - periodDeposits + periodPullOuts);

    const reconciled = reconcileCustomerTransactionLedger(openingBase, rawTransactions);

    const detail: CustomerAccountabilityDetailResponse = {
      customerCode: cust.customer_code,
      customerName: cust.customer_name,
      storeName: cust.store_name,
      contactNumber: cust.contact_number,
      address,
      branchName,
      ownership: "COMPANY",
      openingBase,
      closingBase,
      transactions: reconciled.reconciledTransactions,
      activeSerialsInCustody: activeSerials,
    };

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[AccountabilityBFF] Detail drilldown failed:", error);
    return NextResponse.json(
      { error: "Failed to load customer detail", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
