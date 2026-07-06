export type PurchaseOrder = {
  purchase_order_id: number;
  purchase_order_no: string;
  date: string;
  supplier_name: number;
  remark: string | null;
  inventory_status: number;
  payment_status: number;
  transaction_type: number;
  // Refill/serial tagging flags
  is_refill?: number;
  is_tagged?: number;
  
  gross_amount?: number;
  grossAmount?: number;
  subtotal?: number;
  
  discount_amount?: number;
  discounted_amount?: number;
  discountAmount?: number;
  discount_value?: number;
  
  discount_percent?: number;
  discount_type?: string;
  
  total_amount?: number;
  total?: number;
  net_amount?: number;
  vat_amount?: number;

  // Derived flags for filtering
  is_serialized_po?: boolean;
  is_industrial_po?: boolean;
  is_industrial_supplier?: boolean;
  supplier_type?: string;
};

export type Supplier = {
  id: number;
  supplier_name: string;
  supplier_type: string;
};

export type StatusRef = {
  id: number;
  status: string;
};

// ── Serial Audit Log Types ─────────────────────────────────────────────────────

/** A single serial number pre-tagged before receiving (from purchase_order_serial) */
export type ExpectedSerial = {
  id: number;
  serialNumber: string;
};

/** A single serial scanned and received physically (from purchase_order_receiving_serial) */
export type ReceivedSerial = {
  id: number;
  serialNumber: string;
  createdAt: string;
  tareWeight: number | null;
};

/** Expected vs. received serials grouped by product for one PO */
export type SerialProductGroup = {
  productId: number;
  productName: string;
  /** Pre-tagged expected serials from purchase_order_serial */
  expected: ExpectedSerial[];
  /** Physically received serials from purchase_order_receiving_serial */
  received: ReceivedSerial[];
};

/** Top-level serial audit log returned by the API */
export type POSerialAuditLog = {
  /** true only when is_refill=1 AND is_tagged=1 */
  isRefillTagged: boolean;
  byProduct: SerialProductGroup[];
};