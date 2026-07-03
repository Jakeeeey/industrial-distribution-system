export interface SalesOrderHeader {
  order_id: number;
  order_no: string;
  customer_code: string;
  customer_name: string;
  branch_id?: number | null;
  branch_name?: string;
  order_status?: string;
}

export interface TaggedSerial {
  serial_number: string;
  status: string;
}

export interface SalesOrderItem {
  detail_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  ordered_qty: number;
  allocated_qty: number;
  served_qty: number; // Added: Invoiced / Served quantity column
  tagged_qty: number;
  tagged_serials: TaggedSerial[];
}

export interface SalesOrderTaggingDetails {
  order: SalesOrderHeader;
  items: SalesOrderItem[];
}

export interface MappedSerial {
  serial_number: string;
  product_id: number;
  cylinder_status?: string;
}

export interface CustomerAsset {
  id: number;
  serial_number: string;
  product_name: string;
  days_at_site: number;
}

export interface SalesOrderListItem {
  order_id: number;
  order_no: string;
  customer_code: string;
  customer_name: string;
  branch_id: number;
  branch_name?: string;
  order_status?: string;
  created_date?: string;
  tagging_status?: "tagged" | "partially tagged" | "not tagged";
}
