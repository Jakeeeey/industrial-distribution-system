export type BillingMode = 'KILO' | 'METERED' | 'BOTH';
export type MeterUnit = 'M3' | 'LITER' | 'KG' | 'UNIT';
export type MeterDirection = 'INCREASING' | 'DECREASING';
export type SiteCylinderStatus = 'CONNECTED' | 'STANDBY' | 'REMOVED' | 'RETURNED' | 'EMPTY' | 'DAMAGED';

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

  // Expansion
  customer?: {
    customer_code: string;
    customer_name: string;
  };
  cylinders?: SiteCylinder[];
}

export interface SiteCylinder {
  id: number;
  lpg_site_id: number;
  customer_code: string;
  cylinder_asset_id: number | {
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
