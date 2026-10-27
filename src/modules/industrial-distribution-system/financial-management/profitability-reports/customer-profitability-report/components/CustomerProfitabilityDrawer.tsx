// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityDrawer.tsx
// ==============================================================================
// Customer Drilldown Sheet Component
// Shows verified invoices, linked delivery dispatches, and attributable cylinder incidents.
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
  Clock,
  MapPin,
  Calendar,
} from "lucide-react";

export function CustomerProfitabilityDrawer() {
  const {
    selectedCustomerCode,
    drilldownDetails,
    isDrilldownLoading,
    closeDrilldown,
  } = useCustomerProfitability();

  const isOpen = !!selectedCustomerCode;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrilldown()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6 space-y-6">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-mono">
              {selectedCustomerCode}
            </Badge>
          </div>
          <SheetTitle className="text-lg font-bold text-foreground">
            {drilldownDetails?.customer?.customerName || "Customer Breakdown"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Audit trail of revenue invoices, dispatch delivery allocations, and cylinder incidents.
          </SheetDescription>
        </SheetHeader>

        {isDrilldownLoading ? (
          <div className="space-y-4 py-8">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-28 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-44 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        ) : !drilldownDetails ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No drilldown records found for this account.
          </div>
        ) : (
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

            {/* TAB 1: Verified Invoices */}
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
                      {drilldownDetails.invoices.map((inv) => (
                        <tr key={inv.invoiceId} className="hover:bg-muted/20">
                          <td className="p-2.5 font-medium">{inv.invoiceNo}</td>
                          <td className="p-2.5 text-muted-foreground">{inv.invoiceDate}</td>
                          <td className="p-2.5 text-right font-medium">₱{inv.netAmount.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-muted-foreground">₱{inv.cogs.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            ₱{inv.margin.toLocaleString()} ({inv.marginPercent}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Dispatches & Delivery Costs */}
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
                          <td className="p-2.5 text-right font-medium">₱{dp.allocatedCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: Cylinder Incidents */}
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
                            <Badge variant="destructive" className="text-[10px]">{inc.condition}</Badge>
                          </td>
                          <td className="p-2.5 text-right font-medium text-red-600 dark:text-red-400">
                            ₱{inc.cost.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
