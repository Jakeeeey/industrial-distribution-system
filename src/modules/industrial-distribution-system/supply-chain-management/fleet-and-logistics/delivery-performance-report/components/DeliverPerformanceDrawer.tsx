// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceDrawer.tsx
// ==============================================================================
// Delivery Performance Report - Details Inspection Drawer
// Wide format (sm:max-w-xl md:max-w-2xl) with structured 2-column key-value cards,
// high-contrast badges, and clean spacing to avoid squished text.
// ==============================================================================

"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  User,
  Building,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  Navigation,
} from "lucide-react";
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";
import type { DeliveryFulfillmentStatus } from "../types/deliver-performance.types";

export function DeliverPerformanceDrawer() {
  const { selectedRecord, setSelectedRecord } = useDeliverPerformance();

  if (!selectedRecord) return null;

  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (status: DeliveryFulfillmentStatus) => {
    switch (status) {
      case "Fulfilled":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs py-0.5 px-2.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Fulfilled
          </Badge>
        );
      case "Fulfilled With Concerns":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs py-0.5 px-2.5"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            With Concerns
          </Badge>
        );
      case "Fulfilled With Returns":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs py-0.5 px-2.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            With Returns
          </Badge>
        );
      case "Not Fulfilled":
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-xs py-0.5 px-2.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Not Fulfilled
          </Badge>
        );
    }
  };

  return (
    <Sheet open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-4 sm:p-6 space-y-4"
      >
        {/* Header with Title and Status Badges */}
        <SheetHeader className="pb-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Delivery Details
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Waybill: <span className="font-mono font-semibold text-foreground">{selectedRecord.waybillNo}</span> | Invoice: <span className="font-mono font-semibold text-foreground">{selectedRecord.invoiceNo}</span>
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusBadge(selectedRecord.status)}
              {selectedRecord.isOnTime ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs"
                >
                  <Clock className="h-3 w-3" /> On-Time
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 text-xs"
                >
                  <Clock className="h-3 w-3" /> Delayed
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 text-xs">
          {/* 1. Schedule & Transit Overview (2-Column Grid) */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Schedule & Transit Overview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Dispatch Date & Time:</span>
                <span className="font-medium text-foreground">{selectedRecord.dispatchDate}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Recorded Arrival:</span>
                <span className="font-medium text-foreground">
                  {selectedRecord.arrivalDate || "In Transit / Not Recorded"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Total Distance:</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3 text-muted-foreground" />
                  {selectedRecord.totalDistance} km
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Quantity Dispatched:</span>
                <span className="font-bold text-foreground">{selectedRecord.totalQuantity} units / cylinders</span>
              </div>
            </div>
          </div>

          {/* 2. Customer & Branch (2-Column Grid) */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-primary" /> Destination & Branch Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Customer Name:</span>
                <span className="font-semibold text-foreground">{selectedRecord.customerName}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Customer Code:</span>
                <span className="font-mono text-xs font-medium text-muted-foreground">{selectedRecord.customerCode}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Originating Branch:</span>
                <span className="font-medium text-foreground">{selectedRecord.branchName}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Invoice Reference:</span>
                <span className="font-mono font-medium text-foreground">{selectedRecord.invoiceNo}</span>
              </div>
            </div>
          </div>

          {/* 3. Custodian & Verification */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Custodian & Audit Clearance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Driver / Custodian:</span>
                <span className="font-semibold text-foreground">{selectedRecord.driverName}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Post-Delivery Audit:</span>
                <span>
                  {selectedRecord.isCleared ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> Audit Cleared
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded text-[11px] border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-3 w-3" /> Pending Clearance
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Commercial & Invoiced Amounts */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" /> Invoiced Financials
            </h4>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] uppercase text-muted-foreground font-medium">Gross Amount</span>
                <p className="font-semibold text-foreground mt-0.5">{formatCurrency(selectedRecord.grossAmount)}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                <span className="text-[10px] uppercase text-rose-600 font-medium">Discount</span>
                <p className="font-semibold text-rose-600 mt-0.5">-{formatCurrency(selectedRecord.discountAmount)}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-primary/5 p-2">
                <span className="text-[10px] uppercase text-primary font-bold">Net Sales</span>
                <p className="font-bold text-primary mt-0.5">{formatCurrency(selectedRecord.netAmount)}</p>
              </div>
            </div>
          </div>

          {/* 5. Delivery Exception Remarks (Prominently Styled) */}
          {selectedRecord.remarks && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/30 p-3.5 shadow-2xs space-y-1.5">
              <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Delivery Exception / Incident Remarks
              </h4>
              <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap leading-relaxed pl-5">
                {selectedRecord.remarks}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
