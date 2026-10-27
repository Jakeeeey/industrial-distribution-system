// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/index.ts
// ==============================================================================
// Customer Profitability Report - Public Module Exports
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

export * from "./CustomerProfitabilityReportModule";
export * from "./types/customer-profitability.types";
export * from "./types/customer-profitability.schema";
export * from "./providers/CustomerProfitabilityProvider";
export * from "./services/customer-profitability.service";
export * from "./services/customer-profitability.aggregation";
export * from "./utils/generateCustomerProfitabilityPrintHtml";
export * from "./utils/exportCustomerProfitabilityCsv";
