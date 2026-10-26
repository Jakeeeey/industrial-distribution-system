// components/CylinderCirculationDetailDrawer.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Inspection Drawer / Sheet for individual cylinder trace.
// Displays full chronological timeline of events, highlights circulation breaks,
// and shows source document links.
// Optimized with smooth vertical scrolling across all movement events.
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
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";
import { CirculationStatusBadge } from "./CirculationStatusBadge";
import { Clock, AlertCircle } from "lucide-react";

export function CylinderCirculationDetailDrawer() {
  const { selectedCylinder, setSelectedCylinder } = useCylinderCirculationReport();

  const isOpen = Boolean(selectedCylinder);

  if (!selectedCylinder) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setSelectedCylinder(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-full max-h-screen overflow-hidden gap-0 bg-card border-l">
        {/* ── Fixed Drawer Header & Metrics Strip ── */}
        <div className="shrink-0 p-6 border-b bg-muted/20 space-y-3">
          <SheetHeader className="text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Cylinder Trace Inspection
              </span>
              <CirculationStatusBadge status={selectedCylinder.circulationStatus} />
            </div>
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <span className="font-mono">{selectedCylinder.serialNumber}</span>
              <Badge variant="secondary" className="font-normal text-xs">
                {selectedCylinder.productName}
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
              {selectedCylinder.breakDescription ||
                "Cylinder has maintained healthy sequential circulation without gaps."}
            </SheetDescription>
          </SheetHeader>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground block">Current Location</span>
              <span className="font-semibold truncate block">{selectedCylinder.currentBranchName}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Current Custody</span>
              <span className="font-semibold truncate block">
                {selectedCylinder.currentCustodianName}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Dwell in Status</span>
              <span className="font-semibold">{selectedCylinder.daysInCurrentStatus} days</span>
            </div>
          </div>
        </div>

        {/* ── Scrollable Chronological Event Timeline Area ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Physical Movement History ({selectedCylinder.movementsHistory.length} Events)
            </h3>
            <p className="text-xs text-muted-foreground">
              Sourced from verified physical events in timestamp order.
            </p>
          </div>

          {selectedCylinder.movementsHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
              No historical movement records found for this serial in the database view.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {selectedCylinder.movementsHistory.map((move, idx) => {
                const isOut = move.outQty === 1;
                const isBreak = move.isFlaggedBreak;

                return (
                  <div key={idx} className="relative group">
                    {/* Stepper Dot */}
                    <div
                      className={`absolute -left-6 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-background ${
                        isBreak
                          ? "border-rose-500 text-rose-500"
                          : isOut
                          ? "border-amber-500 text-amber-500"
                          : "border-emerald-500 text-emerald-500"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isBreak ? "bg-rose-500" : isOut ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                    </div>

                    {/* Event Content Card */}
                    <div
                      className={`p-3.5 rounded-lg border text-xs transition-colors shadow-2xs ${
                        isBreak
                          ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-foreground flex items-center gap-1.5">
                          {move.docType}
                          {isBreak && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              Anomaly
                            </Badge>
                          )}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {move.ts ? move.ts.replace("T", " ").substring(0, 16) : "—"}
                        </span>
                      </div>

                      {move.isFlaggedBreak && (
                        <div className="mt-2 p-2 rounded bg-rose-100/60 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-[11px] flex items-start gap-1.5 leading-snug">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{move.breakReason}</span>
                        </div>
                      )}

                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          <span className="block text-[10px] uppercase font-medium">Document</span>
                          <span className="text-foreground font-mono font-medium">{move.docNo}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-medium">Branch</span>
                          <span className="text-foreground font-medium">{move.branchName}</span>
                        </div>
                        {(move.customerName || move.customerCode) && (
                          <div className="col-span-2">
                            <span className="block text-[10px] uppercase font-medium">Customer</span>
                            <span className="text-foreground font-medium">
                              {move.customerName || move.customerCode}
                            </span>
                          </div>
                        )}
                        {move.supplierName && (
                          <div className="col-span-2">
                            <span className="block text-[10px] uppercase font-medium">Supplier</span>
                            <span className="text-foreground font-medium">{move.supplierName}</span>
                          </div>
                        )}
                      </div>

                      {move.dwellDays !== undefined && move.dwellDays > 0 && (
                        <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Stage Dwell</span>
                          <span className="font-semibold text-foreground">
                            {move.dwellDays} days elapsed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
