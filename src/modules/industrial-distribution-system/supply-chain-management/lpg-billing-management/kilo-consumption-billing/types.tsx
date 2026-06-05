// ─── Enums / Literals ────────────────────────────────────────────────────────

export type WiwoStatus = "PENDING" | "BILLED" | "CANCELLED" | "VOIDED";
export type InvoiceStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type BillingSource = "WIWO" | "METERED";

// ─── WIWO Header ─────────────────────────────────────────────────────────────

export interface WiwoHeader {
  id: number;
  transaction_no: string;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  status: WiwoStatus;
  remarks: string | null;
  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // Relations
  customer?: {
    customer_code: string;
    customer_name: string;
  };
  site?: {
    id: number;
    site_name: string | null;
    default_price_per_kg: number;
  };
  details?: WiwoDetail[];

  // Computed (populated by calc)
  total_wiwo_kg?: number;
}

// ─── WIWO Detail ─────────────────────────────────────────────────────────────

export interface WiwoDetail {
  id: number;
  wiwo_header_id: number;
  site_cylinder_id: number | null;
  cylinder_asset_id: number;
  serial_number: string;
  opening_lpg_kg: number;
  gross_weight: number;
  tare_weight: number;
  remarks: string | null;

  // Computed
  remaining_lpg_kg?: number;
  consumed_lpg_kg?: number;
}

// ─── Kilo Billing Invoice ─────────────────────────────────────────────────────

export interface KiloBillingInvoice {
  id?: number;
  invoice_no: string;
  invoice_date: string;
  wiwo_header_id: number;
  customer_code: string;
  lpg_site_id: number | null;
  billable_kg: number;
  price_per_kg: number;
  gross_amount: number;
  vat_amount: number;
  net_amount: number;
  status: InvoiceStatus;
  remarks: string | null;
  created_by: number | null;
  created_date: string | null;

  // Relations
  customer?: { customer_name: string };
  site?: { site_name: string | null };
  wiwo_header?: WiwoHeader;
}

// ─── Filter Params ────────────────────────────────────────────────────────────

export interface KiloListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ─── Billing Form State ───────────────────────────────────────────────────────

export interface KiloBillingFormState {
  invoiceNo: string;
  invoiceDate: string;
  pricePerKg: number;
  vatRate: number; // 0.12 default
  remarks: string;
  status: InvoiceStatus;
}
