// src/modules/industrial-distribution-system/dashboard/components/WidgetContainer.tsx
// NOTE: Replaced GlassCard with a standard card layout to remove background blur and hover scaling.
// Fullscreen mode removed in favor of navigating directly to the respective module report/summary page.
// Added Move Left/Right controls to re-order layout dynamically via array re-ordering (autoflow).

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WidgetLayout } from "../types";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

interface WidgetContainerProps {
  layout: WidgetLayout;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onHide: () => void;
  onRefresh?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  
  // Unused props kept for backward/prop compatibility
  colWidth?: number;
  rowHeight?: number;
  onLayoutChange?: (changes: Partial<WidgetLayout>) => void;
}

// Maps widget IDs to their respective operational module report / summary routes
const getModulePath = (id: string): string => {
  switch (id) {
    case "rto-overview":
      return "/ids/bia/rto-operation";
    case "cylinder-aging":
      return "/ids/bia/customer-cylinder-aging";
    case "order-status":
      return "/ids/crm/customer-hub";
    case "sales-performance":
      return "/ids/crm/customer-hub"; // Under Sales/Revenue reports
    case "logistics-trips":
      return "/ids/scm/fleet-management";
    case "inventory-stock":
      return "/ids/scm/inventory-management";
    case "low-stock-alert":
      return "/ids/scm/products-management";
    case "receivables":
      return "/ids/invoicing";
    case "weather-calendar":
      return "/ids/scm/logistics";
    case "activity-feed":
      return "/ids/settings";
    default:
      return "";
  }
};

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  layout,
  title,
  subtitle,
  children,
  onHide,
  onRefresh,
  onMoveLeft,
  onMoveRight,
  isFirst = false,
  isLast = false,
}) => {
  const [localRefreshSpin, setLocalRefreshSpin] = useState(false);
  const modulePath = getModulePath(layout.id);

  const handleLocalRefresh = () => {
    if (onRefresh) {
      setLocalRefreshSpin(true);
      onRefresh();
      setTimeout(() => setLocalRefreshSpin(false), 700);
    }
  };

  // Determine standard accent styling based on widget id (gives subtle left-side border color matching the category)
  let accentBorder = "border-l-cyan-500";
  let hoverBorder = "hover:border-cyan-500/40";
  if (layout.id.includes("rto") || layout.id.includes("aging")) {
    accentBorder = "border-l-rose-500";
    hoverBorder = "hover:border-rose-500/40";
  } else if (layout.id.includes("sales") || layout.id.includes("receivable")) {
    accentBorder = "border-l-indigo-500";
    hoverBorder = "hover:border-indigo-500/40";
  } else if (layout.id.includes("stock") || layout.id.includes("low")) {
    accentBorder = "border-l-emerald-500";
    hoverBorder = "hover:border-emerald-500/40";
  } else if (layout.id.includes("logistics") || layout.id.includes("weather")) {
    accentBorder = "border-l-amber-500";
    hoverBorder = "hover:border-amber-500/40";
  } else if (layout.id.includes("activity")) {
    accentBorder = "border-l-violet-500";
    hoverBorder = "hover:border-violet-500/40";
  }

  // Row height units = 80px.
  // Set width spanning w columns and height spanning h rows.
  const gridStyle: React.CSSProperties = {
    gridColumn: `span ${layout.w}`,
    gridRow: `span ${layout.h}`,
    minHeight: 0,
  };

  return (
    <div style={gridStyle} className="min-w-0 h-full w-full">
      {/* Standard non-blurred card, removes large scale and shadow blurs */}
      <div
        className={cn(
          "h-full w-full flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-xs transition-all duration-200 border-l-4",
          accentBorder,
          hoverBorder
        )}
      >
        {/* Widget header bar */}
        <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2 bg-muted/10 shrink-0 select-none">
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 truncate leading-none">
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons list */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Move Left/Up button */}
            {onMoveLeft && (
              <button
                onClick={onMoveLeft}
                disabled={isFirst}
                className={cn(
                  "rounded-md p-1 transition-all cursor-pointer",
                  isFirst 
                    ? "text-muted-foreground/30 cursor-not-allowed" 
                    : "text-muted-foreground/75 hover:bg-muted hover:text-foreground"
                )}
                title="Move Left"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
            )}

            {/* Move Right/Down button */}
            {onMoveRight && (
              <button
                onClick={onMoveRight}
                disabled={isLast}
                className={cn(
                  "rounded-md p-1 transition-all cursor-pointer",
                  isLast 
                    ? "text-muted-foreground/30 cursor-not-allowed" 
                    : "text-muted-foreground/75 hover:bg-muted hover:text-foreground"
                )}
                title="Move Right"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}

            {/* Refresh widget content */}
            {onRefresh && (
              <button
                onClick={handleLocalRefresh}
                className="rounded-md p-1 text-muted-foreground/75 hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                title="Refresh Widget"
              >
                <RefreshCw className={cn("h-3 w-3", localRefreshSpin && "animate-spin")} />
              </button>
            )}

            {/* Link to module report instead of fullscreen */}
            {modulePath && (
              <Link
                href={modulePath}
                className="rounded-md p-1 text-muted-foreground/75 hover:bg-muted hover:text-primary transition-all cursor-pointer flex items-center justify-center"
                title="View Module Report"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            )}


            {/* Hide Widget */}
            <button
              onClick={onHide}
              className="rounded-md p-1 text-muted-foreground/75 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-all cursor-pointer"
              title="Hide Widget"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content container fills height of the grid cell container perfectly */}
        <div className="flex-1 w-full h-full min-h-0 overflow-auto select-text p-3 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};
