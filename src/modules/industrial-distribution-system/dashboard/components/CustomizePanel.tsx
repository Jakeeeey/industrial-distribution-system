// src/modules/industrial-distribution-system/dashboard/components/CustomizePanel.tsx

"use client";

import React from "react";
import { WidgetLayout, WidgetId } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";


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
      {
        id: "sales-performance",
        name: "Monthly Revenue Tracker",
        description: "Target tracking comparison vs current monthly revenue.",
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
        id: "alerts-feed",
        name: "Critical Operations Alerts",
        description: "High priority alerts (credit limit breaches, inventory mismatches).",
      },
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
  const isWidgetVisible = (id: WidgetId): boolean => {
    return layouts.find((w) => w.id === id)?.visible ?? false;
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
            <div className="border-t border-border/60 p-4 bg-muted/20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              Drag & resize widgets freely on the dashboard.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
