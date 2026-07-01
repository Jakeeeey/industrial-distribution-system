// ─── services/index.ts ────────────────────────────────────────────────────────
// Barrel file: re-exports all public service functions for clean imports.
// Callers (API routes) should import from this file, not the service directly.
// ─────────────────────────────────────────────────────────────────────────────

export {
  fetchConsolidationHeaders,
  fetchConsolidationWorkspace,
  fetchWiwoDetails,
  fetchAuditTrail,
  fetchAttachments,
  adjustMeterReading,
  adjustWiwoDetail,
  approveConsolidationHeader,
} from "./billing-consolidation.service";

// Adjusted: Re-exporting parameter and payload types for consumers of the service functions
export type {
  ConsolidationHeader,
  ConsolidationTransaction,
  ConsolidationWiwoHeader,
  ConsolidationMeterReading,
  ConsolidationAttachment,
  ConsolidationAuditEntry,
  ConsolidationHeaderListParams,
  MeterReadingAdjustPayload,
  WiwoDetailAdjustPayload,
  ApproveHeaderPayload,
  WiwoLineType,
} from "./billing-consolidation.service";
