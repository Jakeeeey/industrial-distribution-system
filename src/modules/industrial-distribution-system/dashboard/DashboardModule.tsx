// src/modules/industrial-distribution-system/dashboard/DashboardModule.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES (v2):
//   • ROW_HEIGHT reduced from 80px → 60px (tighter, more data-dense grid).
//   • Desktop grid uses Tailwind grid-cols-12 + grid-flow-dense for auto-packing.
//     gridAutoRows is still set via inline style (dynamic value).
//   • Replaced left/right arrow reorder with drag-and-drop via useDragDrop.
//   • Added useResize hook wired to containerRef for column/row resize.
//   • WidgetContainer no longer receives isFirst/isLast/onMoveLeft/onMoveRight.
//   • Mobile layout: added grip handle + touch drag support (useDragDrop handles both).
//   • Mobile cards get data-widget-id for touch elementFromPoint detection.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useState, useRef, useEffect } from "react";

import { DashboardProvider, useDashboard } from "./providers/DashboardProvider";
import { useDashboardState } from "./hooks/useDashboardState";
import { useDragDrop } from "./hooks/useDragDrop";
import { useResize } from "./hooks/useResize";
import { DashboardHeader } from "./components/DashboardHeader";
import { CustomizePanel } from "./components/CustomizePanel";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { WidgetContainer } from "./components/WidgetContainer";
import { WidgetLayout, WidgetId } from "./types";
import { motion } from "framer-motion";


// Widget imports
import { RtoOverviewWidget } from "./components/widgets/RtoOverviewWidget";
import { CylinderAgingWidget } from "./components/widgets/CylinderAgingWidget";
import { OrderStatusWidget } from "./components/widgets/OrderStatusWidget";
// import { SalesPerformanceWidget } from "./components/widgets/SalesPerformanceWidget";
import { LogisticsTripsWidget } from "./components/widgets/LogisticsTripsWidget";
import { InventoryStockWidget } from "./components/widgets/InventoryStockWidget";
import { LowStockAlertWidget } from "./components/widgets/LowStockAlertWidget";
import { ReceivablesWidget } from "./components/widgets/ReceivablesWidget";
import { ActivityFeedWidget } from "./components/widgets/ActivityFeedWidget";
import { QuickActionsWidget } from "./components/widgets/QuickActionsWidget";
import { WeatherCalendarWidget } from "./components/widgets/WeatherCalendarWidget";
import { TopSalesmanWidget } from "./components/widgets/TopSalesmanWidget";
import { TopCustomerWidget } from "./components/widgets/TopCustomerWidget";
import { EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// 60px per grid row — matches gridAutoRows value set on the grid container.
// Bump this if row height changes again (also update useResize call below).
const ROW_HEIGHT = 60;

// Switch to stacked mobile layout below this breakpoint
const MOBILE_BREAKPOINT = 768;

// ── Empty state component (module-level — must not be defined inside render) ──
// react-hooks/static-components forbids defining components inside another component.
const EmptyState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center text-center h-60">
    <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">
      Your workspace is empty
    </p>
    <p className="text-[10px] text-slate-400 max-w-xs mt-1">{label}</p>
  </div>
);

interface MobileWidgetCardProps {
  layout: WidgetLayout;
  details: { title: string; subtitle?: string };
  minH: string;
  isBeingDragged: boolean;
  isDropTarget: boolean;
  borderAccent: string;
  handleTouchStartGrip: (id: string, nativeEvent: TouchEvent, el: HTMLElement) => void;
  toggleWidgetVisibility: (id: WidgetId) => void;
  renderWidgetContent: (id: string, layout: WidgetLayout) => React.ReactNode;
}

// ── Mobile widget card with transition-out animation support ──
const MobileWidgetCard: React.FC<MobileWidgetCardProps> = ({
  layout,
  details,
  minH,
  isBeingDragged,
  isDropTarget,
  borderAccent,
  handleTouchStartGrip,
  toggleWidgetVisibility,
  renderWidgetContent,
}) => {
  const [isHiding, setIsHiding] = useState(false);

  const handleHide = () => {
    setIsHiding(true);
    setTimeout(() => {
      toggleWidgetVisibility(layout.id);
    }, 300);
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
      className={cn(
        `w-full ${minH} flex flex-col rounded-xl border border-border/70 border-l-4`,
        "bg-card text-card-foreground shadow-xs overflow-hidden transition-all duration-300",
        borderAccent,
        // Drag visual feedback
        isBeingDragged && "opacity-40 scale-[0.98]",
        isDropTarget   && "ring-2 ring-blue-400/70 shadow-lg shadow-blue-500/10",
        isHiding && "opacity-0 scale-90 translate-y-2 pointer-events-none",
      )}
    >
      {/* Mobile widget header */}
      <div className="flex items-center border-b border-border/40 px-3 py-2 bg-muted/10 select-none gap-2">
        {/* Grip handle — touch initiates mobile drag reorder */}
        <div
          onTouchStart={(e) => {
            handleTouchStartGrip(layout.id, e.nativeEvent, e.currentTarget);
          }}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors p-0.5 shrink-0"
          title="Hold and drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-black uppercase italic tracking-tighter text-foreground truncate">
            {details.title}
          </h3>
          {details.subtitle && (
            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/70 truncate leading-none mt-0.5">
              {details.subtitle}
            </p>
          )}
        </div>

        {/* Hide button */}
        <button
          onClick={handleHide}
          className="rounded-md p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-red-500 transition-all cursor-pointer shrink-0"
          title="Hide Widget"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Widget content */}
      <div className="flex-1 p-3 min-h-0 overflow-auto select-text flex flex-col">
        {renderWidgetContent(layout.id, layout)}
      </div>
    </motion.div>
  );
};

export const DashboardModuleContent: React.FC = () => {
  const {
    isLoaded,
    activePreset,
    layouts,
    changePreset,
    resetLayout,
    toggleWidgetVisibility,
    swapWidgets,
    resizeWidget,
    updateWidgetLayout,
    importLayouts,
    exportAllLayouts,
  } = useDashboardState();

  const { refreshWidget } = useDashboard();

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Ref to the desktop grid container — used by useResize for column-width measurement
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drag-and-drop (desktop HTML5 DnD + mobile touch) ──────────────────────
  const {
    draggedId,
    overId,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragEnd,
    handleTouchStartGrip,
  } = useDragDrop({ onSwap: swapWidgets });

  // ── Resize (desktop only) ─────────────────────────────────────────────────
  const { startResize } = useResize({
    rowHeight: ROW_HEIGHT,
    onResize: resizeWidget,
  });

  // ── Mobile breakpoint detection ───────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Widget content renderer ───────────────────────────────────────────────
  const renderWidgetContent = (id: string, layout: WidgetLayout) => {
    switch (id) {
      case "rto-overview":       return <RtoOverviewWidget layout={layout} />;
      case "cylinder-aging":     return <CylinderAgingWidget />;
      case "order-status":       return <OrderStatusWidget layout={layout} />;
      // case "sales-performance":  return <SalesPerformanceWidget />;
      case "logistics-trips":    return <LogisticsTripsWidget />;
      case "inventory-stock":    return <InventoryStockWidget />;
      case "low-stock-alert":    return <LowStockAlertWidget />;
      case "receivables":        return <ReceivablesWidget layout={layout} />;
      case "activity-feed":      return <ActivityFeedWidget />;
      case "quick-actions":      return <QuickActionsWidget layout={layout} />;
      case "weather-calendar":   return <WeatherCalendarWidget layout={layout} />;
      case "top-salesman":       return <TopSalesmanWidget />;
      case "top-customer":       return <TopCustomerWidget />;
      default:
        return <div className="text-xs text-muted-foreground p-4">Widget not found</div>;
    }
  };

  // ── Widget metadata (title + subtitle) ───────────────────────────────────
  const getWidgetDetails = (id: string) => {
    switch (id) {
      case "rto-overview":      return { title: "RTO Operations Overview",        subtitle: "Recovery Metrics HUD" };
      case "cylinder-aging":    return { title: "Cylinder Return Aging",           subtitle: "Overdue buckets (0-90+ days)" };
      case "order-status":      return { title: "CRM Orders Status Flow",          subtitle: "Work-in-progress status pipeline" };
      // case "sales-performance": return { title: "Monthly Revenue Tracker",         subtitle: "Actual revenue vs target" };
      case "logistics-trips":   return { title: "Active Dispatches & Trips",       subtitle: "Fleet & Delivery tracker" };
      case "inventory-stock":   return { title: "Warehouse Cylinder Stock",        subtitle: "Filled vs Empty stock ratio" };
      case "low-stock-alert":   return { title: "Low Inventory Alerts",            subtitle: "Items below reorder point" };
      case "receivables":       return { title: "Receivables & Credit Alerts",     subtitle: "Accounts aging & debt risks" };
      case "activity-feed":     return { title: "Live Audit Logs Timeline",        subtitle: "Chronological transaction trail" };
      case "quick-actions":     return { title: "Quick Action Shortcuts",          subtitle: "ERP navigation triggers" };
      case "weather-calendar":  return { title: "Logistics Weather & Calendar",    subtitle: "Scheduled events & conditions" };
      case "top-salesman":      return { title: "Top Sales Performers",            subtitle: "Leaderboard of top salesmen" };
      case "top-customer":      return { title: "Top Customer Revenue",            subtitle: "Purchases leader board ranking" };
      default:                  return { title: "System Widget",                   subtitle: "" };
    }
  };




  // ── Loading state ──────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest animate-pulse">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  const rawVisibleLayouts = layouts.filter((l) => l.visible);
  const visibleLayouts = autoScaleLayoutWidths(rawVisibleLayouts);

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  // Vertical stack. Drag is supported for reordering (touch via grip handle).
  // No resize on mobile.
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        <DashboardHeader
          activePreset={activePreset}
          onChangePreset={changePreset}
          onToggleCustomize={() => setIsCustomizeOpen(true)}
          onToggleNotifications={() => setIsNotificationsOpen(true)}
          onResetLayout={resetLayout}
          onExportDashboard={exportAllLayouts}
          onImportLayouts={importLayouts}
        />
        <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
          {visibleLayouts.length === 0 && (
            <EmptyState label="Tap 'Customize' in the toolbar to enable widgets." />
          )}

          {visibleLayouts.map((layout) => {
            const details = getWidgetDetails(layout.id);
            const minH = layout.h >= 4 ? "min-h-[280px]" : layout.h >= 3 ? "min-h-[220px]" : "min-h-[160px]";
            const isBeingDragged = draggedId === layout.id;
            const isDropTarget   = overId === layout.id;

            // Mobile border accent (mirrors WidgetContainer accent logic)
            let borderAccent = "border-l-cyan-500";
            if (layout.id.includes("rto") || layout.id.includes("aging"))      borderAccent = "border-l-rose-500";
            else if (layout.id.includes("sales") || layout.id.includes("receivable")) borderAccent = "border-l-indigo-500";
            else if (layout.id.includes("stock") || layout.id.includes("low"))  borderAccent = "border-l-emerald-500";
            else if (layout.id.includes("logistics") || layout.id.includes("weather")) borderAccent = "border-l-amber-500";
            else if (layout.id.includes("activity"))                             borderAccent = "border-l-violet-500";

            return (
              <MobileWidgetCard
                key={layout.id}
                layout={layout}
                details={details}
                minH={minH}
                isBeingDragged={isBeingDragged}
                isDropTarget={isDropTarget}
                borderAccent={borderAccent}
                handleTouchStartGrip={handleTouchStartGrip}
                toggleWidgetVisibility={toggleWidgetVisibility}
                renderWidgetContent={renderWidgetContent}
              />
            );
          })}
        </div>

        <CustomizePanel
          isOpen={isCustomizeOpen}
          onClose={() => setIsCustomizeOpen(false)}
          layouts={layouts}
          onToggleWidget={toggleWidgetVisibility}
        />
        <NotificationsPanel
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  // 12-column CSS Grid with auto-rows and grid-flow-dense.
  // Drag-and-drop handled by useDragDrop; resize by useResize.
  return (
    <div className="flex flex-col h-full bg-background">
      <DashboardHeader
        activePreset={activePreset}
        onChangePreset={changePreset}
        onToggleCustomize={() => setIsCustomizeOpen(true)}
        onToggleNotifications={() => setIsNotificationsOpen(true)}
        onResetLayout={resetLayout}
        onExportDashboard={exportAllLayouts}
        onImportLayouts={importLayouts}
      />

      <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {visibleLayouts.length === 0 ? (
          <EmptyState label="Click 'Customize' in the toolbar to show widgets." />
        ) : (
          // 12-column grid.
          // - grid-flow-dense: auto-fills holes left by hidden/removed widgets.
          // - gridAutoRows: 60px per row (matches ROW_HEIGHT constant).
          // - Each widget uses gridColumn/gridRow span via WidgetContainer's inline style.
          <div
            ref={containerRef}
            className="w-full grid grid-cols-12 grid-flow-dense gap-3"
            style={{ gridAutoRows: `${ROW_HEIGHT}px` }}
          >
            {visibleLayouts.map((layout) => {
              const details = getWidgetDetails(layout.id);
              return (
                <WidgetContainer
                  key={layout.id}
                  layout={layout}
                  title={details.title}
                  subtitle={details.subtitle}
                  onHide={() => toggleWidgetVisibility(layout.id)}
                  onRefresh={() => refreshWidget(layout.id)}
                  // Custom size selector callbacks
                  onSelectCustomSize={(w, h) => updateWidgetLayout(layout.id, { w, h, customSize: true })}
                  onResetCustomSize={() => updateWidgetLayout(layout.id, { customSize: false })}
                  // DnD visual state
                  isDragging={draggedId === layout.id}
                  isDragOver={overId === layout.id}
                  // Desktop DnD handlers
                  onDragStart={() => handleDragStart(layout.id)}
                  onDragEnd={handleDragEnd}
                  onDragEnter={() => handleDragEnter(layout.id)}
                  onDragOver={handleDragOver}
                  // Mobile touch drag (via grip handle)
                  onTouchStartGrip={handleTouchStartGrip}
                  // Resize (SE corner handle)
                  onResizeStart={(e) => startResize(layout.id, e, layout)}
                >
                  {renderWidgetContent(layout.id, layout)}
                </WidgetContainer>
              );
            })}
          </div>
        )}
      </div>

      <CustomizePanel
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        layouts={layouts}
        onToggleWidget={toggleWidgetVisibility}
      />
      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
};


// ── Helper to dynamically auto-scale column widths of visible widgets ─────────
// This ensures that adjacent widgets pair up to total 12 columns perfectly.
// - Full widgets (e.g. rto-overview) always span 12.
// - Wide (8) + Narrow (4) pairs span 12.
// - Narrow (4) + Wide (8) pairs span 12.
// - Wide + Wide pairs span 6 + 6.
// - Narrow + Narrow pairs span 6 + 6.
// - Any standalone widget spans 12 to fill the row beautifully.
function autoScaleLayoutWidths(visible: WidgetLayout[]): WidgetLayout[] {
  const result: WidgetLayout[] = [];
  let i = 0;

  while (i < visible.length) {
    const current = { ...visible[i] };
    const currentType = getWidgetType(current.id);

    if (current.customSize) {
      // Keep custom w & h directly
      result.push(current);
      i++;
      continue;
    }

    if (currentType === "full") {
      current.w = 12;
      result.push(current);
      i++;
      continue;
    }

    const next = visible[i + 1] ? { ...visible[i + 1] } : null;
    const nextType = next ? getWidgetType(next.id) : null;

    if (next && nextType !== "full" && !next.customSize) {
      const nextCloned = { ...next };

      if (currentType === "wide" && nextType === "narrow") {
        current.w = 8;
        nextCloned.w = 4;
        result.push(current, nextCloned);
      } else if (currentType === "narrow" && nextType === "wide") {
        current.w = 4;
        nextCloned.w = 8;
        result.push(current, nextCloned);
      } else if (currentType === "wide" && nextType === "wide") {
        current.w = 6;
        nextCloned.w = 6;
        result.push(current, nextCloned);
      } else if (currentType === "narrow" && nextType === "narrow") {
        current.w = 6;
        nextCloned.w = 6;
        result.push(current, nextCloned);
      } else {
        current.w = 6;
        nextCloned.w = 6;
        result.push(current, nextCloned);
      }
      i += 2;
    } else {
      // Standalone widget spans 12
      current.w = 12;
      result.push(current);
      i++;
    }
  }

  return result;
}

function getWidgetType(id: string): "full" | "wide" | "narrow" {
  switch (id) {
    case "rto-overview":
      return "full";
    case "sales-performance":
    case "receivables":
    case "activity-feed":
    case "cylinder-aging":
    case "order-status":
      return "wide";
    case "quick-actions":
    case "weather-calendar":
    case "top-salesman":
    case "top-customer":
    case "inventory-stock":
    case "low-stock-alert":
    case "logistics-trips":
      return "narrow";
    default:
      return "narrow";
  }
}

export default function DashboardModule() {
  return (
    <DashboardProvider>
      <DashboardModuleContent />
    </DashboardProvider>
  );
}
