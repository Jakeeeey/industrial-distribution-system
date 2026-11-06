// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/hooks/useCylinderUtilizationReport.ts
// ==============================================================================
// Consumer hook for the Cylinder Utilization Report context.
//
// Components read state through this hook only — no local fetching, no local
// derivation of report figures — per the Logic Layering Standard. The hook is a
// thin bridge so a component import path never has to reach into the provider.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import { useCylinderUtilizationReportContext } from "../providers/CylinderUtilizationReportProvider";

export function useCylinderUtilizationReport() {
  return useCylinderUtilizationReportContext();
}
