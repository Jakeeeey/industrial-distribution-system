// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestTable.tsx
// ==============================================================================
// Results Table Component for Cylinder Inspection and Hydrotest Due Report
// Sortable table with serial badges, conditions, expiration dates, days remaining,
// compliance pills, and drawer triggers.
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CylinderInspectionHydrotestPagination } from "./CylinderInspectionHydrotestPagination";
import {
  Eye,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  FileQuestion,
} from "lucide-react";
import type { CylinderInspectionRecord } from "../types/cylinder-inspection-hydrotest.types";

export function CylinderInspectionHydrotestTable() {
  const { paginatedRows, isLoading, setSelectedRecord, filters, setFilters } = useCylinderInspection();

  const handleSort = (field: string) => {
    if (filters.sortBy === field) {
      setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ sortBy: field, sortOrder: "asc" });
    }
  };

  const renderStatusBadge = (status: CylinderInspectionRecord["complianceStatus"]) => {
    switch (status) {
      case "COMPLIANT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            COMPLIANT
          </span>
        );
      case "DUE_SOON":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            DUE SOON
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20">
            <AlertOctagon className="h-3 w-3" />
            OVERDUE
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            FAILED
          </span>
        );
      case "MISSING_CERT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20">
            <FileQuestion className="h-3 w-3" />
            MISSING CERT
          </span>
        );
    }
  };

  const renderConditionBadge = (cond: CylinderInspectionRecord["condition"]) => {
    switch (cond) {
      case "GOOD":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            GOOD
          </span>
        );
      case "FOR_REPAIR":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            FOR REPAIR
          </span>
        );
      case "DAMAGED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-600 border border-rose-500/20">
            DAMAGED
          </span>
        );
      case "SCRAP":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">
            SCRAP
          </span>
        );
    }
  };

  // Use paginatedRows provided by in-memory pagination from provider
  const rows = paginatedRows;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("serialNumber")}
              >
                <div className="flex items-center gap-1">
                  <span>Serial Number</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("productName")}
              >
                <div className="flex items-center gap-1">
                  <span>Product / Gas</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Location / Custodian</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("condition")}
              >
                <div className="flex items-center gap-1">
                  <span>Condition</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("expirationDate")}
              >
                <div className="flex items-center gap-1">
                  <span>Test Due Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("daysRemaining")}
              >
                <div className="flex items-center gap-1">
                  <span>Days Left</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("complianceStatus")}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading cylinder inspection records...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center text-xs text-muted-foreground">
                  No cylinders found matching the current inspection and compliance filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors text-xs border-b border-border/50 cursor-pointer"
                  onClick={() => setSelectedRecord(row)}
                >
                  <TableCell className="font-mono font-medium text-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted text-[11px] font-bold border border-border">
                      {row.serialNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">{row.productName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {row.productCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.custodianName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.branchName} ({row.custodianType})
                    </div>
                  </TableCell>
                  <TableCell>{renderConditionBadge(row.condition)}</TableCell>
                  <TableCell className="font-mono">
                    {row.expirationDate ? (
                      <span className="text-foreground">{row.expirationDate}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unrecorded</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {row.daysRemaining === null ? (
                      <span className="text-purple-600 font-semibold">—</span>
                    ) : row.daysRemaining < 0 ? (
                      <span className="text-red-600 font-bold">
                        {Math.abs(row.daysRemaining)}d overdue
                      </span>
                    ) : row.daysRemaining <= 30 ? (
                      <span className="text-amber-600 font-semibold">{row.daysRemaining}d left</span>
                    ) : (
                      <span className="text-emerald-600">{row.daysRemaining}d left</span>
                    )}
                  </TableCell>
                  <TableCell>{renderStatusBadge(row.complianceStatus)}</TableCell>
                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRecord(row)}
                      className="h-7 w-7 p-0"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CylinderInspectionHydrotestPagination />
    </div>
  );
}
