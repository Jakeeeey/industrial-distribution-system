// components/CustomerCylinderTurnaroundDrawer.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Slide-over detail drawer for Customer Cylinder Turnaround Ratio (CTR) Module.
// Displays customer profile, calculation math breakdown, underlying delivery & deposit orders,
// and change audit logs.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  User,
  Calculator,
  History,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { CTRGradeBadge } from "./CTRGradeBadge";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

export function CustomerCylinderTurnaroundDrawer() {
  const { selectedItem, setSelectedItem, auditLogs } = useCustomerCylinderTurnaround();

  if (!selectedItem) return null;

  return (
    <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-background text-foreground"
      >
        <SheetHeader className="p-5 border-b border-border/80 bg-card">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>{selectedItem.customerName}</span>
            </SheetTitle>
            <CTRGradeBadge grade={selectedItem.grade} />
          </div>
          <SheetDescription className="text-xs flex items-center gap-2 text-muted-foreground">
            <span className="font-mono">{selectedItem.customerCode}</span>
            <span>•</span>
            <span>{selectedItem.branchName}</span>
            <span>•</span>
            <span>Period: {selectedItem.periodLabel}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-border/70 bg-muted/30 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Annual Turns
              </p>
              <p className="text-lg font-bold text-foreground">
                {selectedItem.isBaseZero ? "N/A" : `${selectedItem.annualTurns}x`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Months / Turn
              </p>
              <p className="text-lg font-bold text-foreground">
                {selectedItem.isBaseZero ? "N/A" : `${selectedItem.monthsPerTurn} mos`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Total Incentive
              </p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                ₱{selectedItem.totalIncentiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <Tabs defaultValue="calculation" className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-9">
              <TabsTrigger value="calculation" className="text-xs gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                <span>Calculation</span>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Orders ({selectedItem.transactions.length})</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span>Audit Trail</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Calculation Math Breakdown */}
            <TabsContent value="calculation" className="space-y-4 pt-3">
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  Turnaround Formula Breakdown
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Accumulated Cylinder Base:</span>
                    <span className="font-mono font-semibold">{selectedItem.cylinderBase} units</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Repeat Order Quantity (RO):</span>
                    <span className="font-mono">{selectedItem.repeatOrderQty} units</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Deposit Cylinder Quantity:</span>
                    <span className="font-mono">{selectedItem.depositCylinderQty} units</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40 font-medium">
                    <span>Total Circulating Quantity (RO + Deposit):</span>
                    <span className="font-mono">{selectedItem.totalCirculatingQty} units</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Period Duration Covered:</span>
                    <span className="font-mono">{selectedItem.monthsCovered} month(s)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Annualizing Multiplier (12 / Months):</span>
                    <span className="font-mono">{(12 / selectedItem.monthsCovered).toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between py-1 pt-2 font-bold text-foreground">
                    <span>Calculated Annual Turns:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {selectedItem.isBaseZero ? "0 (Base Zero)" : `${selectedItem.annualTurns} turns/yr`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-foreground">
                    <span>Calculated Months per Turn (12 / Turns):</span>
                    <span className="font-mono text-foreground">
                      {selectedItem.isBaseZero ? "N/A" : `${selectedItem.monthsPerTurn} months`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Incentive Math */}
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Incentive Calculation Breakdown
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Assigned CTR Grade:</span>
                    <span className="font-semibold">{selectedItem.grade.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Eligible 11 kg Refills:</span>
                    <span className="font-mono">{selectedItem.eligibleRefill11kgQty} refills</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Eligible Kilograms (Qty × 11 kg):</span>
                    <span className="font-mono">{selectedItem.eligibleKilograms} kg</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Approved Rate per kg:</span>
                    <span className="font-mono">₱{selectedItem.incentiveRatePerKg}.00 / kg</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Equivalent per 11 kg Refill:</span>
                    <span className="font-mono">₱{selectedItem.incentivePerRefill}.00</span>
                  </div>
                  <div className="flex justify-between py-1 pt-2 font-bold text-foreground">
                    <span>Total Incentive Entitlement:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      ₱{selectedItem.totalIncentiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {selectedItem.isBaseZero && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Zero Cylinder Base Detected</p>
                    <p className="mt-0.5 text-muted-foreground">
                      This customer has recorded orders but zero registered cylinder accountability base. Please reconcile Customer Cylinder Accountability before processing payouts.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Underlying Transactions */}
            <TabsContent value="transactions" className="space-y-3 pt-3">
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs">Date & Doc #</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItem.transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                          No order documents recorded for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedItem.transactions.map((tx, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs py-2">
                            <div className="font-mono font-medium">{tx.docNo}</div>
                            <div className="text-[10px] text-muted-foreground">{tx.ts}</div>
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            <Badge variant="outline" className="text-[10px]">
                              {tx.docType.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-right py-2 font-semibold">
                            {tx.quantity} units
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 3: Audit Trail */}
            <TabsContent value="audit" className="space-y-3 pt-3">
              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {log.actionType.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(log.changedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      By {log.changedBy}
                    </p>
                    <p className="text-xs bg-muted/40 p-2 rounded border border-border/40 mt-1">
                      &ldquo;{log.reasonForChange}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
