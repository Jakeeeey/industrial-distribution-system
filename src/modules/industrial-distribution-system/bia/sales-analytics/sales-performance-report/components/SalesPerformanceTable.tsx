// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceTable.tsx
// ==============================================================================
// Sales Performance Report - Data Table Component
// Displays paginated sales transactions, sortable columns, tax badges, and row selection.
// ==============================================================================

"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";
import { SalesPerformancePagination } from "./SalesPerformancePagination";

export function SalesPerformanceTable() {
  const { report, filters, setFilter, setSelectedRecord, isLoading } = useSalesPerformance();

  const handleSort = (column: "invoiceDate" | "netSales" | "kgSold" | "customerName" | "branchName") => {
    if (filters.sortBy === column) {
      setFilter("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc");
    } else {
      setFilter("sortBy", column);
      setFilter("sortOrder", "desc");
    }
  };

  const renderSortIcon = (column: "invoiceDate" | "netSales" | "kgSold" | "customerName" | "branchName") => {
    if (filters.sortBy !== column) return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
    return filters.sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />
    );
  };

  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead
                className="cursor-pointer select-none text-xs font-bold"
                onClick={() => handleSort("invoiceDate")}
              >
                Invoice Date {renderSortIcon("invoiceDate")}
              </TableHead>
              <TableHead className="text-xs font-bold">Doc / Ref No</TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-bold"
                onClick={() => handleSort("customerName")}
              >
                Customer Entity {renderSortIcon("customerName")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-bold"
                onClick={() => handleSort("branchName")}
              >
                Branch {renderSortIcon("branchName")}
              </TableHead>
              <TableHead className="text-xs font-bold">Product Description</TableHead>
              <TableHead className="text-right text-xs font-bold">Qty</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none text-xs font-bold"
                onClick={() => handleSort("kgSold")}
              >
                Gas Kg {renderSortIcon("kgSold")}
              </TableHead>
              <TableHead className="text-right text-xs font-bold">Gross</TableHead>
              <TableHead className="text-right text-xs font-bold">Deducted Credits</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none text-xs font-bold"
                onClick={() => handleSort("netSales")}
              >
                Net Sales {renderSortIcon("netSales")}
              </TableHead>
              <TableHead className="text-center text-xs font-bold">Tax Type</TableHead>
              <TableHead className="text-center text-xs font-bold w-12">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !report || report.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground text-xs">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Info className="h-5 w-5 text-muted-foreground/60" />
                    <span>No verified sales records found matching the active filters.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              report.records.map((r) => {
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors text-xs"
                    onClick={() => setSelectedRecord(r)}
                  >
                    {/* Invoice Date */}
                    <TableCell className="font-medium whitespace-nowrap text-muted-foreground">
                      {r.invoiceDate}
                    </TableCell>

                    {/* Invoice No & Order ID */}
                    <TableCell className="whitespace-nowrap">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        {r.invoiceNo}
                        {r.hasExceptions && (
                          <span title={r.exceptionReason || "Discrepancy detected"}>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block font-mono">
                        {r.orderId}
                      </span>
                    </TableCell>

                    {/* Customer */}
                    <TableCell className="max-w-[180px]">
                      <div className="font-medium truncate text-foreground" title={r.customerName}>
                        {r.customerName}
                      </div>
                      {r.storeName && (
                        <div className="text-[11px] text-muted-foreground truncate" title={r.storeName}>
                          {r.storeName}
                        </div>
                      )}
                    </TableCell>

                    {/* Branch */}
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium text-foreground">{r.branchName}</span>
                      <span className="text-muted-foreground text-[11px] ml-1">({r.branchCode})</span>
                    </TableCell>

                    {/* Product */}
                    <TableCell className="max-w-[200px]">
                      <div className="font-medium truncate text-foreground" title={r.productName}>
                        {r.productName}
                      </div>
                      {r.isSerialized ? (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                          Serialized ({r.productWeight}kg)
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Non-serialized</span>
                      )}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-right font-medium">{r.quantitySold}</TableCell>

                    {/* Kg Sold */}
                    <TableCell className="text-right whitespace-nowrap">
                      {r.kgSold > 0 ? (
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          {r.kgSold.toLocaleString()} kg
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Gross Amount */}
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(r.grossAmount)}
                    </TableCell>

                    {/* Deducted Credits */}
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      {r.creditAmount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          -{formatCurrency(r.creditAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Net Sales */}
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                      {formatCurrency(r.netSales)}
                    </TableCell>

                    {/* Tax Treatment */}
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 font-medium ${
                          r.taxTreatment === "VAT 12%"
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : "border-slate-500/30 text-slate-600 dark:text-slate-400 bg-slate-500/10"
                        }`}
                      >
                        {r.taxTreatment}
                      </Badge>
                    </TableCell>

                    {/* Action Eye */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(r);
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="View transaction drill-down"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <SalesPerformancePagination />
    </div>
  );
}
