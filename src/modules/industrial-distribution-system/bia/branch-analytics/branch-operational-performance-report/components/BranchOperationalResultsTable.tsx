// components/BranchOperationalResultsTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Paginated Results Table for Incidents/Exceptions with Search and Column Sorting.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { ArrowUpDown, Eye, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";
import { ReportTablePagination } from "./ReportTablePagination";
import type { IncidentRecord } from "../types/branch-operational-performance.types";

export function BranchOperationalResultsTable() {
  const { report, isLoading, selectIncidentForDrillDown } =
    useBranchOperationalPerformanceReport();

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortField, setSortField] = React.useState<keyof IncidentRecord>("incidentDate");
  const [sortAsc, setSortAsc] = React.useState(false);

  const incidents = React.useMemo(() => report?.incidents ?? [], [report?.incidents]);

  // Filter by search query
  const filteredIncidents = React.useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(
      (inc) =>
        inc.incidentNo.toLowerCase().includes(q) ||
        inc.serialNumber.toLowerCase().includes(q) ||
        inc.custodianName.toLowerCase().includes(q) ||
        inc.productName.toLowerCase().includes(q) ||
        inc.documentRef.toLowerCase().includes(q)
    );
  }, [incidents, search]);

  // Sort rows
  const sortedIncidents = React.useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      return sortAsc ? 1 : -1;
    });
  }, [filteredIncidents, sortField, sortAsc]);

  // Paginate
  const paginatedRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedIncidents.slice(start, start + pageSize);
  }, [sortedIncidents, page, pageSize]);

  const handleSort = (field: keyof IncidentRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getRecoveryBadge = (status: string) => {
    switch (status) {
      case "RECOVERED":
        return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300">Recovered</Badge>;
      case "PENDING_RECOVERY":
        return <Badge variant="outline" className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-300">Pending</Badge>;
      case "WRITTEN_OFF":
        return <Badge variant="outline" className="text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-300">Written Off</Badge>;
      default:
        return <Badge variant="outline" className="text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-300">In Custody</Badge>;
    }
  };

  const getChargeBadge = (status: string) => {
    switch (status) {
      case "CHARGED":
        return <Badge variant="outline" className="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300">Charged</Badge>;
      case "ASSESSED":
        return <Badge variant="outline" className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-300">Assessed</Badge>;
      case "WAIVED":
        return <Badge variant="outline" className="text-muted-foreground bg-muted/40 border-muted">Waived</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-300">Uncharged</Badge>;
    }
  };

  return (
    <Card className="border shadow-xs bg-card">
      <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Operational Exceptions & Incident Records
          </CardTitle>
          <CardDescription className="text-xs">
            Audit register of non-standard cylinder conditions, missing units, and charge valuations
          </CardDescription>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search incident, serial, custodian..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="text-xs">
                <TableHead onClick={() => handleSort("incidentNo")} className="cursor-pointer">
                  <div className="flex items-center gap-1 font-semibold">Incident <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("serialNumber")} className="cursor-pointer">
                  <div className="flex items-center gap-1 font-semibold">Cylinder Serial <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("custodianName")} className="cursor-pointer">
                  <div className="flex items-center gap-1 font-semibold">Custodian <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("incidentType")} className="cursor-pointer">
                  <div className="flex items-center gap-1 font-semibold">Type <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("assessedValue")} className="cursor-pointer text-right">
                  <div className="flex items-center justify-end gap-1 font-semibold">Assessed Value <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("recoveryStatus")} className="cursor-pointer text-center">
                  <div className="flex items-center justify-center gap-1 font-semibold">Recovery <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("chargeStatus")} className="cursor-pointer text-center">
                  <div className="flex items-center justify-center gap-1 font-semibold">Charge Status <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    Loading branch operational exceptions...
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No exceptions or incident records match the active filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((inc) => (
                  <TableRow key={inc.id} className="text-xs hover:bg-muted/20">
                    <TableCell className="font-semibold text-foreground">{inc.incidentNo}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-medium text-foreground">{inc.serialNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{inc.productName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{inc.custodianName}</div>
                      <div className="text-[10px] text-muted-foreground">{inc.custodianType}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground text-[11px]">
                        {inc.incidentType.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                      PHP {inc.assessedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">{getRecoveryBadge(inc.recoveryStatus)}</TableCell>
                    <TableCell className="text-center">{getChargeBadge(inc.chargeStatus)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectIncidentForDrillDown(inc)}
                        className="h-7 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Audit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ReportTablePagination
          page={page}
          pageSize={pageSize}
          totalRows={sortedIncidents.length}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </CardContent>
    </Card>
  );
}
