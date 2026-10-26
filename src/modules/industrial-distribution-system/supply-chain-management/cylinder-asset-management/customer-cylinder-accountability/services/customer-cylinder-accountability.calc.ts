// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/services/customer-cylinder-accountability.calc.ts
// ==============================================================================
// Pure Mathematical & Reconciliation Ledger Engine for Customer Cylinder Accountability
// Conforms to VoSync Standards:
// - Physical quantity segregation from cash values
// - Deterministic running base ledger computation
// - Exception & variance detection (negative balances, unverified documents)
// - 100% pure functions suitable for unit testing
// - Full comments left behind for long-term maintainability
// ==============================================================================

import type {
  AccountabilityTransactionRecord,
  CustomerAccountabilityRow,
  AccountabilityKPISummary,
  CylinderOwnership,
} from "../types/customer-cylinder-accountability.types";

/**
 * Calculates the running base step-by-step across an array of chronological transactions.
 * Starts from the customer's opening base and applies each verified document movement.
 *
 * @param openingBase Starting cylinder count at period cutoff
 * @param rawTransactions Chronologically ordered transaction records
 * @returns Reconciled transactions with computed running balances and anomaly flags
 */
export function reconcileCustomerTransactionLedger(
  openingBase: number,
  rawTransactions: AccountabilityTransactionRecord[]
): {
  reconciledTransactions: AccountabilityTransactionRecord[];
  closingBase: number;
  totalDeposits: number;
  totalSwaps: number;
  totalNetSwapChange: number;
  totalPullOuts: number;
  exceptionCount: number;
} {
  let currentBalance = Math.max(0, Math.floor(openingBase || 0));
  let totalDeposits = 0;
  let totalSwaps = 0;
  let totalNetSwapChange = 0;
  let totalPullOuts = 0;
  let exceptionCount = 0;

  // Sort ascending by transaction date and ID to guarantee sequence integrity
  const sorted = [...rawTransactions].sort((a, b) => {
    const timeDiff = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  const reconciledTransactions: AccountabilityTransactionRecord[] = [];

  for (const tx of sorted) {
    let baseImpact = 0;
    let isAnomaly = false;
    let anomalyNote: string | null = null;

    const depQty = Math.max(0, Math.floor(tx.depositQty || 0));
    const swapQty = Math.max(0, Math.floor(tx.swapQty || 0));
    const pullOutQty = Math.max(0, Math.floor(tx.pullOutQty || 0));

    // Determine Base Impact according to activity classification
    switch (tx.activityType) {
      case "DEPOSIT":
        // Customer takes additional cylinder without returning one (+Base)
        baseImpact = depQty;
        totalDeposits += depQty;
        break;

      case "SWAP":
        // 1-to-1 Refill: customer exchanges empty for full (+0 Net Base Change)
        baseImpact = 0;
        totalSwaps += swapQty;
        break;

      case "NET_SWAP_ADD":
        // Customer took more full cylinders than empties returned (+Delta)
        baseImpact = depQty;
        totalSwaps += swapQty;
        totalNetSwapChange += depQty;
        break;

      case "NET_SWAP_SUB":
        // Customer returned more empties than full cylinders received (-Delta)
        baseImpact = -pullOutQty;
        totalSwaps += swapQty;
        totalNetSwapChange -= pullOutQty;
        break;

      case "PULL_OUT":
        // Cylinder returned to warehouse / plant (-Base)
        baseImpact = -pullOutQty;
        totalPullOuts += pullOutQty;
        break;

      case "REVERSAL":
        // Reversal of an earlier erroneous transaction
        baseImpact = -depQty;
        break;

      default:
        baseImpact = 0;
        break;
    }

    // Only apply base impact if record is verified under its posting workflow
    if (tx.isVerified) {
      currentBalance += baseImpact;
    } else {
      isAnomaly = true;
      anomalyNote = `Unverified source status (${tx.sourceStatus}). Not posted to running base.`;
    }

    // Check for Negative Custody Exception (physically impossible state)
    if (currentBalance < 0) {
      isAnomaly = true;
      anomalyNote = anomalyNote
        ? `${anomalyNote} Negative custody balance (${currentBalance}).`
        : `Negative custody balance (${currentBalance}) detected after transaction.`;
    }

    if (isAnomaly) {
      exceptionCount += 1;
    }

    reconciledTransactions.push({
      ...tx,
      netBaseImpact: baseImpact,
      runningBase: currentBalance,
      hasException: isAnomaly,
      exceptionReason: anomalyNote || tx.exceptionReason,
    });
  }

  return {
    reconciledTransactions,
    closingBase: currentBalance,
    totalDeposits,
    totalSwaps,
    totalNetSwapChange,
    totalPullOuts,
    exceptionCount,
  };
}

/**
 * Aggregates high-level KPI summary cards from all customer accountability rows.
 */
export function calculateAccountabilityKPIs(
  rows: CustomerAccountabilityRow[]
): AccountabilityKPISummary {
  let totalOpeningBase = 0;
  let totalPeriodDeposits = 0;
  let totalPeriodSwaps = 0;
  let totalPeriodPullOuts = 0;
  let totalClosingBase = 0;
  let totalVerifiedRecords = 0;
  let totalExceptions = 0;

  for (const row of rows) {
    totalOpeningBase += Number(row.openingBase || 0);
    totalPeriodDeposits += Number(row.periodDeposits || 0);
    totalPeriodSwaps += Number(row.periodSwaps || 0);
    totalPeriodPullOuts += Number(row.periodPullOuts || 0);
    totalClosingBase += Number(row.closingBase || 0);
    totalVerifiedRecords += Number(row.verifiedTransactionsCount || 0);
    totalExceptions += Number(row.exceptionCount || 0);
  }

  return {
    totalOpeningBase,
    totalPeriodDeposits,
    totalPeriodSwaps,
    totalPeriodPullOuts,
    totalClosingBase,
    activeCustomerAccounts: rows.length,
    totalVerifiedRecords,
    totalExceptions,
  };
}

/**
 * Filter customer rows based on search text, branch, and ownership criteria.
 */
export function filterAccountabilityRows(
  rows: CustomerAccountabilityRow[],
  searchQuery?: string,
  branchId?: number | string,
  ownership?: CylinderOwnership | "ALL"
): CustomerAccountabilityRow[] {
  const query = (searchQuery || "").trim().toLowerCase();

  return rows.filter((r) => {
    // 1. Branch match
    if (branchId !== undefined && branchId !== "" && branchId !== "ALL") {
      if (Number(r.branchId) !== Number(branchId)) return false;
    }

    // 2. Ownership match
    if (ownership && ownership !== "ALL") {
      if (r.ownership !== ownership) return false;
    }

    // 3. Search query match
    if (query) {
      const matchCode = r.customerCode.toLowerCase().includes(query);
      const matchName = r.customerName.toLowerCase().includes(query);
      const matchStore = (r.storeName || "").toLowerCase().includes(query);
      const matchBranch = (r.branchName || "").toLowerCase().includes(query);
      if (!matchCode && !matchName && !matchStore && !matchBranch) {
        return false;
      }
    }

    return true;
  });
}
