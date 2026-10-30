// ============================================================
// customer-order-consumption.types.ts
// Pure TypeScript interfaces for the Customer Order & Consumption Report.
// Validation lives in customer-order-consumption.schema.ts — no Zod here.
// Placement: CRM -> Customer Reports -> Customer Order & Consumption Report
// ============================================================

// ------------------------------------------------------------
// Channel — the single dimension that keeps incompatible units apart.
// CYLINDER demand is a PURCHASE PROXY (pieces x cylinder size) for
// serialized products in industrial categories.
// LPG demand is ACTUAL RECORDED CONSUMPTION (native kg).
// They are never summed into one number (ticket s8).
// ------------------------------------------------------------
export type ConsumptionChannel = "CYLINDER" | "LPG";

// lpg_customer_lpg_sites.billing_mode — carried as a label only.
// It is a SITE attribute, so filtering on it would fan out order counts.
export type BillingMode = "KILO" | "METERED" | "BOTH";

// ------------------------------------------------------------
// Filter inputs sent to the BFF as query params.
// Each picker is a multi-select, so a value is a list; an absent or empty
// list means "everything", never "nothing". The BFF receives them as repeated
// query params and Directus matches them with `_in`.
// ------------------------------------------------------------
export interface CustomerOrderConsumptionFilters {
  startDate: string; // YYYY-MM-DD, Asia/Manila
  endDate: string; // YYYY-MM-DD, doubles as the reporting cutoff
  customerCodes?: string[]; // customer.customer_code
  branchIds?: number[]; // branches.id, matched on sales_invoice.branch_id
  salesmanIds?: number[]; // salesman.id
  classificationIds?: number[]; // customer.classification -> customer_classification.id
  channel?: ConsumptionChannel;
}

// Applied filters carry display labels so the UI can render active chips.
// They are positionally parallel to the id lists above and never used in a
// query, so a caller may read them for text only.
export interface AppliedFilterContext extends CustomerOrderConsumptionFilters {
  customerLabels?: string[];
  branchLabels?: string[];
  salesmanLabels?: string[];
  classificationLabels?: string[];
}

// ------------------------------------------------------------
// Raw Directus rows. snake_case is deliberate: these mirror the
// collection payloads 1:1 so the repo layer stays logic-free.
// ------------------------------------------------------------
export interface RawInvoiceRow {
  invoice_id: number;
  order_id: string | null;
  invoice_no: string | null;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  invoice_date: string | null;
  transaction_status: string | null;
  net_amount: number | null;
  gross_amount: number | null;
  discount_amount: number | null;
  isReplaced?: unknown;
  isDispatched?: unknown;
}

export interface RawInvoiceDetailRow {
  detail_id: number;
  invoice_no: number; // holds sales_invoice.invoice_id despite the name
  product_id: number;
  unit: number | null;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  gross_amount: number | null;
}

export interface RawReturnRow {
  return_id: number;
  return_number: string;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  return_date: string | null;
  gross_amount: number | null;
  order_id: string | null;
  invoice_no: string | null; // doc number, not the FK id
  status: string | null;
  isPosted?: unknown;
  deleted_at: string | null;
}

export interface RawReturnDetailRow {
  detail_id: number;
  return_no: string; // sales_return.return_number
  product_id: number;
  quantity: number;
  total_amount: number | null;
  gross_amount: number | null;
  // sales_return_details carries its own line status, so a single cancelled
  // line can be dropped without discarding the whole return.
  status: string | null;
}

// sales_invoice_sales_return: return_no -> sales_return.return_id,
// invoice_no -> sales_invoice.invoice_id. The column names do not match
// what they hold, which is why the mapping is written down here.
export interface RawReturnLinkRow {
  id: number;
  return_no: number;
  invoice_no: number;
  amount: number | null;
}

export interface RawProductRow {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  product_weight: number | null;
  weight: number | null;
  weight_unit_id: number | null;
  is_serialized?: unknown;
  product_category: number | null;
}

export interface RawUnitRow {
  unit_id: number;
  unit_name: string | null;
  unit_shortcut: string | null;
}

export interface RawWeightUnitRow {
  id: number;
  code: string | null;
  name: string | null;
}

export interface RawCategoryRow {
  category_id: number;
  category_name: string | null;
  // Eligibility flag: only industrial categories are in scope for the
  // cylinder channel, alongside products.is_serialized.
  is_industrial?: unknown;
}

export interface RawCustomerRow {
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
  classification: number | null;
}

export interface RawClassificationRow {
  id: number;
  classification_name: string | null;
}

export interface RawBranchRow {
  id: number;
  branch_name: string | null;
  branch_code: string | null;
}

export interface RawSalesmanRow {
  id: number;
  salesman_code: string | null;
  salesman_name: string | null;
}

// ---- LPG actual-consumption sources ----
export interface RawLpgSiteRow {
  id: number;
  customer_code: string | null;
  site_name: string | null;
  billing_mode: BillingMode | string | null;
}

export interface RawUnifiedLpgRow {
  id: number;
  transaction_no: string | null;
  transaction_type: string | null;
  lpg_site_id: number;
  customer_code: string | null;
  sales_order_id: number | null;
  sales_order_no: string | null;
  meter_reading_id: number | null;
  wiwo_header_id: number | null;
  transaction_date: string | null;
  billing_period_from: string | null;
  billing_period_to: string | null;
  metered_kg: number | null;
  wiwo_kg: number | null;
  variance_kg: number | null;
  variance_reason_code: string | null;
  billable_source: string | null;
  billable_kg: number | null;
  price_per_kg: number | null;
  gross_amount: number | null;
  discount_amount: number | null;
  net_amount: number | null;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
  status: string | null;
}

export interface RawWiwoDetailRow {
  id: number;
  wiwo_header_id: number;
  lpg_site_id: number;
  customer_code: string | null;
  line_type: string | null;
  product_id: number | null;
  serial_number: string | null;
  tare_weight_kg: number | null;
  consumed_lpg_kg: number | null;
  billable_kg: number | null;
  price_per_kg: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  is_billable?: unknown;
}

export interface RawWiwoHeaderRow {
  id: number;
  wiwo_no: string | null;
  lpg_site_id: number;
  customer_code: string | null;
  transaction_date: string | null;
  wiwo_type: string | null;
  total_billable_kg: number | null;
  net_amount: number | null;
  wiwo_status: string | null;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
}

export interface RawMeterReadingRow {
  id: number;
  lpg_site_id: number;
  customer_code: string | null;
  reading_no: string | null;
  reading_date: string | null;
  billing_period_from: string | null;
  billing_period_to: string | null;
  meter_unit: string | null;
  kg_consumed: number | null;
  price_per_kg: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  reading_status: string | null;
  sales_invoice_id: number | null;
  sales_invoice_no: string | null;
}

export interface RawPostDispatchRow {
  invoice_id: number | null;
  status: string | null;
}

// Everything the server-side aggregation needs, as already-fetched rows.
export interface ConsumptionSourceData {
  invoices: RawInvoiceRow[];
  invoiceDetails: RawInvoiceDetailRow[];
  returns: RawReturnRow[];
  returnDetails: RawReturnDetailRow[];
  returnLinks: RawReturnLinkRow[];
  products: RawProductRow[];
  units: RawUnitRow[];
  weightUnits: RawWeightUnitRow[];
  categories: RawCategoryRow[];
  customers: RawCustomerRow[];
  classifications: RawClassificationRow[];
  branches: RawBranchRow[];
  salesmen: RawSalesmanRow[];
  lpgSites: RawLpgSiteRow[];
  unifiedLpg: RawUnifiedLpgRow[];
  wiwoHeaders: RawWiwoHeaderRow[];
  wiwoDetails: RawWiwoDetailRow[];
  meterReadings: RawMeterReadingRow[];
  postDispatch: RawPostDispatchRow[];
}

// ------------------------------------------------------------
// Monthly trend — one point per YYYY-MM bucket
// ------------------------------------------------------------
export interface MonthlyTrendPoint {
  yearMonth: string; // "YYYY-MM"
  orderCount: number;
  // The document keys behind orderCount. Kept so a report-level rollup can
  // dedupe an order that appears in several product rows; without them the
  // buying-frequency metric would inflate with the number of lines sold.
  orderKeys: string[];
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
}

// Report-level trend keeps the channel on every point, because a blended kg
// series would plot a proxy against a measurement as if they were one thing.
export interface ReportTrendPoint extends MonthlyTrendPoint {
  channel: ConsumptionChannel;
}

// ------------------------------------------------------------
// Result row grain: customer x branch x channel x product.
// Branch comes from sales_invoice.branch_id — the only branch evidence
// that exists for both sales and LPG postings (no LPG table carries a
// branch column, and there is no user-to-branch table in the schema).
// ------------------------------------------------------------
export interface CustomerOrderConsumptionRow {
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchId: number | null;
  branchName: string;
  channel: ConsumptionChannel;
  billingMode: BillingMode | null; // LPG rows only
  productId: number;
  productCode: string;
  productName: string;
  // Provisional gas dimension: products has no gas_type column, so the
  // product category name is used and callers must treat null as unknown.
  gasType: string | null;
  // Cylinder size proxy. Read from the product category name ("LPG 11KG"),
  // because the categories table has no numeric size column and serialized
  // cylinder products commonly store 0 in product_weight. The product weight
  // is the fallback; cylinder_assets.tare_weight is the EMPTY weight and is
  // deliberately not used here.
  sizeKg: number | null;
  quantityUnit: string;

  orderCount: number;
  grossQty: number;
  returnedQty: number;
  netQty: number;

  // kg is a proxy on CYLINDER rows (qty x cylinder size) and a measured
  // value on LPG rows. kgIsProxy tells the UI which label to render.
  grossKg: number;
  returnedKg: number;
  netKg: number;
  kgIsProxy: boolean;

  netAmount: number;
  avgOrderSizeKg: number;
  avgOrderSizeQty: number;

  // Metered vs weigh-in/weigh-out divergence, LPG rows only.
  meteredKg: number;
  wiwoKg: number;
  varianceKg: number;

  monthlyTrend: MonthlyTrendPoint[];
  exceptionCodes: string[];
}

// ------------------------------------------------------------
// Data exceptions — surfaced, never corrected here (ticket s6).
// ------------------------------------------------------------
export type ExceptionCode =
  | "MISSING_PRODUCT_WEIGHT"
  | "MISSING_PRODUCT_CATEGORY"
  | "NON_KG_WEIGHT_UNIT"
  | "UNBILLED_LPG_TRANSACTION"
  | "BRANCH_UNKNOWN"
  | "LPG_VARIANCE"
  | "LPG_BASELINE_EXCLUDED"
  | "NOT_FULFILLED_DELIVERY"
  | "FULFILLED_WITH_CONCERNS";

export interface ReportException {
  code: ExceptionCode;
  channel: ConsumptionChannel;
  customerCode: string;
  customerName: string;
  // LPG_TRANSACTION covers lpg_metered_wiwo_transactions rows, which are
  // neither a WIWO header nor a meter reading once the unified ledger wins.
  referenceType:
    | "SALES_INVOICE"
    | "SALES_RETURN"
    | "WIWO"
    | "METER_READING"
    | "LPG_TRANSACTION"
    | "PRODUCT";
  referenceNo: string;
  detail: string;
  quantity: number;
  kg: number;
}

// ------------------------------------------------------------
// KPI overview. kg is reported per channel, never as one combined figure:
// CYLINDER kg is a purchase proxy and LPG kg is measured consumption, so a
// single total would break the incompatible-units rule (ticket s8).
// ------------------------------------------------------------
export interface ChannelTotals {
  customers: number;
  orders: number;
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
  netAmount: number;
  avgOrderSizeKg: number;
  returnRatePct: number;
}

export interface CustomerOrderConsumptionOverview {
  totalCustomers: number;
  totalOrders: number;
  cylinder: ChannelTotals;
  lpg: ChannelTotals;
  exceptionCount: number;
}

// ------------------------------------------------------------
// BFF response envelope
// ------------------------------------------------------------
export interface CustomerOrderConsumptionReportResponse {
  filters: AppliedFilterContext;
  generatedAt: string; // ISO timestamp
  reportingCutoff: string; // YYYY-MM-DD, mirrors endDate
  sourceRowCount: number; // raw rows read before aggregation
  overview: CustomerOrderConsumptionOverview;
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  monthlyTrend: ReportTrendPoint[];
}

// ------------------------------------------------------------
// Drill-down: the supporting documents behind one customer row group.
// ------------------------------------------------------------
export interface SupportingDocument {
  documentType: "SALES_ORDER" | "SALES_INVOICE" | "DISPATCH" | "SALES_RETURN" | "WIWO" | "METER_READING" | "LPG_BILLING";
  documentNo: string;
  date: string;
  status: string;
  quantity: number;
  kg: number;
  amount: number;
  reference: string;
}

export interface CustomerOrderConsumptionDetail {
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchName: string;
  window: { startDate: string; endDate: string };
  documents: SupportingDocument[];
  exceptions: ReportException[];
}

// ------------------------------------------------------------
// Filter-bar lookup options
// ------------------------------------------------------------
export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface ReportLookupResponse {
  data: ReportLookupOption[];
}
