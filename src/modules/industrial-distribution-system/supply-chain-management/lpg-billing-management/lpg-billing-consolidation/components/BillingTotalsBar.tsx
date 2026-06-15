"use client";

// ─── BillingTotalsBar.tsx ─────────────────────────────────────────────────────
// Footer bar showing running header totals: metered KG, WIWO KG, billable KG,
// and gross amount. Computed live from the child transactions array.
// Shown at the bottom of the ConsolidationWorkspace panel.
// ─────────────────────────────────────────────────────────────────────────────

import { Gauge, Scale, ReceiptText, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsolidationTransaction } from "../types/billing-consolidation.types";

interface BillingTotalsBarProps {
  transactions: ConsolidationTransaction[];
  className?: string;
}

interface TotalItem {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}

export function BillingTotalsBar({ transactions, className }: BillingTotalsBarProps) {
  // Compute totals from child transactions (mirrors what the server recalculates)
  const totalMeteredKg = transactions.reduce((s, tx) => s + tx.metered_kg, 0);
  const totalWiwoKg = transactions.reduce((s, tx) => s + tx.wiwo_kg, 0);
  const totalBillableKg = transactions.reduce((s, tx) => s + tx.billable_kg, 0);
  const totalGrossAmount = transactions.reduce((s, tx) => s + tx.gross_amount, 0);

  const items: TotalItem[] = [
    {
      label: "Total Metered",
      value: totalMeteredKg.toFixed(3),
      sub: "kg",
      icon: Gauge,
      color: "text-violet-600 dark:text-violet-400",
    },
    {
      label: "Total WIWO",
      value: totalWiwoKg.toFixed(3),
      sub: "kg",
      icon: Scale,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Billable KG",
      value: totalBillableKg.toFixed(3),
      sub: "kg",
      icon: ReceiptText,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Gross Amount",
      value: `₱ ${totalGrossAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 backdrop-blur-sm shrink-0",
        className
      )}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "flex-1 flex items-center gap-2 px-4 py-2.5",
              i < items.length - 1 && "border-r border-zinc-200 dark:border-zinc-800"
            )}
          >
            <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Icon className={cn("h-3.5 w-3.5", item.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground leading-tight">
                {item.label}
              </p>
              <p className={cn("text-sm font-black leading-tight", item.color)}>
                {item.value}
                {item.sub && (
                  <span className="text-[10px] font-medium text-muted-foreground ml-1">
                    {item.sub}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
