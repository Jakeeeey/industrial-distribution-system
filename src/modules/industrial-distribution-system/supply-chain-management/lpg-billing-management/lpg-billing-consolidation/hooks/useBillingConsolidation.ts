// ─── useBillingConsolidation.ts ───────────────────────────────────────────────
// Composer hook for the LPG Billing Consolidation module.
// Manages all module-level state: header list, selected workspace, loading,
// error, and reviewer action dispatchers.
// RULE: Zero business logic here. All compute lives in the service/API layer.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import type {
  ConsolidationHeader,
  ConsolidationTransaction,
  ConsolidationAuditEntry,
  ConsolidationHeaderListParams,
} from "../types/billing-consolidation.types";
import { toast } from "sonner";

const BASE_URL = "/api/ids/scm/lpg-billing-management/lpg-billing-consolidation";

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseBillingConsolidationReturn {
  // Header list state
  headers: ConsolidationHeader[];
  totalHeaders: number;
  isLoadingHeaders: boolean;
  headerError: string | null;
  headerParams: ConsolidationHeaderListParams;
  setHeaderParams: (params: Partial<ConsolidationHeaderListParams>) => void;
  loadHeaders: () => Promise<void>;

  // Selected workspace state
  selectedHeaderId: number | null;
  selectedHeader: ConsolidationHeader | null;
  transactions: ConsolidationTransaction[];
  isLoadingWorkspace: boolean;
  workspaceError: string | null;
  selectHeader: (id: number) => void;
  clearSelection: () => void;
  refreshWorkspace: () => Promise<void>;

  // Reviewer actions
  isSubmitting: boolean;
  adjustMeterReading: (payload: {
    transactionId: number;
    meterReadingId: number;
    new_current_reading: number;
    adjustment_reason: string;
  }) => Promise<boolean>;
  adjustWiwoDetail: (payload: {
    transactionId: number;
    wiwoDetailId: number;
    wiwoHeaderId: number;
    new_returned_gross_weight_kg: number;
    adjustment_reason: string;
  }) => Promise<boolean>;
  approveHeader: (headerId: number, pdfBase64?: string) => Promise<boolean>;

  // Audit trail
  auditEntries: ConsolidationAuditEntry[];
  isLoadingAudit: boolean;
  loadAuditTrail: (transactionId: number) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBillingConsolidation
 *
 * Composer hook that manages the full state tree for the LPG Billing
 * Consolidation reviewer module. Exposes:
 *  - Header list with pagination and filtering
 *  - Full workspace (selected header + enriched child transactions)
 *  - Reviewer action dispatchers (adjust, approve)
 *  - Audit trail loader for a specific transaction
 */
export function useBillingConsolidation(): UseBillingConsolidationReturn {
  // ── Header List State ─────────────────────────────────────────────────────
  const [headers, setHeaders] = useState<ConsolidationHeader[]>([]);
  const [totalHeaders, setTotalHeaders] = useState(0);
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerParams, setHeaderParamsState] = useState<ConsolidationHeaderListParams>({
    status: "ALL",
    page: 1,
    limit: 15,
  });

  // ── Workspace State ───────────────────────────────────────────────────────
  const [selectedHeaderId, setSelectedHeaderId] = useState<number | null>(null);
  const [selectedHeader, setSelectedHeader] = useState<ConsolidationHeader | null>(null);
  const [transactions, setTransactions] = useState<ConsolidationTransaction[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // ── Submission State ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Audit Trail State ─────────────────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState<ConsolidationAuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Ref to track the current selected header for refreshWorkspace closure stability
  const selectedHeaderIdRef = useRef<number | null>(null);

  // ── Header Param Setter ───────────────────────────────────────────────────

  const setHeaderParams = useCallback((params: Partial<ConsolidationHeaderListParams>) => {
    setHeaderParamsState((prev) => ({ ...prev, ...params }));
  }, []);

  // ── Load Headers ──────────────────────────────────────────────────────────

  /**
   * Fetches the paginated billing header list with current params.
   */
  const loadHeaders = useCallback(async () => {
    setIsLoadingHeaders(true);
    setHeaderError(null);
    try {
      const qs = new URLSearchParams({
        type: "headers",
        ...(headerParams.status && headerParams.status !== "ALL" ? { status: headerParams.status } : {}),
        ...(headerParams.search ? { search: headerParams.search } : {}),
        page: String(headerParams.page ?? 1),
        limit: String(headerParams.limit ?? 15),
      });

      const res = await fetch(`${BASE_URL}?${qs}`);
      if (!res.ok) throw new Error(`Failed to load headers (${res.status})`);
      const json = await res.json() as { data: ConsolidationHeader[]; total: number };
      setHeaders(json.data ?? []);
      setTotalHeaders(json.total ?? 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load billing headers.";
      setHeaderError(msg);
      toast.error("Load Error", { description: msg });
    } finally {
      setIsLoadingHeaders(false);
    }
  }, [headerParams]);

  // ── Load Workspace ────────────────────────────────────────────────────────

  /**
   * Fetches the full workspace for a selected header ID.
   * Stored in selectedHeader + transactions state.
   */
  const loadWorkspace = useCallback(async (headerId: number, silent = false) => {
    if (!silent) {
      setIsLoadingWorkspace(true);
      setTransactions([]);
    }
    setWorkspaceError(null);
    try {
      const res = await fetch(`${BASE_URL}?type=workspace&headerId=${headerId}`);
      if (!res.ok) throw new Error(`Failed to load workspace (${res.status})`);
      const json = await res.json() as {
        header: ConsolidationHeader | null;
        transactions: ConsolidationTransaction[];
      };
      setSelectedHeader(json.header);
      setTransactions(json.transactions ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load workspace.";
      setWorkspaceError(msg);
      toast.error("Workspace Error", { description: msg });
    } finally {
      if (!silent) {
        setIsLoadingWorkspace(false);
      }
    }
  }, []);

  // ── Select Header ─────────────────────────────────────────────────────────

  const selectHeader = useCallback((id: number) => {
    setSelectedHeaderId(id);
    selectedHeaderIdRef.current = id;
    setAuditEntries([]);
    loadWorkspace(id);
  }, [loadWorkspace]);

  const clearSelection = useCallback(() => {
    setSelectedHeaderId(null);
    selectedHeaderIdRef.current = null;
    setSelectedHeader(null);
    setTransactions([]);
    setWorkspaceError(null);
    setAuditEntries([]);
  }, []);

  /**
   * Refreshes the workspace with the currently selected header.
   * Call this after any reviewer adjustment to sync re-computed values.
   */
  const refreshWorkspace = useCallback(async () => {
    const id = selectedHeaderIdRef.current;
    if (!id) return;
    await loadWorkspace(id, true);
  }, [loadWorkspace]);

  // ── Reviewer Actions ──────────────────────────────────────────────────────

  /**
   * Submits a meter reading correction.
   * Returns true on success, false on failure.
   */
  const adjustMeterReading = useCallback(async (payload: {
    transactionId: number;
    meterReadingId: number;
    new_current_reading: number;
    adjustment_reason: string;
  }): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}?action=adjust-meter-reading`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Adjustment failed (${res.status})`);
      }
      toast.success("Meter Reading Adjusted", {
        description: "The reading has been corrected and values have been recomputed.",
      });
      await refreshWorkspace();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to adjust meter reading.";
      toast.error("Adjustment Failed", { description: msg });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [refreshWorkspace]);

  /**
   * Submits a WIWO cylinder weight correction.
   * Returns true on success, false on failure.
   */
  const adjustWiwoDetail = useCallback(async (payload: {
    transactionId: number;
    wiwoDetailId: number;
    wiwoHeaderId: number;
    new_returned_gross_weight_kg: number;
    adjustment_reason: string;
  }): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}?action=adjust-wiwo-detail`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Adjustment failed (${res.status})`);
      }
      toast.success("WIWO Weight Adjusted", {
        description: "Cylinder weight has been corrected and consumption has been recomputed.",
      });
      await refreshWorkspace();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to adjust WIWO detail.";
      toast.error("Adjustment Failed", { description: msg });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [refreshWorkspace]);

  /**
   * Approves the selected billing header (sets status → POSTED).
   * Returns true on success, false on failure.
   */
  const approveHeader = useCallback(async (headerId: number, pdfBase64?: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}?action=approve-header`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerId, pdfBase64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Approval failed (${res.status})`);
      }
      toast.success("Billing Header Approved", {
        description: "The billing header has been approved and is ready for invoice generation.",
      });
      await Promise.all([refreshWorkspace(), loadHeaders()]);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve billing header.";
      toast.error("Approval Failed", { description: msg });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [refreshWorkspace, loadHeaders]);

  // ── Audit Trail ───────────────────────────────────────────────────────────

  /**
   * Loads the audit trail entries for a specific child transaction.
   */
  const loadAuditTrail = useCallback(async (transactionId: number) => {
    setIsLoadingAudit(true);
    setAuditEntries([]);
    try {
      const res = await fetch(`${BASE_URL}?type=audit-trail&transactionId=${transactionId}`);
      if (!res.ok) throw new Error(`Failed to load audit trail (${res.status})`);
      const json = await res.json() as { data: ConsolidationAuditEntry[] };
      setAuditEntries(json.data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load audit trail.";
      toast.error("Audit Error", { description: msg });
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // Header list
    headers,
    totalHeaders,
    isLoadingHeaders,
    headerError,
    headerParams,
    setHeaderParams,
    loadHeaders,

    // Workspace
    selectedHeaderId,
    selectedHeader,
    transactions,
    isLoadingWorkspace,
    workspaceError,
    selectHeader,
    clearSelection,
    refreshWorkspace,

    // Actions
    isSubmitting,
    adjustMeterReading,
    adjustWiwoDetail,
    approveHeader,

    // Audit trail
    auditEntries,
    isLoadingAudit,
    loadAuditTrail,
  };
}
