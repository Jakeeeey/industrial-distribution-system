export type WiwoType = 'CONSUMPTION_SWAP' | 'RETURN_ONLY' | 'DEPLOYMENT_ONLY' | 'ADJUSTMENT';
export type WiwoStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type DetailLineType = 'CONSUMPTION_RETURN' | 'NEW_DEPLOYMENT' | 'RETURN_ONLY' | 'ADJUSTMENT';
export type BillingSource = 'NONE' | 'WIWO' | 'METERED';
export type TransactionHeaderStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface LpgTransactionHeader {
  header_id: number;
  header_no: string | null;
  customer_id: string;
  customer_site_id: number;
  period_from: string;
  period_to: string;
  status: TransactionHeaderStatus;
  is_billed: number;
  remarks: string | null;
  created_by?: number | null;
  posted_by?: number | null;
  posted_at?: string | null;
  cancelled_by?: number | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  site?: CustomerSite;
  customer_name?: string;
}

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

export interface WiwoHeader {
  id: number;
  wiwo_no?: string;
  transaction_no?: string;
  wiwo_type: WiwoType;
  transaction_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  total_returned_cylinders: number;
  total_deployed_cylinders: number;
  total_billable_kg: number;
  wiwo_status: WiwoStatus;
  remarks: string | null;
  created_by?: number | null;
  created_date?: string | null;
  modified_by?: number | null;
  modified_date?: string | null;

  // Audit metadata for cancellation
  cancelled_by?: number | null;
  cancelled_date?: string | null;
  cancelled_reason?: string | null;

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
}

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
  is_billable: number; // TINYINT or number (0/1)
  remarks?: string | null;
}

export interface MeteredWiwoTransaction {
  id: number;
  transaction_header_id?: number | null;
  transaction_no?: string;
  transaction_date: string;
  billing_period_from?: string | null;
  billing_period_to?: string | null;
  transaction_type?: string;
  customer_code: string;
  lpg_site_id: number;
  sales_order_id: number | null;
  sales_order_no?: string | null;
  meter_reading_id: number | null;
  wiwo_header_id: number | null;
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  variance_reason_code?: 'NONE' | 'METER_DRIFT' | 'PHYSICAL_LEAK' | 'METER_MALFUNCTION' | 'TEMPERATURE_VARIATION';
  billable_source: BillingSource;
  billable_kg: number;
  sales_invoice_id: number | null;
  sales_invoice_no?: string | null;
  price_per_kg: number;
  gross_amount: number;
  vat_amount: number;
  net_amount: number;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  remarks: string | null;
  created_by?: number | null;
  created_date?: string | null;
  modified_by?: number | null;
  modified_date?: string | null;

  // Audit metadata for cancellation
  cancelled_by?: number | null;
  cancelled_date?: string | null;
  cancelled_reason?: string | null;

  // Relations
  customer?: {
    customer_code: string;
    customer_name: string;
    store_name?: string | null;
  };
  site?: {
    id: number;
    site_name: string | null;
    default_price_per_kg: number;
  };
  // AG-CHANGE: Embedded meter_reading and wiwo_header for summary display
  meter_reading?: {
    id: number;
    lpg_site_id: number;
    reading_date: string;
    previous_reading: number;
    current_reading: number;
    kg_consumed: number;
    price_per_kg: number;
    raw_consumption?: number;
    created_by?: number | null;
    created_date?: string | null;
  };
  wiwo_header?: WiwoHeader | null;
}

export interface WiwoListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  // AG-CHANGE: Optional filter to scope transactions to a specific transaction header
  transactionHeaderId?: number;
  salesInvoiceId?: number;
}

export interface OnboardCylinderInput {
  cylinderAssetId: number;
  targetKg: number;
  pricePerKg: number;
}

export interface CustomerSite {
  id: number;
  site_name: string | null;
  customer_code: string;
  default_price_per_kg: number;
  last_meter_reading?: number | null;
  default_target_lpg_kg?: number | null;
}

export interface MeterReading {
  id: number;
  previous_reading: number;
  current_reading: number;
  kg_consumed: number;
  price_per_kg: number;
  reading_date: string;
}
