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
  /** LPG VAPOR constant (e.g. 2.0183) */
  lpgVapor?: number;
  /** PSI gauge pressure (e.g. 10.0000) */
  psi?: number;
  /** Computed Pressure Line = (PSI + CF) / CF (e.g. 1.6803) */
  pressureLine?: number;
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
    lpgVapor,
    psi = 0,
    pressureLine,
  } = props;

  const hasPsi = psi > 0;

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
          <div className="flex justify-between text-violet-100">
            <span>WIWO KG</span>
            <span className="font-mono font-bold">{Number(wiwoKg).toFixed(4)} kg</span>
          </div>
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

      {/* PSI Conversion — matching billing table columns */}
      {hasPsi && lpgVapor !== undefined && pressureLine !== undefined && (
        <div className="bg-white/10 rounded-xl overflow-hidden">
          <div className="px-3 py-1.5 bg-white/10 border-b border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">PSI Conversion</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right px-3 py-1.5 text-[10px] font-bold text-violet-200 uppercase tracking-wider">
                  Pressure Line
                </th>
                <th className="text-right px-3 py-1.5 text-[10px] font-bold text-orange-200 uppercase tracking-wider">
                  LPG Vapor
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* Pressure Line column = LPG Vapor constant (matching physical bill table) */}
                <td className="text-right px-3 py-2 font-mono font-bold text-violet-200">
                  {lpgVapor.toFixed(4)}
                </td>
                {/* LPG Vapor column = computed pressure line (matching physical bill table) */}
                <td className="text-right px-3 py-2 font-mono font-bold text-orange-200">
                  {pressureLine.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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
