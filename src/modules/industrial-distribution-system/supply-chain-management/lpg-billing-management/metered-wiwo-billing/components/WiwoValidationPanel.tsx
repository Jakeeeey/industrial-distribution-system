"use client";

import { Flame, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WiwoDetailRef } from "../types";

interface Props {
  details: WiwoDetailRef[];
  totalWiwoKg: number;
}

export function WiwoValidationPanel({ details, totalWiwoKg }: Props) {
  return (
    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/20 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold">WIWO Validation</h2>
            <p className="text-[10px] text-muted-foreground">Cylinder returns — weight in, weight out</p>
          </div>
        </div>
        <Badge className="bg-orange-100 text-orange-700 border-none font-mono text-xs">
          {Number(totalWiwoKg).toFixed(4)} kg total
        </Badge>
      </div>

      {details.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Package className="h-8 w-8 opacity-20" />
          <span className="text-sm">No WIWO detail lines linked.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50/60 dark:bg-zinc-900/60 text-muted-foreground border-b border-zinc-100 dark:border-zinc-800/50">
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Serial No</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Opening KG</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Gross Wt</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Tare Wt</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Remaining KG</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Consumed KG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {details.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{d.serial_number}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{Number(d.opening_lpg_kg).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(d.gross_weight).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{Number(d.tare_weight).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant="outline" className="font-mono text-xs">{Number(d.remaining_lpg_kg ?? 0).toFixed(4)} kg</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge className="bg-orange-100 text-orange-700 border-none font-mono text-xs">{Number(d.consumed_lpg_kg ?? 0).toFixed(4)} kg</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50/50 dark:bg-orange-900/10 border-t border-orange-200/50 dark:border-orange-800/30 font-bold">
                <td className="px-4 py-3 text-orange-700 dark:text-orange-400 text-sm" colSpan={5}>
                  Total WIWO KG
                </td>
                <td className="px-4 py-3 text-right font-mono text-orange-700 dark:text-orange-400 text-base">
                  {Number(totalWiwoKg).toFixed(4)} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
