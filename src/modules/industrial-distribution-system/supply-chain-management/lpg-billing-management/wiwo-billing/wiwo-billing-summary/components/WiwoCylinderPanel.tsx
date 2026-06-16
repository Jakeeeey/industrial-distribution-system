// RULE DEV: WiWO Cylinder Panel
// Shows the list of WiWO detail lines (cylinders weighed in / out) for a transaction.
// Displayed in the WiWO billing summary detail view.

"use client";

import { Scale, Package, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WiwoDetail, WiwoHeader } from "../types";

interface Props {
  wiwoHeader: WiwoHeader | null | undefined;
}

// Line type display map
const LINE_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  CONSUMPTION_RETURN: {
    label: "Return",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-none",
  },
  NEW_DEPLOYMENT: {
    label: "Deployment",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-none",
  },
  RETURN_ONLY: {
    label: "Return Only",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-none",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-none",
  },
};

export function WiwoCylinderPanel({ wiwoHeader }: Props) {
  if (!wiwoHeader) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center text-xs text-muted-foreground">
        No linked WiWO header found for this transaction.
      </div>
    );
  }

  const details: WiwoDetail[] = wiwoHeader.details ?? [];
  const billableDetails = details.filter((d) => d.is_billable);
  const totalConsumed = details.reduce((sum, d) => sum + Number(d.consumed_lpg_kg ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* WiWO Header Summary */}
      <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50/50 dark:bg-orange-900/10 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              WiWO Reference
            </p>
            <p className="font-bold text-sm font-mono text-foreground">
              {wiwoHeader.wiwo_no || wiwoHeader.transaction_no || `#${wiwoHeader.id}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {wiwoHeader.wiwo_type?.replace(/_/g, " ")} — {wiwoHeader.wiwo_status}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total WiWO KG</p>
          <p className="font-black text-xl font-mono text-foreground">
            {totalConsumed.toFixed(4)}
            <span className="text-xs font-normal text-muted-foreground"> kg</span>
          </p>
        </div>
      </div>

      {/* Cylinder Details Table */}
      {details.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center text-xs text-muted-foreground">
          No cylinder detail lines found.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
            Cylinder Detail Lines ({details.length} total, {billableDetails.length} billable)
          </p>
          {details.map((d, idx) => {
            const isBillable = !!d.is_billable;
            const lineTypeMeta = LINE_TYPE_LABEL[d.line_type] ?? {
              label: d.line_type,
              color: "bg-zinc-100 text-zinc-700 border-none",
            };
            const previous = Number(d.previous_lpg_kg ?? 0);
            const returned = Number(d.returned_gross_weight_kg ?? 0);
            const tare = Number(d.tare_weight_kg ?? 0);
            const remaining = Number(d.remaining_lpg_kg ?? 0);
            const consumed = Number(d.consumed_lpg_kg ?? 0);

            return (
              <div
                key={d.id ?? idx}
                className={`rounded-xl border p-4 flex flex-col sm:flex-row gap-4 ${
                  isBillable
                    ? "border-orange-200 dark:border-orange-800/40 bg-orange-50/30 dark:bg-orange-900/5"
                    : "border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/5"
                }`}
              >
                {/* Left: Cylinder identity */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-foreground truncate">
                      {d.serial_number || `Cylinder #${d.cylinder_asset_id}`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge className={`text-[9px] px-1.5 py-0 ${lineTypeMeta.color}`}>
                        {lineTypeMeta.label}
                      </Badge>
                      {isBillable ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-none text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Billable
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-100 text-zinc-500 border-none text-[9px] px-1.5 py-0">
                          Non-Billable
                        </Badge>
                      )}
                    </div>
                    {d.remarks && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">{d.remarks}</p>
                    )}
                  </div>
                </div>

                {/* Right: Weight breakdown */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center shrink-0">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Opening</p>
                    <p className="font-mono font-bold text-xs">{previous.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Returned</p>
                    <p className="font-mono font-bold text-xs">{returned > 0 ? returned.toFixed(3) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Tare</p>
                    <p className="font-mono font-bold text-xs">{tare.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Remaining</p>
                    <p className="font-mono font-bold text-xs">{remaining.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Consumed</p>
                    <p className="font-mono font-black text-sm text-orange-700 dark:text-orange-400">
                      {consumed.toFixed(3)}
                    </p>
                    {consumed === 0 && isBillable && (
                      <AlertTriangle className="h-3 w-3 text-amber-500 mx-auto mt-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className="rounded-xl border border-orange-300 dark:border-orange-700/50 bg-gradient-to-r from-orange-50 dark:from-orange-900/20 to-amber-50/50 dark:to-amber-900/10 p-3.5 flex items-center justify-between">
            <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
              Total Consumed KG
            </p>
            <p className="font-black text-xl font-mono text-orange-700 dark:text-orange-400">
              {totalConsumed.toFixed(4)}
              <span className="text-xs font-normal text-orange-500 ml-1">kg</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
