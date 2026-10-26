// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderTable.tsx
// ==============================================================================
// Results Table Component for Lost and Damaged Cylinder Report
// Paginated table displaying incident entries with condition badges, assessed cost,
// status, and drawer drilldown trigger.
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LostDamagedCylinderPagination } from "./LostDamagedCylinderPagination";
import { Eye, ArrowUpDown } from "lucide-react";
import type { IncidentRecord } from "../types/lost-damaged-cylinder.types";

export function LostDamagedCylinderTable() {
  const { paginatedRows, isLoading, setSelectedIncident, filters, setFilters } =
    useLostDamagedCylinder();

  const handleSort = (field: string) => {
    if (filters.sortBy === field) {
      setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ sortBy: field, sortOrder: "desc" });
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val);
  };

  const renderCategoryBadge = (cat: IncidentRecord["incidentCategory"]) => {
    if (cat === "LOST") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20">
          LOST
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
        DAMAGED
      </span>
    );
  };

  const renderStatusBadge = (status: IncidentRecord["status"]) => {
    switch (status) {
      case "RECOVERED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
            Recovered
          </span>
        );
      case "WRITTEN_OFF":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
            Written Off
          </span>
        );
      case "VERIFIED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20">
            Verified
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/20">
            Reported
          </span>
        );
    }
  };

  const renderConditionBadge = (cond: IncidentRecord["condition"]) => {
    switch (cond) {
      case "DAMAGED":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Damaged</Badge>;
      case "SCRAP":
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">Scrap</Badge>;
      case "FOR_REPAIR":
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">For Repair</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Good</Badge>;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-24 text-[11px] font-semibold">Incident #</TableHead>
              <TableHead className="w-36 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => handleSort("serialNumber")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Serial Number
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-[11px] font-semibold">Product Description</TableHead>
              <TableHead className="text-[11px] font-semibold">Custodian / Branch</TableHead>
              <TableHead className="text-[11px] font-semibold">Category</TableHead>
              <TableHead className="text-[11px] font-semibold">Condition</TableHead>
              <TableHead className="text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => handleSort("assessedValue")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Assessed Value
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-[11px] font-semibold">Lifecycle</TableHead>
              <TableHead className="text-[11px] font-semibold">Charge Status</TableHead>
              <TableHead className="w-28 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => handleSort("incidentDate")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Date
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-16 text-right text-[11px] font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    <span>Loading incidents from ledger...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-xs text-muted-foreground">
                  No lost or damaged cylinder incidents found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedIncident(row)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.incidentNo}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-foreground">
                    {row.serialNumber}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{row.productName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.productCode} · {row.tareWeight} kg
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{row.custodianName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.custodianType} · {row.branchName}
                    </div>
                  </TableCell>
                  <TableCell>{renderCategoryBadge(row.incidentCategory)}</TableCell>
                  <TableCell>{renderConditionBadge(row.condition)}</TableCell>
                  <TableCell className="font-medium text-xs text-foreground">
                    {formatCurrency(row.assessedValue)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(row.status)}</TableCell>
                  <TableCell>
                    <span className="text-[11px] text-muted-foreground">{row.chargeStatus}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-foreground">{row.incidentDate}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.daysOutstanding}d ago
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIncident(row)}
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

      <LostDamagedCylinderPagination />
    </div>
  );
}
