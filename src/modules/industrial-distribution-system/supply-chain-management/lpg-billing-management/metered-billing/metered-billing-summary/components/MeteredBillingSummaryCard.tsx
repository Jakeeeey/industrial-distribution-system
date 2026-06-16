"use client";

import { Gauge, TrendingUp } from "lucide-react";
import type { BillableSource } from "../../metered-billing-common/types";
import { Badge } from "@/components/ui/badge";

interface Props {
  meteredKg: number;
  wiwoKg: number;
  varianceKg: number;
  billableKg: number;
  billableSource: BillableSource;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  pricePerKg: number;
  isMeteredOnly?: boolean;
  /** LPG VAPOR constant (e.g. 2.0183) */
  lpgVapor?: number;
  /** PSI gauge pressure (e.g. 10.0000) */
  psi?: number;
  /** Computed Pressure Line = (PSI + CF) / CF (e.g. 1.6803) */
  pressureLine?: number;
  previousReading?: number;
  currentReading?: number;
}

export function MeteredBillingSummaryCard(props: Props) {
  // IDS-CHANGE: Destructure grossAmount and vatAmount to show VAT breakdown only for display purposes
  const {
    meteredKg,
    // wiwoKg,
    varianceKg,
    billableKg,
    billableSource,
    grossAmount,
    vatAmount,
    netAmount,
    pricePerKg,
    isMeteredOnly = false,
    lpgVapor,
    psi = 0,
    pressureLine,
    previousReading,
    currentReading,
  } = props;

  const activeLpgVapor = lpgVapor ?? 2.0183;
  const activePressureLine = pressureLine ?? 1.0000;
  const activePsi = psi ?? 0;
  const activePrevReading = previousReading ?? 0;
  const activeCurrReading = currentReading ?? 0;

  // Fallback to 12% output VAT calculation if stored vatAmount is 0 but grossAmount exists
  const computedVatAmount = vatAmount > 0 ? vatAmount : parseFloat((grossAmount * 0.12).toFixed(2));

  return (
    <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-6 text-white shadow-2xl shadow-violet-500/30 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
          <Gauge className="h-5 w-5" />
        </div>
        <h3 className="font-bold text-lg">{isMeteredOnly ? "Metered Summary" : "Metered+WIWO Summary"}</h3>
      </div>

      {/* KG Comparison */}
      {!isMeteredOnly && (
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-violet-100">
            <span>Metered KG</span>
            <span className="font-mono font-bold">{Number(meteredKg).toFixed(4)} kg</span>
          </div>
          {/* <div className="flex justify-between text-violet-100">
            <span>WIWO KG</span>
            <span className="font-mono font-bold">{Number(wiwoKg).toFixed(4)} kg</span>
          </div> */}
          <div className="flex justify-between text-violet-200 border-t border-white/10 pt-1.5">
            <span>Variance</span>
            <span className="font-mono">{Number(varianceKg).toFixed(4)} kg</span>
          </div>
        </div>
      )}

      {/* Arbitration Result */}
      {!isMeteredOnly && (
        <div className="flex items-center justify-between bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-white/80" />
            <span className="text-sm font-semibold">Billable Source</span>
          </div>
          <Badge
            className={`font-bold text-xs tracking-wider border-none ${billableSource === "METERED"
                ? "bg-blue-300/30 text-blue-100"
                : "bg-orange-300/30 text-orange-100"
              }`}
          >
            {billableSource}
          </Badge>
        </div>
      )}

      {/* Comprehensive Calculation Details */}
      <div className="bg-white/10 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="border-b border-white/10 pb-1.5 flex justify-between items-center">
          <span className="font-bold text-[10px] uppercase tracking-widest text-violet-200">Calculation Details</span>
          <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">
            {activePsi > 0 ? "Usage × Vapor × Factor" : "Usage × Vapor"}
          </span>
        </div>
        <div className="space-y-1 text-violet-100 font-mono">
          <div className="flex justify-between">
            <span>Present Reading</span>
            <span>{activeCurrReading.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span>Previous Reading</span>
            <span>{activePrevReading.toFixed(3)}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1 text-white font-bold">
            <span>Consumption (Usage)</span>
            <span>{Math.abs(activeCurrReading - activePrevReading).toFixed(3)}</span>
          </div>
        </div>
        <div className="space-y-1 text-violet-100 font-mono border-t border-white/10 pt-1.5">
          <div className="flex justify-between">
            <span>LPG Vapor Constant</span>
            <span>{activeLpgVapor.toFixed(4)}</span>
          </div>
          {activePsi > 0 && (
            <div className="flex justify-between">
              <span>Vapor Factor (PSI: {activePsi.toFixed(1)})</span>
              <span>{activePressureLine.toFixed(4)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between text-white font-bold border-t border-dashed border-white/20 pt-1.5">
          <span className="text-violet-200">Computed Metered KG</span>
          <span className="font-mono">{Number(meteredKg).toFixed(4)} kg</span>
        </div>
      </div>

      {/* Billing breakdown */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-violet-100">
          <span>{isMeteredOnly ? "Metered KG" : "Billable KG"}</span>
          <span className="font-bold font-mono">{Number(billableKg).toFixed(4)} kg</span>
        </div>
        <div className="flex justify-between text-violet-100">
          <span>Price / KG</span>
          <span className="font-bold font-mono">₱ {Number(pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        {/* IDS-CHANGE: Display VAT breakdown for user review */}
        <div className="border-t border-white/10 pt-2 space-y-1 text-xs text-violet-200 font-mono">
          <div className="flex justify-between">
            <span>VAT (12%)</span>
            <span>₱ {Number(computedVatAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="border-t border-white/20 pt-3 flex justify-between items-end">
          <span className="font-bold text-base">Total Amount</span>
          <span className="text-2xl font-black font-mono">
            ₱ {Number(netAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
