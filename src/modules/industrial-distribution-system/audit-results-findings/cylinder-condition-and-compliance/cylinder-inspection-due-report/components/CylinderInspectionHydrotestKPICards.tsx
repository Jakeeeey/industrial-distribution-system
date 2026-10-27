// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestKPICards.tsx
// ==============================================================================
// Executive KPI Summary Cards for Cylinder Inspection & Hydrotest Due Report
// Highlights Total Audited, Compliant, Due Soon, Overdue, Failed, and Missing Certs.
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  FileQuestion,
  Percent,
} from "lucide-react";

export function CylinderInspectionHydrotestKPICards() {
  const { report, isLoading } = useCylinderInspection();
  const kpis = report?.kpis;

  const cardItems = [
    {
      title: "Total Inspected",
      value: kpis?.totalAudited ?? 0,
      sub: "Active cylinder fleet",
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      title: "Compliant Cylinders",
      value: kpis?.compliantCount ?? 0,
      sub: "Valid hydrotest & certified",
      icon: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Due Soon",
      value: kpis?.dueSoonCount ?? 0,
      sub: "Re-test warning window",
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      title: "Overdue (Critical)",
      value: kpis?.overdueCount ?? 0,
      sub: "Expired hydrotest / safety risk",
      icon: AlertOctagon,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      title: "Failed / Defective",
      value: kpis?.failedCount ?? 0,
      sub: "Damaged / For Repair / Scrap",
      icon: XCircle,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      title: "Missing Cert / Unknown",
      value: kpis?.missingCertCount ?? 0,
      sub: "Unrecorded expiration date",
      icon: FileQuestion,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      title: "Compliance Rate",
      value: `${kpis?.complianceRate ?? 0}%`,
      sub: "Valid vs total active assets",
      icon: Percent,
      color: (kpis?.complianceRate ?? 0) >= 80 ? "text-emerald-500" : "text-amber-500",
      bg: (kpis?.complianceRate ?? 0) >= 80 ? "bg-emerald-500/10" : "bg-amber-500/10",
      border: (kpis?.complianceRate ?? 0) >= 80 ? "border-emerald-500/20" : "border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cardItems.map((item, idx) => {
        const IconComponent = item.icon;
        return (
          <Card key={idx} className={`border ${item.border} shadow-sm overflow-hidden`}>
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {item.title}
                </span>
                <div className={`p-1.5 rounded-md ${item.bg}`}>
                  <IconComponent className={`h-3.5 w-3.5 ${item.color}`} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {isLoading ? "—" : typeof item.value === "number" ? item.value.toLocaleString() : item.value}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
