// =============================================================================
// Price Change Monitoring — Module Index
// Standard export contract per IDS architecture rules.
// Refactored from PriceMonitoring to PriceChangeMonitoring for nomenclature alignment.
// =============================================================================

// Default export: the module root component (used by page.tsx)
export { default } from "./PriceChangeMonitoringModule";
export { default as PriceChangeMonitoringModule } from "./PriceChangeMonitoringModule";

// Named type exports: consumed by parent modules or page.tsx if needed
export * from "./types";
