"use client";

// ============================================================
// CustomerOrderConsumptionDrawer.tsx
// Drill-down for one customer: the documents behind the numbers, plus the
// exceptions raised on them. Read-only by design — this report never posts
// inventory, raises charges or records payments.
// ============================================================

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatAmount,
  formatKgCompact,
  formatQty,
  formatReportDate,
} from "../services/customer-order-consumption.helpers";
import type { SupportingDocument } from "../types/customer-order-consumption.types";

const DOCUMENT_LABEL: Record<SupportingDocument["documentType"], string> = {
  SALES_ORDER: "Sales order",
  SALES_INVOICE: "Sales invoice",
  DISPATCH: "Dispatch",
  SALES_RETURN: "Sales return",
  WIWO: "Weigh-in / weigh-out",
  METER_READING: "Meter reading",
  LPG_BILLING: "LPG billing",
};

const COLUMNS = ["Document", "Reference", "Date", "Status", "Qty", "kg", "Amount", "Linked to"];

function TriggerCount({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

export function CustomerOrderConsumptionDrawer(): React.ReactElement {
  const { selectedCustomer, detail, isDetailLoading, detailError, closeCustomerDetail } =
    useCustomerOrderConsumptionReport();

  const isOpen = selectedCustomer !== null;
  const documents = detail?.documents ?? [];
  const exceptions = detail?.exceptions ?? [];

  // Totals are read off the documents rather than re-derived, so the drawer
  // always agrees with the table row that opened it.
  const totalKg = documents.reduce((sum, item) => sum + item.kg, 0);
  const totalQty = documents.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = documents.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? undefined : closeCustomerDetail())}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {selectedCustomer?.customerName ?? "Customer"} ·{" "}
            {selectedCustomer?.customerCode ?? ""}
          </SheetTitle>
          <SheetDescription>
            Supporting records for the applied window. Negative rows are accepted
            sales returns already deducted from the customer&rsquo;s totals.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {isDetailLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Loading supporting records…
            </div>
          ) : detailError ? (
            <p className="py-6 text-sm text-destructive">{detailError}</p>
          ) : (
            <>
              {detail ? (
                <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-medium">{detail.branchName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Classification</p>
                    <p className="font-medium">{detail.classificationName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Window</p>
                    <p className="font-medium">
                      {detail.window.startDate} → {detail.window.endDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Store</p>
                    <p className="font-medium">{detail.storeName || "—"}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Documents: <span className="font-medium text-foreground">{documents.length}</span>
                </span>
                <span>
                  Net qty: <span className="font-medium text-foreground">{formatQty(totalQty)}</span>
                </span>
                <span>
                  Net kg: <span className="font-medium text-foreground">{formatKgCompact(totalKg)}</span>
                </span>
                <span>
                  Net amount: <span className="font-medium text-foreground">{formatAmount(totalAmount)}</span>
                </span>
              </div>

              <Tabs defaultValue="documents" className="gap-3">
                <div className="border-b">
                  <TabsList variant="line" className="h-9 gap-1 bg-transparent p-0">
                    <TabsTrigger value="documents" className="gap-1.5 rounded-none px-2 text-xs">
                      Supporting documents
                      <TriggerCount value={documents.length} />
                    </TabsTrigger>
                    <TabsTrigger value="exceptions" className="gap-1.5 rounded-none px-2 text-xs">
                      Exceptions
                      {exceptions.length > 0 ? (
                        <Badge
                          variant="destructive"
                          className="min-w-5 rounded-full px-1.5 py-0 text-[10px] tabular-nums"
                        >
                          {exceptions.length}
                        </Badge>
                      ) : (
                        <TriggerCount value={0} />
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="documents" className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {COLUMNS.map((column) => (
                            <TableHead key={column} className="whitespace-nowrap">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-sm text-muted-foreground">
                              No supporting documents in this window.
                            </TableCell>
                          </TableRow>
                        ) : (
                          documents.map((document, index) => (
                            <TableRow key={`${document.documentType}-${document.documentNo}-${index}`}>
                              <TableCell className="whitespace-nowrap">
                                {DOCUMENT_LABEL[document.documentType]}
                              </TableCell>
                              <TableCell className="max-w-[180px] truncate font-medium">
                                {document.documentNo || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatReportDate(document.date)}
                              </TableCell>
                              <TableCell className="max-w-[180px] truncate text-xs">
                                {document.status || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatQty(document.quantity)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatKgCompact(document.kg)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(document.amount)}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                                {document.reference || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="exceptions" className="space-y-2">
                  {exceptions.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">
                      Nothing was flagged on this customer&rsquo;s records in this
                      window.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {exceptions.map((item, index) => (
                        <li
                          key={`${item.code}-${item.referenceNo}-${index}`}
                          className="rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="destructive">{item.code}</Badge>
                            <span className="font-medium">{item.referenceNo}</span>
                            <span className="text-muted-foreground">
                              {item.referenceType} · {item.channel}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">{item.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={closeCustomerDetail}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
