export type CustomerTier =
  | "Commercial"
  | "Walk-in"
  | "Retail Trade Outlet"
  | "RTO"
  | (string & {});
export type TransactionStatus = "Unpaid" | "Terms" | "Partially Paid" | "Paid";

export interface CustomerMetrics {
  totalOrdered: number;
  totalDelivered: number;
  totalDeliveries: number;
  onTimeDeliveries: number;
  cumulativeDeployed: number;
  cumulativeReturned: number;
  outstandingBalance: number;
  avgVisitDays: number;
  timeGap: number;
  volumeGap: string;
  currentUsage: string;
}

export interface Transaction {
  id: string;
  date: string;
  refNo: string;
  orderDetails: string;
  orderedQty: number;
  deliveredQty: number;
  emptiesReturned: number;
  tankBalance: number;
  totalAmount: number;
  status: TransactionStatus;
}

export interface AssetLedgerEntry {
  id: string;
  date: string;
  deployed: number;
  returned: number;
  reference: string;
}

export interface CustomerHistoryData {
  id: string;
  name: string;
  tier: CustomerTier;
  contact: string;
  phone: string;
  metrics: CustomerMetrics;
  transactions: Transaction[];
  assetLedger: AssetLedgerEntry[];
}
