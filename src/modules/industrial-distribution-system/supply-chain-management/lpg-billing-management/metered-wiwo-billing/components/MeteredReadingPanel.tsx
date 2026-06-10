"use client";

import { Gauge, Calendar, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  readingDate: string;
  previousReading: number;
  currentReading: number;
  meteredKg: number;
  meterUnit?: string;
  meterDirection?: string;
  /** LPG VAPOR — constant from pressure/vapor tables (e.g. 2.0183) */
  lpgVapor?: number;
  /** PSI — gauge operating pressure (e.g. 10.0000) */
  psi?: number;
  /** CORRECTION FACTOR — atmospheric pressure constant (e.g. 14.7) */
  correctionFactor?: number;
  /** PRESSURE LINE — computed: (PSI + CF) / CF (e.g. 1.6803) */
  pressureLine?: number;
}

export function MeteredReadingPanel({
  readingDate,
  previousReading,
  currentReading,
  meteredKg,
  meterUnit = "KG",
  meterDirection = "INCREASING",
  lpgVapor = 1,
  psi = 0,
  correctionFactor = 14.7,
  pressureLine = 1,
}: Props) {
  const rawConsumption =
    meterDirection === "DECREASING"
      ? Math.max(0, previousReading - currentReading)
      : Math.max(0, currentReading - previousReading);

  const hasPsi = psi > 0;

  return (
    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
          <Gauge className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold">Meter Reading Details</h2>
          <p className="text-[10px] text-muted-foreground">Raw readings · PSI conversion · KG computation</p>
        </div>
      </div>

      {/* ── Reading Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/35 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Reading Date</span>
          </div>
          <p className="font-bold text-sm">{readingDate || "—"}</p>
        </div>
        <div className="bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/35 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Previous</span>
          </div>
          <p className="font-bold font-mono text-sm">{Number(previousReading).toFixed(4)}</p>
        </div>
        <div className="bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/35 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Present</span>
          </div>
          <p className="font-bold font-mono text-sm">{Number(currentReading).toFixed(4)}</p>
        </div>
      </div>

      {/* Usage Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl px-4 py-2.5">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Usage ({meterDirection.toLowerCase()} meter)
        </span>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">{Number(currentReading).toFixed(4)}</span>
          <span className="text-muted-foreground">−</span>
          <span className="text-zinc-500">{Number(previousReading).toFixed(4)}</span>
          <span className="text-muted-foreground">=</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5">
            {rawConsumption.toFixed(4)} {meterUnit}
          </span>
        </div>
      </div>

      {/* ── FOR YOUR REFERENCE table ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          For Your Reference
        </p>
        <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700/50">
                <th className="text-left px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                  Item
                </th>
                <th className="text-right px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                  Value
                </th>
                <th className="text-right px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {/* LPG VAPOR */}
              <tr className="bg-white dark:bg-zinc-900/40">
                <td className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  LPG VAPOR
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-violet-700 dark:text-violet-400">
                  {lpgVapor.toFixed(4)}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  CONSTANT
                </td>
              </tr>
              {/* PSI */}
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/20">
                <td className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  PSI
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {psi.toFixed(4)}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  CONSTANT
                </td>
              </tr>
              {/* CORRECTION FACTOR */}
              <tr className="bg-white dark:bg-zinc-900/40">
                <td className="px-3 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  CORRECTION FACTOR
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {correctionFactor.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  CONSTANT
                </td>
              </tr>
              {/* PRESSURE LINE — computed */}
              <tr className="bg-orange-50/40 dark:bg-orange-950/10">
                <td className="px-3 py-2.5 font-semibold text-orange-700 dark:text-orange-400">
                  PRESSURE LINE
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-orange-700 dark:text-orange-400">
                  {hasPsi ? pressureLine.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] text-orange-600 dark:text-orange-500 font-semibold uppercase tracking-wider">
                  {hasPsi ? "PSI + CF / CF" : "N/A"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pressure Line formula expansion */}
        {hasPsi && (
          <div className="bg-orange-50/30 dark:bg-orange-950/10 border border-orange-100/50 dark:border-orange-900/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono">
              ({psi.toFixed(4)} + {correctionFactor.toFixed(1)}) ÷ {correctionFactor.toFixed(1)}
            </span>
            <span className="text-xs font-bold font-mono text-orange-700 dark:text-orange-400">
              = {pressureLine.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {/* ── KG Computation ── */}
      <div className="bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/40 dark:border-blue-900/20 rounded-xl p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">
          KG Computation
        </p>

        {/* Billing table style: Usage × Pressure Line[col] × LPG Vapor[col] */}
        <div className="rounded-lg overflow-hidden border border-blue-100 dark:border-blue-900/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-100/50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
                <th className="text-right px-3 py-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Usage
                </th>
                <th className="text-right px-3 py-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                  LPG Vapor
                </th>
                {hasPsi && (
                  <th className="text-right px-3 py-1.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    Pressure Line
                  </th>
                )}
                <th className="text-right px-3 py-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Kilo
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white/70 dark:bg-zinc-900/40">
                <td className="text-right px-3 py-2 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {rawConsumption.toFixed(4)}
                </td>
                <td className="text-right px-3 py-2 font-mono font-bold text-violet-700 dark:text-violet-400">
                  {lpgVapor.toFixed(4)}
                </td>
                {hasPsi && (
                  <td className="text-right px-3 py-2 font-mono font-bold text-orange-700 dark:text-orange-400">
                    {pressureLine.toFixed(4)}
                  </td>
                )}
                <td className="text-right px-3 py-2 font-mono font-bold text-blue-700 dark:text-blue-400">
                  {Number(meteredKg).toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Formula legend */}
        <p className="text-[9px] text-muted-foreground font-mono opacity-70 text-center">
          {hasPsi
            ? `Kilo = Usage × Pressure Line × LPG Vapor`
            : `Kilo = Usage × Pressure Line`}
        </p>

        {/* Final result */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-blue-100/40 dark:border-blue-900/20 pt-3">
          <div>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Computed Metered KG</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {rawConsumption.toFixed(4)}
              {" × "}{lpgVapor.toFixed(4)}
              {hasPsi && ` × ${pressureLine.toFixed(4)}`}
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-blue-700 dark:text-blue-400">
            {Number(meteredKg).toFixed(4)}{" "}
            <span className="text-xs font-normal text-muted-foreground">kg</span>
          </p>
        </div>
      </div>
    </div>
  );
}
