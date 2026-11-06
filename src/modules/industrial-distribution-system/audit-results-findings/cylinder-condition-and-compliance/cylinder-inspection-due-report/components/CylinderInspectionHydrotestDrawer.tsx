// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestDrawer.tsx
// ==============================================================================
// Drawer Component for Cylinder Inspection and Hydrotest Due Report
// Slide-over inspection sheet presenting asset dossier, custody, inspection assessment,
// and chronological v_serial_movements timeline trace.
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  FileQuestion,
  History,
  Scale,
} from "lucide-react";
import type { CylinderInspectionRecord, MovementTracePoint } from "../types/cylinder-inspection-hydrotest.types";

export function CylinderInspectionHydrotestDrawer() {
  const { selectedRecord, setSelectedRecord } = useCylinderInspection();
  // Local state for on-demand lazy loading of serial movements trace
  const [movements, setMovements] = React.useState<MovementTracePoint[]>([]);
  const [isMovementsLoading, setIsMovementsLoading] = React.useState<boolean>(false);

  // Lazy-load movements trace only when a cylinder record is selected in drawer
  React.useEffect(() => {
    if (!selectedRecord?.serialNumber) {
      setMovements([]);
      return;
    }

    let isMounted = true;
    setIsMovementsLoading(true);

    fetch(`/api/ids/arf/cylinder-condition-and-compliance/cylinder-inspection-due-report?mode=movements&serialNumber=${encodeURIComponent(selectedRecord.serialNumber)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load movements");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setMovements(Array.isArray(data.movements) ? data.movements : []);
          setIsMovementsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load movements trace:", err);
        if (isMounted) {
          setMovements([]);
          setIsMovementsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRecord?.serialNumber]);

  if (!selectedRecord) return null;

  const renderStatusBadge = (status: CylinderInspectionRecord["complianceStatus"]) => {
    switch (status) {
      case "COMPLIANT":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            COMPLIANT
          </Badge>
        );
      case "DUE_SOON":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            DUE SOON
          </Badge>
        );
      case "OVERDUE":
        return (
          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-semibold gap-1">
            <AlertOctagon className="h-3.5 w-3.5" />
            OVERDUE
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold gap-1">
            <XCircle className="h-3.5 w-3.5" />
            FAILED / DEFECTIVE
          </Badge>
        );
      case "MISSING_CERT":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-semibold gap-1">
            <FileQuestion className="h-3.5 w-3.5" />
            MISSING CERT / UNKNOWN
          </Badge>
        );
    }
  };

  const renderConditionBadge = (cond: CylinderInspectionRecord["condition"]) => {
    switch (cond) {
      case "GOOD":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            GOOD
          </span>
        );
      case "FOR_REPAIR":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            FOR REPAIR
          </span>
        );
      case "DAMAGED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            DAMAGED
          </span>
        );
      case "SCRAP":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">
            SCRAP
          </span>
        );
    }
  };

  return (
    <Sheet open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="text-left space-y-2 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-muted text-foreground font-bold border border-border">
              {selectedRecord.serialNumber}
            </span>
            {renderStatusBadge(selectedRecord.complianceStatus)}
          </div>
          <SheetTitle className="text-lg font-bold text-foreground">
            {selectedRecord.productName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            SKU Code: {selectedRecord.productCode} • Asset ID #{selectedRecord.id}
          </SheetDescription>
        </SheetHeader>

        {/* Inspection & Hydrotest Assessment Section */}
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
            <Clock className="h-4 w-4 text-primary" />
            Inspection & Hydrotest Schedule
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Acquisition / Baseline:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord.acquisitionDate || "Not recorded"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Hydrotest Expiration:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord.expirationDate || "Missing / Unknown"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Days Remaining:</span>
              <span
                className={`font-bold ${
                  selectedRecord.daysRemaining === null
                    ? "text-purple-600"
                    : selectedRecord.daysRemaining < 0
                    ? "text-red-600"
                    : selectedRecord.daysRemaining <= 30
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {selectedRecord.daysRemaining === null
                  ? "Unknown (Unrecorded)"
                  : selectedRecord.daysRemaining < 0
                  ? `${Math.abs(selectedRecord.daysRemaining)} days overdue`
                  : `${selectedRecord.daysRemaining} days left`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Physical Condition:</span>
              <div className="mt-0.5">{renderConditionBadge(selectedRecord.condition)}</div>
            </div>
          </div>
        </div>

        {/* Custody and Location Section */}
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
            <MapPin className="h-4 w-4 text-primary" />
            Custody & Location Details
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Current Branch:</span>
              <span className="font-semibold text-foreground">{selectedRecord.branchName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Stock Status:</span>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {selectedRecord.status}
              </Badge>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground block">Custodian Entity:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord.custodianName} ({selectedRecord.custodianType}: {selectedRecord.custodianCode})
              </span>
            </div>
          </div>
        </div>

        {/* Technical Asset Dossier */}
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
            <Scale className="h-4 w-4 text-primary" />
            Asset Specifications & Notes
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Tare Weight:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord.tareWeight > 0 ? `${selectedRecord.tareWeight} kg` : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Decommission Status:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord.isRetired ? "RETIRED" : "ACTIVE FLEET"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground block">Inspector Remarks / Audit Notes:</span>
              <p className="font-normal text-muted-foreground mt-0.5 bg-muted/40 p-2 rounded border border-border/50 text-[11px] leading-relaxed">
                {selectedRecord.remarks}
              </p>
            </div>
          </div>
        </div>

        {/* Chronological Audit Movements Timeline Trace */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              <History className="h-4 w-4 text-primary" />
              Movement Ledger Trace (v_serial_movements)
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isMovementsLoading ? "Loading ledger..." : `${movements.length} events recorded`}
            </span>
          </div>

          {isMovementsLoading ? (
            <div className="p-6 rounded-lg border border-border bg-card/40 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Fetching chronological movements from audit ledger...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
              No historical movement ledger records found for serial {selectedRecord.serialNumber}.
            </div>
          ) : (
            <div className="space-y-2 relative border-l-2 border-border/80 ml-3 pl-4">
              {movements.map((event, idx) => (
                <div key={idx} className="relative group space-y-1 pb-3">
                  <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{event.docType}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {event.timestamp ? new Date(event.timestamp).toLocaleDateString("en-PH") : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-foreground font-medium">{event.docNo}</span>
                    <span>•</span>
                    <span>{event.branchName}</span>
                    <span>•</span>
                    <span className="text-foreground">{event.counterparty}</span>
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
