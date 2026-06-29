// src/modules/industrial-distribution-system/dashboard/components/widgets/TopCustomerWidget.tsx
"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Store, TrendingUp } from "lucide-react";

export const TopCustomerWidget: React.FC = () => {
  const { topCustomers, loading } = useDashboard();

  const maxRevenue = useMemo(() => {
    if (!topCustomers || topCustomers.length === 0) return 1;
    return Math.max(...topCustomers.map((c) => c.revenue), 1);
  }, [topCustomers]);

  if (loading) {
    return (
      <div className="flex flex-col h-full justify-between p-2">
        <Skeleton className="h-4 w-1/3 mb-4" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Get index styling for top rankers
  const getRankStyle = (index: number) => {
    switch (index) {
      case 0:
        return "bg-amber-500/10 text-amber-500 border-amber-500/25";
      case 1:
        return "bg-slate-400/10 text-slate-400 border-slate-400/25";
      case 2:
        return "bg-amber-700/10 text-amber-700 border-amber-700/25";
      default:
        return "bg-muted text-muted-foreground/80 border-transparent";
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">
          Top Customer Revenue
        </span>
        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider block mb-3">
          IDS division purchases by customer
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
        {topCustomers.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            No customer invoice aggregates found.
          </div>
        ) : (
          topCustomers.map((customer, idx) => {
            const pct = (customer.revenue / maxRevenue) * 100;
            const displayName = customer.storeName || customer.name || "Unknown Customer";
            
            return (
              <div key={customer.code || idx} className="group relative">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-mono text-[9px] font-black shrink-0 ${getRankStyle(idx)}`}>
                      {idx + 1}
                    </span>
                    <Store className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <div className="min-w-0">
                      <span className="truncate text-foreground/95 font-black block leading-none">
                        {displayName}
                      </span>
                      <span className="text-[7.5px] font-semibold text-slate-400 font-mono mt-0.5 block leading-none">
                        {customer.code} {customer.storeName && customer.name ? `(${customer.name})` : ""}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right pl-2 font-mono shrink-0">
                    <span className="text-foreground font-black">
                      ₱{customer.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-medium ml-1">
                      ({customer.invoices} Inv)
                    </span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="h-1.5 w-full bg-muted/65 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500/80 to-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {topCustomers.length > 0 && (
        <div className="border-t border-border/40 pt-2.5 mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-indigo-500" />
            <span>Leader: {topCustomers[0]?.storeName || topCustomers[0]?.name}</span>
          </div>
          <span>₱{topCustomers[0]?.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} Max</span>
        </div>
      )}
    </div>
  );
};
