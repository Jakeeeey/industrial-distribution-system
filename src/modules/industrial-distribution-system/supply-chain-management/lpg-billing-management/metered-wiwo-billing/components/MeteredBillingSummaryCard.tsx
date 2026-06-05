"use client";

import { Gauge, TrendingUp } from "lucide-react";
import type { BillableSource } from "../types";
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
}

export function MeteredBillingSummaryCard(props: Props) {
  const {
    meteredKg,
    wiwoKg,
    varianceKg,
    billableKg,
    billableSource,
    netAmount,
    pricePerKg,
    isMeteredOnly = false,
  } = props;
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
            <span className="font-mono font-bold">{Number(meteredKg).toFixed(3)} kg</span>
          </div>
          <div className="flex justify-between text-violet-100">
            <span>WIWO KG</span>
            <span className="font-mono font-bold">{Number(wiwoKg).toFixed(3)} kg</span>
          </div>
          <div className="flex justify-between text-violet-200 border-t border-white/10 pt-1.5">
            <span>Variance</span>
            <span className="font-mono">{Number(varianceKg).toFixed(3)} kg</span>
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
            className={`font-bold text-xs tracking-wider border-none ${
              billableSource === "METERED"
                ? "bg-blue-300/30 text-blue-100"
                : "bg-orange-300/30 text-orange-100"
            }`}
          >
            {billableSource}
          </Badge>
        </div>
      )}

      {/* Billing breakdown */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-violet-100">
          <span>{isMeteredOnly ? "Metered KG" : "Billable KG"}</span>
          <span className="font-bold font-mono">{Number(billableKg).toFixed(3)} kg</span>
        </div>
        <div className="flex justify-between text-violet-100">
          <span>Price / KG</span>
          <span className="font-bold font-mono">₱ {Number(pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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

