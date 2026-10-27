// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityDrawer.tsx
// ==============================================================================
// Customer Drilldown Sheet Component
// Shows verified invoices, linked delivery dispatches, cylinder incidents,
// with a top summary KPI ribbon and table footer totals.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Truck,
  AlertOctagon,
  DollarSign,
  TrendingUp,
  Package,
} from "lucide-react";

export function CustomerProfitabilityDrawer() {
  const {
    selectedCustomerCode,
    drilldownDetails,
    isDrilldownLoading,
    closeDrilldown,
    startDate,
    endDate,
    branchId,
    branches,
  } = useCustomerProfitability();

  const isOpen = !!selectedCustomerCode;

  const activeBranchName =
    branchId === "all"
      ? "All Branches"
      : branches.find((b) => b.id === branchId)?.branch_name || "Assigned Branch";

  // Calculate cumulative summary totals across invoices, dispatches, and incidents
  const totals = React.useMemo(() => {
    if (!drilldownDetails) {
      return {
        totalNetSales: 0,
        totalCogs: 0,
        totalGrossMargin: 0,
        overallGrossMarginPercent: 0,
        totalAllocatedDelivery: 0,
        totalIncidentCost: 0,
        netContribution: 0,
        overallContributionPercent: 0,
      };
    }

    let netSales = 0;
    let cogs = 0;
    drilldownDetails.invoices.forEach((inv) => {
      netSales += inv.netAmount;
      cogs += inv.cogs;
    });

    const grossMargin = netSales - cogs;
    const grossMarginPercent = netSales > 0 ? (grossMargin / netSales) * 100 : 0;

    let delivery = 0;
    drilldownDetails.dispatches.forEach((dp) => {
      delivery += dp.allocatedCost;
    });

    let incidents = 0;
    drilldownDetails.incidents.forEach((inc) => {
      incidents += inc.cost;
    });

    const contribution = grossMargin - delivery - incidents;
    const contributionPercent = netSales > 0 ? (contribution / netSales) * 100 : 0;

    return {
      totalNetSales: Math.round(netSales * 100) / 100,
      totalCogs: Math.round(cogs * 100) / 100,
      totalGrossMargin: Math.round(grossMargin * 100) / 100,
      overallGrossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
      totalAllocatedDelivery: Math.round(delivery * 100) / 100,
      totalIncidentCost: Math.round(incidents * 100) / 100,
      netContribution: Math.round(contribution * 100) / 100,
      overallContributionPercent: Math.round(contributionPercent * 10) / 10,
    };
  }, [drilldownDetails]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrilldown()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6 space-y-6">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {selectedCustomerCode}
              </Badge>
              {startDate && endDate && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {activeBranchName} • {startDate} to {endDate}
                </Badge>
              )}
            </div>
            {drilldownDetails?.customer?.city && (
              <span className="text-xs text-muted-foreground">
                {drilldownDetails.customer.city}, {drilldownDetails.customer.province}
              </span>
            )}
          </div>
          <SheetTitle className="text-lg font-bold text-foreground">
            {drilldownDetails?.customer?.customerName || "Customer Breakdown"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Audit breakdown of revenue invoices, dispatch delivery allocations, and cylinder incidents for the filtered period.
          </SheetDescription>
        </SheetHeader>

        {isDrilldownLoading ? (
          <div className="space-y-4 py-8">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        ) : !drilldownDetails ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No drilldown records found for this account.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top Hero KPI Summary Ribbon for this Customer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
              {/* 1. Net Sales */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-blue-500" />
                  <span>Total Net Sales</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  ₱{totals.totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  COGS: ₱{totals.totalCogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* 2. Gross Margin */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span>Gross Margin</span>
                </div>
                <div
                  className={`text-sm font-bold ${
                    totals.totalGrossMargin >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  ₱{totals.totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {totals.overallGrossMarginPercent}% gross margin
                </div>
              </div>

              {/* 3. Delivery & Incidents */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3 text-amber-500" />
                  <span>Operating Costs</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  ₱{(totals.totalAllocatedDelivery + totals.totalIncidentCost).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Del: ₱{totals.totalAllocatedDelivery.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Inc: ₱{totals.totalIncidentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* 4. Net Contribution */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3 text-primary" />
                  <span>Contribution</span>
                </div>
                <div
                  className={`text-sm font-bold ${
                    totals.netContribution >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  ₱{totals.netContribution.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {totals.overallContributionPercent}% net contribution
                </div>
              </div>
            </div>

            {/* Drilldown Tabs */}
            <Tabs defaultValue="invoices" className="w-full space-y-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="invoices" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Invoices ({drilldownDetails.invoices.length})</span>
                </TabsTrigger>
                <TabsTrigger value="dispatches" className="text-xs gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  <span>Dispatches ({drilldownDetails.dispatches.length})</span>
                </TabsTrigger>
                <TabsTrigger value="incidents" className="text-xs gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  <span>Incidents ({drilldownDetails.incidents.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Verified Invoices with Total Summary Footer */}
              <TabsContent value="invoices" className="space-y-3">
                {drilldownDetails.invoices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    No verified invoices posted in this reporting period.
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5">Invoice #</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5 text-right">Net Sales</th>
                          <th className="p-2.5 text-right">COGS</th>
                          <th className="p-2.5 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {drilldownDetails.invoices.map((inv) => {
                          const isNegative = inv.margin < 0;
                          return (
                            <tr key={inv.invoiceId} className="hover:bg-muted/20">
                              <td className="p-2.5 font-medium">{inv.invoiceNo}</td>
                              <td className="p-2.5 text-muted-foreground">{inv.invoiceDate}</td>
                              <td className="p-2.5 text-right font-medium">₱{inv.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-2.5 text-right text-muted-foreground">₱{inv.cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-2.5 text-right font-semibold">
                                {isNegative ? (
                                  <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                    ₱{inv.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({inv.marginPercent}%)
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    ₱{inv.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({inv.marginPercent}%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Total Summary Footer */}
                      <tfoot className="bg-muted/70 font-semibold border-t-2 border-border">
                        <tr>
                          <td className="p-2.5 text-foreground" colSpan={2}>
                            Total ({drilldownDetails.invoices.length} Invoices)
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground">
                            ₱{totals.totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-bold text-muted-foreground">
                            ₱{totals.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td
                            className={`p-2.5 text-right font-bold ${
                              totals.totalGrossMargin >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            ₱{totals.totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totals.overallGrossMarginPercent}%)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: Dispatches & Delivery Costs with Total Summary Footer */}
              <TabsContent value="dispatches" className="space-y-3">
                {drilldownDetails.dispatches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    No delivery dispatch trips registered for this customer.
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5">Dispatch Doc</th>
                          <th className="p-2.5">Trip Date</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Allocated Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {drilldownDetails.dispatches.map((dp, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2.5 font-medium">{dp.docNo}</td>
                            <td className="p-2.5 text-muted-foreground">{dp.dispatchDate}</td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[10px]">{dp.tripStatus}</Badge>
                            </td>
                            <td className="p-2.5 text-right font-medium">₱{dp.allocatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Total Summary Footer */}
                      <tfoot className="bg-muted/70 font-semibold border-t-2 border-border">
                        <tr>
                          <td className="p-2.5 text-foreground" colSpan={3}>
                            Total ({drilldownDetails.dispatches.length} Trips)
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground">
                            ₱{totals.totalAllocatedDelivery.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: Cylinder Incidents with Total Summary Footer */}
              <TabsContent value="incidents" className="space-y-3">
                {drilldownDetails.incidents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    No damaged or lost cylinder incident expenses assigned to this account.
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5">Serial #</th>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Condition</th>
                          <th className="p-2.5 text-right">Asset Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {drilldownDetails.incidents.map((inc) => (
                          <tr key={inc.assetId} className="hover:bg-muted/20">
                            <td className="p-2.5 font-mono font-medium">{inc.serialNumber}</td>
                            <td className="p-2.5">{inc.productName}</td>
                            <td className="p-2.5">
                              <Badge
                                variant={inc.status === "LOST" ? "destructive" : "outline"}
                                className="text-[10px]"
                              >
                                {inc.status || inc.condition}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-medium text-red-600 dark:text-red-400">
                              ₱{inc.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Total Summary Footer */}
                      <tfoot className="bg-muted/70 font-semibold border-t-2 border-border">
                        <tr>
                          <td className="p-2.5 text-foreground" colSpan={3}>
                            Total ({drilldownDetails.incidents.length} Incidents)
                          </td>
                          <td className="p-2.5 text-right font-bold text-red-600 dark:text-red-400">
                            ₱{totals.totalIncidentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
