"use client";

import React, { useState } from "react";
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
import { Transaction, TransactionStatus } from "../types";
import { formatPHP } from "../utils/calculations";
import { cn } from "@/lib/utils";
import { ListChecks, Eye } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TransactionLedgerProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const STATUS_STYLES: Record<TransactionStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Terms: "bg-blue-500/10 text-blue-700 border-blue-200",
  "Partially Paid": "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  Unpaid: "bg-red-500/10 text-red-700 border-red-200",
};

export function TransactionLedger({ transactions, isLoading }: TransactionLedgerProps) {
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleShowDetails = (txn: Transaction) => {
    setSelectedTxn(txn);
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-foreground/80">
            Transaction & Asset Ledger
          </h3>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Date
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Ref No.
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Order Details
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Ordered / Delivered
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Empties Returned
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Tank Balance
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                Total Amount
              </TableHead>
              <TableHead className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Status
              </TableHead>
              <TableHead className="h-10 px-4 w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4 py-4"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="px-4 py-4"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="px-4 py-4"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="px-4 py-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                  <TableCell className="px-4 py-4 text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell className="px-4 py-4 text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell className="px-4 py-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell className="px-4 py-4 text-center"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></TableCell>
                  <TableCell className="px-4 py-4 text-center"><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <ListChecks className="h-8 w-8 opacity-20" />
                    <span className="text-sm font-medium">No records available</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => (
                <TableRow
                  key={txn.id}
                  className="group hover:bg-muted/30 transition-colors duration-200 ease-in-out motion-safe:transform motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-in-out motion-safe:hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleShowDetails(txn)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleShowDetails(txn);
                    }
                  }}
                >
                  <TableCell className="px-4 py-4 text-xs font-medium text-foreground/80">
                    {new Date(txn.date).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-primary hover:underline">
                    {txn.refNo}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs text-muted-foreground font-medium">
                    {txn.orderDetails}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-center tabular-nums text-foreground/70">
                    {txn.orderedQty} / {txn.deliveredQty}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-center tabular-nums text-foreground/70">
                    {txn.emptiesReturned}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-center tabular-nums text-foreground/70">
                    {txn.tankBalance}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm font-black text-right tabular-nums text-foreground">
                    {formatPHP(txn.totalAmount)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                        STATUS_STYLES[txn.status] ?? "",
                      )}
                    >
                      {txn.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          className={cn(
            "sm:max-w-115 w-2/4 p-0 gap-0 flex flex-col overflow-hidden transform-gpu motion-safe:transition motion-safe:duration-300 motion-safe:ease-out",
            // slide & fade using transform+opacity to keep it GPU-accelerated
            isSheetOpen ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0 pointer-events-none",
          )}
          style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
        >
          {selectedTxn && (
            <>
              {/* ── Fixed Header ── */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 shrink-0 space-y-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <ListChecks className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                      <ListChecks className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-base font-black tracking-tight text-foreground leading-tight">
                        Transaction Record
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                        Ref: <span className="font-bold text-foreground">{selectedTxn.refNo}</span>
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-3 py-1 shrink-0 shadow-sm",
                      STATUS_STYLES[selectedTxn.status] ?? "",
                    )}
                  >
                    {selectedTxn.status}
                  </Badge>
                </div>
              </SheetHeader>

              {/* ── Scrollable Body ── */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-muted/5">
                {/* Read-only Disclaimer */}
                <div className="flex gap-2 bg-blue-500/10 text-blue-700 p-3 rounded-lg border border-blue-500/20 items-center">
                  <Eye className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-tight ">
                    <strong>Read-Only View.</strong> This is a historical ledger entry. You cannot edit master data or process direct payments from this module.
                  </p>
                </div>

                {/* Date row */}
                <div className="flex items-center justify-between text-sm border-b border-border/40 pb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Transaction Date
                  </span>
                  <span className="text-sm font-black text-foreground">
                    {new Date(selectedTxn.date).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Order Details card */}
                <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Order Details
                    </p>
                  </div>
                  <div className="px-5 py-5 space-y-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
                      <span className="text-base font-bold text-foreground leading-snug">
                        {selectedTxn.orderDetails}
                      </span>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Ordered
                        </p>
                        <p className="text-2xl font-black tabular-nums text-foreground mt-1">
                          {selectedTxn.orderedQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Delivered
                        </p>
                        <p className={cn(
                          "text-2xl font-black tabular-nums mt-1",
                          selectedTxn.deliveredQty < selectedTxn.orderedQty
                            ? "text-yellow-600"
                            : "text-emerald-600",
                        )}>
                          {selectedTxn.deliveredQty}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Asset Tracking card */}
                <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Asset Tracking
                    </p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/40">
                    <div className="px-5 py-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Empties Returned
                      </p>
                      <p className={cn(
                        "text-3xl font-black tabular-nums mt-1.5",
                        selectedTxn.emptiesReturned > 0 ? "text-primary" : "text-muted-foreground/50",
                      )}>
                        {selectedTxn.emptiesReturned}
                      </p>
                    </div>
                    <div className="px-5 py-5 bg-orange-50/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600/80">
                        Tank Balance
                      </p>
                      <p className={cn(
                        "text-3xl font-black tabular-nums mt-1.5",
                        selectedTxn.tankBalance > 0 ? "text-orange-600" : "text-foreground",
                      )}>
                        {selectedTxn.tankBalance}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* ── Sticky Footer ── */}
              <div className="px-6 py-5 border-t bg-background shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      Total Amount
                    </p>
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm inline-block",
                      selectedTxn.status === "Paid" ? "bg-emerald-100 text-emerald-700" :
                      selectedTxn.status === "Unpaid" ? "bg-red-100 text-red-700" :
                      selectedTxn.status === "Partially Paid" ? "bg-yellow-100 text-yellow-700" :
                      "bg-primary/10 text-primary",
                    )}>
                      {selectedTxn.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-4xl font-black tabular-nums tracking-tighter",
                      selectedTxn.status === "Paid" ? "text-emerald-600" :
                      selectedTxn.status === "Unpaid" ? "text-red-600" :
                      selectedTxn.status === "Partially Paid" ? "text-yellow-600" :
                      "text-primary",
                    )}>
                      {formatPHP(selectedTxn.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
