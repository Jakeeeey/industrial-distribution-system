"use client";

import { Flame } from "lucide-react";

interface Props {
  billableKg: number;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  pricePerKg: number;
  cylinderCount: number;
}

export function KiloBillingSummaryCard({
  billableKg,
  grossAmount,
  vatAmount,
  netAmount,
  pricePerKg,
  cylinderCount,
}: Props) {
  return (
    <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 rounded-2xl p-6 text-white shadow-2xl shadow-orange-500/30 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
          <Flame className="h-5 w-5 animate-pulse" />
        </div>
        <h3 className="font-bold text-lg">WIWO Billing Summary</h3>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-orange-100">
          <span>Cylinders Returned</span>
          <span className="font-bold font-mono">{cylinderCount}</span>
        </div>
        <div className="flex justify-between text-orange-100">
          <span>Price / KG</span>
          <span className="font-bold font-mono">₱ {Number(pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-orange-100">
          <span>Total Consumed KG</span>
          <span className="font-bold font-mono">{Number(billableKg).toFixed(3)} kg</span>
        </div>

        <div className="border-t border-white/20 pt-2.5 space-y-2">
          <div className="flex justify-between text-orange-100">
            <span>Gross Amount</span>
            <span className="font-mono font-bold">₱ {Number(grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-orange-100">
            <span>VAT (12%)</span>
            <span className="font-mono font-bold">₱ {Number(vatAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="border-t border-white/20 pt-3 flex justify-between items-end">
          <span className="font-bold text-base">Net Amount</span>
          <span className="text-2xl font-black font-mono">
            ₱ {Number(netAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
