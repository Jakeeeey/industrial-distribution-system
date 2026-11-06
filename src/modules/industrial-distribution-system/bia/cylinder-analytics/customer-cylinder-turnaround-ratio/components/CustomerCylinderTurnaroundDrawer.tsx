// components/CustomerCylinderTurnaroundDrawer.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Detail drawer panel for inspecting individual customer turnaround metrics,
// underlying transaction documents, formula calculation steps, and audit history.
// Displays contextual alerts for Zero Cylinder Base and Unmonitored Holding accounts.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
  Clock,
  Calculator,
  Receipt,
  History,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { CTRGradeBadge } from "./CTRGradeBadge";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

export function CustomerCylinderTurnaroundDrawer() {
  const { selectedItem, setSelectedItem, auditLogs } = useCustomerCylinderTurnaround();

  if (!selectedItem) return null;

  const isDormant = selectedItem.grade === "UNMONITORED" || (selectedItem.cylinderBase > 0 && selectedItem.totalCirculatingQty === 0);

  return (
    <Sheet open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-foreground">
              {selectedItem.customerName}
            </SheetTitle>
            <CTRGradeBadge grade={selectedItem.grade} />
          </div>
          <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="font-mono">{selectedItem.customerCode}</span>
            <span>•</span>
            <span>{selectedItem.branchName}</span>
            {selectedItem.storeName && (
              <>
                <span>•</span>
                <span>{selectedItem.storeName}</span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Quick High-Level Metrics Banner */}
        <div className="grid grid-cols-3 gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Cylinder Base
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {selectedItem.cylinderBase} units
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Circulating Qty
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {selectedItem.totalCirculatingQty} units
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Annual Turns
            </span>
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {selectedItem.isBaseZero ? "—" : `${selectedItem.annualTurns}x`}
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <div>
          <Tabs defaultValue="calculation" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-8.5">
              <TabsTrigger value="calculation" className="text-xs gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Calculation
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Transactions ({selectedItem.transactions.length})
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                Audit Trail
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
                      {selectedItem.isBaseZero
                        ? "0 (Base Zero)"
                        : isDormant
                        ? "0x (No Orders)"
                        : `${selectedItem.annualTurns} turns/yr`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-foreground">
                    <span>Calculated Months per Turn (12 / Turns):</span>
                    <span className="font-mono text-foreground">
                      {selectedItem.isBaseZero || isDormant ? "— (Dormant)" : `${selectedItem.monthsPerTurn} months`}
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

              {/* Warning for Unmonitored Holding */}
              {isDormant && !selectedItem.isBaseZero && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unmonitored Cylinder Holding</p>
                    <p className="mt-0.5 text-muted-foreground">
                      This customer currently holds {selectedItem.cylinderBase} cylinder(s) but has zero recorded repeat orders or deposits in this evaluation period. Marked as Unmonitored Holding rather than a cycle failure.
                    </p>
                  </div>
                </div>
              )}

              {selectedItem.isBaseZero && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
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
