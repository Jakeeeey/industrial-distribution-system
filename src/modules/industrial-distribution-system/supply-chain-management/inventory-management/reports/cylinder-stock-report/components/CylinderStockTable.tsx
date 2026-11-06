// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockTable.tsx
// ==============================================================================
// Cylinder Stock Table
// Standard tabular view displaying cylinder serials, gas product SKU, variant state, condition & status.
// ==============================================================================

"use client";

import React from "react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ArrowUpDown } from "lucide-react";
import type { CylinderStockRecord, CylinderCondition } from "../types/cylinder-stock-report.types";

export function CylinderStockTable() {
  const { rows, isLoading, openDrawer, filters, updateFilter } = useCylinderStockReport();

  const handleSort = (field: string) => {
    if (filters.sortField === field) {
      updateFilter("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc");
    } else {
      updateFilter("sortField", field);
      updateFilter("sortOrder", "asc");
    }
  };

  const getConditionBadge = (condition: CylinderCondition) => {
    switch (condition) {
      case "GOOD":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200">GOOD</Badge>;
      case "FOR_REPAIR":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200">FOR REPAIR</Badge>;
      case "DAMAGED":
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200">DAMAGED</Badge>;
      case "SCRAP":
        return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border-slate-300">SCRAP</Badge>;
      default:
        return <Badge variant="outline">{condition}</Badge>;
    }
  };

  const getStatusBadge = (status: string, isAvailable: boolean) => {
    if (isAvailable) {
      return (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
          ● {status}
        </Badge>
      );
    }
    if (status === "WITH_CUSTOMER") {
      return (
        <Badge variant="outline" className="border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20">
          With Customer
        </Badge>
      );
    }
    if (status === "WITH_SUPPLIER") {
      return (
        <Badge variant="outline" className="border-purple-400 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
          With Supplier
        </Badge>
      );
    }
    if (["DAMAGED", "LOST", "RETIRED"].includes(status)) {
      return (
        <Badge variant="outline" className="border-rose-400 text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20">
          {status}
        </Badge>
      );
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[140px] cursor-pointer" onClick={() => handleSort("serialNumber")}>
              <div className="flex items-center gap-1">
                Serial #
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead className="min-w-[200px] cursor-pointer" onClick={() => handleSort("productName")}>
              <div className="flex items-center gap-1">
                Gas Product & SKU
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead className="w-[130px]">Variant State</TableHead>
            <TableHead className="w-[110px] text-right">Tare Weight</TableHead>
            <TableHead className="min-w-[150px] cursor-pointer" onClick={() => handleSort("branchName")}>
              <div className="flex items-center gap-1">
                Location
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead className="w-[110px]">Condition</TableHead>
            <TableHead className="w-[130px]">Stock Status</TableHead>
            <TableHead className="min-w-[150px]">Current Custodian</TableHead>
            <TableHead className="w-[90px] text-center">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(9)].map((_, j) => (
                  <TableCell key={j} className="py-4">
                    <div className="h-4 bg-muted/60 animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                No cylinder records match the selected filters or snapshot cutoff.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row: CylinderStockRecord) => (
              <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                {/* Serial # */}
                <TableCell className="font-mono text-xs font-semibold">
                  <span className="text-foreground">{row.serialNumber}</span>
                </TableCell>

                {/* SKU */}
                <TableCell>
                  <div className="font-medium text-xs text-foreground line-clamp-1">
                    {row.productName}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {row.productCode}
                  </div>
                </TableCell>

                {/* Variant State */}
                <TableCell>
                  <Badge variant="outline" className="text-[11px] font-mono uppercase bg-muted/40">
                    {row.variantState}
                  </Badge>
                </TableCell>

                {/* Tare Weight */}
                <TableCell className="text-right text-xs font-mono">
                  {row.tareWeight ? `${row.tareWeight} kg` : "—"}
                </TableCell>

                {/* Location */}
                <TableCell>
                  <div className="text-xs font-medium text-foreground">{row.branchName}</div>
                  <div className="text-[11px] text-muted-foreground">{row.branchCode}</div>
                </TableCell>

                {/* Condition */}
                <TableCell>{getConditionBadge(row.cylinderCondition)}</TableCell>

                {/* Status */}
                <TableCell>{getStatusBadge(row.cylinderStatus, row.isAvailableUsable)}</TableCell>

                {/* Custodian */}
                <TableCell>
                  <div className="text-xs text-foreground font-medium truncate max-w-[180px]">
                    {row.custodianName}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {row.custodianType}
                  </div>
                </TableCell>

                {/* Action */}
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDrawer(row)}
                    className="h-8 w-8 p-0"
                    title="View movements & details"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
