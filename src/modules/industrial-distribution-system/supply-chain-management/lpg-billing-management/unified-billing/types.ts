// ─── Billing Mode ─────────────────────────────────────────────────────────────
export type BillingMode = 'BOTH' | 'KILO';
export type WiwoType = 'CONSUMPTION_SWAP' | 'RETURN_ONLY' | 'DEPLOYMENT_ONLY' | 'ADJUSTMENT';
export type WiwoStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type DetailLineType = 'CONSUMPTION_RETURN' | 'NEW_DEPLOYMENT' | 'RETURN_ONLY' | 'ADJUSTMENT';
export type BillingSource = 'NONE' | 'WIWO' | 'METERED';
export type TransactionType = 'ONBOARDING_BASELINE' | 'REGULAR_BILLING' | 'ADJUSTMENT';
export type VarianceReasonCode = 'NONE' | 'METER_DRIFT' | 'PHYSICAL_LEAK' | 'METER_MALFUNCTION' | 'TEMPERATURE_VARIATION';

// ─── LPG Site ─────────────────────────────────────────────────────────────────
export interface LpgSite {
  id: number;
  site_name: string | null;
  customer_code: string;
  billing_mode: BillingMode;
  default_price_per_kg: number;
  default_target_lpg_kg: number;
  last_meter_reading: number | null;
  last_reading_date: string | null;
  meter_no: string | null;
  meter_unit: string | null;
  conversion_factor: number | null;

  // Relations
  customer?: {
    customer_code: string;
    customer_name: string;
  };
}

// ─── Cylinder Asset ───────────────────────────────────────────────────────────
export interface CylinderAsset {
  id: number;
  serial_number: string;
  tare_weight: number;
  cylinder_status: string;
  cylinder_condition: string;
  product_id?: number;
  product?: {
    id: number;
    product_name: string;
    unit_of_measurement_count?: number;
  };
}

// ─── Customer Site Cylinder ───────────────────────────────────────────────────
export interface CustomerSiteCylinder {
  id: number;
  lpg_site_id: number;
  customer_code: string;
  cylinder_asset_id: number;
  site_cylinder_status: 'CONNECTED' | 'STANDBY' | 'REMOVED' | 'RETURNED' | 'EMPTY' | 'DAMAGED';
  previous_lpg_kg: number;
  current_lpg_kg: number;
  installed_date?: string;
  removed_date?: string | null;
  cylinder_asset?: CylinderAsset;
}

// ─── WIWO Header ──────────────────────────────────────────────────────────────
export interface WiwoHeader {
  id: number;
  wiwo_no?: string;
  wiwo_type: WiwoType;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  total_returned_cylinders: number;
  total_deployed_cylinders: number;
  total_billable_kg: number;
  wiwo_status: WiwoStatus;
  remarks: string | null;
  details?: WiwoDetail[];
}

// ─── WIWO Detail ──────────────────────────────────────────────────────────────
export interface WiwoDetail {
  id?: number;
  wiwo_header_id?: number;
  line_type: DetailLineType;
  site_cylinder_id?: number | null;
  cylinder_asset_id: number;
  serial_number: string;
  previous_lpg_kg: number;
  returned_gross_weight_kg: number | null;
  tare_weight_kg: number;
  remaining_lpg_kg: number;
  consumed_lpg_kg: number;
  price_per_kg?: number;
  is_billable: number;
  remarks?: string | null;
}

// ─── Unified Transaction (Parent Ledger) ──────────────────────────────────────
export interface UnifiedBillingTransaction {
  id: number;
  transaction_no?: string;
  transaction_date: string;
  transaction_type?: TransactionType;
  billing_mode?: BillingMode;
  customer_code: string;
  lpg_site_id: number;
  sales_order_id: number | null;
  sales_order_no?: string | null;
  meter_reading_id: number | null;
  wiwo_header_id: number | null;

  // KG values
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  variance_reason_code?: VarianceReasonCode;
  billable_source: BillingSource;
  billable_kg: number;
  // Billing
  price_per_kg: number;
  gross_amount: number;
  vat_amount: number;
  net_amount: number;
  sales_invoice_id: number | null;
  sales_invoice_no?: string | null;

  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  remarks: string | null;
  created_by?: number | null;
  created_date?: string | null;
  modified_by?: number | null;
  modified_date?: string | null;

  // Audit
  cancelled_by?: number | null;
  cancelled_date?: string | null;
  cancelled_reason?: string | null;

  // Relations
  customer?: { customer_code: string; customer_name: string };
  site?: { id: number; site_name: string | null; default_price_per_kg: number; billing_mode?: BillingMode };
  wiwo_header_id_obj?: WiwoHeader;
  meter_reading?: {
    id: number;
    reading_date: string;
    previous_reading: number;
    current_reading: number;
    raw_consumption: number;
    kg_consumed: number;
    price_per_kg: number;
  };
}

// ─── Computation Result ───────────────────────────────────────────────────────
export interface ArbitrationResult {
  meteredKg: number;
  wiwoKg: number;
  varianceKg: number;
  billableKg: number;
  billableSource: BillingSource;
}

// ─── Onboarding Input ─────────────────────────────────────────────────────────
export interface OnboardCylinderInput {
  cylinderAssetId: number;
  targetKg: number;
  pricePerKg: number;
}

// ─── Filter Params ────────────────────────────────────────────────────────────
export interface UnifiedBillingListParams {
  search?: string;
  status?: string;
  billingMode?: BillingMode;
  page?: number;
  limit?: number;
}
