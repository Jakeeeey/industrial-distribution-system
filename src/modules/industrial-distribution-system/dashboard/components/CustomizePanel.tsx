"use client";

import React, { useState } from "react";
import { WidgetLayout, WidgetId } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

// Widget imports for real UI previews
import { RtoOverviewWidget } from "./widgets/RtoOverviewWidget";
import { CylinderAgingWidget } from "./widgets/CylinderAgingWidget";
import { OrderStatusWidget } from "./widgets/OrderStatusWidget";
import { LogisticsTripsWidget } from "./widgets/LogisticsTripsWidget";
import { InventoryStockWidget } from "./widgets/InventoryStockWidget";
import { LowStockAlertWidget } from "./widgets/LowStockAlertWidget";
import { ReceivablesWidget } from "./widgets/ReceivablesWidget";
import { ActivityFeedWidget } from "./widgets/ActivityFeedWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { WeatherCalendarWidget } from "./widgets/WeatherCalendarWidget";
import { TopSalesmanWidget } from "./widgets/TopSalesmanWidget";
import { TopCustomerWidget } from "./widgets/TopCustomerWidget";
import { WidgetContainer } from "./WidgetContainer";

interface CustomizePanelProps {
  isOpen: boolean;
  onClose: () => void;
  layouts: WidgetLayout[];
  onToggleWidget: (id: WidgetId) => void;
}

interface WidgetInfo {
  id: WidgetId;
  name: string;
  description: string;
}

const WIDGET_PREVIEWS: Record<string, {
  category: string;
  gridSize: string;
  dataPoints: string[];
  mockLines: number;
}> = {
  "rto-overview": {
    category: "Executive & Analytics",
    gridSize: "12 cols × 3 rows",
    dataPoints: ["Delivered Fulls count", "Returned Empties count", "Active Dealer Outstanding", "Cylinder Recovery Rate %", "Calculated Financial Exposure"],
    mockLines: 3,
  },
  "cylinder-aging": {
    category: "Executive & Analytics",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Overdue Return buckets", "0-30 Days holding count", "31-60 Days holding count", "61-90 Days holding count", "90+ Days holding count"],
    mockLines: 4,
  },
  "order-status": {
    category: "Sales & Engagement",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Draft & approval status counts", "Consolidation queue stats", "Warehouse picking quantities", "Logistics dispatch loads", "Delivered core records"],
    mockLines: 4,
  },
  "sales-performance": {
    category: "Sales & Engagement",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Monthly revenue targets", "Actual posted invoice amounts", "Realtime achievement progress %", "Daily billing trend coordinates"],
    mockLines: 4,
  },
  "top-salesman": {
    category: "Sales & Engagement",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["IDS division leaderboard", "Sales performance rankings", "Salesman total revenue", "Invoice transactions count"],
    mockLines: 5,
  },
  "top-customer": {
    category: "Sales & Engagement",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["IDS division purchaser leaderboard", "Store name directory", "Customer total purchase revenue", "Sales invoice counts"],
    mockLines: 5,
  },
  "logistics-trips": {
    category: "SCM & Logistics",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Active dispatches & routes", "Vehicle plate numbers", "Assigned driver names", "Delivery status timelines"],
    mockLines: 4,
  },
  "inventory-stock": {
    category: "SCM & Logistics",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Available cylinders on-hand", "Full vs Empty ratio charts", "Capacity utilization rates"],
    mockLines: 4,
  },
  "low-stock-alert": {
    category: "SCM & Logistics",
    gridSize: "6 cols × 4 rows",
    dataPoints: ["Stock level safety limit checks", "Reorder point markers", "Critical & warning alert states"],
    mockLines: 3,
  },
  "receivables": {
    category: "Finance",
    gridSize: "12 cols × 5 rows",
    dataPoints: ["Credit limit aging lines", "High financial risk accounts", "Overdue invoice values"],
    mockLines: 5,
  },
  "activity-feed": {
    category: "Utilities & System",
    gridSize: "12 cols × 5 rows",
    dataPoints: ["Real-time transaction logs", "User operations audits", "ERP document tracking"],
    mockLines: 6,
  },
  "quick-actions": {
    category: "Utilities & System",
    gridSize: "4 cols × 4 rows",
    dataPoints: ["One-click ERP navigation", "Direct shortcut triggers"],
    mockLines: 3,
  },
  "weather-calendar": {
    category: "Utilities & System",
    gridSize: "12 cols × 4 rows",
    dataPoints: ["Live weather API status", "Today's scheduling list", "Location routing checks"],
    mockLines: 4,
  },
};

const WIDGET_CATEGORIES: {
  category: string;
  widgets: WidgetInfo[];
}[] = [
  {
    category: "Executive & Analytics",
    widgets: [
      {
        id: "rto-overview",
        name: "RTO Operations Overview",
        description: "Aggregated cylinder returns, missing counts, and exposure KPIs.",
      },
      {
        id: "cylinder-aging",
        name: "Cylinder Return Aging",
        description: "Bar chart displaying returning cylinder age buckets (0-90+ days).",
      },
    ],
  },
  {
    category: "Sales & Engagement",
    widgets: [
      {
        id: "order-status",
        name: "CRM Orders Status Flow",
        description: "Counts of sales orders grouped by status (Consolidation, Picking, Dispatch).",
      },
      // hide for now but dont delete
      // {
      //   id: "sales-performance",
      //   name: "Monthly Revenue Tracker",
      //   description: "Target tracking comparison vs current monthly revenue.",
      // },
      {
        id: "top-salesman",
        name: "Top Sales Performers",
        description: "Leaderboard of top 5 salesmen ranked by total IDS division revenue.",
      },
      {
        id: "top-customer",
        name: "Top Customer Revenue",
        description: "Ranking of top 5 customers by total IDS division purchase revenue.",
      },
    ],
  },
  {
    category: "SCM & Logistics",
    widgets: [
      {
        id: "logistics-trips",
        name: "Active Dispatches & Trips",
        description: "Trip status checklist (Loading, Shipping, Completed).",
      },
      {
        id: "inventory-stock",
        name: "Warehouse Cylinder Stock",
        description: "Filled vs Empty cylinder stock ratios by branch.",
      },
      {
        id: "low-stock-alert",
        name: "Low Inventory Alerts",
        description: "Highlights inventory items dropping below safety limits.",
      },
    ],
  },
  {
    category: "Finance",
    widgets: [
      {
        id: "receivables",
        name: "Receivables & Credit Alerts",
        description: "Receivables trend line and list of high exposure accounts.",
      },
    ],
  },
  {
    category: "Utilities & System",
    widgets: [
      {
        id: "activity-feed",
        name: "Live Audit Logs Timeline",
        description: "Real-time scrollable feed of system-wide transactions.",
      },
      {
        id: "quick-actions",
        name: "Quick Action Shortcuts",
        description: "One-click navigations for orders, collections, and transfers.",
      },
      {
        id: "weather-calendar",
        name: "Logistics Weather & Calendar",
        description: "Dispatch events calendar and localized logistics weather tracker.",
      },
    ],
  },
];


export const CustomizePanel: React.FC<CustomizePanelProps> = ({
  isOpen,
  onClose,
  layouts,
  onToggleWidget,
}) => {
  const [hoveredWidgetId, setHoveredWidgetId] = useState<WidgetId | null>(null);

  const isWidgetVisible = (id: WidgetId): boolean => {
    return layouts.find((w) => w.id === id)?.visible ?? false;
  };

  const renderWidgetPreview = (id: WidgetId) => {
    // Mock layout for preview — w:6, h:4 gives a mid-size default card
    const mockLayout = { id, x: 0, y: 0, w: 6, h: 4, visible: true };

    // Widget title + subtitle metadata for the container header
    const META: Record<string, { title: string; subtitle: string }> = {
      "rto-overview":    { title: "RTO Operations Overview",     subtitle: "Recovery Metrics HUD" },
      "cylinder-aging":  { title: "Cylinder Return Aging",       subtitle: "Overdue buckets (0-90+ days)" },
      "order-status":    { title: "CRM Orders Status Flow",      subtitle: "Work-in-progress status pipeline" },
      "logistics-trips": { title: "Active Dispatches & Trips",   subtitle: "Fleet & Delivery tracker" },
      "inventory-stock": { title: "Warehouse Cylinder Stock",    subtitle: "Filled vs Empty stock ratio" },
      "low-stock-alert": { title: "Low Inventory Alerts",        subtitle: "Items below reorder point" },
      "receivables":     { title: "Receivables & Credit Alerts", subtitle: "Accounts aging & debt risks" },
      "activity-feed":   { title: "Live Audit Logs Timeline",    subtitle: "Chronological transaction trail" },
      "quick-actions":   { title: "Quick Action Shortcuts",      subtitle: "ERP navigation triggers" },
      "weather-calendar":{ title: "Logistics Weather & Calendar",subtitle: "Scheduled events & conditions" },
      "top-salesman":    { title: "Top Sales Performers",        subtitle: "Leaderboard of top salesmen" },
      "top-customer":    { title: "Top Customer Revenue",        subtitle: "Purchases leader board ranking" },
    };

    const meta = META[id] ?? { title: "Widget", subtitle: "" };

    let content: React.ReactNode = null;
    switch (id) {
      case "rto-overview":    content = <RtoOverviewWidget layout={mockLayout} />; break;
      case "cylinder-aging":  content = <CylinderAgingWidget />; break;
      case "order-status":    content = <OrderStatusWidget layout={mockLayout} />; break;
      case "logistics-trips": content = <LogisticsTripsWidget />; break;
      case "inventory-stock": content = <InventoryStockWidget />; break;
      case "low-stock-alert": content = <LowStockAlertWidget />; break;
      case "receivables":     content = <ReceivablesWidget layout={mockLayout} />; break;
      case "activity-feed":   content = <ActivityFeedWidget />; break;
      case "quick-actions":   content = <QuickActionsWidget layout={mockLayout} />; break;
      case "weather-calendar":content = <WeatherCalendarWidget layout={mockLayout} />; break;
      case "top-salesman":    content = <TopSalesmanWidget />; break;
      case "top-customer":    content = <TopCustomerWidget />; break;
      default: return null;
    }

    // Wrap in WidgetContainer so the header/title bar is also visible in the preview
    return (
      <div className="flex flex-col h-full">
        <WidgetContainer
          layout={mockLayout}
          title={meta.title}
          subtitle={meta.subtitle}
          onHide={() => {}}
          onRefresh={() => {}}
        >
          {content}
        </WidgetContainer>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black backdrop-blur-xs cursor-pointer"
          />

          {/* Sliding Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl border-l border-border/80"
          >
            {/* Widget Hover Preview Overview Dialog */}
            {hoveredWidgetId && WIDGET_PREVIEWS[hoveredWidgetId] && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-5 absolute right-[calc(100%+12px)] top-5 w-[420px] bg-background/95 dark:bg-background/98 backdrop-blur-md rounded-sm shadow-2xl border border-border/80 text-left hidden lg:block"
              >
                {/* Top decorative stripe */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-blue-500  " />

                {/* Live full-size widget preview at top */}
                <div className="relative bg-card overflow-hidden  h-[280px] w-full pointer-events-none select-none">
                  <div
                    className="absolute origin-top-left"
                    style={{ transform: 'scale(0.6)', width: '166.67%', height: '166.67%' }}
                  >
                    {renderWidgetPreview(hoveredWidgetId)}
                  </div>
                </div>

                {/* Info section below preview */}
                <div className="p-4 space-y-3 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {WIDGET_PREVIEWS[hoveredWidgetId].category}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                      {WIDGET_PREVIEWS[hoveredWidgetId].gridSize}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-tight">
                      {WIDGET_CATEGORIES.flatMap(c => c.widgets).find(w => w.id === hoveredWidgetId)?.name || ""}
                    </h4>
                    <p className="text-[10px] text-muted-foreground/90 leading-relaxed font-medium">
                      {WIDGET_CATEGORIES.flatMap(c => c.widgets).find(w => w.id === hoveredWidgetId)?.description || ""}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block border-b border-border/40 pb-1">
                      Key Data & Features
                    </span>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-semibold">
                      {WIDGET_PREVIEWS[hoveredWidgetId].dataPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0 mt-1" />
                          <span className="leading-tight">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
              <div>
                <h2 className="text-base font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100">
                  Workspace Customizer
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  Select Visible widgets
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {WIDGET_CATEGORIES.map((catGroup) => (
                <div key={catGroup.category} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 border-b border-border/40 pb-1">
                    {catGroup.category}
                  </h3>
                  <div className="space-y-2">
                    {catGroup.widgets.map((widget) => {
                      const visible = isWidgetVisible(widget.id);
                      return (
                        <div
                          key={widget.id}
                          onClick={() => onToggleWidget(widget.id)}
                          onMouseEnter={() => setHoveredWidgetId(widget.id)}
                          onMouseLeave={() => setHoveredWidgetId(null)}
                          className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer select-none
                            ${
                              visible
                                ? "border-primary/30 bg-primary/5 hover:bg-primary/8 text-foreground"
                                : "border-border/60 hover:bg-muted/40 hover:border-border text-muted-foreground/80"
                            }`}
                        >
                          <div className="pt-0.5">
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors
                                ${
                                  visible
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/40 bg-transparent"
                                }`}
                            >
                              {visible && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold leading-tight">
                              {widget.name}
                            </h4>
                            <p className="text-[10px] text-muted-foreground/75 leading-relaxed">
                              {widget.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border/60 p-4 bg-muted/20 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
              Widgets auto-align and rearrange sequentially to fit your workspace.
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
