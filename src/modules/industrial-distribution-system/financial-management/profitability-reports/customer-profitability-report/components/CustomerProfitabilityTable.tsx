// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityTable.tsx
// ==============================================================================
// Paginated Customer Profitability Table with Multi-Column Sorting & Tier Badges
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { CustomerProfitabilityPagination } from "./CustomerProfitabilityPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  AlertTriangle,
  Building2,
} from "lucide-react";
import type { ProfitabilityTier } from "../types/customer-profitability.types";

function renderTierBadge(tier: ProfitabilityTier) {
  switch (tier) {
    case "HIGH":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
          High (≥25%)
        </Badge>
      );
    case "MODERATE":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-semibold">
          Moderate (10-25%)
        </Badge>
      );
    case "MARGINAL":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
          Marginal (0-10%)
        </Badge>
      );
    case "LOSS":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] font-semibold">
          Loss-Making (&lt;0%)
        </Badge>
      );
    case "INCOMPLETE":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-[10px] font-semibold">
          Incomplete
        </Badge>
      );
    default:
      return null;
  }
}

export function CustomerProfitabilityTable() {
  const { data, isLoading, sortBy, sortOrder, handleSort, openDrilldown } =
    useCustomerProfitability();

  const getSortIcon = (col: string) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort("customerName")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <span>Customer Account</span>
                  {getSortIcon("customerName")}
                </button>
              </th>
              <th className="py-3 px-3">Branch</th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("totalWeightKg")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Billed Volume</span>
                  {getSortIcon("totalWeightKg")}
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("netSales")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Net Sales</span>
                  {getSortIcon("netSales")}
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("gasCogs")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Gas COGS</span>
                  {getSortIcon("gasCogs")}
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("grossMargin")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Gross Margin</span>
                  {getSortIcon("grossMargin")}
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("allocatedDeliveryCost")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Delivery Cost</span>
                  {getSortIcon("allocatedDeliveryCost")}
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSort("contributionMargin")}
                  className="flex items-center gap-1 justify-end ml-auto hover:text-foreground"
                >
                  <span>Contribution</span>
                  {getSortIcon("contributionMargin")}
                </button>
              </th>
              <th className="py-3 px-3 text-center">Tier</th>
              <th className="py-3 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3 px-3">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2 w-20 bg-muted rounded mt-1.5" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-14 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-14 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 bg-muted rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="h-4 w-14 bg-muted rounded mx-auto" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="h-6 w-8 bg-muted rounded mx-auto" />
                  </td>
                </tr>
              ))
            ) : !data || data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-12 text-center text-muted-foreground text-xs"
                >
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No customer records found matching the active filters.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr
                  key={row.customerCode}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* Customer Column */}
                  <td className="py-3 px-3">
                    <div className="flex items-start gap-1.5">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{row.customerName}</span>
                          {row.hasDataWarning && (
                            <span
                              title={row.warningReasons.join(", ")}
                              className="text-amber-500 cursor-help"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.customerCode} • {row.storeName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                    {row.branchName}
                  </td>

                  {/* Billed Volume */}
                  <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-foreground">
                    {row.totalWeightKg.toLocaleString()} kg
                  </td>

                  {/* Net Sales */}
                  <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-foreground">
                    ₱{row.netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Gas COGS */}
                  <td className="py-3 px-3 text-right whitespace-nowrap text-muted-foreground">
                    ₱{row.gasCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Gross Margin */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        row.grossMargin >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ₱{row.grossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {row.grossMarginPercent}%
                    </div>
                  </td>

                  {/* Allocated Delivery Cost */}
                  <td className="py-3 px-3 text-right whitespace-nowrap text-muted-foreground">
                    ₱{row.allocatedDeliveryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Contribution Margin */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span
                      className={`font-bold ${
                        row.contributionMargin >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ₱{row.contributionMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {row.contributionMarginPercent}%
                    </div>
                  </td>

                  {/* Tier Badge */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {renderTierBadge(row.tier)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDrilldown(row.customerCode)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="View Customer Breakdown"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Embedded Standard Pagination */}
      <CustomerProfitabilityPagination />
    </div>
  );
}
