// src/modules/industrial-distribution-system/dashboard/components/WidgetContainer.tsx
// NOTE: Replaced react-rnd absolute positioning with CSS Grid placement.
// Widgets now use grid-column / grid-row so the browser handles alignment automatically.
// This eliminates all overlap and drift issues from free-form absolute positioning.

"use client";

import React, { useState } from "react";
import { WidgetLayout } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/command-center/GlassCard";
import {
  Minimize2,
  RefreshCw,
  Fullscreen,
  EyeOff,
} from "lucide-react";

interface WidgetContainerProps {
  layout: WidgetLayout;
  onHide: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
  // colWidth / rowHeight / onLayoutChange kept for API compatibility but unused in CSS-grid mode
  colWidth?: number;
  rowHeight?: number;
  onLayoutChange?: (changes: Partial<WidgetLayout>) => void;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  layout,
  onHide,
  title,
  subtitle,
  children,
  onRefresh,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localRefreshSpin, setLocalRefreshSpin] = useState(false);

  const handleLocalRefresh = () => {
    if (onRefresh) {
      setLocalRefreshSpin(true);
      onRefresh();
      setTimeout(() => setLocalRefreshSpin(false), 700);
    }
  };

  // Determine accent color from widget id
  let accent: "cyan" | "indigo" | "emerald" | "amber" | "violet" | "rose" = "cyan";
  if (layout.id.includes("rto") || layout.id.includes("aging")) accent = "rose";
  else if (layout.id.includes("sales") || layout.id.includes("receivable")) accent = "indigo";
  else if (layout.id.includes("stock") || layout.id.includes("low")) accent = "emerald";
  else if (layout.id.includes("logistics")) accent = "amber";
  else if (layout.id.includes("alert")) accent = "rose";
  else if (layout.id.includes("activity")) accent = "violet";

  // --- Fullscreen overlay ---
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-background/96 backdrop-blur-md p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 leading-none">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={handleLocalRefresh}>
                <RefreshCw className={cn("h-4 w-4 mr-2", localRefreshSpin && "animate-spin")} />
                Refresh
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit Fullscreen
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border/80 p-4 overflow-auto shadow-inner">
          {children}
        </div>
      </div>
    );
  }

  // --- CSS Grid item: placed via inline grid-column / grid-row ---
  // x is 0-indexed column start, w is column span
  // y is 0-indexed row start,    h is row span (each row = 100px via grid-auto-rows on parent)
  const gridStyle: React.CSSProperties = {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
    minHeight: 0, // allow flex shrink inside grid cell
  };

  return (
    <div style={gridStyle} className="min-w-0">
      <GlassCard
        accent={accent}
        className="h-full w-full flex flex-col overflow-hidden !rounded-xl !shadow-sm !p-0 border border-border/70 bg-card/50 backdrop-blur-xs"
      >
        {/* Widget header bar */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 bg-muted/10 shrink-0">
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

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {onRefresh && (
              <button
                onClick={handleLocalRefresh}
                className="rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                title="Refresh Widget"
              >
                <RefreshCw className={cn("h-3 w-3", localRefreshSpin && "animate-spin")} />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(true)}
              className="rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-all cursor-pointer"
              title="Fullscreen"
            >
              <Fullscreen className="h-3 w-3" />
            </button>
            <button
              onClick={onHide}
              className="rounded-md p-1 text-muted-foreground/70 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-all cursor-pointer"
              title="Hide Widget"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Widget content */}
        <div className="flex-1 p-3 min-h-0 overflow-auto select-text">
          {children}
        </div>
      </GlassCard>
    </div>
  );
};
