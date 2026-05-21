// index.ts
// Barrel export — import from one place:
//   import EWTModule from '@/modules/industrial-distribution-system/financial-management/reports/ewt'

// Main module
export { default } from "./EWTModule";

// Types
export type {
  RawEWTRow,
  EWTRecord,
  AggregatedEntry,
  EWTMetrics,
} from "./types";

// Utils
export {
  formatPeso,
  transformEWTRows,
  aggregateByCustomer,
  deriveMetrics,
  getPageNumbers,
} from "./utils";

// Hook
export { useEWT } from "./hooks/useEWT";

// Components
export { EWTBarChart } from "./components/EWTBarChart";
export { EWTPieChart } from "./components/EWTPieChart";
export { EWTRecordsTable } from "./components/EWTRecordsTable";
