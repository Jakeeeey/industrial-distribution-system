"use client";

import { Gauge, Calendar, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  readingDate: string;
  previousReading: number;
  currentReading: number;
  meteredKg: number;
}

export function MeteredReadingPanel({
  readingDate,
  previousReading,
  currentReading,
  meteredKg,
}: Props) {
  return (
    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
          <Gauge className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold">Meter Reading</h2>
          <p className="text-[10px] text-muted-foreground">Current - Previous = Metered KG</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Date */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Reading Date</span>
          </div>
          <p className="font-bold text-sm">{readingDate || "—"}</p>
        </div>

        {/* Previous */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Previous</span>
          </div>
          <p className="font-bold font-mono text-sm">{Number(previousReading).toLocaleString()}</p>
        </div>

        {/* Current */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Current</span>
          </div>
          <p className="font-bold font-mono text-sm">{Number(currentReading).toLocaleString()}</p>
        </div>
      </div>

      {/* Computed Metered KG */}
      <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Metered KG</p>
          <p className="text-xs text-blue-500 mt-0.5">Current − Previous</p>
        </div>
        <p className="text-2xl font-black font-mono text-blue-700 dark:text-blue-400">
          {Number(meteredKg).toFixed(3)} <span className="text-sm font-normal">kg</span>
        </p>
      </div>
    </div>
  );
}
