// ============================================================
// customer-order-consumption.test-fixtures.ts
// Builders for the raw Directus row shapes the aggregation consumes.
// Test-only: no production module imports this file.
// ============================================================

import type {
  AppliedFilterContext,
  ConsumptionSourceData,
  CustomerOrderConsumptionFilters,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawLpgSiteRow,
  RawMeterReadingRow,
  RawPostDispatchRow,
  RawProductRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  RawSalesmanRow,
  RawUnitRow,
  RawUnifiedLpgRow,
  RawWeightUnitRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
} from "../types/customer-order-consumption.types";

export const WINDOW = { startDate: "2026-01-01", endDate: "2026-01-31" };

export function filters(
  patch: Partial<CustomerOrderConsumptionFilters> = {}
): AppliedFilterContext {
  return { ...WINDOW, ...patch };
}

export function invoice(patch: Partial<RawInvoiceRow> = {}): RawInvoiceRow {
  return {
    invoice_id: 1,
    order_id: null,
    invoice_no: "SI-0001",
    customer_code: "C-001",
    branch_id: 10,
    salesman_id: 5,
    invoice_date: "2026-01-10",
    transaction_status: "posted",
    net_amount: 1000,
    gross_amount: 1000,
    discount_amount: 0,
    ...patch,
  };
}

export function invoiceDetail(
  patch: Partial<RawInvoiceDetailRow> = {}
): RawInvoiceDetailRow {
  return {
    detail_id: 1,
    invoice_no: 1,
    product_id: 100,
    unit: null,
    quantity: 10,
    unit_price: 100,
    total_amount: 1000,
    discount_amount: 0,
    gross_amount: 1000,
    ...patch,
  };
}

export function salesReturn(patch: Partial<RawReturnRow> = {}): RawReturnRow {
  return {
    return_id: 900,
    return_number: "SR-0001",
    customer_code: "C-001",
    branch_id: 10,
    salesman_id: 5,
    return_date: "2026-01-15",
    gross_amount: 200,
    order_id: null,
    invoice_no: "SI-0001",
    status: "posted",
    isPosted: true,
    deleted_at: null,
    ...patch,
  };
}

export function returnDetail(
  patch: Partial<RawReturnDetailRow> = {}
): RawReturnDetailRow {
  return {
    detail_id: 1,
    return_no: "SR-0001",
    product_id: 100,
    quantity: 2,
    total_amount: 200,
    gross_amount: 200,
    status: "posted",
    ...patch,
  };
}

export function returnLink(
  patch: Partial<RawReturnLinkRow> = {}
): RawReturnLinkRow {
  return { id: 1, return_no: 900, invoice_no: 1, amount: 200, ...patch };
}

/** A 12 kg filled cylinder: product_weight is the GAS weight, not tare. */
export function product(patch: Partial<RawProductRow> = {}): RawProductRow {
  return {
    product_id: 100,
    product_code: "LPG-12",
    product_name: "LPG 12KG",
    product_weight: 12,
    weight: null,
    weight_unit_id: 1,
    product_category: 50,
    is_serialized: 1,
    ...patch,
  };
}

export function unit(patch: Partial<RawUnitRow> = {}): RawUnitRow {
  return { unit_id: 3, unit_name: "Cylinder", unit_shortcut: "cyl", ...patch };
}

export function weightUnit(patch: Partial<RawWeightUnitRow> = {}): RawWeightUnitRow {
  return { id: 1, code: "KG", name: "Kilogram", ...patch };
}

export function category(patch: Partial<RawCategoryRow> = {}): RawCategoryRow {
  return { category_id: 50, category_name: "LPG", is_industrial: 1, ...patch };
}

export function customer(patch: Partial<RawCustomerRow> = {}): RawCustomerRow {
  return {
    customer_code: "C-001",
    customer_name: "Alpha Foods",
    store_name: "Alpha Store",
    classification: 70,
    ...patch,
  };
}

export function classification(
  patch: Partial<RawClassificationRow> = {}
): RawClassificationRow {
  return { id: 70, classification_name: "Commercial", ...patch };
}

export function branch(patch: Partial<RawBranchRow> = {}): RawBranchRow {
  return { id: 10, branch_name: "Manila", branch_code: "MNL", ...patch };
}

export function salesman(patch: Partial<RawSalesmanRow> = {}): RawSalesmanRow {
  return { id: 5, salesman_code: "S-05", salesman_name: "Ana", ...patch };
}

export function lpgSite(patch: Partial<RawLpgSiteRow> = {}): RawLpgSiteRow {
  return { id: 200, customer_code: "C-001", site_name: "Plant 1", billing_mode: "METERED", ...patch };
}

export function unifiedLpg(patch: Partial<RawUnifiedLpgRow> = {}): RawUnifiedLpgRow {
  return {
    id: 300,
    transaction_no: "LPG-0001",
    transaction_type: "consumption",
    lpg_site_id: 200,
    customer_code: "C-001",
    sales_order_id: null,
    sales_order_no: null,
    meter_reading_id: null,
    wiwo_header_id: null,
    transaction_date: "2026-01-12",
    billing_period_from: "2026-01-01",
    billing_period_to: "2026-01-12",
    metered_kg: 100,
    wiwo_kg: 100,
    variance_kg: 0,
    variance_reason_code: null,
    billable_source: "METERED",
    billable_kg: 100,
    price_per_kg: 10,
    gross_amount: 1000,
    discount_amount: 0,
    net_amount: 1000,
    sales_invoice_id: 1,
    sales_invoice_no: "SI-0001",
    status: "POSTED",
    ...patch,
  };
}

export function wiwoHeader(patch: Partial<RawWiwoHeaderRow> = {}): RawWiwoHeaderRow {
  return {
    id: 400,
    wiwo_no: "WIWO-0001",
    lpg_site_id: 200,
    customer_code: "C-001",
    transaction_date: "2026-01-14",
    wiwo_type: "consumption",
    total_billable_kg: 80,
    net_amount: 800,
    wiwo_status: "POSTED",
    sales_invoice_id: 1,
    sales_invoice_no: "SI-0001",
    ...patch,
  };
}

export function wiwoDetail(patch: Partial<RawWiwoDetailRow> = {}): RawWiwoDetailRow {
  return {
    id: 410,
    wiwo_header_id: 400,
    lpg_site_id: 200,
    customer_code: "C-001",
    line_type: "consumption",
    product_id: null,
    serial_number: "SN-1",
    tare_weight_kg: 5,
    consumed_lpg_kg: 50,
    billable_kg: 50,
    price_per_kg: 10,
    gross_amount: 500,
    net_amount: 500,
    is_billable: true,
    ...patch,
  };
}

export function meterReading(patch: Partial<RawMeterReadingRow> = {}): RawMeterReadingRow {
  return {
    id: 500,
    lpg_site_id: 200,
    customer_code: "C-001",
    reading_no: "MR-0001",
    reading_date: "2026-01-20",
    billing_period_from: "2026-01-01",
    billing_period_to: "2026-01-20",
    meter_unit: "M3",
    kg_consumed: 60,
    price_per_kg: 10,
    gross_amount: 600,
    net_amount: 600,
    reading_status: "POSTED",
    sales_invoice_id: 1,
    sales_invoice_no: "SI-0001",
    ...patch,
  };
}

export function postDispatch(patch: Partial<RawPostDispatchRow> = {}): RawPostDispatchRow {
  return { invoice_id: 1, status: "fulfilled", ...patch };
}

/** A complete, empty source bag; spread patches over the arrays needed. */
export function source(
  patch: Partial<ConsumptionSourceData> = {}
): ConsumptionSourceData {
  return {
    invoices: [],
    invoiceDetails: [],
    returns: [],
    returnDetails: [],
    returnLinks: [],
    products: [],
    units: [],
    weightUnits: [],
    categories: [],
    customers: [],
    classifications: [],
    branches: [],
    salesmen: [],
    lpgSites: [],
    unifiedLpg: [],
    wiwoHeaders: [],
    wiwoDetails: [],
    meterReadings: [],
    postDispatch: [],
    ...patch,
  };
}

/** The minimum master set that makes the default fixtures resolve. */
export function masters(
  patch: Partial<ConsumptionSourceData> = {}
): Partial<ConsumptionSourceData> {
  return {
    products: [product()],
    units: [unit()],
    weightUnits: [weightUnit()],
    categories: [category()],
    customers: [customer()],
    classifications: [classification()],
    branches: [branch()],
    salesmen: [salesman()],
    ...patch,
  };
}
