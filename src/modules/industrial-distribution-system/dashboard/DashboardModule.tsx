// src/modules/industrial-distribution-system/dashboard/DashboardModule.tsx

"use client";

import React, { useState, useRef, useEffect } from "react";

import { DashboardProvider } from "./providers/DashboardProvider";
import { useDashboardState } from "./hooks/useDashboardState";
import { DashboardHeader } from "./components/DashboardHeader";
import { CustomizePanel } from "./components/CustomizePanel";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { WidgetContainer } from "./components/WidgetContainer";

import { exportToCsv } from "./utils/kpiCalculations";



// Widgets imports
import { RtoOverviewWidget } from "./components/widgets/RtoOverviewWidget";
import { CylinderAgingWidget } from "./components/widgets/CylinderAgingWidget";
import { OrderStatusWidget } from "./components/widgets/OrderStatusWidget";
import { SalesPerformanceWidget } from "./components/widgets/SalesPerformanceWidget";
import { LogisticsTripsWidget } from "./components/widgets/LogisticsTripsWidget";
import { InventoryStockWidget } from "./components/widgets/InventoryStockWidget";
import { LowStockAlertWidget } from "./components/widgets/LowStockAlertWidget";
import { ReceivablesWidget } from "./components/widgets/ReceivablesWidget";
import { ActivityFeedWidget } from "./components/widgets/ActivityFeedWidget";

import { QuickActionsWidget } from "./components/widgets/QuickActionsWidget";
import { WeatherCalendarWidget } from "./components/widgets/WeatherCalendarWidget";
import { TopSalesmanWidget } from "./components/widgets/TopSalesmanWidget";
import { TopCustomerWidget } from "./components/widgets/TopCustomerWidget";
import { EyeOff } from "lucide-react";


const ROW_HEIGHT = 80; // pixels per grid row (desktop only — matches gridAutoRows)

const MOBILE_BREAKPOINT = 768; // px — below this we switch to stacked layout

export const DashboardModuleContent: React.FC = () => {
  const {
    isLoaded,
    activePreset,
    layouts,
    changePreset,
    resetLayout,
    toggleWidgetVisibility,
    moveWidget,
  } = useDashboardState();


  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);


  // Detect mobile viewport to switch between stacked and grid layouts
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Render individual widget component by layout id
  const renderWidgetContent = (id: string) => {
    switch (id) {
      case "rto-overview":
        return <RtoOverviewWidget />;
      case "cylinder-aging":
        return <CylinderAgingWidget />;
      case "order-status":
        return <OrderStatusWidget />;
      case "sales-performance":
        return <SalesPerformanceWidget />;
      case "logistics-trips":
        return <LogisticsTripsWidget />;
      case "inventory-stock":
        return <InventoryStockWidget />;
      case "low-stock-alert":
        return <LowStockAlertWidget />;
      case "receivables":
        return <ReceivablesWidget />;
      case "activity-feed":
        return <ActivityFeedWidget />;

      case "quick-actions":
        return <QuickActionsWidget />;
      case "weather-calendar":
        return <WeatherCalendarWidget />;
      case "top-salesman":
        return <TopSalesmanWidget />;
      case "top-customer":
        return <TopCustomerWidget />;
      default:
        return <div className="text-xs text-muted-foreground p-4">Widget not found</div>;
    }
  };

  // Human-readable titles/subtitles corresponding to layouts
  const getWidgetDetails = (id: string) => {
    switch (id) {
      case "rto-overview":
        return { title: "RTO Operations Overview", subtitle: "Recovery Metrics HUD" };
      case "cylinder-aging":
        return { title: "Cylinder Return Aging", subtitle: "Overdue buckets (0-90+ days)" };
      case "order-status":
        return { title: "CRM Orders Status Flow", subtitle: "Work-in-progress status pipeline" };
      case "sales-performance":
        return { title: "Monthly Revenue Tracker", subtitle: "Actual revenue vs target" };
      case "logistics-trips":
        return { title: "Active Dispatches & Trips", subtitle: "Fleet & Delivery tracker" };
      case "inventory-stock":
        return { title: "Warehouse Cylinder Stock", subtitle: "Filled vs Empty stock ratio" };
      case "low-stock-alert":
        return { title: "Low Inventory Alerts", subtitle: "Items below reorder point" };
      case "receivables":
        return { title: "Receivables & Credit Alerts", subtitle: "Accounts aging & debt risks" };
      case "activity-feed":
        return { title: "Live Audit Logs Timeline", subtitle: "Chronological transaction trail" };

      case "quick-actions":
        return { title: "Quick Action Shortcuts", subtitle: "ERP navigation triggers" };
      case "weather-calendar":
        return { title: "Logistics Weather & Calendar", subtitle: "Scheduled events & conditions" };
      case "top-salesman":
        return { title: "Top Sales Performers", subtitle: "Leaderboard of top salesmen" };
      case "top-customer":
        return { title: "Top Customer Revenue", subtitle: "Purchases leader board ranking" };
      default:
        return { title: "System Widget", subtitle: "" };
    }
  };

  // Export current widget states to CSV summary
  const handleExportDashboard = () => {
    const csvData = layouts.map((l) => {
      const details = getWidgetDetails(l.id);
      return {
        WidgetID: l.id,
        WidgetName: details.title,
        Status: l.visible ? "Visible" : "Hidden",
        GridX: l.x,
        GridY: l.y,
        GridW: l.w,
        GridH: l.h,
      };
    });
    exportToCsv(csvData, `ids-dashboard-layout-${activePreset}`);
  };

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
  const visibleLayouts = layouts.filter((l) => l.visible);

  // ─── MOBILE LAYOUT: Simple vertical stack, no drag/resize ────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        <DashboardHeader
          activePreset={activePreset}
          onChangePreset={changePreset}
          onToggleCustomize={() => setIsCustomizeOpen(true)}
          onToggleNotifications={() => setIsNotificationsOpen(true)}
          onResetLayout={resetLayout}
          onExportDashboard={handleExportDashboard}
        />
        <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
          {visibleLayouts.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-10">
              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">
                Your workspace is empty
              </p>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                Tap &apos;Customize&apos; in the toolbar to enable widgets.
              </p>
            </div>
          )}
          {/* Sort widgets for predictable mobile stacking */}
          {[...visibleLayouts]
            .map((layout) => {

              const details = getWidgetDetails(layout.id);
              const minH = layout.h >= 4 ? "min-h-[280px]" : layout.h >= 3 ? "min-h-[220px]" : "min-h-[160px]";
              
              // Mobile border accent
              let borderAccent = "border-l-cyan-500";
              if (layout.id.includes("rto") || layout.id.includes("aging")) borderAccent = "border-l-rose-500";
              else if (layout.id.includes("sales") || layout.id.includes("receivable")) borderAccent = "border-l-indigo-500";
              else if (layout.id.includes("stock") || layout.id.includes("low")) borderAccent = "border-l-emerald-500";
              else if (layout.id.includes("logistics") || layout.id.includes("weather")) borderAccent = "border-l-amber-500";
              else if (layout.id.includes("activity")) borderAccent = "border-l-violet-500";

              return (
                <div
                  key={layout.id}
                  className={`w-full ${minH} flex flex-col rounded-xl border border-border/70 border-l-4 bg-card text-card-foreground shadow-xs overflow-hidden ${borderAccent}`}
                >
                  {/* Mobile widget header */}
                  <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2 bg-muted/10">
                    <div className="min-w-0">
                      <h3 className="text-[10px] font-black uppercase italic tracking-tighter text-foreground truncate">
                        {details.title}
                      </h3>
                      {details.subtitle && (
                        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/70 truncate leading-none mt-0.5">
                          {details.subtitle}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleWidgetVisibility(layout.id)}
                      className="rounded-md p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-red-500 transition-all cursor-pointer shrink-0 ml-2"
                      title="Hide Widget"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Widget content */}
                  <div className="flex-1 p-3 min-h-0 overflow-auto select-text flex flex-col">
                    {renderWidgetContent(layout.id)}
                  </div>
                </div>
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

  // ─── DESKTOP LAYOUT: CSS Grid — no overlap, auto-aligned ─────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      <DashboardHeader
        activePreset={activePreset}
        onChangePreset={changePreset}
        onToggleCustomize={() => setIsCustomizeOpen(true)}
        onToggleNotifications={() => setIsNotificationsOpen(true)}
        onResetLayout={resetLayout}
        onExportDashboard={handleExportDashboard}
      />

      <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {visibleLayouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-60">
            <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">
              Your workspace is empty
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-1">
              Click &apos;Customize&apos; in the toolbar to show widgets.
            </p>
          </div>
        ) : (
          // 12-column CSS grid; each row = ROW_HEIGHT px.
          // Widgets are auto-placed via grid-column / grid-row span styles.
          <div
            ref={containerRef}
            className="w-full"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gridAutoRows: `${ROW_HEIGHT}px`,
              gap: "12px",
            }}
          >
            {visibleLayouts.map((layout, idx) => {
              const details = getWidgetDetails(layout.id);
              return (
                <WidgetContainer
                  key={layout.id}
                  layout={layout}
                  title={details.title}
                  subtitle={details.subtitle}
                  onHide={() => toggleWidgetVisibility(layout.id)}
                  onRefresh={() => console.log(`Refreshing: ${layout.id}`)}
                  onMoveLeft={() => moveWidget(layout.id, "left")}
                  onMoveRight={() => moveWidget(layout.id, "right")}
                  isFirst={idx === 0}
                  isLast={idx === visibleLayouts.length - 1}
                >
                  {renderWidgetContent(layout.id)}
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


export default function DashboardModule() {
  return (
    <DashboardProvider>
      <DashboardModuleContent />
    </DashboardProvider>
  );
}
