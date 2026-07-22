"use client";

import * as React from "react";

import {
  CylinderPurchaseReportContext,
  type CylinderPurchaseReportContextValue,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers/CylinderPurchaseReportProvider";

export function useCylinderPurchaseReport(): CylinderPurchaseReportContextValue {
  const context = React.useContext(CylinderPurchaseReportContext);
  if (!context) {
    throw new Error(
      "useCylinderPurchaseReport must be used within CylinderPurchaseReportProvider.",
    );
  }
  return context;
}
