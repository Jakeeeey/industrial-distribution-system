// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceTable.tsx
// ==============================================================================
// Delivery Performance Report - Results Table
// Displays paginated delivery items, status badges, and inspect drawer triggers.
// ==============================================================================

"use client";

import React from "react";
import { Eye, Clock, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from "lucide-react";
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
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";
import type { DeliveryRecordItem, DeliveryFulfillmentStatus } from "../types/deliver-performance.types";

export function DeliverPerformanceTable() {
  const { report, loading, setSelectedRecord } = useDeliverPerformance();
  const records = report?.records || [];

  const getStatusBadge = (status: DeliveryFulfillmentStatus) => {
    switch (status) {
      case "Fulfilled":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-3 w-3" />
            Fulfilled
          </Badge>
        );
      case "Fulfilled With Concerns":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" />
            With Concerns
          </Badge>
        );
      case "Fulfilled With Returns":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400"
          >
            <RotateCcw className="h-3 w-3" />
            With Returns
          </Badge>
        );
      case "Not Fulfilled":
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
          >
            <XCircle className="h-3 w-3" />
            Not Fulfilled
          </Badge>
        );
    }
  };

  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-28 text-xs font-semibold">Waybill #</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Invoice #</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Dispatch Date</TableHead>
              <TableHead className="text-xs font-semibold">Customer</TableHead>
              <TableHead className="w-32 text-xs font-semibold">Branch</TableHead>
              <TableHead className="w-36 text-xs font-semibold">Driver / Custodian</TableHead>
              <TableHead className="w-32 text-center text-xs font-semibold">Status</TableHead>
              <TableHead className="w-24 text-center text-xs font-semibold">Schedule</TableHead>
              <TableHead className="w-20 text-right text-xs font-semibold">Qty</TableHead>
              <TableHead className="w-28 text-right text-xs font-semibold">Net Value</TableHead>
              <TableHead className="w-16 text-center text-xs font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-xs text-muted-foreground">
                  Loading delivery records...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-xs text-muted-foreground">
                  No delivery records found matching the criteria.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r: DeliveryRecordItem) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedRecord(r)}
                >
                  <TableCell className="font-medium text-xs text-foreground">{r.waybillNo}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.invoiceNo}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.dispatchDate}</TableCell>
                  <TableCell className="text-xs text-foreground font-medium max-w-[200px] truncate">
                    {r.customerName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate">{r.branchName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate">{r.driverName}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(r.status)}</TableCell>
                  <TableCell className="text-center">
                    {r.isOnTime ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Clock className="h-3 w-3" /> On-Time
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <Clock className="h-3 w-3" /> Delayed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-foreground">{r.totalQuantity}</TableCell>
                  <TableCell className="text-right text-xs font-semibold text-foreground">
                    {formatCurrency(r.netAmount)}
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedRecord(r)}
                      title="Inspect Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

