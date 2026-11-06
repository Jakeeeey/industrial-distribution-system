// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/index.ts
// Barrel re-export — UI and providers import from here, never from deep paths.
export {
  fetchCylinderUtilizationReport,
  fetchCylinderUtilizationDetail,
  fetchUtilizationLookups,
} from "./cylinder-utilization.repo";
export { exportUtilizationToExcel } from "./cylinder-utilization.xlsx";
export { exportUtilizationToPdf } from "./cylinder-utilization.pdf";
export {
  BUCKET_LABELS,
  IDLE_THRESHOLD_DAYS,
  getRuleSnapshot,
  isEligibleBucket,
} from "./cylinder-utilization.rules";
export {
  formatCount,
  formatPercent,
  formatCutoffLabel,
} from "./cylinder-utilization.helpers";
