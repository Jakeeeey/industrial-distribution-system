// src/modules/industrial-distribution-system/dashboard/types.ts

export type WidgetId =
  | "rto-overview"
  | "cylinder-aging"
  | "order-status"
  | "sales-performance"
  | "logistics-trips"
  | "inventory-stock"
  | "low-stock-alert"
  | "receivables"
  | "alerts-feed"
  | "activity-feed"
  | "quick-actions"
  | "weather-calendar";

export interface WidgetLayout {
  id: WidgetId;
  x: number; // grid columns (0-11)
  y: number; // grid rows
  w: number; // width in grid columns (1-12)
  h: number; // height in grid rows (minimum 1)
  visible: boolean;
  collapsed?: boolean;
  settings?: Record<string, unknown>;
}

export type PresetId =
  | "executive"
  | "sales"
  | "finance"
  | "operations"
  | "warehouse"
  | "logistics"
  | "rto"
  | "personal";

export interface DashboardPreset {
  id: PresetId;
  name: string;
  description: string;
  layouts: WidgetLayout[];
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface DashboardFilters {
  branchId: string; // "all" or ID
  dateRange: DateRange;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "success" | "warning" | "info" | "error";
  message: string;
  module: string;
}

export interface CriticalAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  category: "finance" | "rto" | "operations" | "inventory" | "system";
}
