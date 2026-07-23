"use client";

import * as React from "react";

import { BranchPerformanceView } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/BranchPerformanceView";
import { CustomerPurchaseDetail } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerPurchaseDetail";
import { CustomerRankingView } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerRankingView";
import { CylinderPurchaseDashboardNav } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseDashboardNav";
import { CylinderPurchaseFilters } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseFilters";
import { CylinderPurchaseOverview } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseOverview";
import { CylinderPurchaseReportHeader } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader";
import { ProductPerformanceView } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ProductPerformanceView";
import { ReportErrorState } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReportErrorState";
import { ReturnAnalysisView } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReturnAnalysisView";
import { SalespersonPerformanceView } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPerformanceView";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import { CylinderPurchaseReportProvider } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers/CylinderPurchaseReportProvider";

function CylinderPurchaseReportContent(): React.ReactElement {
  const { report, activeView, isInitialLoading, error, refresh } =
    useCylinderPurchaseReport();

  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-500">
      <CylinderPurchaseReportHeader />
      <CylinderPurchaseFilters />
      {error ? (
        <ReportErrorState
          message={error}
          onRetry={refresh}
          variant={report ? "inline" : "full"}
        />
      ) : null}
      <CylinderPurchaseOverview
        report={report}
        isLoading={isInitialLoading}
      />
      <CylinderPurchaseDashboardNav />
      {activeView === "customers" ? <CustomerRankingView /> : null}
      {activeView === "products" ? <ProductPerformanceView /> : null}
      {activeView === "returns" ? <ReturnAnalysisView /> : null}
      {activeView === "branches" ? <BranchPerformanceView /> : null}
      {activeView === "salespeople" ? <SalespersonPerformanceView /> : null}
      <CustomerPurchaseDetail />
    </div>
  );
}

export default function CylinderPurchaseReportModule(): React.ReactElement {
  return (
    <CylinderPurchaseReportProvider>
      <CylinderPurchaseReportContent />
    </CylinderPurchaseReportProvider>
  );
}
