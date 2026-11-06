"use client";

// ============================================================
// IncentiveDrawer.tsx
// Drill-down for one customer: the eligible volume behind the figures, the
// claims raised against it and the documents linking the two. Read-only by
// design — this report never posts inventory, raises charges or records a
// payment (§2), so approval still happens on the memo itself.
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

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import {
  formatAmount,
  formatKg,
  formatQty,
  formatRate,
  formatReportDate,
} from "../services/customer-incentive.helpers";
import type { SupportingDocument } from "../types/customer-incentive.types";
import { StatusBadge } from "./StatusBadge";

const DOCUMENT_LABEL: Record<SupportingDocument["documentType"], string> = {
  SALES_INVOICE: "Sales invoice",
  SALES_RETURN: "Sales return",
  CUSTOMER_MEMO: "Customer memo",
  TRANSMITTAL: "Transmittal",
};

const EVIDENCE_COLUMNS = [
  "Branch",
  "Product",
  "Size kg",
  "Units",
  "Returned",
  "Eligible",
  "Eligible kg",
  "₱/kg",
  "Earned ₱",
  "Invoices",
];

const CLAIM_COLUMNS = [
  "Memo no.",
  "Status",
  "Approved ₱",
  "Released ₱",
  "Outstanding ₱",
  "Account",
  "Raised",
  "Updated",
  "Payment ref.",
  "Reason",
];

const DOCUMENT_COLUMNS = ["Document", "Reference", "Date", "Status", "Amount", "Detail"];

function TriggerCount({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

export function IncentiveDrawer(): React.ReactElement {
  const { selectedCustomer, detail, isDetailLoading, detailError, closeCustomerDetail } =
    useCustomerIncentiveReport();

  const isOpen = selectedCustomer !== null;
  const row = detail?.rows[0];
  const evidence = row?.evidence ?? [];
  const claims = detail?.claims ?? [];
  const documents = detail?.documents ?? [];
  const exceptions = detail?.exceptions ?? [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? undefined : closeCustomerDetail())}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>
            {selectedCustomer?.customerName ?? "Customer"} ·{" "}
            {selectedCustomer?.customerCode ?? ""}
          </SheetTitle>
          <SheetDescription>
            Eligible volume and claims for the applied window. Money is approved
            at customer level, so the per-product figures below are evidence —
            they carry no allocation of any claim.
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

              {row ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={row.claimStatus} label={row.statusLabel} />
                  <span>
                    Eligible:{" "}
                    <span className="font-medium text-foreground">
                      {formatQty(row.eligibleUnits)} units · {formatKg(row.eligibleKg)} kg
                    </span>
                  </span>
                  <span>
                    Earned:{" "}
                    <span className="font-medium text-foreground">
                      {formatAmount(row.earnedAmount)}
                    </span>
                  </span>
                  <span>
                    Adjustments:{" "}
                    <span className="font-medium text-foreground">
                      {formatAmount(-row.adjustmentAmount)}
                    </span>
                  </span>
                  <span>
                    Approved:{" "}
                    <span className="font-medium text-foreground">
                      {formatAmount(row.approvedAmount)}
                    </span>
                  </span>
                  <span>
                    Outstanding:{" "}
                    <span className="font-medium text-foreground">
                      {formatAmount(row.outstandingAmount)}
                    </span>
                  </span>
                  <span>
                    Variance:{" "}
                    <span className="font-medium text-foreground">
                      {formatAmount(row.varianceAmount)}
                    </span>
                  </span>
                  <span>
                    Implied rate:{" "}
                    <span className="font-medium text-foreground">
                      {formatRate(row.impliedRatePerKg)}
                    </span>
                  </span>
                </div>
              ) : null}

              <Tabs defaultValue="evidence" className="gap-3">
                <div className="border-b">
                  <TabsList variant="line" className="h-9 gap-1 bg-transparent p-0">
                    <TabsTrigger value="evidence" className="gap-1.5 rounded-none px-2 text-xs">
                      Eligible volume
                      <TriggerCount value={evidence.length} />
                    </TabsTrigger>
                    <TabsTrigger value="claims" className="gap-1.5 rounded-none px-2 text-xs">
                      Claims
                      <TriggerCount value={claims.length} />
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="gap-1.5 rounded-none px-2 text-xs">
                      Documents
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

                <TabsContent value="evidence" className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {EVIDENCE_COLUMNS.map((column) => (
                            <TableHead
                              key={column}
                              className={`h-9 whitespace-nowrap px-2 text-xs font-semibold ${
                                column === "Branch" || column === "Product"
                                  ? ""
                                  : "text-right"
                              }`}
                            >
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evidence.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={EVIDENCE_COLUMNS.length}
                              className="py-8 text-center text-sm text-muted-foreground"
                            >
                              No eligible invoiced volume in this window. Any claim
                              still listed under Claims has no supporting refill
                              record here.
                            </TableCell>
                          </TableRow>
                        ) : (
                          evidence.map((item) => (
                            <TableRow
                              key={`${item.branchId}-${item.productId}`}
                              className="text-xs"
                            >
                              <TableCell className="max-w-[140px] truncate">
                                {item.branchName}
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className="truncate">{item.productName}</p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {item.productCode}
                                </p>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {item.sizeKg == null ? "—" : formatKg(item.sizeKg)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatQty(item.grossUnits)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {item.returnedUnits === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  formatQty(item.returnedUnits)
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatQty(item.eligibleUnits)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatKg(item.eligibleKg)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatRate(item.ratePerKg)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(item.earnedAmount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatQty(item.invoiceCount)}
                                {item.returnCount > 0 ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    / {formatQty(item.returnCount)}r
                                  </span>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {evidence.some((item) => item.salesmanNames.length > 0) ? (
                    <p className="text-xs text-muted-foreground">
                      Returns are deducted in the window they were accepted, not
                      against the invoice they came from, so a line can show
                      fewer eligible units than it was billed for.
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="claims" className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {CLAIM_COLUMNS.map((column) => (
                            <TableHead
                              key={column}
                              className={`h-9 whitespace-nowrap px-2 text-xs font-semibold ${
                                column === "Memo no." ||
                                column === "Status" ||
                                column === "Account" ||
                                column === "Payment ref." ||
                                column === "Reason"
                                  ? ""
                                  : "text-right"
                              }`}
                            >
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claims.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={CLAIM_COLUMNS.length}
                              className="py-8 text-center text-sm text-muted-foreground"
                            >
                              No customer memo carries an incentive claim for this
                              customer in this window.
                            </TableCell>
                          </TableRow>
                        ) : (
                          claims.map((claim) => (
                            <TableRow key={claim.memoNumber} className="text-xs">
                              <TableCell className="max-w-[150px] truncate font-medium">
                                {claim.memoNumber}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  status={claim.claimStatus}
                                  label={claim.statusLabel}
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(claim.approvedAmount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(claim.releasedAmount)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatAmount(
                                  Math.max(0, claim.approvedAmount - claim.releasedAmount)
                                )}
                              </TableCell>
                              <TableCell className="max-w-[180px] truncate">
                                {claim.accountTitle || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatReportDate(claim.createdAt)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatReportDate(claim.updatedAt)}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate text-muted-foreground">
                                {claim.paymentReferences.length > 0
                                  ? claim.paymentReferences.join(", ")
                                  : "—"}
                              </TableCell>
                              <TableCell className="max-w-[220px] text-muted-foreground">
                                {claim.reason || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rejected claims keep their review reason because the memo
                    itself records one — the §6 flow ends at Rejected rather than
                    deleting the attempt.
                  </p>
                </TabsContent>

                <TabsContent value="documents" className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {DOCUMENT_COLUMNS.map((column) => (
                            <TableHead
                              key={column}
                              className={`h-9 whitespace-nowrap px-2 text-xs font-semibold ${
                                column === "Amount" ? "text-right" : ""
                              }`}
                            >
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={DOCUMENT_COLUMNS.length}
                              className="py-8 text-center text-sm text-muted-foreground"
                            >
                              No supporting documents in this window.
                            </TableCell>
                          </TableRow>
                        ) : (
                          documents.map((document, index) => (
                            <TableRow
                              key={`${document.documentType}-${document.documentNo}-${index}`}
                              className="text-xs"
                            >
                              <TableCell className="whitespace-nowrap">
                                {DOCUMENT_LABEL[document.documentType]}
                              </TableCell>
                              <TableCell className="max-w-[170px] truncate font-medium">
                                {document.documentNo || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatReportDate(document.date)}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate">
                                {document.status || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {document.amount == null ? "—" : formatAmount(document.amount)}
                              </TableCell>
                              <TableCell className="max-w-[220px] truncate text-muted-foreground">
                                {document.detail || "—"}
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
                            <Badge
                              variant={item.severity === "critical" ? "destructive" : "outline"}
                            >
                              {item.code}
                            </Badge>
                            <span className="font-medium">{item.referenceNo}</span>
                            <span className="text-muted-foreground">{item.referenceType}</span>
                            {item.amount != null ? (
                              <span className="text-muted-foreground">
                                {formatAmount(item.amount)}
                              </span>
                            ) : null}
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
