export type BillingMode = 'KILO' | 'METERED' | 'BOTH';
export type BillingType = 'KILO' | 'METERED';
export type MeterUnit = 'M3' | 'LITER' | 'KG' | 'UNIT';
export type MeterDirection = 'INCREASING' | 'DECREASING';
export type SiteCylinderStatus = 'CONNECTED' | 'STANDBY' | 'REMOVED' | 'RETURNED' | 'EMPTY' | 'DAMAGED';
export type ConversionStatus = 'NOT_CONVERTED' | 'CONVERTED' | 'VOIDED';
export type BillingStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type CylinderStatusAtReading = 'AVAILABLE' | 'RESERVED' | 'LOADED' | 'WITH_CUSTOMER' | 'EMPTY' | 'DAMAGED' | 'LOST' | 'RETIRED';

export interface LpgSite {
  id: number;
  customer_code: string;
  site_name: string | null;
  site_address: string | null;
  billing_mode: BillingMode;
  default_price_per_kg: number;
  default_target_lpg_kg: number;
  meter_no: string | null;
  meter_unit: MeterUnit | null;
  meter_direction: MeterDirection | null;
  conversion_factor: number | null;
  last_meter_reading: number | null;
  last_reading_date: string | null;
  is_active: boolean;
  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;
}

export interface SiteCylinder {
  id: number;
  lpg_site_id: number;
  customer_code: string;
  cylinder_asset_id: number;
  installed_date: string;
  removed_date: string | null;
  site_cylinder_status: SiteCylinderStatus;
  opening_lpg_kg: number | null;
  current_estimated_lpg_kg: number | null;
  remarks: string | null;
  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // Expansion
  asset?: {
    id: number;
    serial_number: string;
    tare_weight: number;
    product_id: number;
    product?: {
      product_id: number;
      product_name: string;
      product_code: string;
    };
  };
}

export interface ConsumptionBilling {
  id?: number;
  billing_no: string;
  billing_date: string;
  customer_code: string;
  lpg_site_id: number | null;
  branch_id: number | null;
  salesman_id: number | null;
  supplier_id: number | null;
  sales_type: number | null;
  receipt_type: number | null;
  payment_terms: number | null;
  billing_type: BillingType;
  total_billable_kg: number;
  price_per_kg: number;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  grand_total_amount: number;
  sales_order_id: number | null;
  sales_order_no: string | null;
  conversion_status: ConversionStatus;
  converted_by: number | null;
  converted_date: string | null;
  status: BillingStatus;
  remarks: string | null;
  created_by: number | null;
  created_date: string | null;
  modified_by: number | null;
  modified_date: string | null;

  // Lines expansion
  lines?: BillingCylinderLine[];
  
  // Joins expansion
  customer?: {
    customer_code: string;
    customer_name: string;
  };
  site?: {
    id: number;
    site_name: string;
  };
}

export interface BillingCylinderLine {
  id?: number;
  billing_id: number;
  site_cylinder_id: number | null;
  cylinder_asset_id: number;
  product_id: number;
  sales_order_detail_id: number | null;
  serial_number: string;
  cylinder_status_at_reading: CylinderStatusAtReading | null;
  tare_weight: number;
  current_gross_weight: number;
  remaining_lpg_kg: number;
  target_lpg_kg: number;
  target_gross_weight: number;
  kg_needed: number;
  price_per_kg: number;
  line_total: number;
  remarks: string | null;
  created_date?: string;

  // Expansion
  product?: {
    product_id: number;
    product_name: string;
    product_code: string;
  };
}
