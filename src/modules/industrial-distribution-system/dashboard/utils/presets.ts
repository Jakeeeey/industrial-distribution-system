// src/modules/industrial-distribution-system/dashboard/utils/presets.ts
// NOTE: All x, y, w, h values MUST be whole integers.
// CSS Grid requires integer grid-line indices — fractional values (e.g. 11.5, 3.5) are invalid.
// Row height is set to 60px on the grid container (ROW_HEIGHT in DashboardModule.tsx).
// Each widget height h is expressed in 60px increments.
// NOTE: "alerts-feed" has been removed since alerts are now permanently docked in the header notification sidebar drawer.
// NOTE: rto-overview uses h:3 (180px @ 60px/row) — was h:2 (160px @ 80px/row) in v4.

import { DashboardPreset, WidgetLayout } from "../types";

export const ALL_WIDGET_IDS = [
  "rto-overview",
  "cylinder-aging",
  "order-status",
  "sales-performance",
  "logistics-trips",
  "inventory-stock",
  "low-stock-alert",
  "receivables",
  "activity-feed",
  "quick-actions",
  "weather-calendar",
  "top-salesman",
  "top-customer",
] as const;

export const DEFAULT_LAYOUTS: Record<string, WidgetLayout[]> = {
  // ── Executive Summary ────────────────────────────────────────────────────────
  executive: [
    { id: "rto-overview",      x: 0, y: 0,  w: 12, h: 3,  visible: true  },
    { id: "order-status",      x: 0, y: 2,  w: 6,  h: 4,  visible: true  },
    { id: "sales-performance", x: 6, y: 2,  w: 6,  h: 4,  visible: true  },
    { id: "cylinder-aging",    x: 0, y: 6,  w: 6,  h: 4,  visible: true  },
    { id: "receivables",       x: 6, y: 6,  w: 6,  h: 4,  visible: true  },
    { id: "activity-feed",     x: 0, y: 10, w: 8,  h: 4,  visible: true  },
    { id: "quick-actions",     x: 8, y: 10, w: 4,  h: 4,  visible: true  },
    { id: "logistics-trips",   x: 0, y: 14, w: 6,  h: 4,  visible: false },
    { id: "inventory-stock",   x: 6, y: 14, w: 6,  h: 4,  visible: false },
    { id: "low-stock-alert",   x: 0, y: 18, w: 6,  h: 4,  visible: false },
    { id: "weather-calendar",  x: 6, y: 18, w: 6,  h: 4,  visible: false },
    { id: "top-salesman",      x: 0, y: 22, w: 6,  h: 4,  visible: false },
    { id: "top-customer",      x: 6, y: 22, w: 6,  h: 4,  visible: false },
  ],
  // ── Sales Command ────────────────────────────────────────────────────────────
  sales: [
    { id: "sales-performance", x: 0, y: 0,  w: 8,  h: 4,  visible: true  },
    { id: "quick-actions",     x: 8, y: 0,  w: 4,  h: 4,  visible: true  },
    { id: "order-status",      x: 0, y: 4,  w: 6,  h: 4,  visible: true  },
    { id: "activity-feed",     x: 6, y: 4,  w: 6,  h: 4,  visible: true  },
    { id: "receivables",       x: 0, y: 8,  w: 12, h: 5,  visible: true  },
    { id: "rto-overview",      x: 0, y: 13, w: 12, h: 3,  visible: false },
    { id: "cylinder-aging",    x: 0, y: 15, w: 6,  h: 4,  visible: false },
    { id: "logistics-trips",   x: 6, y: 15, w: 6,  h: 4,  visible: false },
    { id: "inventory-stock",   x: 0, y: 19, w: 6,  h: 4,  visible: false },
    { id: "low-stock-alert",   x: 6, y: 19, w: 6,  h: 4,  visible: false },
    { id: "weather-calendar",  x: 0, y: 23, w: 12, h: 4,  visible: false },
    { id: "top-salesman",      x: 0, y: 27, w: 6,  h: 4,  visible: true  },
    { id: "top-customer",      x: 6, y: 27, w: 6,  h: 4,  visible: true  },
  ],
  // ── Financial Exposure ───────────────────────────────────────────────────────
  finance: [
    { id: "receivables",       x: 0, y: 0,  w: 8,  h: 5,  visible: true  },
    { id: "sales-performance", x: 8, y: 0,  w: 4,  h: 5,  visible: true  },
    { id: "rto-overview",      x: 0, y: 5,  w: 12, h: 3,  visible: true  },
    { id: "activity-feed",     x: 0, y: 7,  w: 12, h: 4,  visible: true  },
    { id: "cylinder-aging",    x: 0, y: 11, w: 6,  h: 4,  visible: false },
    { id: "order-status",      x: 6, y: 11, w: 6,  h: 4,  visible: false },
    { id: "logistics-trips",   x: 0, y: 15, w: 6,  h: 4,  visible: false },
    { id: "inventory-stock",   x: 6, y: 15, w: 6,  h: 4,  visible: false },
    { id: "low-stock-alert",   x: 0, y: 19, w: 6,  h: 4,  visible: false },
    { id: "quick-actions",     x: 6, y: 19, w: 4,  h: 4,  visible: false },
    { id: "weather-calendar",  x: 0, y: 23, w: 12, h: 4,  visible: false },
    { id: "top-salesman",      x: 0, y: 27, w: 6,  h: 4,  visible: false },
    { id: "top-customer",      x: 6, y: 27, w: 6,  h: 4,  visible: false },
  ],
  // ── Logistics & SCM Operations ───────────────────────────────────────────────
  operations: [
    { id: "order-status",      x: 0, y: 0,  w: 6,  h: 4,  visible: true  },
    { id: "logistics-trips",   x: 6, y: 0,  w: 6,  h: 4,  visible: true  },
    { id: "inventory-stock",   x: 0, y: 4,  w: 6,  h: 4,  visible: true  },
    { id: "low-stock-alert",   x: 6, y: 4,  w: 6,  h: 4,  visible: true  },
    { id: "weather-calendar",  x: 0, y: 8,  w: 12, h: 4,  visible: true  },
    { id: "quick-actions",     x: 0, y: 12, w: 6,  h: 4,  visible: true  },
    { id: "activity-feed",     x: 6, y: 12, w: 6,  h: 4,  visible: true  },
    { id: "rto-overview",      x: 0, y: 16, w: 12, h: 3,  visible: false },
    { id: "cylinder-aging",    x: 0, y: 18, w: 6,  h: 4,  visible: false },
    { id: "sales-performance", x: 6, y: 18, w: 6,  h: 4,  visible: false },
    { id: "receivables",       x: 0, y: 22, w: 12, h: 5,  visible: false },
    { id: "top-salesman",      x: 0, y: 27, w: 6,  h: 4,  visible: false },
    { id: "top-customer",      x: 6, y: 27, w: 6,  h: 4,  visible: false },
  ],
  // ── Cylinder Recovery (RTO) ──────────────────────────────────────────────────
  rto: [
    { id: "rto-overview",      x: 0, y: 0,  w: 12, h: 3,  visible: true  },
    { id: "cylinder-aging",    x: 0, y: 2,  w: 7,  h: 5,  visible: true  },
    { id: "receivables",       x: 0, y: 7,  w: 8,  h: 5,  visible: true  },
    { id: "activity-feed",     x: 8, y: 7,  w: 4,  h: 5,  visible: true  },
    { id: "order-status",      x: 0, y: 12, w: 6,  h: 4,  visible: false },
    { id: "sales-performance", x: 6, y: 12, w: 6,  h: 4,  visible: false },
    { id: "logistics-trips",   x: 0, y: 16, w: 6,  h: 4,  visible: false },
    { id: "inventory-stock",   x: 6, y: 16, w: 6,  h: 4,  visible: false },
    { id: "low-stock-alert",   x: 0, y: 20, w: 6,  h: 4,  visible: false },
    { id: "quick-actions",     x: 6, y: 20, w: 4,  h: 4,  visible: false },
    { id: "weather-calendar",  x: 0, y: 24, w: 12, h: 4,  visible: false },
    { id: "top-salesman",      x: 0, y: 28, w: 6,  h: 4,  visible: false },
    { id: "top-customer",      x: 6, y: 28, w: 6,  h: 4,  visible: false },
  ],
  // ── Personal Workspace ───────────────────────────────────────────────────────
  personal: [
    { id: "quick-actions",     x: 0, y: 0,  w: 6,  h: 4,  visible: true  },
    { id: "weather-calendar",  x: 6, y: 0,  w: 6,  h: 4,  visible: true  },
    { id: "order-status",      x: 0, y: 4,  w: 12, h: 4,  visible: true  },
    { id: "activity-feed",     x: 0, y: 8,  w: 12, h: 5,  visible: true  },
    { id: "rto-overview",      x: 0, y: 13, w: 12, h: 3,  visible: false },
    { id: "cylinder-aging",    x: 0, y: 15, w: 6,  h: 4,  visible: false },
    { id: "sales-performance", x: 6, y: 15, w: 6,  h: 4,  visible: false },
    { id: "logistics-trips",   x: 0, y: 19, w: 6,  h: 4,  visible: false },
    { id: "inventory-stock",   x: 6, y: 19, w: 6,  h: 4,  visible: false },
    { id: "low-stock-alert",   x: 0, y: 23, w: 6,  h: 4,  visible: false },
    { id: "receivables",       x: 6, y: 23, w: 6,  h: 5,  visible: false },
    { id: "top-salesman",      x: 0, y: 28, w: 6,  h: 4,  visible: false },
    { id: "top-customer",      x: 6, y: 28, w: 6,  h: 4,  visible: false },
  ],
};

export const PRESETS: DashboardPreset[] = [
  {
    id: "executive",
    name: "Executive Summary",
    description: "Key high-level operational status, cylinder balances, and visual aging statistics.",
    layouts: DEFAULT_LAYOUTS.executive,
  },
  {
    id: "sales",
    name: "Sales Command",
    description: "Designed for sales managers to track targets, orders, and customer activity.",
    layouts: DEFAULT_LAYOUTS.sales,
  },
  {
    id: "finance",
    name: "Financial Exposure & Receivables",
    description: "Prioritizes outstanding balances, credit alerts, and customer exposures.",
    layouts: DEFAULT_LAYOUTS.finance,
  },
  {
    id: "operations",
    name: "Logistics & SCM Operations",
    description: "Focuses on dispatch progress, picking performance, and inventory levels.",
    layouts: DEFAULT_LAYOUTS.operations,
  },
  {
    id: "rto",
    name: "Cylinder Recovery (RTO)",
    description: "For managing Returns-To-Outlet, cylinder aging, and high-risk customers.",
    layouts: DEFAULT_LAYOUTS.rto,
  },
  {
    id: "personal",
    name: "My Workspace",
    description: "A clean dashboard containing everyday utilities and action feeds.",
    layouts: DEFAULT_LAYOUTS.personal,
  },
];
