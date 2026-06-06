"use client";

import { Badge } from "@/components/ui/badge";
import { Package, Cylinder } from "lucide-react";
import type { WiwoDetail } from "../types";

interface Props {
  details: WiwoDetail[];
  editable?: boolean;
  onChange?: (updatedDetails: WiwoDetail[]) => void;
}

export function KiloConsumptionDetail({ details, editable = false, onChange }: Props) {
  if (details.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Package className="h-8 w-8 opacity-20" />
        <span className="text-sm">No cylinder returns recorded for this WIWO transaction.</span>
      </div>
    );
  }

  const handleWeightChange = (index: number, field: "gross_weight" | "tare_weight", val: number) => {
    if (!onChange) return;
    const updated = [...details];
    updated[index] = {
      ...updated[index],
      [field]: val,
    };
    
    const gross = field === "gross_weight" ? val : updated[index].gross_weight;
    const tare = field === "tare_weight" ? val : updated[index].tare_weight;
    const opening = updated[index].opening_lpg_kg;
    
    const remaining = Math.max(0, gross - tare);
    const consumed = Math.max(0, opening - remaining);
    
    updated[index].remaining_lpg_kg = parseFloat(remaining.toFixed(3));
    updated[index].consumed_lpg_kg = parseFloat(consumed.toFixed(3));
    
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50/60 dark:bg-zinc-900/60 text-muted-foreground border-b border-zinc-100 dark:border-zinc-800/50">
            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">
              <div className="flex items-center gap-1.5">
                <Cylinder className="h-3.5 w-3.5" />
                Serial No
              </div>
            </th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Opening KG</th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Gross Wt</th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Tare Wt</th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Remaining KG</th>
            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Consumed KG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
          {details.map((d, index) => (
            <tr key={d.id || index} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono font-bold text-blue-600">{d.serial_number}</span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                {Number(d.opening_lpg_kg).toFixed(2)} kg
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {editable ? (
                  <input
                    type="number"
                    step="0.01"
                    value={d.gross_weight ?? ""}
                    onChange={(e) => handleWeightChange(index, "gross_weight", Number(e.target.value))}
                    className="w-24 text-right bg-zinc-50 border border-zinc-200 dark:bg-zinc-850 dark:border-zinc-700 rounded px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                ) : (
                  `${Number(d.gross_weight).toFixed(2)} kg`
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                {editable ? (
                  <input
                    type="number"
                    step="0.01"
                    value={d.tare_weight ?? ""}
                    onChange={(e) => handleWeightChange(index, "tare_weight", Number(e.target.value))}
                    className="w-24 text-right bg-zinc-50 border border-zinc-200 dark:bg-zinc-850 dark:border-zinc-700 rounded px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                ) : (
                  `${Number(d.tare_weight).toFixed(2)} kg`
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                <Badge variant="outline" className="font-mono text-xs">
                  {Number(d.remaining_lpg_kg ?? 0).toFixed(3)} kg
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none font-mono text-xs">
                  {Number(d.consumed_lpg_kg ?? 0).toFixed(3)} kg
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-orange-50/50 dark:bg-orange-900/10 border-t border-orange-200/50 dark:border-orange-800/30 font-bold">
            <td className="px-4 py-3 text-sm text-orange-700 dark:text-orange-400" colSpan={5}>
              Total Consumed KG
            </td>
            <td className="px-4 py-3 text-right font-mono text-orange-700 dark:text-orange-400 text-base">
              {Number(details.reduce((s, d) => s + (d.consumed_lpg_kg ?? 0), 0)).toFixed(3)} kg
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

