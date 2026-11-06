// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/hooks/useCustomerCylinderAccountability.ts
// ==============================================================================
// Custom Hook for accessing Customer Cylinder Accountability context state.
// Complies with VoSync standards:
// - Clean consumer interface
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import { useCustomerCylinderAccountabilityContext } from "../providers/CustomerCylinderAccountabilityProvider";

export function useCustomerCylinderAccountability() {
  return useCustomerCylinderAccountabilityContext();
}
