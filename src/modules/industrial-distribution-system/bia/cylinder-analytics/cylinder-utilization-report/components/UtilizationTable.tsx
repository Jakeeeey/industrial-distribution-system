// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationTable.tsx
// ==============================================================================
// Results Grid for the Cylinder Utilization Report.
// Columns follow spec §11 — Branch, cylinder size, fleet, circulating, idle,
// maintenance, utilization — with the remaining mutually exclusive buckets shown so
// the counts on a row reconcile to its fleet figure.
//
// Every bucket count is a drill-down trigger: clicking "Idle" on a row opens the
// details panel already narrowed to that branch × size and bucket, which is the
// "review exceptions → open supporting documents" step of spec §5.
//
// Complies with VoSync Design System standards:
// - Skeleton rows while loading, contextual empty state with a reset action
// - Pagination is driven by the provider so the grid stays view-only
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  Building2,
  Layers,
} from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { formatCount, formatPercent } from "../services";
import { resolveUtilizationClass } from "./BucketBadge";
import type {
  CylinderUtilizationRow,
  UtilizationBucket,
  UtilizationSortField,
} from "../types/cylinder-utilization-report.types";

export function UtilizationTable() {
  const {
    visibleRows,
    filteredRows,
    totalRows,
    isLoading,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetFilters,
    openDetail,
    sortField,
    sortDirection,
    handleSort,
  } = useCylinderUtilizationReport();

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * pageSize;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
        <div className="border-b p-4">
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-12 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-2xs">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No cylinder fleet in scope</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          No serialized cylinder assets matched the selected branch, product and reporting period.
        </p>
        <button
          type="button"
          onClick={resetFilters}
          className="mt-4 rounded-lg bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          Reset Filter Parameters
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
      {/* ── Grid header / page size ───────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Fleet Utilization by Branch and Product ({formatCount(totalRows)} groupings)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortableTh
                field="branchName"
                label="Branch"
                title="Branch location where cylinders are assigned. Click to sort by branch name."
                align="left"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="sizeLabel"
                label="Product"
                title="Serialized cylinder product description. Click to sort by product description."
                align="left"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="fleet"
                label="Total"
                title="Total registered cylinder assets in this grouping. Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="eligibleFleet"
                label="Active"
                title="Active working cylinders (Total minus Scrap and Needs Review). Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="circulating"
                label="Circulating"
                title="Cylinders currently deployed with customers or loaded for delivery. Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="available"
                label="Available"
                title="Usable cylinders available in stock ready for deployment. Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="idle"
                label="Idle"
                title="Dormant cylinders in stock with no movement for more than 30 days. Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="maintenance"
                label="For Repair"
                title="Cylinders in stock tagged under repair or maintenance. Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="unavailable"
                label="Scrap"
                title="Unavailable cylinders permanently out of service (Status LOST/RETIRED or Condition SCRAP). Click to sort."
                align="right"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTh
                field="utilization"
                label="Utilization"
                title="Utilization Rate: Circulating ÷ Active × 100. Click to sort."
                align="center"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <th className="px-4 py-3 text-right" title="Actions and cylinder-level drill down">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {visibleRows.map((row) => {
              // Composite key: a grouping is uniquely identified by branch × size,
              // and either half can legitimately be null (unassigned / unmapped).
              const rowKey = `${row.branchId ?? "null"}::${row.productId ?? "null"}`;
              return (
                <tr key={rowKey} className="group cursor-pointer transition hover:bg-muted/30">
                  {/* 1. Branch */}
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span className="font-semibold text-foreground">{row.branchName}</span>
                    </div>
                  </td>

                  {/* 2. Cylinder size */}
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{row.sizeLabel}</div>
                    {row.productCode && (
                      <div className="font-mono text-[10px] text-muted-foreground">{row.productCode}</div>
                    )}
                  </td>

                  {/* 3. Fleet */}
                  <td className="px-3 py-3 text-right font-mono font-bold text-sm text-foreground">
                    {formatCount(row.fleet)}
                  </td>

                  {/* 4. Eligible denominator */}
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground" title="Fleet minus unavailable and unclassified">
                    {formatCount(row.eligibleFleet)}
                  </td>

                  {/* 5–8. Bucket drill-downs */}
                  <td className="px-3 py-3 text-right">
                    <BucketButton row={row} bucket="CIRCULATING" count={row.circulating} openDetail={openDetail} tone="text-emerald-600 dark:text-emerald-400" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <BucketButton row={row} bucket="AVAILABLE" count={row.available} openDetail={openDetail} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <BucketButton
                      row={row}
                      bucket="IDLE"
                      count={row.idle}
                      openDetail={openDetail}
                      tone={row.idle > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
                      title={`Average dormancy ${row.averageIdleDays === null ? "n/a" : `${row.averageIdleDays} days`} — idle rate ${formatPercent(row.idleRate)}`}
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <BucketButton
                      row={row}
                      bucket="MAINTENANCE"
                      count={row.maintenance}
                      openDetail={openDetail}
                      tone={row.maintenance > 0 ? "text-violet-600 dark:text-violet-400" : undefined}
                    />
                  </td>

                  {/* 9. Unavailable, with the §8 data-exception count folded underneath */}
                  <td className="px-3 py-3 text-right align-top">
                    <BucketButton row={row} bucket="UNAVAILABLE" count={row.unavailable} openDetail={openDetail} />
                    {row.unclassified > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(row, "UNCLASSIFIED");
                        }}
                        className="mt-0.5 block w-full text-right font-mono text-[10px] font-semibold text-destructive underline-offset-2 hover:underline"
                        title="Needs Review: Status missing or outside valid system options (Data Exception)"
                      >
                        {formatCount(row.unclassified)} Needs Review
                      </button>
                    )}
                  </td>

                  {/* 10. Utilization */}
                  <td className="px-3 py-3 text-center">
                    {/* The scale class sits on the wrapper so the value and its bar share one colour. */}
                    <div className={`inline-flex flex-col items-center gap-1 ${resolveUtilizationClass(row.utilization)}`}>
                      <span className="font-mono text-sm font-bold">{formatPercent(row.utilization)}</span>
                      <span className="block h-1 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-current opacity-70"
                          style={{ width: `${Math.min(100, Math.max(0, row.utilization))}%` }}
                        />
                      </span>
                    </div>
                  </td>

                  {/* 11. Actions */}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(row, null);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-2xs transition hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
                    >
                      <Eye className="h-3 w-3" />
                      <span>View Cylinders</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
          <span className="font-semibold text-foreground">{Math.min(startIndex + pageSize, totalRows)}</span> of{" "}
          <span className="font-semibold text-foreground">{formatCount(totalRows)}</span> groupings
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A bucket count that opens the details panel narrowed to that bucket.
 * Rendered as a button so a reviewer can go straight from a number to the serials
 * behind it; zero counts stay clickable because "why is this zero" is a real question.
 */
function BucketButton({
  row,
  bucket,
  count,
  openDetail,
  tone,
  title,
}: {
  row: CylinderUtilizationRow;
  bucket: UtilizationBucket;
  count: number;
  openDetail: (row: CylinderUtilizationRow, bucket?: UtilizationBucket | null) => void;
  tone?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openDetail(row, bucket);
      }}
      title={title ?? `Open the ${bucket.toLowerCase()} cylinders in this grouping`}
      className={`font-mono font-semibold underline-offset-2 transition hover:underline ${
        tone ?? "text-muted-foreground"
      }`}
    >
      {formatCount(count)}
    </button>
  );
}

/**
 * Sortable table header cell with hover state, directional indicator and accessibility title.
 */
function SortableTh({
  field,
  label,
  title,
  align = "left",
  currentSortField,
  currentSortDirection,
  onSort,
}: {
  field: UtilizationSortField;
  label: string;
  title: string;
  align?: "left" | "right" | "center";
  currentSortField: UtilizationSortField;
  currentSortDirection: "asc" | "desc";
  onSort: (field: UtilizationSortField) => void;
}) {
  const isActive = currentSortField === field;
  const justifyClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th
      title={title}
      className={`px-3 py-3 select-none ${field === "branchName" ? "pl-4" : ""} ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        title={title}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-foreground cursor-pointer ${justifyClass} ${
          isActive ? "text-primary font-bold" : "text-muted-foreground"
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          currentSortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3 text-primary shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40 shrink-0 hover:opacity-100" />
        )}
      </button>
    </th>
  );
}
