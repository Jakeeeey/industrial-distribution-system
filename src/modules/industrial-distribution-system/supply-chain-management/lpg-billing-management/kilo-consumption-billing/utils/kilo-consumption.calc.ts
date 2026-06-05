import type { WiwoDetail } from "../types";

// ─── Per-cylinder WIWO computation ───────────────────────────────────────────

/**
 * Remaining LPG KG = Gross Weight - Tare Weight
 */
export function calcRemainingLpg(grossWeight: number, tareWeight: number): number {
  return Math.max(0, grossWeight - tareWeight);
}

/**
 * Consumed LPG KG = Opening LPG KG - Remaining LPG KG
 */
export function calcConsumedLpg(openingLpgKg: number, remainingLpgKg: number): number {
  return Math.max(0, openingLpgKg - remainingLpgKg);
}

/**
 * Enriches WIWO detail lines with computed remaining and consumed KG.
 */
export function enrichWiwoDetails(details: WiwoDetail[]): WiwoDetail[] {
  return details.map((d) => {
    const remaining = calcRemainingLpg(d.gross_weight, d.tare_weight);
    const consumed = calcConsumedLpg(d.opening_lpg_kg, remaining);
    return {
      ...d,
      remaining_lpg_kg: parseFloat(remaining.toFixed(3)),
      consumed_lpg_kg: parseFloat(consumed.toFixed(3)),
    };
  });
}

// ─── Summary computation ──────────────────────────────────────────────────────

/**
 * Total Billable KG = sum of all consumed LPG from returned cylinders
 */
export function calcTotalBillableKg(details: WiwoDetail[]): number {
  return details.reduce((sum, d) => sum + (d.consumed_lpg_kg ?? 0), 0);
}

/**
 * Gross Amount = Billable KG × Price Per KG
 */
export function calcGrossAmount(billableKg: number, pricePerKg: number): number {
  return parseFloat((billableKg * pricePerKg).toFixed(2));
}

/**
 * VAT Amount = Gross Amount × VAT Rate (default 12%)
 */
export function calcVatAmount(grossAmount: number, vatRate = 0.12): number {
  return parseFloat((grossAmount * vatRate).toFixed(2));
}

/**
 * Net Amount = Gross Amount + VAT Amount
 */
export function calcNetAmount(grossAmount: number, vatAmount: number): number {
  return parseFloat((grossAmount + vatAmount).toFixed(2));
}

// ─── Full billing summary ─────────────────────────────────────────────────────

export interface KiloBillingSummary {
  billableKg: number;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
}

export function computeKiloBillingSummary(
  details: WiwoDetail[],
  pricePerKg: number,
  vatRate = 0.12
): KiloBillingSummary {
  const enriched = enrichWiwoDetails(details);
  const billableKg = calcTotalBillableKg(enriched);
  const grossAmount = calcGrossAmount(billableKg, pricePerKg);
  const vatAmount = calcVatAmount(grossAmount, vatRate);
  const netAmount = calcNetAmount(grossAmount, vatAmount);
  return { billableKg, grossAmount, vatAmount, netAmount };
}
