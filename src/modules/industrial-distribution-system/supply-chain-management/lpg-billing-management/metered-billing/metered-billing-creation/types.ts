// ─── Enums / Literals ────────────────────────────────────────────────────────

export type TransactionType = "ONBOARDING_BASELINE" | "REGULAR_BILLING";
export type BillableSource = "METERED" | "WIWO" | "NONE";
export type TransactionStatus = "DRAFT" | "POSTED" | "CANCELLED";

// ─── Meter Reading ────────────────────────────────────────────────────────────

export interface MeterReading {
  id: number;
  reading_no?: string;
  lpg_site_id: number;
  reading_date: string;
  previous_reading: number;
  current_reading: number;
  raw_consumption: number;
  kg_consumed: number;
  price_per_kg: number;
  created_by: number | null;
  created_date: string | null;

  // Relations
  site?: {
    id: number;
    site_name: string | null;
    customer_code: string;
    conversion_factor: number | null;
    meter_unit: string | null;
  };
  customer?: { customer_name: string };
}

// ─── WIWO Header (reused from kilo module) ────────────────────────────────────

export interface WiwoHeaderRef {
  id: number;
  transaction_no: string;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  status: string;
  total_wiwo_kg?: number;
  details?: WiwoDetailRef[];
}

export interface WiwoDetailRef {
  id: number;
  wiwo_header_id: number;
  serial_number: string;
  opening_lpg_kg: number;
  gross_weight: number;
  tare_weight: number;
  remaining_lpg_kg?: number;
  consumed_lpg_kg?: number;
}

export interface LpgTransactionHeader {
  header_id?: number;
  header_no?: string | null;
  customer_id: string;
  customer_site_id: number;
  period_from: string;
  period_to: string;
  status: TransactionStatus;
  is_billed: number;
  remarks?: string | null;
  created_by?: number | null;
  posted_by?: number | null;
  posted_at?: string | null;
  cancelled_by?: number | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Metered-WIWO Transaction ─────────────────────────────────────────────────

export interface MeteredWiwoTransaction {
  id?: number;
  transaction_header_id: number | null;

  /** Primary transaction identifier (MTR-ONB-... or MTR-REG-... prefix) */
  transaction_no?: string;
  /** Legacy alias kept for backward compat — maps to transaction_no or reading_no */
  reading_no: string;

  transaction_type: TransactionType;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  meter_reading_id: number | null;
  wiwo_header_id: number | null;

  // KG values (not applicable for ONBOARDING_BASELINE)
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  billable_source: BillableSource;
  billable_kg: number;

  // Billing (not applicable for ONBOARDING_BASELINE)
  price_per_kg: number;
  gross_amount: number;
  vat_amount: number;
  net_amount: number;
  discount_amount?: number;

  // Invoice
  sales_invoice_id: number | null;
  sales_invoice_no?: string | null;
  sales_order_id?: number | null;
  sales_order_no?: string | null;
  status: TransactionStatus;
  remarks: string | null;

  // Pressure fields snapshot
  pressure_line?: number;
  psi?: number;
  atmospheric_pressure?: number;
  lpg_vapor_factor?: number;

  // Meter settings snapshot
  meter_unit?: "M3" | "LITER" | "KG" | "UNIT";
  meter_direction?: "INCREASING" | "DECREASING";
  conversion_factor?: number;

  // Billing period
  billing_period_from?: string | null;
  billing_period_to?: string | null;

  // Post / Cancel logs
  posted_by?: number | null;
  posted_date?: string | null;
  cancelled_by?: number | null;
  cancelled_date?: string | null;
  cancelled_reason?: string | null;

  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // Relations
  header?: LpgTransactionHeader;
  customer?: { customer_name: string; store_name?: string | null };
  site?: {
    id?: number;
    site_name: string | null;
    site_address?: string | null;
    default_pressure_line?: number | null;
    default_psi?: number | null;
    default_atmospheric_pressure?: number | null;
    billing_mode?: string | null;
  };
  meter_reading?: MeterReading;
  wiwo_header?: WiwoHeaderRef;
  attachments?: MeteredWiwoTransactionAttachment[];
}

export interface MeteredWiwoTransactionAttachment {
  id?: number;
  transaction_id?: number;
  site_cylinder_id?: number | null;
  cylinder_asset_id?: number | null;
  // IDS-CHANGE: Added "PSI_IMAGE" and "MTRD_READING_IMAGE" for metered billing screenshots
  attachment_type: "SERIAL_IMAGE" | "WEIGHT_IMAGE" | "GENERAL_PHOTO" | "PSI_IMAGE" | "MTRD_READING_IMAGE";
  directus_file_id: string;
  created_by?: number | null;
  created_at?: string;
}

// ─── Arbitration Result ───────────────────────────────────────────────────────

export interface ArbitrationResult {
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  billable_kg: number;
  billable_source: BillableSource;
}

// ─── Filter Params ────────────────────────────────────────────────────────────

export interface MeteredListParams {
  search?: string;
  status?: string;
  transactionType?: TransactionType | "ALL";
  page?: number;
  limit?: number;
  siteId?: number;
}
