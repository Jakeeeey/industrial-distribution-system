import type { TransactionType, WiwoDetailRef, BillableSource } from "../types";

// ─── Transaction Number Generation ───────────────────────────────────────────

/**
 * Generates a transaction number based on type.
 *
 * Format:
 *   ONBOARDING_BASELINE → TXO-RB-{6-digit random number}
 *   REGULAR_BILLING     → TX-REG-{6-digit random number}
 * 
 * Developer Comment: Changed from sequential/date/site components to a random 6-digit identifier.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function generateTxNo(
  type: TransactionType,
  siteId?: number | null,
  date?: string,
  seq?: number
): string {
  const prefix = type === "ONBOARDING_BASELINE" ? "TXO-RB" : "TX-REG";
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}`;
}
 
/**
 * Generates a placeholder tx number.
 */
export function generateTxNoPlaceholder(
  type: TransactionType,
  siteId?: number | null,
  date?: string
): string {
  return generateTxNo(type);
}
/* eslint-enable @typescript-eslint/no-unused-vars */


/**
 * Generates a reading number with prefix MTR-REG- or MTR-ONB-.
 * 
 * Format:
 *   ONBOARDING_BASELINE → MTR-ONB-{6-digit random number}
 *   REGULAR_BILLING     → MTR-REG-{6-digit random number}
 * 
 * Developer Comment: Modified to distinguish onboarding reading numbers from regular ones.
 */
// DEV-CHANGE: Changed random reading number identifier from 6 digits to 6 digits.
export function generateReadingNo(type?: TransactionType): string {
  const prefix = type === "ONBOARDING_BASELINE" ? "MTR-ONB" : "MTR-REG";
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}`;
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
 
/**
 * Computes Gross Amount (Vatable Sales).
 * 
 * Under the VAT-inclusive model (default):
 *   Vatable Sales = (Billable KG * Price / KG) / (1 + VAT Rate)
 * Under the VAT-exclusive model:
 *   Vatable Sales = Billable KG * Price / KG
 * 
 * Developer Comment: Modified to support both VAT-inclusive and VAT-exclusive models.
 */
export function calcGrossAmount(
  billableKg: number,
  pricePerKg: number,
  inclusive = true,
  vatRate = 0.12
): number {
  const totalOrBase = billableKg * pricePerKg;
  if (inclusive) {
    return parseFloat((totalOrBase / (1 + vatRate)).toFixed(2));
  } else {
    return parseFloat(totalOrBase.toFixed(2));
  }
}
 
/**
 * Computes VAT Amount.
 * 
 * Under the VAT-inclusive model (default):
 *   VAT = Total - Vatable Sales
 * Under the VAT-exclusive model:
 *   VAT = Vatable Sales * VAT Rate
 * 
 * Developer Comment: Modified to support both VAT-inclusive and VAT-exclusive models.
 */
export function calcVatAmount(
  grossAmount: number,
  vatRate = 0.12,
  inclusive = true,
  totalAmount?: number
): number {
  if (inclusive && totalAmount !== undefined) {
    return parseFloat((totalAmount - grossAmount).toFixed(2));
  }
  return parseFloat((grossAmount * vatRate).toFixed(2));
}
 
/**
 * Computes Net Amount (Total Amount).
 * 
 * Under the VAT-inclusive model (default):
 *   Net Amount = Total Amount
 * Under the VAT-exclusive model:
 *   Net Amount = Vatable Sales + VAT
 * 
 * Developer Comment: Modified to support both VAT-inclusive and VAT-exclusive models.
 */
export function calcNetAmount(
  grossAmount: number,
  vatAmount: number,
  inclusive = true,
  totalAmount?: number
): number {
  if (inclusive && totalAmount !== undefined) {
    return parseFloat(totalAmount.toFixed(2));
  }
  return parseFloat((grossAmount + vatAmount).toFixed(2));
}

