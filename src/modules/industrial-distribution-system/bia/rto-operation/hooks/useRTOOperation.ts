// hooks/useRTOOperation.ts
// ──────────────────────────────────────────────────────────────────────────────
// Thin consumer hook — re-exports the context hook for consistent import style.
// Pattern mirrors: useCustomerCylinderAging → CustomerCylinderAgingProvider
// ──────────────────────────────────────────────────────────────────────────────

export { useRTOOperationCtx as useRTOOperation } from "../providers/RTOOperationProvider";
