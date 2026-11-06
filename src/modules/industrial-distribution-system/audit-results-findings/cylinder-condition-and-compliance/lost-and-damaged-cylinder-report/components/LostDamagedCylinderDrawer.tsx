// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderDrawer.tsx
// ==============================================================================
// Drawer Component for Lost and Damaged Cylinder Report
// Slide-out panel showing incident breakdown, custody details, linked docs,
// and chronological movements history.
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ArrowRightCircle,
  FileCheck2,
  Undo2,
  Database,
  History,
} from "lucide-react";

export function LostDamagedCylinderDrawer() {
  const { selectedIncident, setSelectedIncident } = useLostDamagedCylinder();

  if (!selectedIncident) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val);
  };

  return (
    <Sheet open={Boolean(selectedIncident)} onOpenChange={(open) => !open && setSelectedIncident(null)}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="text-left space-y-2 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  selectedIncident.incidentCategory === "LOST"
                    ? "bg-red-500/10 text-red-600 border-red-500/30 font-bold"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold"
                }
              >
                {selectedIncident.incidentCategory}
              </Badge>

              <Badge variant="secondary" className="font-semibold text-xs">
                {selectedIncident.condition}
              </Badge>
            </div>

            <span className="text-xs text-muted-foreground font-mono font-medium">
              {selectedIncident.incidentNo}
            </span>
          </div>

          <div>
            <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
              Serial: {selectedIncident.serialNumber}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              {selectedIncident.productName} ({selectedIncident.productCode}) · {selectedIncident.tareWeight} kg Tare
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Section 1: Financial & Lifecycle Overview */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-muted/40 border border-border">
          <div>
            <span className="text-[11px] text-muted-foreground">Assessed Loss Value</span>
            <div className="text-sm font-bold text-foreground flex items-center gap-1 mt-0.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              {formatCurrency(selectedIncident.assessedValue)}
            </div>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground">Lifecycle Status</span>
            <div className="text-xs font-semibold text-foreground mt-1">
              <Badge variant="outline" className="text-[11px] bg-background">
                {selectedIncident.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground">Physical Condition</span>
            <div className="text-xs font-medium text-foreground mt-0.5">
              {selectedIncident.condition}
            </div>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground">Custodian Charge Status</span>
            <div className="text-xs font-medium text-foreground mt-0.5">
              {selectedIncident.chargeStatus}
            </div>
          </div>
        </div>

        {/* Section 2: Custody & Location */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custody & Location
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2.5 text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{selectedIncident.custodianName}</span>
                <span className="text-muted-foreground ml-1">
                  ({selectedIncident.custodianType} · Code: {selectedIncident.custodianCode})
                </span>
                <div className="text-muted-foreground text-[11px] mt-0.5">
                  Operating Branch: {selectedIncident.branchName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground pt-1">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Incident Date: {selectedIncident.incidentDate}</span>
              <span className="flex items-center gap-1 ml-2 text-amber-600 dark:text-amber-400 font-medium">
                <Clock className="h-3.5 w-3.5" /> {selectedIncident.daysOutstanding} days outstanding
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 3: Linked Supporting Documents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Supporting Documents
            </h4>
            <span className="text-[10px] text-muted-foreground">Audit Verified</span>
          </div>

          <div className="space-y-2">
            {/* Primary Asset Master */}
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border text-xs bg-card">
              <div className="flex items-center gap-2 text-foreground">
                <Database className="h-4 w-4 text-primary shrink-0" />
                <span>Primary Cylinder Asset Reference</span>
              </div>
              <span className="font-mono font-medium text-foreground">ASSET #{selectedIncident.id}</span>
            </div>

            {/* Approved Write-Off Document */}
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border text-xs bg-card">
              <div className="flex items-center gap-2 text-foreground">
                <FileCheck2 className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Management Write-Off Authorization</span>
              </div>
              <span className="font-mono font-medium text-foreground">
                {selectedIncident.writeOffDocNo ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {selectedIncident.writeOffDocNo}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">None (Unapproved)</span>
                )}
              </span>
            </div>

            {/* Customer Return / Recovery Slip */}
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border text-xs bg-card">
              <div className="flex items-center gap-2 text-foreground">
                <Undo2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Customer Return / Pull-Out Slip</span>
              </div>
              <span className="font-mono font-medium text-foreground">
                {selectedIncident.recoveryDocNo ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {selectedIncident.recoveryDocNo}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">None (Unreturned)</span>
                )}
              </span>
            </div>

            {/* Origin Document Reference */}
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border text-xs bg-card">
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span>Last Custody Document Ref</span>
              </div>
              <span className="font-mono font-medium text-foreground">{selectedIncident.supportingDocNo}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 4: Movements Trace Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span>Ledger Movements Trace ({selectedIncident.movementsTrace.length})</span>
            </h4>
          </div>

          {selectedIncident.movementsTrace.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              No historical serial movements logged in Spring ledger for this cylinder.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedIncident.movementsTrace.map((move, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-xs p-2 rounded border border-border bg-muted/20"
                >
                  <ArrowRightCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground truncate">{move.docType}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{move.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Doc: <span className="font-mono font-medium text-foreground">{move.docNo}</span> · Branch:{" "}
                      {move.branchName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
