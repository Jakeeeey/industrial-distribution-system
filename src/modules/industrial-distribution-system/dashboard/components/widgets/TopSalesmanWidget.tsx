// src/modules/industrial-distribution-system/dashboard/components/widgets/TopSalesmanWidget.tsx
"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Award, UserCheck, TrendingUp } from "lucide-react";

export const TopSalesmanWidget: React.FC = () => {
  const { topSalesmen, loading } = useDashboard();

  const maxRevenue = useMemo(() => {
    if (!topSalesmen || topSalesmen.length === 0) return 1;
    return Math.max(...topSalesmen.map((s) => s.revenue), 1);
  }, [topSalesmen]);

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

  // Medals or trophy icons for top rankers
  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-amber-500 fill-amber-500/20" />;
      case 1:
        return <Award className="h-4 w-4 text-slate-400 fill-slate-400/20" />;
      case 2:
        return <Award className="h-4 w-4 text-amber-700 fill-amber-700/20" />;
      default:
        return <UserCheck className="h-4 w-4 text-muted-foreground/60" />;
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">
          Top Sales Performers
        </span>
        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider block mb-3">
          IDS division revenue by salesman
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
        {topSalesmen.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            No active salesman transaction data.
          </div>
        ) : (
          topSalesmen.map((salesman, idx) => {
            const pct = (salesman.revenue / maxRevenue) * 100;
            return (
              <div key={salesman.id || idx} className="group relative">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground/80 w-4">
                      #{idx + 1}
                    </span>
                    <div className="shrink-0">{getRankBadge(idx)}</div>
                    <span className="truncate text-foreground/90 font-black">
                      {salesman.name}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-400 font-mono">
                      {salesman.code}
                    </span>
                  </div>
                  <div className="text-right pl-2 font-mono">
                    <span className="text-foreground font-black">
                      ₱{salesman.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-medium ml-1.5">
                      ({salesman.invoices} Invoices)
                    </span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="h-1.5 w-full bg-muted/65 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500/80 to-teal-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {topSalesmen.length > 0 && (
        <div className="border-t border-border/40 pt-2.5 mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Top seller: {topSalesmen[0]?.name}</span>
          </div>
          <span>₱{topSalesmen[0]?.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} Max</span>
        </div>
      )}
    </div>
  );
};
