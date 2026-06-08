import type { TransactionType, WiwoDetailRef, BillableSource } from "../types";

// ─── Transaction Number Generation ───────────────────────────────────────────

/**
 * Generates a transaction number based on type.
 *
 * Format:
 *   ONBOARDING_BASELINE → TXORB-{YYYYMMDD}-{siteId}-{seq3}
 *   REGULAR_BILLING     → TXREG-{YYYYMMDD}-{siteId}-{seq3}
 *
 * Sequence restarts per site per day.
 */
export function generateTxNo(
  type: TransactionType,
  siteId: number | null,
  date: string,
  seq: number
): string {
  const prefix = type === "ONBOARDING_BASELINE" ? "TXORB" : "TXREG";
  const dateStr = date.replace(/-/g, "").slice(0, 8);
  const sId = siteId ?? 0;
  const seqStr = String(seq).padStart(3, "0");
  return `${prefix}-${dateStr}-${sId}-${seqStr}`;
}

/**
 * Generates a placeholder tx number (for display before seq is fetched).
 */
export function generateTxNoPlaceholder(
  type: TransactionType,
  siteId: number | null,
  date: string
): string {
  return generateTxNo(type, siteId, date, 0).replace("-000", "-...");
}

// ─── WIWO computation ─────────────────────────────────────────────────────────

export function calcWiwoDetail(d: WiwoDetailRef): WiwoDetailRef {
  const remaining = Math.max(0, d.gross_weight - d.tare_weight);
  const consumed = Math.max(0, d.opening_lpg_kg - remaining);
  return {
    ...d,
    remaining_lpg_kg: parseFloat(remaining.toFixed(4)),
    consumed_lpg_kg: parseFloat(consumed.toFixed(4)),
  };
}

export function calcTotalWiwoKg(details: WiwoDetailRef[]): number {
  return parseFloat(
    details.reduce((sum, d) => sum + (d.consumed_lpg_kg ?? 0), 0).toFixed(4)
  );
}

// ─── Meter reading computation ────────────────────────────────────────────────

/**
 * Metered KG = Current Reading - Previous Reading
 */
export function calcMeteredKg(
  currentReading: number,
  previousReading: number
): number {
  return Math.max(0, parseFloat((currentReading - previousReading).toFixed(4)));
}

// ─── Variance ─────────────────────────────────────────────────────────────────

/**
 * Variance KG = |Metered KG - WIWO KG|
 */
export function calcVarianceKg(meteredKg: number, wiwoKg: number): number {
  return parseFloat(Math.abs(meteredKg - wiwoKg).toFixed(4));
}

// ─── Arbitration ──────────────────────────────────────────────────────────────

export interface ArbitrationResult {
  metered_kg: number;
  wiwo_kg: number;
  variance_kg: number;
  billable_kg: number;
  billable_source: BillableSource;
}

/**
 * Billable KG = MAX(Metered KG, WIWO KG)
 * Billable Source = the one that is higher (METERED wins on tie)
 * If WIWO is 0 (not linked), defaults to Metered only.
 */
export function computeArbitration(
  meteredKg: number,
  wiwoKg: number
): ArbitrationResult {
  const varianceKg = calcVarianceKg(meteredKg, wiwoKg);
  const billableKg = Math.max(meteredKg, wiwoKg);
  const billableSource = meteredKg >= wiwoKg ? "METERED" : "WIWO";
  return {
    metered_kg: parseFloat(meteredKg.toFixed(4)),
    wiwo_kg: parseFloat(wiwoKg.toFixed(4)),
    variance_kg: varianceKg,
    billable_kg: parseFloat(billableKg.toFixed(4)),
    billable_source: billableSource,
  };
}

// ─── Billing computation ──────────────────────────────────────────────────────

export function calcGrossAmount(billableKg: number, pricePerKg: number): number {
  return parseFloat((billableKg * pricePerKg).toFixed(2));
}

export function calcVatAmount(grossAmount: number, vatRate = 0.12): number {
  return parseFloat((grossAmount * vatRate).toFixed(2));
}

export function calcNetAmount(grossAmount: number, vatAmount: number): number {
  return parseFloat((grossAmount + vatAmount).toFixed(2));
}
