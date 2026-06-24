// services/index.ts
// Barrel re-export — UI and providers import from here, never from deep paths.
export {
  fetchCylinderAging,
  fetchCustomerCylinderAgingSummary,
  fetchCustomerCylinderDetail,
} from "./customer-cylinder-aging.repo";
export {
  resolveAgingBadgeVariant,
  resolveAgingTextClass,
  resolveActivityStatusVariant,
  resolveActionVariant,
  formatDaysWithCustomer,
  formatRecommendedAction,
  formatActivityStatus,
  formatAgingBasisSource,
  formatDate,
  resolveCustomerSegment,
} from "./customer-cylinder-aging.helpers";
