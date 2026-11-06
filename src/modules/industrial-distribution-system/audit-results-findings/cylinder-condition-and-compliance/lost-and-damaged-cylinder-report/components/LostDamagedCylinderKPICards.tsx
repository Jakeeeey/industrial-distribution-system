// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderKPICards.tsx
// ==============================================================================
// KPI Cards Component for Lost and Damaged Cylinder Report
// Displays vibrant metric cards adapted for Light and Dark themes.
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import { Card } from "@/components/ui/card";
import { AlertCircle, Wrench, ShieldCheck, DollarSign } from "lucide-react";

export function LostDamagedCylinderKPICards() {
  const { report, isLoading } = useLostDamagedCylinder();
  const kpis = report?.kpis;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: "Total Incidents",
      value: kpis?.totalIncidents ?? 0,
      subText: `${kpis?.lostCount ?? 0} Lost · ${kpis?.damagedCount ?? 0} Damaged`,
      icon: AlertCircle,
      gradient: "from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
    {
      title: "Total Assessed Loss",
      value: formatCurrency(kpis?.totalLossValue ?? 0),
      subText: `${kpis?.writtenOffCount ?? 0} Write-offs Approved`,
      icon: DollarSign,
      gradient: "from-red-500/10 via-red-500/5 to-transparent border-red-500/20 text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    },
    {
      title: "Recovered Assets",
      value: kpis?.recoveredCount ?? 0,
      subText: `${kpis?.recoveryRate ?? 0}% Recovery Rate (${formatCurrency(kpis?.recoveredValue ?? 0)})`,
      icon: ShieldCheck,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    },
    {
      title: "Unsettled Charges",
      value: formatCurrency(kpis?.unsettledChargesValue ?? 0),
      subText: "Pending Customer / Custodian Billing",
      icon: Wrench,
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className={`border bg-gradient-to-br shadow-sm transition-all duration-200 hover:shadow-md py-0 gap-0 ${card.gradient}`}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoading ? "—" : card.value}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{card.subText}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
