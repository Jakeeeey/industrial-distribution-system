// components/CylinderAgingKPICards.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Turnaround rules cards matching the mockup design.
// Displays Expected Turnaround limits by Customer Segment.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Building2, Store, Home } from "lucide-react";

export function CylinderAgingKPICards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* COMMERCIAL CARD */}
      <div className="bg-[#232360] border-none text-white p-6 rounded-xl relative overflow-hidden shadow-lg min-h-[130px] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Building2 className="h-4 w-4 shrink-0" />
            COMMERCIAL
          </div>
          <div className="text-3xl font-black mt-2">
            15 <span className="text-sm font-normal text-slate-300">Days / Customer</span>
          </div>
        </div>
        <div className="text-xs text-indigo-300/80 font-medium tracking-wide mt-2">
          Expected turnaround schedule
        </div>
        {/* Background Watermark Icon */}
        <Building2 className="h-28 w-28 absolute right-[-15px] top-[-10px] opacity-5 text-white pointer-events-none scale-125" />
      </div>

      {/* RETAIL / RESALE CARD */}
      <div className="bg-[#232360] border-none text-white p-6 rounded-xl relative overflow-hidden shadow-lg min-h-[130px] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
            <Store className="h-4 w-4 shrink-0" />
            RETAIL / RESALE
          </div>
          <div className="text-3xl font-black mt-2">
            20 <span className="text-sm font-normal text-slate-300">Days / Customer</span>
          </div>
        </div>
        <div className="text-xs text-indigo-300/80 font-medium tracking-wide mt-2">
          Expected turnaround schedule
        </div>
        {/* Background Watermark Icon */}
        <Store className="h-28 w-28 absolute right-[-15px] top-[-10px] opacity-5 text-white pointer-events-none scale-125" />
      </div>

      {/* RESIDENTIAL CARD */}
      <div className="bg-[#232360] border-none text-white p-6 rounded-xl relative overflow-hidden shadow-lg min-h-[130px] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <Home className="h-4 w-4 shrink-0" />
            RESIDENTIAL
          </div>
          <div className="text-3xl font-black mt-2">
            40 <span className="text-sm font-normal text-slate-300">Days / Customer</span>
          </div>
        </div>
        <div className="text-xs text-indigo-300/80 font-medium tracking-wide mt-2">
          Expected turnaround schedule
        </div>
        {/* Background Watermark Icon */}
        <Home className="h-28 w-28 absolute right-[-15px] top-[-10px] opacity-5 text-white pointer-events-none scale-125" />
      </div>
    </div>
  );
}

