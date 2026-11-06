// components/CylinderCirculationTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Results table for Cylinder Circulation Report.
// Displays serialized inventory records, status badges, dwell time, and inspection actions.
// Features: Default sorting by latest cylinder first, interactive column sorting toggles.
// ──────────────────────────────────────────────────────────────────────────────

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";
import { CirculationStatusBadge } from "./CirculationStatusBadge";
import { ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { CylinderCirculationItem } from "../types/cylinder-circulation.types";

type SortField = "serialNumber" | "lastEvent" | "dwell" | "status";
type SortOrder = "asc" | "desc";

export function CylinderCirculationTable() {
  const { reportData, loading, setSelectedCylinder } = useCylinderCirculationReport();
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [sortField, setSortField] = React.useState<SortField>("lastEvent");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc"); // Default: Latest event first
  const pageSize = 15;

  const rawCylinders = React.useMemo(() => {
    return reportData?.cylinders || [];
  }, [reportData?.cylinders]);

  // Reset to first page when raw data length changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [rawCylinders.length]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Sort cylinders client-side if user changes sort toggles
  const sortedCylinders = React.useMemo(() => {
    const list = [...rawCylinders];
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "serialNumber") {
        comparison = a.serialNumber.localeCompare(b.serialNumber);
      } else if (sortField === "lastEvent") {
        const timeA = new Date(a.lastEventTimestamp).getTime();
        const timeB = new Date(b.lastEventTimestamp).getTime();
        comparison = timeA - timeB;
      } else if (sortField === "dwell") {
        comparison = a.daysInCurrentStatus - b.daysInCurrentStatus;
      } else if (sortField === "status") {
        comparison = a.circulationStatus.localeCompare(b.circulationStatus);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [rawCylinders, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedCylinders.length / pageSize) || 1;
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCylinders.slice(start, start + pageSize);
  }, [sortedCylinders, currentPage]);

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-4 space-y-3 shadow-2xs">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (sortedCylinders.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center shadow-2xs">
        <p className="text-base font-semibold text-foreground">No Cylinder Records Found</p>
        <p className="text-sm text-muted-foreground mt-1">
          No cylinder circulation items matched your current filter criteria.
        </p>
      </div>
    );
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary font-bold" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary font-bold" />
    );
  };

  return (
    <div className="bg-card border rounded-lg shadow-2xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              {/* Cylinder Serial Header */}
              <TableHead
                className="font-semibold text-xs cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSortToggle("serialNumber")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Cylinder Serial</span>
                  {renderSortIcon("serialNumber")}
                </div>
              </TableHead>

              <TableHead className="font-semibold text-xs">Gas Type</TableHead>
              <TableHead className="font-semibold text-xs">Current Branch</TableHead>
              <TableHead className="font-semibold text-xs">Current Custody</TableHead>

              {/* Last Verified Event Header (Default Sorted) */}
              <TableHead
                className="font-semibold text-xs cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSortToggle("lastEvent")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Verified Event</span>
                  {renderSortIcon("lastEvent")}
                </div>
              </TableHead>

              {/* Dwell Header */}
              <TableHead
                className="font-semibold text-xs cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSortToggle("dwell")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Dwell</span>
                  {renderSortIcon("dwell")}
                </div>
              </TableHead>

              {/* Status Header */}
              <TableHead
                className="font-semibold text-xs cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSortToggle("status")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Circulation Status</span>
                  {renderSortIcon("status")}
                </div>
              </TableHead>

              <TableHead className="text-right font-semibold text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item: CylinderCirculationItem) => (
              <TableRow
                key={item.id}
                className="hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => setSelectedCylinder(item)}
              >
                {/* Serial */}
                <TableCell className="font-medium text-xs py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground font-mono">{item.serialNumber}</span>
                  </div>
                </TableCell>

                {/* Gas Type */}
                <TableCell className="text-xs text-muted-foreground py-3">
                  <span className="text-foreground font-medium">{item.productName}</span>
                </TableCell>

                {/* Branch */}
                <TableCell className="text-xs py-3">{item.currentBranchName}</TableCell>

                {/* Custody */}
                <TableCell className="text-xs py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{item.currentCustodianName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.currentCustodianType}
                    </span>
                  </div>
                </TableCell>

                {/* Last Event */}
                <TableCell className="text-xs py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{item.lastEventDocType}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {item.lastEventDocNo} •{" "}
                      {item.lastEventTimestamp ? item.lastEventTimestamp.split("T")[0] : "—"}
                    </span>
                  </div>
                </TableCell>

                {/* Dwell Time */}
                <TableCell className="text-xs py-3">
                  <Badge variant="outline" className="font-normal text-[11px]">
                    {item.daysInCurrentStatus} d
                  </Badge>
                </TableCell>

                {/* Status Badge */}
                <TableCell className="text-xs py-3">
                  <CirculationStatusBadge status={item.circulationStatus} />
                </TableCell>

                {/* Action */}
                <TableCell className="text-right py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-primary hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCylinder(item);
                    }}
                  >
                    <span>Inspect</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground bg-muted/10">
        <div>
          Showing <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * pageSize, sortedCylinders.length)}
          </span>{" "}
          of <span className="font-medium text-foreground">{sortedCylinders.length}</span> cylinders
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="h-8 text-xs"
          >
            Previous
          </Button>
          <span className="px-2 font-medium text-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="h-8 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
