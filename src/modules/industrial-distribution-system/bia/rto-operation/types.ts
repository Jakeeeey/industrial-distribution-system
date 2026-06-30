// types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared TypeScript contracts for the BIA RTO Operation module.
//
// Data origin:
//   - Dealers     → Directus `customer` collection where store_type = "Dealer"
//   - Network     → `customer_salesmen` junction → `salesman` table
//   - Cylinders   → `cylinder_assets` (status = WITH_CUSTOMER) joined to dealer
//   - Movements   → consolidator + dispatch + POS pipeline (same as cylinder aging)
// ──────────────────────────────────────────────────────────────────────────────

// ── Derived risk levels ────────────────────────────────────────────────────────

/**
 * Missing tank risk classification.
 *   normal   → missingTanks <= 50
 *   warning  → 51 – 100
 *   critical → > 100
 */
export type MissingStatus = "normal" | "warning" | "critical";

/**
 * Unpaid balance risk tier.
 *   paid → balance === 0
 *   low  → 0 < balance < 100,000
 *   high → balance >= 100,000
 */
export type BalanceStatus = "paid" | "low" | "high";

// ── RTO Agent (Salesman network member) ───────────────────────────────────────

/**
 * A salesman assigned to a dealer customer.
 * Sourced from the `salesman` collection via `customer_salesmen` junction.
 */
export interface RTOAgent {
  id: string;
  name: string;
  code: string | null;
  barangay: string | null;
}

// ── Core dealer record ─────────────────────────────────────────────────────────

/**
 * Aggregated dealer summary returned by the BFF route.
 * One record per dealer customer (store_type = "Dealer").
 */
export interface RTODealerRecord {
  // ── Identity ─────────────────────────────────────────────────────────────────
  customerCode: string;
  customerName: string | null;
  storeName: string | null;
  contactNumber: string | null;
  customerEmail: string | null;
  customerAddress: string | null;    // brgy + city + province concat

  // ── Branch ───────────────────────────────────────────────────────────────────
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;

  // ── Assigned network ─────────────────────────────────────────────────────────
  assignedAgents: RTOAgent[];

  // ── Cylinder accountability ───────────────────────────────────────────────────
  /** Total full tanks dispatched to this dealer (OUT movements) */
  fullsDelivered: number;
  /** Total empties returned from this dealer (IN movements from consolidator returns) */
  emptiesReturned: number;
  /** missingTanks = fullsDelivered - emptiesReturned */
  missingTanks: number;
  /** Risk classification based on missingTanks count */
  missingStatus: MissingStatus;
  /** true when missingTanks > 100 (critical alert threshold) */
  riskFlag: boolean;

  // ── Financial ────────────────────────────────────────────────────────────────
  /** Estimated financial exposure (missingTanks × avg unit price) */
  financialExposure: number | null;
  /** Total outstanding unpaid balance from sales ledger */
  unpaidBalance: number;
  /** Balance tier classification */
  balanceStatus: BalanceStatus;

  // ── Cylinder active deployment ────────────────────────────────────────────────
  /** Number of cylinders currently WITH_CUSTOMER status in cylinder_assets */
  activeCylindersWithDealer: number;
  /** Serial numbers of cylinders delivered (OUT movements) */
  outCylinderSerials: string[];
  /** Serial numbers of cylinders returned (IN movements) */
  inCylinderSerials: string[];

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  /** ISO date of most recent delivery to this dealer */
  lastDeliveryDate: string | null;
  /** Registered date of the customer */
  createdAt: string | null;
  /** Customer tier classification (Dealer, Sub-Dealer, RTO, etc.) */
  classification: string | null;
}

// ── Detail payload (for modal view) ───────────────────────────────────────────

/**
 * Full detail for one dealer — used when user clicks a row.
 * Contains the summary + transaction history breakdown.
 */
export interface RTODealerDetail {
  customerCode: string;
  customerName: string | null;
  storeName: string | null;
  contactNumber: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  branchName: string | null;
  branchCode: string | null;
  assignedAgents: RTOAgent[];
  missingTanks: number;
  missingStatus: MissingStatus;
  riskFlag: boolean;
  financialExposure: number | null;
  unpaidBalance: number;
  recentDeliveries: RTODeliveryRecord[];
}

/**
 * One delivery transaction line item in the detail view.
 */
export interface RTODeliveryRecord {
  id: string | number;
  transactionDate: string;
  referenceNo: string | null;
  productName: string | null;
  productCode: string | null;
  quantity: number;
  netAmount: number | null;
  movementType: "OUT" | "IN";
}

// ── Filters ───────────────────────────────────────────────────────────────────

/**
 * Filter params for the RTOOperationProvider and BFF route.
 * All optional — returns all dealers if none provided.
 */
export interface RTOFilters {
  branchId?: number | "";
  missingStatus?: MissingStatus | "all";
  balanceStatus?: BalanceStatus | "all";
}

// ── KPI summary ───────────────────────────────────────────────────────────────

/**
 * Computed KPI totals shown in the header cards.
 * Derived client-side from RTODealerRecord[].
 */
export interface RTOKPISummary {
  totalDealers: number;
  /** Dealers with missingTanks > 100 */
  criticalDealers: number;
  /** Dealers with missingTanks 51–100 */
  warningDealers: number;
  /** Grand total missing tanks across all dealers */
  totalMissingTanks: number;
  /** Sum of financialExposure across all dealers */
  totalFinancialExposure: number;
  /** Sum of unpaidBalance across all dealers */
  totalUnpaidBalance: number;
}
