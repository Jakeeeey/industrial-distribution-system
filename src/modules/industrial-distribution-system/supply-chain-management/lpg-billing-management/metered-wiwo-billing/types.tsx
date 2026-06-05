// ─── Enums / Literals ────────────────────────────────────────────────────────

export type BillableSource = "METERED" | "WIWO";
export type TransactionStatus = "DRAFT" | "POSTED" | "CANCELLED";

// ─── Meter Reading ────────────────────────────────────────────────────────────

export interface MeterReading {
  id: number;
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

// ─── Metered-WIWO Transaction ─────────────────────────────────────────────────

export interface MeteredWiwoTransaction {
  id?: number;
  transaction_no: string;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  meter_reading_id: number | null;
  wiwo_header_id: number | null;

  // KG values
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  billable_source: BillableSource;
  billable_kg: number;

  // Billing
  price_per_kg: number;
  gross_amount: number;
  vat_amount: number;
  net_amount: number;

  // Invoice
  sales_invoice_id: number | null;
  status: TransactionStatus;
  remarks: string | null;

  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // Relations
  customer?: { customer_name: string; store_name?: string | null };
  site?: { site_name: string | null };
  meter_reading?: MeterReading;
  wiwo_header?: WiwoHeaderRef;
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
  page?: number;
  limit?: number;
}
