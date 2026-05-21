"use client";

import React, { memo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import type { WalkInTransaction } from "../types";

interface Props {
  items: WalkInTransaction[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

/* -----------------------------
   FORMAT LAYER (PURE FUNCTIONS)
------------------------------*/

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatCurrency = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

/* -----------------------------
   DOMAIN STYLE MAPPING LAYER
------------------------------*/

const getTypeBadgeClass = (type?: string) => {
  const t = (type || "").toLowerCase();

  if (t.includes("exchange")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (t.includes("deposit") || t.includes("new")) return "bg-purple-100 text-purple-700 border-purple-200";

  return "bg-muted text-muted-foreground border-border";
};

/* -----------------------------
   SMALL UI PRIMITIVES
------------------------------*/

const LoadingRows = () =>
  Array.from({ length: 4 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell>
        <Skeleton className="h-4 w-24 mb-1" />
        <Skeleton className="h-3 w-16" />
      </TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell className="text-right">
        <Skeleton className="h-4 w-16 ml-auto" />
      </TableCell>
    </TableRow>
  ));

const EmptyState = ({ message }: { message: string }) => (
  <TableRow>
    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
      {message}
    </TableCell>
  </TableRow>
);

/* -----------------------------
   MAIN COMPONENT
------------------------------*/

export const RecentWalkInTransactionsTable = memo(
  ({ items, isLoading, error, onRetry }: Props) => {
    return (
      <div className="space-y-4">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              Recent Walk-in Transactions
            </h3>
            <p className="text-sm text-muted-foreground">
              Latest walk-in activity including refills and deposits.
            </p>
          </div>

          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="h-9">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>

        {/* TABLE WRAPPER */}
        <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>

            {/* HEADER */}
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date / Txn ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>

            {/* BODY */}
            <TableBody>

              {isLoading && <LoadingRows />}

              {!isLoading && error && (
                <EmptyState message={error} />
              )}

              {!isLoading && !error && items.length === 0 && (
                <EmptyState message="No recent walk-in transactions found." />
              )}

              {!isLoading &&
                !error &&
                items.map((tx) => (
                  <TableRow key={tx.order_id} className="hover:bg-muted/30">

                    {/* DATE / TXN */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">
                          {formatDate(tx.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {tx.order_no || `TXN-${tx.order_id}`}
                        </span>
                      </div>
                    </TableCell>

                    {/* CUSTOMER */}
                    <TableCell>
                      <span className="text-xs font-semibold text-primary">
                        {tx.customer_name}
                      </span>
                    </TableCell>

                    {/* ITEMS */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground italic">
                        {tx.items_label}
                      </span>
                    </TableCell>

                    {/* TYPE */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${getTypeBadgeClass(tx.type_label)}`}
                      >
                        {(tx.type_label || "Walk-in").toUpperCase()}
                      </Badge>
                    </TableCell>

                    {/* AMOUNT */}
                    <TableCell className="text-right text-xs font-semibold">
                      {formatCurrency(tx.amount)}
                    </TableCell>

                  </TableRow>
                ))}
            </TableBody>

          </Table>
        </div>
      </div>
    );
  }
);

RecentWalkInTransactionsTable.displayName = "RecentWalkInTransactionsTable";