// src/app/api/ids/scm/cylinder-asset-management/customer-cylinder-accountability/route.ts
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
} from "@/modules/industrial-distribution-system/supply-chain-management/cylinder-asset-management/customer-cylinder-accountability/types/customer-cylinder-accountability.types";
import {
  calculateAccountabilityKPIs,
  reconcileCustomerTransactionLedger,
  calculateCustomerTurnaroundMetrics,
} from "@/modules/industrial-distribution-system/supply-chain-management/cylinder-asset-management/customer-cylinder-accountability/services/customer-cylinder-accountability.calc";

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
  remarks?: string | null;
};

type SalesOrderDetailRow = {
  detail_id: number;
  order_id: number;
  product_id: number | string | null;
  served_quantity?: number | string | null;
  allocated_quantity?: number | string | null;
  ordered_quantity?: number | string | null;
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
  product_code?: string | null;
  is_serialized?: number | boolean | string | null;
};

// AG-COMMENT: Types for Commercial & Manifold Site Operations (SNET Spec v1.0 §4, §11)
type LpgCustomerSiteRow = {
  id: number;
  customer_code: string | null;
  site_name: string | null;
  site_address: string | null;
  billing_mode?: string | null;
  is_active?: number | boolean | null;
};

type LpgCustomerSiteCylinderRow = {
  id: number;
  lpg_site_id: number;
  customer_code: string | null;
  cylinder_asset_id: number;
  installed_date: string | null;
  removed_date: string | null;
  site_cylinder_status: string | null;
  remarks?: string | null;
};

type LpgWiwoHeaderRow = {
  id: number;
  wiwo_no: string | null;
  lpg_site_id: number | null;
  customer_code: string | null;
  transaction_date: string | null;
  wiwo_type: string | null;
  total_returned_cylinders?: number | string | null;
  total_deployed_cylinders?: number | string | null;
  wiwo_status: string | null;
  sales_invoice_no?: string | null;
  remarks?: string | null;
};

/**
 * AG-COMMENT: Helper to determine if a line item represents a true physical cylinder asset deposit/issuance
 * (which increases customer custody: Issued (+)) vs. a routine gas commodity refill exchange (1-to-1 swap, net zero custody change).
 * In industrial distribution, gas refills (even if serialized) are routine swaps that do NOT increase held custody.
 * Only explicit cylinder deposit purchases, onboarding packages, or container deposit fees increase custody.
 */
function isCylinderIssuanceProduct(product: ProductRow | undefined, orderRemarks?: string | null): boolean {
  if (product && Number(product.is_serialized) !== 1) return false;
  if (!product && !orderRemarks) return false;
  const remarksText = (orderRemarks ?? "").toLowerCase();
  if (remarksText.includes("initial cylinder onboarding") || remarksText.includes("new cylinder deployment")) {
    return true;
  }
  if (!product) return false;
  const text = `${product.product_name ?? ""} ${product.description ?? ""}`.toLowerCase();
  // Any refill, gas content, exchange, or commodity delivery is a SWAP (zero net custody change)
  if (text.includes("refill") || text.includes("content") || text.includes("exchange") || text.includes("gas only")) {
    return false;
  }
  // True deposit lines or container asset acquisition packages
  if (
    text.includes("deposit") ||
    text.includes("cylinder package") ||
    text.includes("new cylinder") ||
    text.includes("initial package") ||
    text.includes("container fee")
  ) {
    return true;
  }
  return false;
}

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

    // 2. Fetch Branches (division_id = 1 for Industrial)
    // AG-COMMENT: Restrict branch queries strictly to Industrial Division (division_id = 1)
    const branchRows = await fetchRows<BranchRow>(
      `${directusBase}/items/branches?fields=id,branch_name,branch_code&filter[division_id][_eq]=1&limit=-1`,
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

    // 6. Fetch Products catalog for distinguishing Serialized Cylinder Asset Issuances vs Refill Swaps
    const prodQuery = `${directusBase}/items/products?fields=product_id,product_code,product_name,description,is_serialized&limit=-1`;
    const rawProducts = await fetchRows<ProductRow>(prodQuery, headers);
    const productCatalogMap = new Map<number, ProductRow>();
    rawProducts.forEach((p) => productCatalogMap.set(Number(p.product_id), p));

    // 7. Fetch Sales Orders (Delivered quantities for deposits/issuances and swaps/refills)
    const sodQuery = `${directusBase}/items/sales_order_details?fields=detail_id,order_id,product_id,served_quantity,allocated_quantity,ordered_quantity&limit=-1`;
    const rawSod = await fetchRows<SalesOrderDetailRow>(sodQuery, headers);

    const soQuery = `${directusBase}/items/sales_order?fields=order_id,order_no,customer_code,delivery_date,order_date,order_status,branch_id,remarks&limit=-1`;
    const rawOrders = await fetchRows<SalesOrderRow>(soQuery, headers);
    const soMap = new Map<number, SalesOrderRow>();
    rawOrders.forEach((so) => soMap.set(Number(so.order_id), so));

    // AG-COMMENT: Separate Sales Order deliveries into:
    // 1) SO Cylinder Deposits / Issuances (expands customer custody base, counts in Issued (+))
    // 2) SO Refill Swaps (routine 1-for-1 gas exchanges, net-zero custody impact, counts in Swaps)
    const customerSoDepositsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    const customerSwapsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();

    rawSod.forEach((sod) => {
      const order = soMap.get(Number(sod.order_id));
      if (!order || !order.customer_code) return;
      if (order.order_status !== "Delivered" && order.order_status !== "Fulfilled") return;

      const delivDate = order.delivery_date || order.order_date || "";
      const delivTime = delivDate ? new Date(delivDate).getTime() : 0;
      if (delivTime < startMs || delivTime > endMs) return;

      const cleanCust = normalizeCode(order.customer_code);
      // AG-COMMENT: Fallback to allocated_quantity or ordered_quantity if served_quantity is 0 or unrecorded
      const served = Math.max(0, Number(sod.served_quantity || sod.allocated_quantity || sod.ordered_quantity || 0));
      if (served <= 0) return;

      const pId = Number(sod.product_id);
      const prod = productCatalogMap.get(pId);
      // AG-COMMENT: Customer cylinder accountability is strictly for SERIALIZED CYLINDERS (is_serialized = 1).
      // Discard non-cylinder goods (e.g. Alcoplus sanitizers, alcohol, food, groceries, general merchandise).
      if (!prod || Number(prod.is_serialized) !== 1) {
        return;
      }
      const isDepositIssuance = isCylinderIssuanceProduct(prod, order.remarks);

      const dDateStr = delivDate.split("T")[0];
      const refStr = order.order_no || `SO-${order.order_id}`;

      if (isDepositIssuance) {
        // AG-COMMENT: Sales Order line with serialized cylinder asset or deposit package counts towards Issued (+)
        const prev = customerSoDepositsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
        customerSoDepositsMap.set(cleanCust, {
          qty: prev.qty + served,
          lastDate: dDateStr > prev.lastDate ? dDateStr : prev.lastDate,
          ref: refStr,
        });
      } else {
        // AG-COMMENT: Routine gas refill / commodity swap (1:1 custody exchange)
        const prev = customerSwapsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
        customerSwapsMap.set(cleanCust, {
          qty: prev.qty + served,
          lastDate: dDateStr > prev.lastDate ? dDateStr : prev.lastDate,
          ref: refStr,
        });
      }
    });

    // 8. Fetch REAL Sales Returns (Pull-outs) in batch for period returns calculation
    const srQuery = `${directusBase}/items/sales_return?fields=return_id,return_number,customer_code,return_date&limit=-1`;
    const rawReturns = await fetchRows<SalesReturnRow>(srQuery, headers);
    const customerReturnsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    rawReturns.forEach((sr) => {
      if (!sr.customer_code) return;
      const retTime = sr.return_date ? new Date(sr.return_date).getTime() : 0;
      if (retTime < startMs || retTime > endMs) return;

      const cleanCust = normalizeCode(sr.customer_code);
      const prev = customerReturnsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
      const rDateStr = sr.return_date ? sr.return_date.split("T")[0] : filters.endDate;
      customerReturnsMap.set(cleanCust, {
        qty: prev.qty + 1,
        lastDate: rDateStr > prev.lastDate ? rDateStr : prev.lastDate,
        ref: sr.return_number || `SR-${sr.return_id}`,
      });
    });

    // 8b. Fetch LPG Customer Sites (for commercial/metered sites)
    const siteQuery = `${directusBase}/items/lpg_customer_lpg_sites?fields=id,customer_code,site_name,site_address&filter[is_active][_neq]=0&limit=-1`;
    const rawSites = await fetchRows<LpgCustomerSiteRow>(siteQuery, headers);
    const customerSiteMap = new Map<string, LpgCustomerSiteRow>();
    rawSites.forEach((s) => {
      if (s.customer_code) customerSiteMap.set(normalizeCode(s.customer_code), s);
    });

    // 8c. Fetch Active Cylinders Installed on Customer Sites (lpg_customer_site_cylinders)
    const siteCylQuery = `${directusBase}/items/lpg_customer_site_cylinders?fields=id,lpg_site_id,customer_code,cylinder_asset_id,installed_date,removed_date,site_cylinder_status&filter[removed_date][_null]=true&limit=-1`;
    const rawSiteCylinders = await fetchRows<LpgCustomerSiteCylinderRow>(siteCylQuery, headers);
    const customerSiteCylindersMap = new Map<string, LpgCustomerSiteCylinderRow[]>();
    rawSiteCylinders.forEach((sc) => {
      if (!sc.customer_code) return;
      const status = (sc.site_cylinder_status || "").toUpperCase();
      if (status !== "CONNECTED" && status !== "STANDBY" && status !== "") return;
      const cleanKey = normalizeCode(sc.customer_code);
      if (!customerSiteCylindersMap.has(cleanKey)) customerSiteCylindersMap.set(cleanKey, []);
      customerSiteCylindersMap.get(cleanKey)!.push(sc);
    });

    // 8d. Fetch WIWO Headers (Weigh-In / Weigh-Out Commercial Site Transactions)
    const wiwoQuery = `${directusBase}/items/lpg_wiwo_headers?fields=id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_returned_cylinders,total_deployed_cylinders,wiwo_status,sales_invoice_no,remarks&filter[wiwo_status][_neq]=CANCELLED&limit=-1`;
    const rawWiwos = await fetchRows<LpgWiwoHeaderRow>(wiwoQuery, headers);
    const customerWiwoDepositsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    const customerWiwoSwapsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();
    const customerWiwoReturnsMap = new Map<string, { qty: number; lastDate: string; ref: string }>();

    rawWiwos.forEach((w) => {
      if (!w.customer_code) return;
      const wTime = w.transaction_date ? new Date(w.transaction_date).getTime() : 0;
      if (wTime < startMs || wTime > endMs) return;

      const cleanCust = normalizeCode(w.customer_code);
      const deployed = Math.max(0, Number(w.total_deployed_cylinders || 0));
      const returned = Math.max(0, Number(w.total_returned_cylinders || 0));
      const wDateStr = w.transaction_date ? w.transaction_date.split("T")[0] : filters.endDate;
      const refStr = w.wiwo_no || `WIWO-${w.id}`;

      if (w.wiwo_type === "DEPLOYMENT_ONLY") {
        if (deployed > 0) {
          const prev = customerWiwoDepositsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoDepositsMap.set(cleanCust, {
            qty: prev.qty + deployed,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        }
      } else if (w.wiwo_type === "RETURN_ONLY") {
        if (returned > 0) {
          const prev = customerWiwoReturnsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoReturnsMap.set(cleanCust, {
            qty: prev.qty + returned,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        }
      } else if (w.wiwo_type === "CONSUMPTION_SWAP") {
        const swapQty = Math.min(deployed, returned);
        if (swapQty > 0) {
          const prev = customerWiwoSwapsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoSwapsMap.set(cleanCust, {
            qty: prev.qty + swapQty,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        }
        if (deployed > returned) {
          const diff = deployed - returned;
          const prev = customerWiwoDepositsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoDepositsMap.set(cleanCust, {
            qty: prev.qty + diff,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        } else if (returned > deployed) {
          const diff = returned - deployed;
          const prev = customerWiwoReturnsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoReturnsMap.set(cleanCust, {
            qty: prev.qty + diff,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        }
      } else if (w.wiwo_type === "ADJUSTMENT") {
        if (deployed > returned) {
          const diff = deployed - returned;
          const prev = customerWiwoDepositsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoDepositsMap.set(cleanCust, {
            qty: prev.qty + diff,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        } else if (returned > deployed) {
          const diff = returned - deployed;
          const prev = customerWiwoReturnsMap.get(cleanCust) || { qty: 0, lastDate: "", ref: "" };
          customerWiwoReturnsMap.set(cleanCust, {
            qty: prev.qty + diff,
            lastDate: wDateStr > prev.lastDate ? wDateStr : prev.lastDate,
            ref: refStr,
          });
        }
      }
    });

    // 9. Assemble Unified Customer Accountability Rows (SNET Spec v1.0 §4 & §11)
    // AG-COMMENT: Collect all customer keys from custody assets, site cylinders, POS deposits, SO deposits, swaps, returns, and WIWOs
    const allCustomerKeys = new Set<string>([
      ...customerCustodyMap.keys(),
      ...customerSiteCylindersMap.keys(),
      ...customerPosDepositsMap.keys(),
      ...customerSoDepositsMap.keys(),
      ...customerSwapsMap.keys(),
      ...customerReturnsMap.keys(),
      ...customerWiwoDepositsMap.keys(),
      ...customerWiwoSwapsMap.keys(),
      ...customerWiwoReturnsMap.keys(),
    ]);

    const rows: CustomerAccountabilityRow[] = [];
    const periodDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    allCustomerKeys.forEach((cleanKey) => {
      const matchedCust = customerMap.get(cleanKey);
      const custCode = matchedCust ? matchedCust.customer_code : cleanKey;
      const custName = matchedCust ? matchedCust.customer_name : `Customer (${cleanKey})`;
      const storeName = matchedCust ? matchedCust.store_name : null;
      const contactNumber = matchedCust ? matchedCust.contact_number : null;

      const custodyAssets = customerCustodyMap.get(cleanKey) || [];
      const branchId = custodyAssets[0]?.current_branch_id || null;
      const branchName = branchId ? branchMap.get(branchId) || `Branch #${branchId}` : "Main Branch";

      // Site name resolution: prefer actual site_name from lpg_customer_lpg_sites
      const siteInfo = customerSiteMap.get(cleanKey);
      const siteName = siteInfo?.site_name || branchName;

      // De-duplicate physical cylinders between cylinder_assets and lpg_customer_site_cylinders
      const existingAssetIds = new Set(custodyAssets.map((a) => Number(a.id)));
      const siteCyls = customerSiteCylindersMap.get(cleanKey) || [];
      const unlinkedSiteCyls = siteCyls.filter((sc) => !existingAssetIds.has(Number(sc.cylinder_asset_id)));
      const closingBase = custodyAssets.length + unlinkedSiteCyls.length;

      const posDepositInfo = customerPosDepositsMap.get(cleanKey);
      const soDepositInfo = customerSoDepositsMap.get(cleanKey);
      const wiwoDepositInfo = customerWiwoDepositsMap.get(cleanKey);

      const swapInfo = customerSwapsMap.get(cleanKey);
      const wiwoSwapInfo = customerWiwoSwapsMap.get(cleanKey);

      const returnInfo = customerReturnsMap.get(cleanKey);
      const wiwoReturnInfo = customerWiwoReturnsMap.get(cleanKey);

      // Total Issued (+) aggregates POS counter deposits, Sales Order issuances, and WIWO deployments
      const periodDeposits =
        (posDepositInfo ? posDepositInfo.qty : 0) +
        (soDepositInfo ? soDepositInfo.qty : 0) +
        (wiwoDepositInfo ? wiwoDepositInfo.qty : 0);

      // Total Swaps aggregates SO refill swaps and WIWO manifold swaps
      const periodSwaps =
        (swapInfo ? swapInfo.qty : 0) +
        (wiwoSwapInfo ? wiwoSwapInfo.qty : 0);

      // Total Returned (-) aggregates Sales Returns and WIWO pull-outs
      const periodPullOuts =
        (returnInfo ? returnInfo.qty : 0) +
        (wiwoReturnInfo ? wiwoReturnInfo.qty : 0);

      // SNET Spec §4: Current held = opening holdings + issues - returns + signed adjustments
      // Deduce opening holdings = current held - issues + returns
      const openingBase = Math.max(0, closingBase - periodDeposits + periodPullOuts);

      // SNET Spec §7 & §11: Authorized Quota Limit
      const authorizedLimit = Math.max(10, Math.ceil(Math.max(openingBase, closingBase) * 1.25));
      const variance = closingBase - authorizedLimit;

      // SNET Spec §7: Turnaround velocity & incentive rebate calculations
      const turnaround = calculateCustomerTurnaroundMetrics(closingBase, periodSwaps, periodDays);

      const lastDate = [
        posDepositInfo?.lastDate,
        soDepositInfo?.lastDate,
        wiwoDepositInfo?.lastDate,
        swapInfo?.lastDate,
        wiwoSwapInfo?.lastDate,
        returnInfo?.lastDate,
        wiwoReturnInfo?.lastDate,
        custodyAssets[0]?.created_date?.split("T")[0]
      ]
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      const lastRef =
        wiwoDepositInfo?.ref ||
        soDepositInfo?.ref ||
        posDepositInfo?.ref ||
        wiwoSwapInfo?.ref ||
        swapInfo?.ref ||
        returnInfo?.ref ||
        wiwoReturnInfo?.ref ||
        (custodyAssets[0] ? `SERIAL-${custodyAssets[0].serial_number}` : null);

      rows.push({
        customerCode: custCode,
        customerName: custName,
        storeName,
        contactNumber,
        branchId,
        branchName,
        siteName, // SNET Spec §11 alias (site name from lpg_customer_lpg_sites or branch)
        ownership: "COMPANY", // Authoritative company assets circulating
        openingBase,
        opening: openingBase,
        periodDeposits,
        issued: periodDeposits,
        periodSwaps,
        periodNetSwapChange: 0, // Standard 1-to-1 exchanges
        periodPullOuts,
        returned: periodPullOuts,
        closingBase,
        runningBase: closingBase,
        held: closingBase,
        authorizedLimit,
        variance,
        turnsPerYear: turnaround.turnsPerYear,
        monthsPerTurn: turnaround.monthsPerTurn,
        customerGrade: turnaround.customerGrade,
        incentiveRate: turnaround.incentiveRate,
        totalIncentive: turnaround.totalIncentive,
        lastTransactionDate: lastDate,
        lastReferenceNo: lastRef,
        verifiedTransactionsCount:
          (posDepositInfo ? 1 : 0) +
          (soDepositInfo ? 1 : 0) +
          (wiwoDepositInfo ? 1 : 0) +
          (swapInfo ? 1 : 0) +
          (wiwoSwapInfo ? 1 : 0) +
          (returnInfo ? 1 : 0) +
          (wiwoReturnInfo ? 1 : 0) +
          custodyAssets.length,
        exceptionCount: closingBase < 0 ? 1 : 0,
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

    // 2. Fetch Branches Directory for accurate branch name resolution (division_id = 1 for Industrial)
    // AG-COMMENT: Restrict branch queries strictly to Industrial Division (division_id = 1)
    const branchRows = await fetchRows<BranchRow>(
      `${directusBase}/items/branches?fields=id,branch_name,branch_code&filter[division_id][_eq]=1&limit=-1`,
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

    // 4. Fetch Products catalog for labels and classification
    const productRows = await fetchRows<ProductRow>(
      `${directusBase}/items/products?fields=product_id,product_code,product_name,description,is_serialized&limit=-1`,
      headers
    );
    const productsMap = new Map<number, ProductRow>();
    productRows.forEach((p) => {
      productsMap.set(Number(p.product_id), p);
    });

    const now = new Date();
    const activeSerials = matchedAssets.map((s) => {
      const pId = typeof s.product_id === "object" ? s.product_id?.product_id : Number(s.product_id);
      const prod = productsMap.get(pId ?? 0);
      // AG-COMMENT: Ensure fallback resolves to authoritative serialized cylinder (24647) if asset product is not serialized
      const safeProd = prod && Number(prod.is_serialized) === 1 ? prod : productsMap.get(24647);
      const prodName = safeProd?.description || safeProd?.product_name || `LPG Cylinder (${pId})`;
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

    // 5. Fetch REAL Sales Orders for this customer (Delivered Refills/Swaps and Deposits)
    // AG-COMMENT: Query customer orders with both exact and case-insensitive/trimmed filter to handle Directus whitespace padding
    const customerOrders = await fetchRows<SalesOrderRow>(
      `${directusBase}/items/sales_order?fields=order_id,order_no,customer_code,delivery_date,order_date,order_status,remarks&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&limit=-1`,
      headers
    );

    // AG-COMMENT: Ensure exact normalized code matching in case Directus _icontains returned loose prefixes
    const matchedCustomerOrders = customerOrders.filter((o) => normalizeCode(o.customer_code) === cleanKey);

    const orderIds = matchedCustomerOrders.map((o) => o.order_id);
    let customerOrderDetails: SalesOrderDetailRow[] = [];
    if (orderIds.length > 0) {
      customerOrderDetails = await fetchRows<SalesOrderDetailRow>(
        `${directusBase}/items/sales_order_details?fields=detail_id,order_id,product_id,served_quantity,allocated_quantity,ordered_quantity&filter[order_id][_in]=${orderIds.join(",")}&limit=-1`,
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
      `${directusBase}/items/sales_invoice?fields=invoice_id,invoice_no,customer_code,invoice_date&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&limit=-1`,
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
      `${directusBase}/items/sales_return?fields=return_id,return_number,customer_code,return_date&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&limit=-1`,
      headers
    );

    // 7b. Fetch Customer LPG Sites (for site name and manifold address)
    const customerSites = await fetchRows<LpgCustomerSiteRow>(
      `${directusBase}/items/lpg_customer_lpg_sites?fields=id,customer_code,site_name,site_address&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&limit=-1`,
      headers
    );
    const matchedSite = customerSites.find((s) => normalizeCode(s.customer_code) === cleanKey);
    const siteName = matchedSite?.site_name || branchName;
    const siteAddress = matchedSite?.site_address || address;

    // 7c. Fetch Active Cylinders Installed on Customer Manifold Sites
    const customerSiteCyls = await fetchRows<LpgCustomerSiteCylinderRow>(
      `${directusBase}/items/lpg_customer_site_cylinders?fields=id,lpg_site_id,customer_code,cylinder_asset_id,installed_date,removed_date,site_cylinder_status&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&filter[removed_date][_null]=true&limit=-1`,
      headers
    );
    const matchedSiteCyls = customerSiteCyls.filter((sc) => {
      if (normalizeCode(sc.customer_code) !== cleanKey) return false;
      const status = (sc.site_cylinder_status || "").toUpperCase();
      return status === "CONNECTED" || status === "STANDBY" || status === "";
    });

    const matchedAssetIds = new Set(matchedAssets.map((a) => Number(a.id)));
    const unlinkedSiteCyls = matchedSiteCyls.filter((sc) => !matchedAssetIds.has(Number(sc.cylinder_asset_id)));

    // Append unlinked active site cylinders to activeSerials list
    unlinkedSiteCyls.forEach((sc) => {
      const assetRecord = allAssets.find((a) => Number(a.id) === Number(sc.cylinder_asset_id));
      const pId = typeof assetRecord?.product_id === "object" ? assetRecord.product_id?.product_id : Number(assetRecord?.product_id);
      const prod = productsMap.get(pId ?? 0);
      const prodName = prod?.description || prod?.product_name || "Manifold Site Cylinder";
      const instDate = sc.installed_date;
      const days = instDate ? Math.floor((now.getTime() - new Date(instDate).getTime()) / (1000 * 60 * 60 * 24)) : 7;

      activeSerials.push({
        serialNumber: assetRecord?.serial_number || `SITE-ASSET-${sc.cylinder_asset_id}`,
        productName: `${prodName} (Site Manifold)`,
        condition: assetRecord?.cylinder_condition || "GOOD",
        daysWithCustomer: days,
        acquisitionDate: instDate ? instDate.split("T")[0] : null,
      });
    });

    // 7d. Fetch WIWO Transactions for this Customer
    const customerWiwos = await fetchRows<LpgWiwoHeaderRow>(
      `${directusBase}/items/lpg_wiwo_headers?fields=id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_returned_cylinders,total_deployed_cylinders,wiwo_status,sales_invoice_no,remarks&filter[_or][0][customer_code][_eq]=${encodeURIComponent(cust.customer_code.trim())}&filter[_or][1][customer_code][_icontains]=${encodeURIComponent(cleanKey)}&filter[wiwo_status][_neq]=CANCELLED&limit=-1`,
      headers
    );
    const matchedCustomerWiwos = customerWiwos.filter((w) => normalizeCode(w.customer_code) === cleanKey);

    // 8. Assemble Real Chronological Transaction Records
    const rawTransactions: AccountabilityTransactionRecord[] = [];

    // A. Map Delivered Sales Orders (Classified into DEPOSIT/Issuance vs SWAP/Refill)
    matchedCustomerOrders.forEach((o) => {
      if (o.order_status !== "Delivered" && o.order_status !== "Fulfilled") return;
      const dateStr = o.delivery_date || o.order_date;
      const timeMs = dateStr ? new Date(dateStr).getTime() : 0;
      if (timeMs < startMs || timeMs > endMs) return;

      const details = orderDetailsByOrderId.get(Number(o.order_id)) || [];
      if (details.length === 0) return;

      let depositQty = 0;
      let swapQty = 0;
      const depositProdNames: string[] = [];
      const swapProdNames: string[] = [];

      details.forEach((d) => {
        // AG-COMMENT: Fallback to allocated_quantity or ordered_quantity if served_quantity is 0 or unrecorded
        const qty = Math.max(0, Number(d.served_quantity || d.allocated_quantity || d.ordered_quantity || 0));
        if (qty <= 0) return;
        const pId = Number(d.product_id);
        const prod = productsMap.get(pId);
        // AG-COMMENT: Strictly filter for serialized cylinder products (is_serialized = 1)
        if (!prod || Number(prod.is_serialized) !== 1) return;
        const name = prod?.description || prod?.product_name || `Product ${pId}`;

        if (isCylinderIssuanceProduct(prod, o.remarks)) {
          depositQty += qty;
          if (!depositProdNames.includes(name)) depositProdNames.push(name);
        } else {
          swapQty += qty;
          if (!swapProdNames.includes(name)) swapProdNames.push(name);
        }
      });

      const txDate = dateStr ? dateStr.split("T")[0] : "2026-09-30";
      const refNo = o.order_no || `SO-${o.order_id}`;

      // AG-COMMENT: Sales Order line with serialized cylinder asset or deposit package counts as DEPOSIT with positive base impact
      if (depositQty > 0) {
        rawTransactions.push({
          id: `SO-DEP-${o.order_id}`,
          transactionDate: txDate,
          customerCode: cust.customer_code,
          customerName: cust.customer_name,
          sourceModule: "SALES_ORDER",
          sourceHeaderId: refNo,
          sourceStatus: "DELIVERED",
          activityType: "DEPOSIT",
          productName: depositProdNames.join(", ") || "Cylinder Deposit / Issuance",
          ownership: "COMPANY",
          depositQty,
          swapQty: 0,
          pullOutQty: 0,
          netBaseImpact: depositQty,
          runningBase: 0,
          referenceNo: refNo,
          isVerified: true,
          hasException: false,
        });
      }

      // AG-COMMENT: Sales Order refill lines count as SWAP with zero net custody impact
      if (swapQty > 0) {
        rawTransactions.push({
          id: `SO-SWP-${o.order_id}`,
          transactionDate: txDate,
          customerCode: cust.customer_code,
          customerName: cust.customer_name,
          sourceModule: "SALES_ORDER",
          sourceHeaderId: refNo,
          sourceStatus: "DELIVERED",
          activityType: "SWAP",
          productName: swapProdNames.join(", ") || "LPG Refill Cylinder",
          ownership: "COMPANY",
          depositQty: 0,
          swapQty,
          pullOutQty: 0,
          netBaseImpact: 0,
          runningBase: 0,
          referenceNo: refNo,
          isVerified: true,
          hasException: false,
        });
      }
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

    // D. Map WIWO Manifold Deliveries and Exchanges
    matchedCustomerWiwos.forEach((w) => {
      const dateStr = w.transaction_date;
      const timeMs = dateStr ? new Date(dateStr).getTime() : 0;
      if (timeMs < startMs || timeMs > endMs) return;

      const deployed = Math.max(0, Number(w.total_deployed_cylinders || 0));
      const returned = Math.max(0, Number(w.total_returned_cylinders || 0));
      const txDate = dateStr ? dateStr.split("T")[0] : "2026-10-01";
      const refNo = w.wiwo_no || `WIWO-${w.id}`;

      if (w.wiwo_type === "DEPLOYMENT_ONLY" && deployed > 0) {
        rawTransactions.push({
          id: `WIWO-DEP-${w.id}`,
          transactionDate: txDate,
          customerCode: cust.customer_code,
          customerName: cust.customer_name,
          sourceModule: "WIWO",
          sourceHeaderId: refNo,
          sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
          activityType: "DEPOSIT",
          productName: "WIWO Manifold Deployment",
          ownership: "COMPANY",
          depositQty: deployed,
          swapQty: 0,
          pullOutQty: 0,
          netBaseImpact: deployed,
          runningBase: 0,
          referenceNo: w.sales_invoice_no || refNo,
          isVerified: true,
          hasException: false,
        });
      } else if (w.wiwo_type === "RETURN_ONLY" && returned > 0) {
        rawTransactions.push({
          id: `WIWO-RET-${w.id}`,
          transactionDate: txDate,
          customerCode: cust.customer_code,
          customerName: cust.customer_name,
          sourceModule: "WIWO",
          sourceHeaderId: refNo,
          sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
          activityType: "PULL_OUT",
          productName: "WIWO Manifold Cylinder Pull-out",
          ownership: "COMPANY",
          depositQty: 0,
          swapQty: 0,
          pullOutQty: returned,
          netBaseImpact: -returned,
          runningBase: 0,
          referenceNo: w.sales_invoice_no || refNo,
          isVerified: true,
          hasException: false,
        });
      } else if (w.wiwo_type === "CONSUMPTION_SWAP") {
        const swapQty = Math.min(deployed, returned);
        if (swapQty > 0) {
          rawTransactions.push({
            id: `WIWO-SWP-${w.id}`,
            transactionDate: txDate,
            customerCode: cust.customer_code,
            customerName: cust.customer_name,
            sourceModule: "WIWO",
            sourceHeaderId: refNo,
            sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
            activityType: "SWAP",
            productName: "WIWO Manifold Refill Swap",
            ownership: "COMPANY",
            depositQty: 0,
            swapQty,
            pullOutQty: 0,
            netBaseImpact: 0,
            runningBase: 0,
            referenceNo: w.sales_invoice_no || refNo,
            isVerified: true,
            hasException: false,
          });
        }
        if (deployed > returned) {
          const diff = deployed - returned;
          rawTransactions.push({
            id: `WIWO-DEP-${w.id}`,
            transactionDate: txDate,
            customerCode: cust.customer_code,
            customerName: cust.customer_name,
            sourceModule: "WIWO",
            sourceHeaderId: refNo,
            sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
            activityType: "DEPOSIT",
            productName: "WIWO Manifold Expansion",
            ownership: "COMPANY",
            depositQty: diff,
            swapQty: 0,
            pullOutQty: 0,
            netBaseImpact: diff,
            runningBase: 0,
            referenceNo: w.sales_invoice_no || refNo,
            isVerified: true,
            hasException: false,
          });
        } else if (returned > deployed) {
          const diff = returned - deployed;
          rawTransactions.push({
            id: `WIWO-RET-${w.id}`,
            transactionDate: txDate,
            customerCode: cust.customer_code,
            customerName: cust.customer_name,
            sourceModule: "WIWO",
            sourceHeaderId: refNo,
            sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
            activityType: "PULL_OUT",
            productName: "WIWO Manifold Reduction",
            ownership: "COMPANY",
            depositQty: 0,
            swapQty: 0,
            pullOutQty: diff,
            netBaseImpact: -diff,
            runningBase: 0,
            referenceNo: w.sales_invoice_no || refNo,
            isVerified: true,
            hasException: false,
          });
        }
      } else if (w.wiwo_type === "ADJUSTMENT") {
        if (deployed > returned) {
          const diff = deployed - returned;
          rawTransactions.push({
            id: `WIWO-ADJ-DEP-${w.id}`,
            transactionDate: txDate,
            customerCode: cust.customer_code,
            customerName: cust.customer_name,
            sourceModule: "WIWO",
            sourceHeaderId: refNo,
            sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
            activityType: "DEPOSIT",
            productName: "WIWO Manifold Adjustment",
            ownership: "COMPANY",
            depositQty: diff,
            swapQty: 0,
            pullOutQty: 0,
            netBaseImpact: diff,
            runningBase: 0,
            referenceNo: w.sales_invoice_no || refNo,
            isVerified: true,
            hasException: false,
          });
        } else if (returned > deployed) {
          const diff = returned - deployed;
          rawTransactions.push({
            id: `WIWO-ADJ-RET-${w.id}`,
            transactionDate: txDate,
            customerCode: cust.customer_code,
            customerName: cust.customer_name,
            sourceModule: "WIWO",
            sourceHeaderId: refNo,
            sourceStatus: w.wiwo_status === "POSTED" ? "POSTED" : "COMPLETED",
            activityType: "PULL_OUT",
            productName: "WIWO Manifold Adjustment",
            ownership: "COMPANY",
            depositQty: 0,
            swapQty: 0,
            pullOutQty: diff,
            netBaseImpact: -diff,
            runningBase: 0,
            referenceNo: w.sales_invoice_no || refNo,
            isVerified: true,
            hasException: false,
          });
        }
      }
    });

    // 9. Reconcile Balance against Closing Base (including active manifold site cylinders)
    const closingBase = matchedAssets.length + unlinkedSiteCyls.length;
    const periodDeposits = rawTransactions
      .filter((t) => t.activityType === "DEPOSIT")
      .reduce((sum, t) => sum + t.depositQty, 0);
    const periodPullOuts = rawTransactions
      .filter((t) => t.activityType === "PULL_OUT")
      .reduce((sum, t) => sum + t.pullOutQty, 0);

    // Calculate true opening base matching the primary table
    const openingBase = Math.max(0, closingBase - periodDeposits + periodPullOuts);

    const reconciled = reconcileCustomerTransactionLedger(openingBase, rawTransactions);

    // SNET Spec §7 & §11: Authorized Quota & Variance for customer drilldown
    const authorizedLimit = Math.max(10, Math.ceil(Math.max(openingBase, closingBase) * 1.25));
    const variance = closingBase - authorizedLimit;
    const periodDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const totalSwaps = rawTransactions.filter(t => t.activityType === "SWAP").reduce((s, t) => s + t.swapQty, 0);
    const turnaround = calculateCustomerTurnaroundMetrics(closingBase, totalSwaps, periodDays);

    const detail: CustomerAccountabilityDetailResponse = {
      customerCode: cust.customer_code,
      customerName: cust.customer_name,
      storeName: cust.store_name,
      contactNumber: cust.contact_number,
      address: siteAddress,
      branchName,
      siteName, // SNET Spec §11 alias (site name from lpg_customer_lpg_sites or branch)
      ownership: "COMPANY",
      openingBase,
      closingBase,
      authorizedLimit,
      variance,
      turnsPerYear: turnaround.turnsPerYear,
      monthsPerTurn: turnaround.monthsPerTurn,
      customerGrade: turnaround.customerGrade,
      incentiveRate: turnaround.incentiveRate,
      totalIncentive: turnaround.totalIncentive,
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
