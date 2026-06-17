// RULE DEV: WiWO Billing Summary Card
// Shows computed billing totals for a WiWO transaction in the detail panel.
// VAT is displayed as informational-only (absorbed / VAT-inclusive model).
// Does NOT add VAT on top — gross_amount = total customer price.

"use client";

import { Scale, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BillingSource } from "../types";

interface Props {
  meteredKg: number;
  wiwoKg: number;
  varianceKg: number;
  billableKg: number;
  billableSource: BillingSource;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  pricePerKg: number;
  isOnboarding?: boolean;
}

export function WiwoBillingSummaryCard({
  meteredKg,
  wiwoKg,
  varianceKg,
  billableKg,
  billableSource,
  grossAmount,
  vatAmount,
  pricePerKg,
  isOnboarding = false,
}: Props) {
  // IDS-CHANGE: VAT is informational only — not added on top.
  // Fallback: compute 12% VAT from grossAmount if stored vatAmount is 0
  const computedVatAmount =
    vatAmount > 0 ? vatAmount : parseFloat((grossAmount * (12 / 112)).toFixed(2));

  return (
    <div className="bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-700 rounded-2xl p-6 text-white shadow-2xl shadow-orange-500/30 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
          <Scale className="h-5 w-5" />
        </div>
        <h3 className="font-bold text-lg">
          {isOnboarding ? "Onboarding Baseline" : "WiWO Billing Summary"}
        </h3>
      </div>

      {/* KG Comparison — only for regular billing */}
      {!isOnboarding && (
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-orange-100">
            <span>Metered KG</span>
            <span className="font-mono font-bold">{Number(meteredKg).toFixed(4)} kg</span>
          </div>
          <div className="flex justify-between text-orange-100">
            <span>WiWO KG</span>
            <span className="font-mono font-bold">{Number(wiwoKg).toFixed(4)} kg</span>
          </div>
          <div className="flex justify-between text-orange-200 border-t border-white/10 pt-1.5">
            <span>Variance</span>
            <span className="font-mono">{Number(varianceKg).toFixed(4)} kg</span>
          </div>
        </div>
      )}

      {/* Billable Source arbitration — only for regular billing */}
      {!isOnboarding && (
        <div className="flex items-center justify-between bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-white/80" />
            <span className="text-sm font-semibold">Billable Source</span>
          </div>
          <Badge
            className={`font-bold text-xs tracking-wider border-none ${
              billableSource === "METERED"
                ? "bg-blue-300/30 text-blue-100"
                : billableSource === "WIWO"
                  ? "bg-orange-300/30 text-orange-100"
                  : "bg-zinc-300/20 text-zinc-100"
            }`}
          >
            {billableSource || "N/A"}
          </Badge>
        </div>
      )}

      {/* Billing Breakdown */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-orange-100">
          <span>{isOnboarding ? "Baseline KG" : "Billable KG"}</span>
          <span className="font-bold font-mono">{Number(billableKg).toFixed(4)} kg</span>
        </div>

        {!isOnboarding && (
          <div className="flex justify-between text-orange-100">
            <span>Price / KG</span>
            <span className="font-bold font-mono">
              ₱ {Number(pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* IDS-CHANGE: VAT shown for reporting only — NOT added on top */}
        {!isOnboarding && (
          <div className="border-t border-white/10 pt-2 space-y-1 text-xs text-orange-200 font-mono">
            <div className="flex justify-between">
              <span>VAT (12%)</span>
              <span>
                ₱{" "}
                {Number(computedVatAmount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        )}

        {/* Total Amount */}
        <div className="border-t border-white/20 pt-3 flex justify-between items-end">
          <span className="font-bold text-base">
            {isOnboarding ? "Baseline Value" : "Total Amount"}
          </span>
          <span className="text-2xl font-black font-mono">
            ₱{" "}
            {Number(grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
