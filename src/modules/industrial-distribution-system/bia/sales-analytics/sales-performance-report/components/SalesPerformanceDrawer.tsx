// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceDrawer.tsx
// ==============================================================================
// Sales Performance Report - Detail Slide-out Drawer
// Shows individual transaction details, product quantities, tax breakdown, and audit basis.
// ==============================================================================

"use client";

import * as React from "react";
import {
  FileText,
  Calendar,
  Building2,
  User,
  Package,
  AlertTriangle,
  Receipt,
  Truck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";

export function SalesPerformanceDrawer() {
  const { selectedRecord, setSelectedRecord } = useSalesPerformance();

  const formatCurrency = (val?: number) =>
    `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isOpen = Boolean(selectedRecord);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setSelectedRecord(null)}>
      <SheetContent className="sm:max-w-md overflow-y-auto w-full p-6 space-y-6">
        {selectedRecord && (
          <>
            <SheetHeader className="text-left space-y-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedRecord.invoiceNo}
                </Badge>
                <Badge
                  className={`text-xs ${
                    selectedRecord.taxTreatment === "VAT 12%"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                  }`}
                >
                  {selectedRecord.taxTreatment}
                </Badge>
              </div>
              <SheetTitle className="text-lg font-bold text-foreground">
                Transaction Line Item
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Supporting document breakdown and tax recognition basis
              </SheetDescription>
            </SheetHeader>

            {/* Exception Warning If Present */}
            {selectedRecord.hasExceptions && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Data Exception</strong>
                  <span>{selectedRecord.exceptionReason || "Discrepancy detected in source transaction"}</span>
                </div>
              </div>
            )}

            {/* Document Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Document Details
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Sales Order No
                  </span>
                  <span className="font-semibold text-foreground">{selectedRecord.orderId}</span>
                </div>

                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Invoice Date
                  </span>
                  <span className="font-semibold text-foreground">{selectedRecord.invoiceDate}</span>
                </div>

                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Dispatch Date
                  </span>
                  <span className="font-semibold text-foreground">{selectedRecord.dispatchDate || "—"}</span>
                </div>

                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> Recognition Basis
                  </span>
                  <span className="font-semibold text-foreground">{selectedRecord.recognitionBasis}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Customer & Branch */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Entities & Authorized Branch
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-card">
                  <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Branch Location</span>
                    <strong className="text-foreground">{selectedRecord.branchName}</strong>
                    <span className="text-muted-foreground ml-1.5 font-mono">({selectedRecord.branchCode})</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-card">
                  <User className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Customer Entity</span>
                    <strong className="text-foreground">{selectedRecord.customerName}</strong>
                    {selectedRecord.storeName && (
                      <span className="text-muted-foreground text-[11px] block">{selectedRecord.storeName}</span>
                    )}
                    <span className="text-muted-foreground text-[11px] block font-mono">
                      Code: {selectedRecord.customerCode}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-card">
                  <User className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Assigned Salesman</span>
                    <strong className="text-foreground">{selectedRecord.salesmanName}</strong>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Product & Volume Calculation */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Product & Gas Volume Breakdown
              </h4>
              <div className="p-3 rounded-lg border bg-card space-y-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <strong className="text-foreground block truncate">{selectedRecord.productName}</strong>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Code: {selectedRecord.productCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Quantity</span>
                    <span className="font-bold text-foreground text-sm">{selectedRecord.quantitySold}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Unit Weight</span>
                    <span className="font-bold text-foreground text-sm">{selectedRecord.productWeight} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Kg Sold</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">
                      {selectedRecord.kgSold.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Financial Valuation & Deductions */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Financial Summary & Net Sales
              </h4>
              <div className="p-3 rounded-lg border bg-card space-y-2 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Gross Amount:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(selectedRecord.grossAmount)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Discount Applied:</span>
                  <span className="text-foreground">-{formatCurrency(selectedRecord.discountAmount)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Deducted Credits / Returns:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    -{formatCurrency(selectedRecord.creditAmount)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between py-1 text-sm font-bold">
                  <span className="text-foreground">Net Sales:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedRecord.netSales)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[11px] text-muted-foreground">
                  <span>VAT Component (12%):</span>
                  <span>{formatCurrency(selectedRecord.vatAmount)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
