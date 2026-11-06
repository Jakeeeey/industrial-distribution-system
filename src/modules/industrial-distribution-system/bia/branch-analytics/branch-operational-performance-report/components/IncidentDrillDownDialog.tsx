// components/IncidentDrillDownDialog.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Modal dialog to inspect an incident exception's underlying supporting records.
// Expanded to max-w-5xl with dedicated stat cards and clean layout so info is never cut off.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Clock, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";

export function IncidentDrillDownDialog() {
  const { selectedIncident, selectIncidentForDrillDown } =
    useBranchOperationalPerformanceReport();

  const isOpen = Boolean(selectedIncident);

  if (!selectedIncident) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && selectIncidentForDrillDown(null)}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-6 gap-4">
        {/* Modal Header */}
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                {selectedIncident.incidentNo} — Supporting Audit Trace
              </DialogTitle>
            </div>
            <Badge variant="outline" className="w-fit text-xs px-2.5 py-0.5 font-medium border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              {selectedIncident.incidentType.replace(/_/g, " ")}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Cylinder Serial: <span className="font-mono font-semibold text-foreground">{selectedIncident.serialNumber}</span> &bull; Product: <span className="font-medium text-foreground">{selectedIncident.productName}</span> ({selectedIncident.productCode})
          </DialogDescription>
        </DialogHeader>

        {/* 4 Summary Metadata Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">Current Custodian</span>
            <span className="text-xs font-bold text-foreground block truncate" title={selectedIncident.custodianName}>
              {selectedIncident.custodianName}
            </span>
            <span className="text-[10px] text-muted-foreground block">{selectedIncident.custodianType}</span>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">Assessed Value</span>
            <span className="text-xs font-bold text-foreground tabular-nums block">
              PHP {selectedIncident.assessedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-muted-foreground block">Replacement Valuation</span>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">Recovery Status</span>
            <span className="text-xs font-bold text-foreground block">
              {selectedIncident.recoveryStatus.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              {selectedIncident.daysOutstanding} days outstanding
            </span>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">Charge Status</span>
            <span className="text-xs font-bold text-foreground block">
              {selectedIncident.chargeStatus}
            </span>
            <span className="text-[10px] text-muted-foreground block">Origin Ref: {selectedIncident.documentRef}</span>
          </div>
        </div>

        {/* Movement Trace Table */}
        <div className="flex-1 min-h-0 flex flex-col pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-2.5 text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>Cylinder Movement & Custody Ledger</span>
          </div>

          <ScrollArea className="h-64 sm:h-72 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="text-xs">
                  <TableHead className="w-48 font-semibold">Timestamp</TableHead>
                  <TableHead className="w-44 font-semibold">Document No</TableHead>
                  <TableHead className="font-semibold">Document Type</TableHead>
                  <TableHead className="font-semibold">Branch Handling</TableHead>
                  <TableHead className="w-24 text-right font-semibold">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedIncident.movementsTrace && selectedIncident.movementsTrace.length > 0 ? (
                  selectedIncident.movementsTrace.map((trace, idx) => (
                    <TableRow key={idx} className="text-xs hover:bg-muted/20">
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {trace.timestamp ? new Date(trace.timestamp).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {trace.docNo}
                      </TableCell>
                      <TableCell>{trace.docType}</TableCell>
                      <TableCell>{trace.branchName}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {trace.quantity}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                      No prior serial movements logged in the current reporting cutoff window.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
