// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/services/sales-performance.service.ts
// ==============================================================================
// Sales Performance Report - Backend Service Layer
// Fetches records concurrently from Directus REST endpoints with fault tolerance.
// ==============================================================================

import {
  aggregateSalesPerformanceReport,
  type AggregationSourceData,
  type RawSalesInvoice,
  type RawSalesInvoiceDetail,
  type RawSalesReturn,
  type RawSalesReturnDetail,
  type RawProduct,
  type RawCustomer,
  type RawBranch,
  type RawSalesman,
} from "./sales-performance.aggregation";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";
import type {
  SalesPerformanceReportResponse,
  SalesPerformanceLookupsResponse,
} from "../types/sales-performance.types";

// DEV-RULE: Resolve Directus base URL strictly via environment variables without hardcoded fallbacks
function getDirectusBase(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (!raw) {
    console.warn(
      "[SalesPerformanceService] Neither NEXT_PUBLIC_API_BASE_URL nor DIRECTUS_URL is set in environment."
    );
    return "";
  }
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

// DEV-RULE: Retrieve Directus authentication token from environment variables
function getDirectusToken(): string {
  return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
}

function directusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// DEV-RULE: Fetch records from Directus REST API with verbose error diagnosis and fault tolerance
async function fetchDirectus<T>(path: string): Promise<T[]> {
  try {
    const base = getDirectusBase();
    if (!base) {
      console.error(`[SalesPerformanceService] Aborting fetch for '${path}': Directus base URL is not configured.`);
      return [];
    }
    const url = `${base}/${path.replace(/^\//, "")}`;
    const res = await fetch(url, { headers: directusHeaders(), cache: "no-store" });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[SalesPerformanceService] Directus fetch failed (${res.status} ${res.statusText}) for path '${path}'. URL: ${url}. Response: ${errText}`
      );
      return [];
    }
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  } catch (err) {
    console.error(`[SalesPerformanceService] Network/system exception fetching '${path}':`, err);
    return [];
  }
}

export async function fetchSalesPerformanceLookups(): Promise<SalesPerformanceLookupsResponse> {
  // DEV-RULE: Exclusively fetch serialized gas cylinder products and entities without restrictive filter errors
  const [branches, customers, products, salesmen] = await Promise.all([
    fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name&limit=-1"),
    fetchDirectus<RawCustomer>(
      "items/customer?fields=customer_code,customer_name,store_name&limit=-1"
    ),
    fetchDirectus<RawProduct>(
      "items/products?fields=product_id,product_code,product_name,product_weight,weight,is_serialized&filter[is_serialized][_eq]=1&limit=-1"
    ),
    fetchDirectus<RawSalesman>(
      "items/salesman?fields=id,salesman_code,salesman_name&limit=-1"
    ),
  ]);

  return {
    branches: branches
      .filter((b) => b.branch_name)
      .map((b) => ({
        value: String(b.id),
        label: `${b.branch_name}${b.branch_code ? ` (${b.branch_code})` : ""}`,
        code: b.branch_code || "",
      })),
    customers: customers
      .filter((c) => c.customer_name || c.store_name)
      .map((c) => ({
        value: c.customer_code,
        label: `${c.customer_name || c.store_name} (${c.customer_code})`,
        code: c.customer_code,
      })),
    products: products
      .filter((p) => p.product_name)
      .map((p) => {
        const wt = Number(p.weight ?? p.product_weight ?? 0);
        const codeSuffix = p.product_code ? ` (${p.product_code})` : "";
        const weightSuffix = wt > 0 ? ` [${wt}kg]` : "";
        return {
          value: String(p.product_id),
          label: `${p.product_name}${codeSuffix}${weightSuffix}`,
          code: p.product_code || "",
          weight: wt,
        };
      }),
    salesmen: salesmen
      .filter((s) => s.salesman_name)
      .map((s) => ({
        value: String(s.id),
        label: `${s.salesman_name}${s.salesman_code ? ` (${s.salesman_code})` : ""}`,
        code: s.salesman_code || "",
      })),
  };
}

export async function fetchSalesPerformanceReport(
  filters: SalesPerformanceFilterInput
): Promise<SalesPerformanceReportResponse> {
  // DEV-RULE: Push date and branch filters directly to Directus query to optimize network latency & speed up report load
  const invoiceParams = new URLSearchParams({
    fields:
      "invoice_id,order_id,customer_code,invoice_no,salesman_id,branch_id,invoice_date,dispatch_date,due_date,total_amount,gross_amount,discount_amount,net_amount,vat_amount,isReceipt,isPosted,transaction_status",
    limit: "-1",
  });
  if (filters.startDate) invoiceParams.set("filter[invoice_date][_gte]", `${filters.startDate} 00:00:00`);
  if (filters.endDate) invoiceParams.set("filter[invoice_date][_lte]", `${filters.endDate} 23:59:59`);
  if (filters.branchId && filters.branchId !== "ALL") {
    invoiceParams.set("filter[branch_id][_eq]", filters.branchId);
  }

  const returnParams = new URLSearchParams({
    fields:
      "return_id,return_number,customer_code,salesman_id,branch_id,return_date,total_amount,discount_amount,gross_amount,order_id,invoice_no,status,isPosted,isApplied,isReceived",
    limit: "-1",
  });
  if (filters.startDate) returnParams.set("filter[return_date][_gte]", `${filters.startDate} 00:00:00`);
  if (filters.endDate) returnParams.set("filter[return_date][_lte]", `${filters.endDate} 23:59:59`);

  // DEV-RULE: Exclusively query serialized gas cylinder products (is_serialized = 1) to eliminate FMCG/grocery catalog overhead
  const [
    invoices,
    invoiceDetails,
    returns,
    returnDetails,
    products,
    customers,
    branches,
    salesmen,
  ] = await Promise.all([
    fetchDirectus<RawSalesInvoice>(`items/sales_invoice?${invoiceParams.toString()}`),
    fetchDirectus<RawSalesInvoiceDetail>(
      "items/sales_invoice_details?fields=detail_id,order_id,invoice_no,serial_no,discount_type,product_id,unit,unit_price,quantity,discount_amount,gross_amount,total_amount&limit=-1"
    ),
    fetchDirectus<RawSalesReturn>(`items/sales_return?${returnParams.toString()}`),
    fetchDirectus<RawSalesReturnDetail>(
      "items/sales_return_details?fields=detail_id,return_no,product_id,quantity,unit_price,total_amount,discount_amount,discount_type,gross_amount,status&limit=-1"
    ),
    fetchDirectus<RawProduct>(
      "items/products?fields=product_id,product_name,product_code,description,product_weight,weight,price_per_unit,cost_per_unit,is_serialized,isActive&filter[is_serialized][_eq]=1&limit=-1"
    ),
    fetchDirectus<RawCustomer>(
      "items/customer?fields=customer_code,customer_name,store_name,city,province,isActive&limit=-1"
    ),
    fetchDirectus<RawBranch>(
      "items/branches?fields=id,branch_name,branch_code&limit=-1"
    ),
    fetchDirectus<RawSalesman>(
      "items/salesman?fields=id,salesman_code,salesman_name&limit=-1"
    ),
  ]);

  const sourceData: AggregationSourceData = {
    invoices,
    invoiceDetails,
    returns,
    returnDetails,
    products,
    customers,
    branches,
    salesmen,
  };

  return aggregateSalesPerformanceReport(sourceData, filters);
}
