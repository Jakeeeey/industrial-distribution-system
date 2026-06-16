// RULE DEV: WiWO Billing Summary — shared type contracts for this module
// References the shared types.ts at the wiwo-billing parent level

export type { MeteredWiwoTransaction, WiwoHeader, WiwoDetail, WiwoType, WiwoStatus, DetailLineType, BillingSource } from "../wiwo-billing-creation/types";

// Summary-specific list params (mirrors metered list params structure for API consistency)
export interface WiwoSummaryListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  transactionType?: string;
}
