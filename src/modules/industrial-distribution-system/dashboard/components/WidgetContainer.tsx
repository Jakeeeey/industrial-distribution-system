// src/modules/industrial-distribution-system/dashboard/components/WidgetContainer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES (v2):
//   • Removed onMoveLeft / onMoveRight / isFirst / isLast props (arrow buttons gone).
//   • Added GripVertical drag handle — only the grip is draggable (not the card),
//     preventing accidental drags from chart interactions or text selection.
//   • Added HTML5 drag events on outer card for drop-zone detection.
//   • Added touch events on the grip for mobile drag ordering.
//   • Added SE corner resize handle — mousedown calls onResizeStart.
//   • Visual states: isDragging (source fades) and isDragOver (target gets a ring).
//   • data-widget-id attribute on outer div — used by touch elementFromPoint walk-up.
//   • Position: relative on inner card to anchor the resize handle absolutely.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { WidgetLayout } from "../types";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  EyeOff,
  ArrowUpRight,
  GripVertical,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GridSizeSelector } from "./GridSizeSelector";

interface WidgetContainerProps {
  layout: WidgetLayout;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onHide: () => void;
  onRefresh?: () => void;

  // ── Drag-and-drop (desktop HTML5 DnD) ────────────────────────────────────
  /** True while THIS widget is the active drag source */
  isDragging?: boolean;
  /** True while a foreign widget is hovering over THIS widget */
  isDragOver?: boolean;
  /** Called on the grip handle's onDragStart */
  onDragStart?: () => void;
  /** Called on the grip handle's onDragEnd */
  onDragEnd?: () => void;
  /** Called on the outer card's onDragEnter (marks this as drop target) */
  onDragEnter?: () => void;
  /** Called on the outer card's onDragOver (must be present to allow drop) */
  onDragOver?: (e: React.DragEvent) => void;

  // ── Touch drag (mobile) ───────────────────────────────────────────────────
  /**
   * Called on the grip handle's onTouchStart.
   * Receives id, nativeEvent, and the grip element for ghost sizing.
   */
  onTouchStartGrip?: (
    id: string,
    nativeEvent: TouchEvent,
    el: HTMLElement
  ) => void;

  // ── Resize ────────────────────────────────────────────────────────────────
  /** Called on the SE resize handle's onMouseDown */
  onResizeStart?: (e: React.MouseEvent) => void;

  // ── Custom size selection ──────────────────────────────────────────────────
  onSelectCustomSize?: (w: number, h: number) => void;
  onResetCustomSize?: () => void;

  // ── Backward compat (kept, unused) ───────────────────────────────────────
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
      return "/ids/crm/customer-hub/sales-order-report";
    case "sales-performance":
      return "/ids/crm/customer-hub";
    case "logistics-trips":
      return "/ids/scm/warehouse-management/consolidation/pre-dispatch-plan/pdp-planner";
    case "inventory-stock":
      return "/ids/scm/inventory-management/cylinder-assets";
    case "low-stock-alert":
      return "/ids/scm/inventory-management/inventory-control";
    case "receivables":
      return "/ids/bia/rto-operation";
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
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onTouchStartGrip,
  onResizeStart,
  onSelectCustomSize,
  onResetCustomSize,
}) => {
  const [localRefreshSpin, setLocalRefreshSpin] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  // Guard: only allow drag when initiated from the grip handle
  const dragAllowed = useRef(false);

  const modulePath = getModulePath(layout.id);

  const handleLocalRefresh = () => {
    if (onRefresh) {
      setLocalRefreshSpin(true);
      onRefresh();
      setTimeout(() => setLocalRefreshSpin(false), 700);
    }
  };

  const handleHide = () => {
    setIsHiding(true);
    setTimeout(() => {
      onHide();
    }, 300);
  };

  // ── Accent color per widget category ──────────────────────────────────────
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

  // ── CSS Grid span styles (applied to outer wrapper) ───────────────────────
  const gridStyle: React.CSSProperties = {
    gridColumn: `span ${layout.w}`,
    gridRow: `span ${layout.h}`,
    minHeight: 0,
  };

  return (
    <motion.div
      layout
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.9
      }}
      data-widget-id={layout.id}
      style={gridStyle}
      className={cn(
        "min-w-0 h-full w-full",
        // While this card is being dragged: fade + shrink slightly
        isDragging && "opacity-40 scale-[0.97]",
        // Hiding transition: shrink, fade out
        isHiding && "opacity-0 scale-90 translate-y-2 pointer-events-none transition-all duration-300",
      )}
      // Drop zone handlers — required on the target card, not the dragged grip
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragOver={onDragOver}
    >
      {/* Inner card — relative so the resize handle can be positioned absolutely */}
      <div
        className={cn(
          "relative h-full w-full flex flex-col overflow-hidden rounded-xl",
          "border border-border/70 bg-card text-card-foreground shadow-xs",
          "transition-all duration-200 border-l-4",
          accentBorder,
          hoverBorder,
          // Drop target ring — shown when a foreign card is hovering over this one
          isDragOver && "ring-2 ring-blue-400/70 shadow-lg shadow-blue-500/10 bg-blue-500/[0.02]",
        )}
      >
        {/* ── Widget header bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 bg-muted/10 shrink-0 select-none">

          {/* Grip handle — the ONLY element that initiates drag */}
          <div
            // Desktop: mark as draggable and fire DnD events
            draggable={true}
            onDragStart={(e) => {
              if (!dragAllowed.current) {
                e.preventDefault();
                return;
              }
              dragAllowed.current = false;
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }}
            onDragEnd={() => {
              dragAllowed.current = false;
              onDragEnd?.();
            }}
            // Mobile: initiate touch drag via document-level listeners
            onTouchStart={(e) => {
              onTouchStartGrip?.(layout.id, e.nativeEvent, e.currentTarget);
            }}
            // Allow drag only when pointer goes down on this handle
            onPointerDown={() => {
              dragAllowed.current = true;
            }}
            onPointerUp={() => {
              dragAllowed.current = false;
            }}
            className={cn(
              "flex items-center gap-1.5 cursor-grab active:cursor-grabbing",
              "rounded-md p-1 -ml-0.5 text-muted-foreground/40",
              "hover:text-muted-foreground/70 hover:bg-muted/50 transition-colors",
              isDragging && "cursor-grabbing",
            )}
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0" />
          </div>

          {/* Widget title + subtitle */}
          <div className="min-w-0 flex-1 ml-1">
            <h3 className="text-[10px] font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 truncate leading-none">
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Refresh */}
            {onRefresh && (
              <button
                onClick={handleLocalRefresh}
                className="rounded-md p-1 text-muted-foreground/75 hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                title="Refresh Widget"
              >
                <RefreshCw
                  className={cn("h-3 w-3", localRefreshSpin && "animate-spin")}
                />
              </button>
            )}

            {/* Customize card size Popover (Gear Icon) */}
            {onSelectCustomSize && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="rounded-md p-1 text-muted-foreground/75 hover:bg-muted hover:text-foreground transition-all cursor-pointer flex items-center justify-center"
                    title="Customize widget grid size"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" side="bottom">
                  <GridSizeSelector
                    currentW={layout.w}
                    currentH={layout.h}
                    isCustom={!!layout.customSize}
                    onSelect={(w, h) => {
                      onSelectCustomSize(w, h);
                    }}
                    onReset={() => {
                      onResetCustomSize?.();
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Navigate to module report */}
            {modulePath && (
              <Link
                href={modulePath}
                className="rounded-md p-1 text-muted-foreground/75 hover:bg-muted hover:text-primary transition-all cursor-pointer flex items-center justify-center"
                title="View Module Report"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            )}

            {/* Hide widget */}
            <button
              onClick={handleHide}
              className="rounded-md p-1 text-muted-foreground/75 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-all cursor-pointer"
              title="Hide Widget"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ── Widget content ────────────────────────────────────────────── */}
        <div className="flex-1 w-full h-full min-h-0 overflow-auto select-text p-3 flex flex-col">
          {children}
        </div>

        {/* ── SE Resize handle ──────────────────────────────────────────── */}
        {/* Positioned at bottom-right corner; mousedown triggers useResize */}
        {onResizeStart && (
          <div
            onMouseDown={onResizeStart}
            className={cn(
              "absolute bottom-0 right-0 w-5 h-5 cursor-se-resize",
              "flex items-end justify-end pb-0.5 pr-0.5",
              "opacity-0 hover:opacity-100 group-hover:opacity-60 transition-opacity",
              "text-muted-foreground/50",
            )}
            title="Resize widget"
          >
            {/* 3-dot SE corner indicator */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              className="opacity-70"
            >
              <circle cx="9" cy="9" r="1.3" />
              <circle cx="5.5" cy="9" r="1.3" />
              <circle cx="9" cy="5.5" r="1.3" />
            </svg>
          </div>
        )}
      </div>
    </motion.div>
  );
};
