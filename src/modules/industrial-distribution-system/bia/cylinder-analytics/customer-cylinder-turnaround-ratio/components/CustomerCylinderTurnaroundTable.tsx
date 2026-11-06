// components/CustomerCylinderTurnaroundTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Primary results data table for Customer Cylinder Turnaround Ratio (CTR) Module.
// Columns: Customer, Period, Cylinder Base, RO Qty, Deposit Qty, Annual Turns,
// Months/Turn, Grade Badge, Eligible 11kg Refill, Incentive Rate, Total Incentive, and Actions.
// Features full pagination (default 10 rows), page size selector, and jump navigation.
// Displays '—' for months/turn when account is Unmonitored (0 circulation) or Base = 0.
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
} from "lucide-react";
import { CTRGradeBadge } from "./CTRGradeBadge";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

type SortField =
  | "customerName"
  | "cylinderBase"
  | "repeatOrderQty"
  | "depositCylinderQty"
  | "annualTurns"
  | "monthsPerTurn"
  | "eligibleRefill11kgQty"
  | "totalIncentiveAmount";

export function CustomerCylinderTurnaroundTable() {
  const { items, isLoading, setSelectedItem, filters } = useCustomerCylinderTurnaround();

  const [sortField, setSortField] = React.useState<SortField>("annualTurns");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  // Pagination states (Default 10 rows)
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  // Reset to page 1 on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters.customerCode, filters.branchId, filters.grade, filters.searchQuery, filters.datePreset, filters.startDate, filters.endDate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") {
        valA = (valA as string).toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortField, sortDirection]);

  // Paginated slice
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = sortedItems.slice(startIndex, endIndex);

  if (isLoading) {
    return (
      <Card className="border border-border/80 shadow-sm">
        <CardContent className="p-8 text-center text-sm text-muted-foreground animate-pulse">
          Calculating turnaround velocity and grade assignments...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/50">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold text-foreground">
            Customer Assessment Register
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Click on any customer to inspect underlying order documents, cylinder base calculations, and audit history.
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          Showing {totalItems === 0 ? 0 : startIndex + 1}–{endIndex} of {totalItems} accounts
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("customerName")}
                    className="-ml-3 h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Customer & Branch
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("cylinderBase")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Cylinder Base
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("repeatOrderQty")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    RO Qty
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("depositCylinderQty")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Deposit
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("annualTurns")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Annual Turns
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("monthsPerTurn")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Mos / Turn
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-center">
                  Grade Tier
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("eligibleRefill11kgQty")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Eligible (11kg)
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  Rate / kg
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("totalIncentiveAmount")}
                    className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground ml-auto"
                  >
                    Total Incentive
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-center w-14">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-xs text-muted-foreground">
                    No customer assessment records match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => {
                  const isDormantOrZero = item.isBaseZero || item.grade === "UNMONITORED" || item.annualTurns === 0;

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      {/* Customer */}
                      <TableCell className="py-2.5">
                        <div className="font-medium text-xs text-foreground">
                          {item.customerName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">{item.customerCode}</span>
                          <span>•</span>
                          <span>{item.branchName}</span>
                        </div>
                      </TableCell>

                      {/* Cylinder Base */}
                      <TableCell className="text-right py-2.5">
                        {item.isBaseZero ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                            <AlertCircle className="h-3 w-3" />
                            0
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-medium">
                            {item.cylinderBase}
                          </span>
                        )}
                      </TableCell>

                      {/* RO Qty */}
                      <TableCell className="text-right py-2.5 font-mono text-xs text-muted-foreground">
                        {item.repeatOrderQty}
                      </TableCell>

                      {/* Deposit Qty */}
                      <TableCell className="text-right py-2.5 font-mono text-xs text-muted-foreground">
                        {item.depositCylinderQty}
                      </TableCell>

                      {/* Annual Turns */}
                      <TableCell className="text-right py-2.5 font-mono text-xs font-bold text-foreground">
                        {item.isBaseZero ? "—" : `${item.annualTurns}x`}
                      </TableCell>

                      {/* Months Per Turn: Avoid 99.9 fallback on unmonitored / 0 turnover */}
                      <TableCell className="text-right py-2.5 font-mono text-xs text-muted-foreground">
                        {isDormantOrZero ? "—" : `${item.monthsPerTurn} mos`}
                      </TableCell>

                      {/* Grade Badge */}
                      <TableCell className="text-center py-2.5">
                        <CTRGradeBadge grade={item.grade} />
                      </TableCell>

                      {/* Eligible 11kg Refills */}
                      <TableCell className="text-right py-2.5">
                        <div className="font-mono text-xs font-medium">
                          {item.eligibleRefill11kgQty} pcs
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.eligibleKilograms} kg
                        </div>
                      </TableCell>

                      {/* Rate per kg */}
                      <TableCell className="text-right py-2.5 font-mono text-xs text-muted-foreground">
                        {item.incentiveRatePerKg > 0 ? `₱${item.incentiveRatePerKg}/kg` : "—"}
                      </TableCell>

                      {/* Total Incentive */}
                      <TableCell className="text-right py-2.5">
                        <div className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {item.totalIncentiveAmount > 0
                            ? `₱${item.totalIncentiveAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "₱0.00"}
                        </div>
                        {item.incentivePerRefill > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            ₱{item.incentivePerRefill}/refill
                          </div>
                        )}
                      </TableCell>

                      {/* Action / View */}
                      <TableCell className="text-center py-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Table Pagination Bar (Default 10 Rows) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border/60 bg-muted/20 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs bg-background">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10" className="text-xs">10</SelectItem>
                <SelectItem value="25" className="text-xs">25</SelectItem>
                <SelectItem value="50" className="text-xs">50</SelectItem>
                <SelectItem value="100" className="text-xs">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="hidden sm:inline">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="First Page"
              className="h-7 w-7"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="px-2.5 text-xs font-medium text-foreground">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
              className="h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last Page"
              className="h-7 w-7"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
