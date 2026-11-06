// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityKPICards.tsx
// ==============================================================================
// Metric Summary Ribbon: Net Sales, Gross Margin, Contribution Margin, Profitable Accounts
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { DollarSign, Percent, TrendingUp, Users, AlertCircle } from "lucide-react";

export function CustomerProfitabilityKPICards() {
  const { data, isLoading } = useCustomerProfitability();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border bg-card/40 animate-pulse p-4 flex flex-col justify-between"
          >
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="h-2.5 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const { kpis } = data;
  const isGrossLoss = kpis.totalGrossMargin < 0;
  const isContributionLoss = kpis.totalContributionMargin < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Net Sales */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>Total Net Sales</span>
          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            ₱{kpis.totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            COGS: ₱{kpis.totalGasCogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* 2. Total Gross Margin */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>Total Gross Margin</span>
          <div
            className={`p-1.5 rounded-md ${
              isGrossLoss ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            <Percent className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div
            className={`text-2xl font-bold tracking-tight ${
              isGrossLoss ? "text-red-600 dark:text-red-400" : "text-foreground"
            }`}
          >
            ₱{kpis.totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className={`text-xs font-medium mt-0.5 ${
              isGrossLoss ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {kpis.averageGrossMarginPercent}% Avg Gross Margin
          </div>
        </div>
      </div>

      {/* 3. Contribution Margin */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>Net Contribution Margin</span>
          <div
            className={`p-1.5 rounded-md ${
              isContributionLoss ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div
            className={`text-2xl font-bold tracking-tight ${
              isContributionLoss ? "text-red-600 dark:text-red-400" : "text-foreground"
            }`}
          >
            ₱{kpis.totalContributionMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Operating Costs: ₱{kpis.totalOperatingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* 4. Customer Classification Ratio */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>Profitable Accounts</span>
          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {kpis.profitableCustomersCount} <span className="text-sm font-normal text-muted-foreground">/ {kpis.totalCustomersCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-0.5">
            {kpis.lossMakingCustomersCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {kpis.lossMakingCustomersCount} loss-making
              </span>
            )}
            {kpis.incompleteDataCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" />
                {kpis.incompleteDataCount} warnings
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
