// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/services/customer-profitability.service.ts
// ==============================================================================
// Customer Profitability Report - Backend Service
// Queries Directus collections with field filtering, token handling, and fallback defaults.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import {
  aggregateCustomerProfitabilityReport,
  buildCustomerDrilldown,
  type AggregationSourceData,
} from "./customer-profitability.aggregation";
import type { CustomerProfitabilityFilterInput } from "../types/customer-profitability.schema";
import type {
  CustomerProfitabilityReportResponse,
  CustomerDrilldownDetails,
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
} from "../types/customer-profitability.types";

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) {
    throw new Error(
      "Directus base URL is not configured. Please set NEXT_PUBLIC_API_BASE_URL or DIRECTUS_URL in environment variables."
    );
  }
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusToken(): string {
  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();
  if (!token) {
    throw new Error(
      "DIRECTUS_STATIC_TOKEN is not set. Please check your .env.local configuration."
    );
  }
  return token;
}

function directusHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getDirectusToken()}`,
  };
}

async function fetchDirectusCollection<T>(path: string): Promise<T[]> {
  try {
    const base = getDirectusBase();
    const url = `${base}/${path.replace(/^\//, "")}`;
    const res = await fetch(url, {
      headers: directusHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Directus Fetch Error] ${path} returned status ${res.status}: ${errText}`);
      return [];
    }
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  } catch (err) {
    console.error(`[Directus Network/Exception] ${path}:`, err);
    return [];
  }
}

/**
 * Fetch lookup options (branches, profitability tiers)
 */
export async function fetchProfitabilityLookups() {
  const branches = await fetchDirectusCollection<RawBranch>(
    "items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"
  );

  return {
    branches: branches
      .filter((b) => b.branch_name)
      .map((b) => ({
        id: b.id,
        branch_code: b.branch_code,
        branch_name: b.branch_name,
      })),
  };
}

/**
 * Main report fetcher: pulls all interconnected datasets concurrently and feeds the aggregation engine
 */
export async function fetchCustomerProfitabilityReport(
  filters: CustomerProfitabilityFilterInput
): Promise<CustomerProfitabilityReportResponse> {
  // Concurrently fetch all source collections
  const [
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
  ] = await Promise.all([
    fetchDirectusCollection<RawCustomer>(
      "items/customer?fields=id,customer_code,customer_name,store_name,city,province,isActive&limit=-1"
    ),
    fetchDirectusCollection<RawSalesInvoice>(
      "items/sales_invoice?fields=invoice_id,invoice_no,order_id,customer_code,salesman_id,branch_id,invoice_date,gross_amount,discount_amount,vat_amount,net_amount,total_amount,transaction_status,isPosted,isReplaced&limit=-1"
    ),
    fetchDirectusCollection<RawSalesInvoiceDetail>(
      "items/sales_invoice_details?fields=detail_id,invoice_no,product_id,quantity,unit_price,total_amount&limit=-1"
    ),
    fetchDirectusCollection<RawProduct>(
      "items/products?fields=product_id,product_code,product_name,cost_per_unit,price_per_unit,estimated_unit_cost,product_weight,is_serialized,isActive&limit=-1"
    ),
    fetchDirectusCollection<RawBranch>(
      "items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"
    ),
    fetchDirectusCollection<RawPostDispatchPlan>(
      "items/post_dispatch_plan?fields=id,doc_no,starting_point,status,amount,time_of_dispatch&limit=-1"
    ),
    fetchDirectusCollection<RawPostDispatchInvoice>(
      "items/post_dispatch_invoices?fields=id,post_dispatch_plan_id,invoice_id,status&limit=-1"
    ),
    fetchDirectusCollection<RawPostDispatchBudgeting>(
      "items/post_dispatch_budgeting?fields=id,post_dispatch_plan_id,coa_id,amount,remarks&limit=-1"
    ),
    fetchDirectusCollection<RawCylinderAsset>(
      "items/cylinder_assets?fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,cost,is_deleted&limit=-1"
    ),
    fetchDirectusCollection<RawSalesReturn>(
      "items/sales_return?fields=return_id,return_number,customer_code,branch_id,return_date,total_amount,isPosted,isReceived&limit=-1"
    ),
    fetchDirectusCollection<RawSalesReturnDetail>(
      "items/sales_return_details?fields=detail_id,return_no,product_id,quantity,unit_price,total_amount&limit=-1"
    ),
  ]);

  console.log("[Profitability Service Diagnostics]", {
    customersCount: customers.length,
    invoicesCount: invoices.length,
    sampleInvoice: invoices[0] ? {
      invoice_id: invoices[0].invoice_id,
      customer_code: invoices[0].customer_code,
      invoice_date: invoices[0].invoice_date,
      isPosted: invoices[0].isPosted,
      transaction_status: invoices[0].transaction_status,
      branch_id: invoices[0].branch_id,
    } : null,
    invoiceDetailsCount: invoiceDetails.length,
    productsCount: products.length,
    branchesCount: branches.length,
  });

  const sourceData: AggregationSourceData = {
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
  };

  return aggregateCustomerProfitabilityReport(sourceData, filters);
}

/**
 * Fetch drilldown for a specific customer
 */
export async function fetchCustomerProfitabilityDrilldown(
  customerCode: string
): Promise<CustomerDrilldownDetails | null> {
  const [
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
  ] = await Promise.all([
    fetchDirectusCollection<RawCustomer>(
      `items/customer?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=1`
    ),
    fetchDirectusCollection<RawSalesInvoice>(
      `items/sales_invoice?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1`
    ),
    fetchDirectusCollection<RawSalesInvoiceDetail>(
      "items/sales_invoice_details?fields=detail_id,invoice_no,product_id,quantity,unit_price,total_amount&limit=-1"
    ),
    fetchDirectusCollection<RawProduct>(
      "items/products?fields=product_id,product_code,product_name,cost_per_unit,price_per_unit,estimated_unit_cost,product_weight,is_serialized,isActive&limit=-1"
    ),
    fetchDirectusCollection<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"),
    fetchDirectusCollection<RawPostDispatchPlan>("items/post_dispatch_plan?fields=id,doc_no,starting_point,status,amount,time_of_dispatch&limit=-1"),
    fetchDirectusCollection<RawPostDispatchInvoice>("items/post_dispatch_invoices?fields=id,post_dispatch_plan_id,invoice_id,status&limit=-1"),
    fetchDirectusCollection<RawPostDispatchBudgeting>("items/post_dispatch_budgeting?fields=id,post_dispatch_plan_id,coa_id,amount,remarks&limit=-1"),
    fetchDirectusCollection<RawCylinderAsset>(
      `items/cylinder_assets?filter[current_customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1`
    ),
    fetchDirectusCollection<RawSalesReturn>(
      `items/sales_return?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1`
    ),
    fetchDirectusCollection<RawSalesReturnDetail>("items/sales_return_details?fields=detail_id,return_no,product_id,quantity,unit_price,total_amount&limit=-1"),
  ]);

  return buildCustomerDrilldown(customerCode, {
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
  });
}
