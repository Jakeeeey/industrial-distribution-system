// services/customer-cylinder-turnaround.aggregation.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure business logic & calculation algorithms for Customer Cylinder Turnaround Ratio (CTR)
// Computes Annual Turns, Months Per Turn, Progressive CTR Grading, and Incentive Payouts.
// Handles active cylinder base with zero circulating transactions as UNMONITORED.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CTRGrade,
  CustomerCylinderTurnaroundItem,
  CustomerCylinderTurnaroundKPIs,
  CustomerTurnaroundTransactionDoc,
  CustomerCylinderTurnaroundReportResponse,
  CustomerCylinderTurnaroundAuditLog,
} from "../types/customer-cylinder-turnaround.types";
import type { CustomerCylinderTurnaroundFilterInput } from "../types/customer-cylinder-turnaround.schema";

export interface RawCustomerInput {
  id: number | string;
  customerCode: string;
  customerName: string;
  storeName?: string;
  contactNumber?: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  cylinderBase: number;
  repeatOrderQty: number;
  depositCylinderQty: number;
  eligibleRefill11kgQty: number;
  transactions?: CustomerTurnaroundTransactionDoc[];
}

/**
 * Evaluates CTR Grade and Incentive Rates according to verified Progressive Brackets:
 * - Months per Turn <= 4.0 (Annual Turns >= 3.0)  -> CTR 4 (₱2/kg, ₱22/11kg refill)
 * - Months per Turn 4.01 to 6.0 (2.0 <= Turns < 3.0) -> CTR 6 (₱4/kg, ₱44/11kg refill)
 * - Months per Turn 6.01 to 8.0 (1.5 <= Turns < 2.0) -> CTR 8 (₱6/kg, ₱66/11kg refill)
 * - Months per Turn > 8.0 (Turns < 1.5, with circulation) -> SUB_STANDARD (₱0/kg, ₱0/refill)
 * - Base Zero                                     -> BASE_ZERO (Unrated, ₱0)
 * - Base > 0 but Zero Circulation                 -> UNMONITORED (No transactions, ₱0)
 */
export function evaluateCTRGrade(
  annualTurns: number,
  monthsPerTurn: number,
  isBaseZero: boolean,
  hasCirculation: boolean = true
): {
  grade: CTRGrade;
  incentiveRatePerKg: number;
  incentivePerRefill: number;
} {
  if (isBaseZero) {
    return {
      grade: "BASE_ZERO",
      incentiveRatePerKg: 0,
      incentivePerRefill: 0,
    };
  }

  // Active base > 0, but no repeat orders or deposits in period
  if (!hasCirculation || annualTurns <= 0) {
    return {
      grade: "UNMONITORED",
      incentiveRatePerKg: 0,
      incentivePerRefill: 0,
    };
  }

  // Progressive Brackets based on Months per Turn / Annual Turns
  if (monthsPerTurn <= 4.0 || annualTurns >= 3.0) {
    return {
      grade: "CTR_4",
      incentiveRatePerKg: 2,
      incentivePerRefill: 22, // 11 kg * ₱2
    };
  } else if (monthsPerTurn <= 6.0 || annualTurns >= 2.0) {
    return {
      grade: "CTR_6",
      incentiveRatePerKg: 4,
      incentivePerRefill: 44, // 11 kg * ₱4
    };
  } else if (monthsPerTurn <= 8.0 || annualTurns >= 1.5) {
    return {
      grade: "CTR_8",
      incentiveRatePerKg: 6,
      incentivePerRefill: 66, // 11 kg * ₱6
    };
  } else {
    return {
      grade: "SUB_STANDARD",
      incentiveRatePerKg: 0,
      incentivePerRefill: 0,
    };
  }
}

/**
 * Calculates turnaround metrics for a customer over the specified month span.
 * Avoids assigning 99.9 months to dormant accounts with 0 circulation.
 */
export function calculateCustomerTurnaroundItem(
  raw: RawCustomerInput,
  monthsCovered: number,
  periodLabel: string
): CustomerCylinderTurnaroundItem {
  const isBaseZero = raw.cylinderBase <= 0;
  const totalCirculating = Math.max(0, raw.repeatOrderQty + raw.depositCylinderQty);
  const hasCirculation = totalCirculating > 0;
  
  let annualTurns = 0;
  let monthsPerTurn = 0;

  if (!isBaseZero && hasCirculation) {
    // Formula: ((RO + Deposit) / Base) * (12 / Months Covered)
    const annualizingFactor = 12 / Math.max(1, monthsCovered);
    annualTurns = Number(((totalCirculating / raw.cylinderBase) * annualizingFactor).toFixed(2));
    
    // Formula: 12 / Annual Turns
    if (annualTurns > 0) {
      monthsPerTurn = Number((12 / annualTurns).toFixed(2));
    }
  }

  const { grade, incentiveRatePerKg, incentivePerRefill } = evaluateCTRGrade(
    annualTurns,
    monthsPerTurn,
    isBaseZero,
    hasCirculation
  );

  const eligibleRefills = Math.max(0, raw.eligibleRefill11kgQty);
  const eligibleKilograms = eligibleRefills * 11;
  const totalIncentiveAmount = eligibleKilograms * incentiveRatePerKg;

  return {
    id: `CTR-${raw.customerCode}`,
    customerCode: raw.customerCode,
    customerName: raw.customerName,
    storeName: raw.storeName,
    contactNumber: raw.contactNumber,
    branchId: raw.branchId,
    branchCode: raw.branchCode,
    branchName: raw.branchName,
    periodLabel,
    monthsCovered,
    cylinderBase: raw.cylinderBase,
    repeatOrderQty: raw.repeatOrderQty,
    depositCylinderQty: raw.depositCylinderQty,
    totalCirculatingQty: totalCirculating,
    annualTurns,
    monthsPerTurn,
    grade,
    eligibleRefill11kgQty: eligibleRefills,
    eligibleKilograms,
    incentiveRatePerKg,
    incentivePerRefill,
    totalIncentiveAmount,
    isBaseZero,
    status: "APPROVED",
    lastUpdated: new Date().toISOString(),
    transactions: raw.transactions || [],
  };
}

/**
 * Computes KPIs from aggregated customer items.
 * Accounts without circulation do not distort active turnaround averages.
 */
export function computeTurnaroundKPIs(
  items: CustomerCylinderTurnaroundItem[]
): CustomerCylinderTurnaroundKPIs {
  const totalCustomers = items.length;
  // Valid active turnaround items must have base > 0 and recorded annual turns > 0
  const validItems = items.filter((i) => !i.isBaseZero && i.annualTurns > 0 && i.grade !== "UNMONITORED");
  const activeTurnaroundCustomers = validItems.length;

  const sumTurns = validItems.reduce((acc, curr) => acc + curr.annualTurns, 0);
  const sumMonths = validItems.reduce((acc, curr) => acc + curr.monthsPerTurn, 0);

  const averageAnnualTurns =
    activeTurnaroundCustomers > 0 ? Number((sumTurns / activeTurnaroundCustomers).toFixed(2)) : 0;
  const averageMonthsPerTurn =
    activeTurnaroundCustomers > 0 ? Number((sumMonths / activeTurnaroundCustomers).toFixed(2)) : 0;

  const gradeDistribution = {
    ctr4Count: 0,
    ctr6Count: 0,
    ctr8Count: 0,
    subStandardCount: 0,
    baseZeroCount: 0,
    unmonitoredCount: 0,
  };

  let totalEligibleRefills11kg = 0;
  let totalEligibleKilograms = 0;
  let totalEstimatedIncentive = 0;

  for (const item of items) {
    if (item.grade === "CTR_4") gradeDistribution.ctr4Count++;
    else if (item.grade === "CTR_6") gradeDistribution.ctr6Count++;
    else if (item.grade === "CTR_8") gradeDistribution.ctr8Count++;
    else if (item.grade === "BASE_ZERO") gradeDistribution.baseZeroCount++;
    else if (item.grade === "UNMONITORED") gradeDistribution.unmonitoredCount++;
    else gradeDistribution.subStandardCount++;

    totalEligibleRefills11kg += item.eligibleRefill11kgQty;
    totalEligibleKilograms += item.eligibleKilograms;
    totalEstimatedIncentive += item.totalIncentiveAmount;
  }

  return {
    totalCustomers,
    activeTurnaroundCustomers,
    averageAnnualTurns,
    averageMonthsPerTurn,
    gradeDistribution,
    totalEligibleRefills11kg,
    totalEligibleKilograms,
    totalEstimatedIncentive,
    totalApprovedIncentive: totalEstimatedIncentive,
  };
}

/**
 * Main engine processing raw dataset against filter criteria.
 */
export function aggregateCustomerTurnaroundReport(
  rawList: RawCustomerInput[],
  filters: CustomerCylinderTurnaroundFilterInput,
  existingAuditLogs: CustomerCylinderTurnaroundAuditLog[] = []
): CustomerCylinderTurnaroundReportResponse {
  const startM = Math.min(filters.periodStartMonth, filters.periodEndMonth);
  const endM = Math.max(filters.periodStartMonth, filters.periodEndMonth);
  const monthsCovered = endM - startM + 1;

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const periodLabel =
    monthsCovered === 1
      ? `${monthNames[startM - 1]} ${filters.periodYear}`
      : `${monthNames[startM - 1]} - ${monthNames[endM - 1]} ${filters.periodYear}`;

  let items = rawList.map((raw) =>
    calculateCustomerTurnaroundItem(raw, monthsCovered, periodLabel)
  );

  // Apply filters
  if (filters.branchId && typeof filters.branchId === "number") {
    items = items.filter((i) => i.branchId === filters.branchId);
  }

  if (filters.customerCode && filters.customerCode.trim()) {
    items = items.filter(
      (i) => i.customerCode.toLowerCase() === filters.customerCode?.toLowerCase()
    );
  }

  if (filters.grade && filters.grade !== "ALL") {
    items = items.filter((i) => i.grade === filters.grade);
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase();
    items = items.filter(
      (i) =>
        i.customerCode.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        (i.storeName && i.storeName.toLowerCase().includes(q)) ||
        i.branchName.toLowerCase().includes(q)
    );
  }

  const kpis = computeTurnaroundKPIs(items);
  const assessmentNo = `CTR-${filters.periodYear}-${String(startM).padStart(2, "0")}${
    monthsCovered > 1 ? `-${String(endM).padStart(2, "0")}` : ""
  }`;

  return {
    periodYear: filters.periodYear,
    periodStartMonth: startM,
    periodEndMonth: endM,
    monthsCovered,
    assessmentNo,
    status: "APPROVED",
    items,
    kpis,
    auditLogs: existingAuditLogs,
  };
}
