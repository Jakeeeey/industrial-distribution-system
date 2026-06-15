// ─── billing-consolidation.types.ts ──────────────────────────────────────────
// Pure TypeScript interfaces for the LPG Billing Consolidation module.
// Business purpose: Provides the data contracts between the repo, service,
// hook, and UI layers for reviewing and approving final LPG billing headers.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shared Enums ────────────────────────────────────────────────────────────

export type HeaderStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type TransactionStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type BillableSource = "METERED" | "WIWO" | "NONE";
export type WiwoLineType =
  | "CONSUMPTION_RETURN"
  | "NEW_DEPLOYMENT"
  | "RETURN_ONLY"
  | "ADJUSTMENT";

// ─── Billing Header (lpg_transaction_headers) ────────────────────────────────

export interface ConsolidationHeader {
  header_id: number;
  header_no: string | null;
  /** Customer code (customer_id on the DB table) */
  customer_id: string;
  customer_site_id: number;
  period_from: string; // "YYYY-MM-DD"
  period_to: string;   // "YYYY-MM-DD"
  status: HeaderStatus;
  is_billed: 0 | 1;
  remarks: string | null;
  created_by: number | null;
  posted_by: number | null;
  posted_at: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;

  // --- Expanded relations (joined by repo) ---
  customer?: { customer_name: string; store_name?: string | null };
  site?: {
    id: number;
    site_name: string | null;
    site_address: string | null;
  };
  /** Computed from child transactions by the service layer */
  total_metered_kg?: number;
  total_wiwo_kg?: number;
  total_billable_kg?: number;
  total_gross_amount?: number;
  total_net_amount?: number;
  /** Count of child transactions */
  transaction_count?: number;
}

// ─── Child Transaction (lpg_metered_wiwo_transactions) ───────────────────────

export interface ConsolidationTransaction {
  id: number;
  transaction_header_id: number;
  transaction_no: string;
  transaction_type: "ONBOARDING_BASELINE" | "REGULAR_BILLING" | "ADJUSTMENT";
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number;

  // Foreign keys to reading/WIWO modules
  meter_reading_id: number | null;
  wiwo_header_id: number | null;

  // KG values
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  billable_source: BillableSource;
  billable_kg: number;

  // Amounts
  price_per_kg: number;
  gross_amount: number;
  discount_amount: number;
  vat_amount: number;
  net_amount: number;

  status: TransactionStatus;
  billing_period_from: string | null;
  billing_period_to: string | null;
  remarks: string | null;

  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // --- Expanded relations ---
  /** Full meter reading record attached to this transaction */
  meter_reading?: ConsolidationMeterReading;
  /** Full WIWO header with its cylinder details */
  wiwo_header?: ConsolidationWiwoHeader;
  /** Uploaded photo attachments (serial / weight / general) */
  attachments?: ConsolidationAttachment[];
}

// ─── Meter Reading (lpg_meter_readings) ──────────────────────────────────────

export interface ConsolidationMeterReading {
  id: number;
  reading_no: string | null;
  lpg_site_id: number;
  customer_code: string;
  reading_date: string;
  billing_period_from: string | null;
  billing_period_to: string | null;
  previous_reading: number;
  current_reading: number;
  raw_consumption: number;
  meter_unit: "M3" | "LITER" | "KG" | "UNIT";
  meter_direction: "INCREASING" | "DECREASING";
  conversion_factor: number;
  pressure_line: number;
  psi: number;
  atmospheric_pressure: number;
  lpg_vapor_factor: number;
  kg_consumed: number;
  price_per_kg: number;
  gross_amount: number;
  discount_amount: number;
  vat_amount: number;
  net_amount: number;
  reading_status: "DRAFT" | "POSTED" | "CANCELLED";
  remarks: string | null;
}

// ─── WIWO Header (lpg_wiwo_headers) ──────────────────────────────────────────

export interface ConsolidationWiwoHeader {
  id: number;
  wiwo_no: string;
  lpg_site_id: number;
  customer_code: string;
  transaction_date: string;
  wiwo_type: "CONSUMPTION_SWAP" | "RETURN_ONLY" | "DEPLOYMENT_ONLY" | "ADJUSTMENT";
  total_returned_cylinders: number;
  total_deployed_cylinders: number;
  total_billable_kg: number;
  price_per_kg: number;
  gross_amount: number;
  discount_amount: number;
  vat_amount: number;
  net_amount: number;
  wiwo_status: "DRAFT" | "POSTED" | "CANCELLED";
  remarks: string | null;

  // --- Expanded cylinder details ---
  details?: ConsolidationWiwoDetail[];
}

// ─── WIWO Detail (lpg_wiwo_details) ──────────────────────────────────────────

export interface ConsolidationWiwoDetail {
  id: number;
  wiwo_header_id: number;
  line_no: number;
  lpg_site_id: number;
  customer_code: string;
  line_type: WiwoLineType;
  site_cylinder_id: number | null;
  cylinder_asset_id: number;
  product_id: number;
  serial_number: string;
  tare_weight_kg: number;
  previous_lpg_kg: number;
  returned_gross_weight_kg: number | null;
  remaining_lpg_kg: number;
  consumed_lpg_kg: number;
  billable_kg: number;
  price_per_kg: number;
  gross_amount: number;
  discount_amount: number;
  vat_amount: number;
  net_amount: number;
  is_billable: 0 | 1;
  remarks: string | null;

  // --- Expanded relations ---
  product?: { product_name: string | null };
}

// ─── Transaction Attachment ───────────────────────────────────────────────────

export interface ConsolidationAttachment {
  id: number;
  transaction_id: number;
  site_cylinder_id: number | null;
  cylinder_asset_id: number | null;
  attachment_type: "SERIAL_IMAGE" | "WEIGHT_IMAGE" | "GENERAL_PHOTO";
  /** Directus file UUID */
  directus_file_id: string;
  created_by: number | null;
  created_at: string;
}

// ─── Audit Trail (lpg_metered_wiwo_transactions_audit) ───────────────────────

export interface ConsolidationAuditEntry {
  audit_id: number;
  transaction_id: number;
  transaction_no: string;
  action_type: string; // e.g. "UPDATE"
  /** JSON payload: { "column": { "old": x, "new": y } } */
  changes_payload: Record<string, { old: unknown; new: unknown }>;
  modified_by: number | null;
  modified_date: string;
}

// ─── API Param Types ──────────────────────────────────────────────────────────

export interface ConsolidationHeaderListParams {
  search?: string;
  status?: HeaderStatus | "ALL";
  page?: number;
  limit?: number;
}

export interface MeterReadingAdjustPayload {
  transactionId: number;
  meterReadingId: number;
  /** Reviewer-corrected current reading */
  new_current_reading: number;
  adjustment_reason: string;
  modified_by: number;
}

export interface WiwoDetailAdjustPayload {
  transactionId: number;
  wiwoDetailId: number;
  wiwoHeaderId: number;
  /** Reviewer-corrected returned gross weight in kg */
  new_returned_gross_weight_kg: number;
  adjustment_reason: string;
  modified_by: number;
}

export interface ApproveHeaderPayload {
  headerId: number;
  approved_by: number;
}

// ─── Active Cylinder Raw Response (lpg_customer_site_cylinders) ────────────────
// Added to support typing for onboarding baseline cylinder syntheses in service layer
export interface ActiveCylinderRaw {
  id: number;
  lpg_site_id: number;
  customer_code: string;
  previous_lpg_kg: number | null;
  current_lpg_kg: number | null;
  installed_date: string;
  cylinder_asset_id: {
    id: number;
    serial_number: string;
    tare_weight: number;
    product_id?: {
      product_name: string | null;
    } | null;
  } | null;
}

