"use client";

import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BillableSource } from "../../metered-billing-common/types";
import type { ArbitrationResult } from "../../metered-billing-common/utils/calc";

interface Props {
  result: ArbitrationResult;
}

export function VariancePanel({ result }: Props) {
  const { metered_kg, wiwo_kg, variance_kg, billable_kg, billable_source } = result;
  const variancePct =
    Number(metered_kg) > 0 ? ((Number(variance_kg) / Number(metered_kg)) * 100).toFixed(1) : "0.0";
  const isHighVariance = Number(variance_kg) > 10;

  return (
    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
          <Scale className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold">Variance & Arbitration</h2>
          <p className="text-[10px] text-muted-foreground">MAX(Metered KG)</p>
        </div>
      </div>

      {/* Comparison table */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className={`rounded-xl p-4 border ${billable_source === "METERED"
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40"
              : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40"
            }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Metered KG</p>
          <p className={`text-xl font-black font-mono ${billable_source === "METERED" ? "text-blue-700 dark:text-blue-400" : ""}`}>
            {Number(metered_kg).toFixed(4)}
          </p>
          {billable_source === "METERED" && (
            <Badge className="mt-1.5 bg-blue-600 text-white border-none text-[10px]">SELECTED</Badge>
          )}
        </div>
        <div
          className={`rounded-xl p-4 border ${billable_source === "WIWO"
              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40"
              : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40"
            }`}
        >
          {/* <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">WIWO KG</p> */}
          <p className={`text-xl font-black font-mono ${billable_source === "WIWO" ? "text-orange-700 dark:text-orange-400" : ""}`}>
            {Number(wiwo_kg).toFixed(4)}
          </p>
          {billable_source === "WIWO" && (
            <Badge className="mt-1.5 bg-orange-600 text-white border-none text-[10px]">SELECTED</Badge>
          )}
        </div>
      </div>

      {/* Variance row */}
      <div
        className={`rounded-xl p-3 flex items-center justify-between ${isHighVariance
            ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30"
            : "bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/30"
          }`}
      >
        <div className="flex items-center gap-2">
          {isHighVariance ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <div>
            <p className="text-xs font-bold">Variance</p>
            <p className="text-[10px] text-muted-foreground">|Metered − WIWO|</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono font-bold ${isHighVariance ? "text-red-600" : "text-zinc-700 dark:text-zinc-300"}`}>
            {Number(variance_kg).toFixed(4)} kg
          </p>
          {/* <p className="text-[10px] text-muted-foreground">{variancePct}%</p> */}
        </div>
      </div>

      {/* Billable KG result */}
      <div className="mt-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider">
            Billable KG
          </p>
          <p className="text-xs text-violet-500 mt-0.5">
            MAX(Metered, WIWO) → {billable_source as BillableSource}
          </p>
        </div>
        <p className="text-2xl font-black font-mono text-violet-700 dark:text-violet-400">
          {Number(billable_kg).toFixed(4)} <span className="text-sm font-normal">kg</span>
        </p>
      </div>
    </div>
  );
}
