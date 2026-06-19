export type CylinderStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'LOADED'
  | 'WITH_CUSTOMER'
  | 'EMPTY'
  | 'DAMAGED'
  | 'LOST'
  | 'RETIRED';

export type CylinderCondition = 'GOOD' | 'FOR_REPAIR' | 'DAMAGED' | 'SCRAP';

export interface CylinderAsset {
  id: number;
  product_id: number;
  serial_number: string;
  cylinder_status: CylinderStatus;
  cylinder_condition: CylinderCondition;
  current_branch_id: number | null;
  current_customer_code: string | null;
  acquisition_date: string | null;
  expiration_date: string | null;
  tare_weight: number | null;
  cost: number | null;
  remarks: string | null;
  created_by?: number | null | {
    user_fname: string;
    user_lname: string;
  };
  created_date?: string | null;
  modified_by?: number | null;
  modified_date?: string | null;

  // Potential relational fields for the UI
  product?: {
    product_id: number;
    product_name: string;
    product_code: string;
    unit_of_measurement?: number | null;
  };
  branch?: {
    id: number;
    branch_name: string;
  };
  customer?: {
    customer_code: string;
    customer_name: string;
  };
}
