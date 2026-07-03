// src/modules/industrial-distribution-system/dashboard/components/widgets/QuickActionsWidget.tsx

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  FilePlus2,
  FileCheck2,
  Tag,
  ArrowLeftRight,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { WidgetLayout } from "../../types";
import { cn } from "@/lib/utils";

export const QuickActionsWidget: React.FC<{ layout?: WidgetLayout }> = ({ layout }) => {
  const actions = useMemo(() => {
    return [
      {
        title: "Create Sales Order",
        href: "/ids/crm/customer-hub/create-sales-order",
        icon: FilePlus2,
        color: "text-blue-500 bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/20",
      },
      {
        title: "Approve Order",
        href: "/ids/crm/customer-hub/sales-order-approval",
        icon: FileCheck2,
        color: "text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/15 border-indigo-500/20",
      },
      {
        title: "Serial Tagging",
        href: "/ids/crm/customer-hub/sales-order-tagging",
        icon: Tag,
        color: "text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/15 border-cyan-500/20",
      },
      {
        title: "RTO Operations",
        href: "/ids/bia/rto-operation",
        icon: TrendingUp,
        color: "text-rose-500 bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20",
      },
      {
        title: "Stock Transfer",
        href: "/ids/scm/warehouse-management/stock-transfers/stock-transfer-request",
        icon: ArrowLeftRight,
        color: "text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/20",
      },
      {
        title: "Invoicing & Billing",
        href: "/ids/invoicing",
        icon: Receipt,
        color: "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20",
      },
    ];
  }, []);

  const w = layout?.w ?? 12;
  const cols = w >= 6 ? 3 : (w >= 3 ? 2 : 1);
  const rows = Math.ceil(actions.length / cols);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full justify-between">
      {/* <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2 shrink-0">
        Operational Quick Shortcuts
      </span> */}

      <div 
        className="grid gap-1.5 flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <Link
              key={idx}
              href={act.href}
              className={cn(
                "flex items-center gap-1 border rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all duration-200 select-none h-full w-full",
                act.color
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate leading-none">{act.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
