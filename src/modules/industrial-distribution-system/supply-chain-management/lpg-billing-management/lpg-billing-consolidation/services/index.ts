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
