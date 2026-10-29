"use client";

// ============================================================
// ClaimsLedger.tsx
// Every customer memo that carries an incentive claim in the window, across
// all customers. §3 has sales validating eligibility and finance approving —
// this is the worklist both of them read, because the per-customer grid only
// shows one rolled-up status per customer.
// ============================================================

import * as React from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import {
  formatAmount,
  formatQty,
  formatReportDate,
} from "../services/customer-incentive.helpers";
import { CLAIM_STATUS_LABELS } from "../types/customer-incentive.types";
import type {
  ClaimStatus,
  IncentiveClaimSummary,
} from "../types/customer-incentive.types";
import { StatusBadge } from "./StatusBadge";

const COLUMNS = [
  "Memo no.",
  "Customer",
  "Status",
  "Approved ₱",
  "Released ₱",
  "Outstanding ₱",
  "Account",
  "Payment ref.",
  "Reason / note",
];

/** Claim money lives on the memo, so the customer comes from its row. */
function customerOf(
  claim: IncentiveClaimSummary,
  byMemo: Map<string, { customerCode: string; customerName: string }>
): { customerCode: string; customerName: string } {
  return (
    byMemo.get(claim.memoNumber) ?? {
      customerCode: "—",
      customerName: "Unmatched customer",
    }
  );
}

export function ClaimsLedger(): React.ReactElement | null {
  const { report, openCustomerDetail } = useCustomerIncentiveReport();
  const [term, setTerm] = React.useState("");
  const [status, setStatus] = React.useState<ClaimStatus | "ALL">("ALL");

  if (!report) return null;

  const byMemo = new Map<
    string,
    { customerCode: string; customerName: string }
  >();
  report.rows.forEach((row) => {
    row.memoNumbers.forEach((memoNumber) => {
      if (!byMemo.has(memoNumber)) {
        byMemo.set(memoNumber, {
          customerCode: row.customerCode,
          customerName: row.customerName,
        });
      }
    });
  });

  const counts: Record<ClaimStatus | "ALL", number> = {
    ALL: report.claims.length,
    FOR_REVIEW: 0,
    APPROVED: 0,
    PARTIALLY_RELEASED: 0,
    RELEASED: 0,
    REJECTED: 0,
  };
  report.claims.forEach((claim) => {
    counts[claim.claimStatus] += 1;
  });

  const filtered = report.claims.filter((claim) => {
    if (status !== "ALL" && claim.claimStatus !== status) return false;
    if (!term) return true;
    const owner = customerOf(claim, byMemo);
    return [
      claim.memoNumber,
      owner.customerCode,
      owner.customerName,
      claim.accountTitle ?? "",
      claim.reason ?? "",
      ...claim.paymentReferences,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term.toLowerCase());
  });

  const approvedTotal = filtered.reduce((sum, claim) => sum + claim.approvedAmount, 0);
  const outstandingTotal = filtered.reduce(
    (sum, claim) => sum + Math.max(0, claim.approvedAmount - claim.releasedAmount),
    0
  );

  return (
    <Card className="gap-3 border-border/80 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Claims register
            </h2>
            <span className="text-xs text-muted-foreground">
              {formatQty(filtered.length)} of {formatQty(report.claims.length)} memo
              {report.claims.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Filter memos, customers, references"
              aria-label="Filter claims"
              className="w-full pl-8 sm:w-72"
            />
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter claims by status"
          className="flex flex-wrap items-center gap-1"
        >
          {(["ALL", ...Object.keys(CLAIM_STATUS_LABELS)] as (
            | ClaimStatus
            | "ALL"
          )[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={status === key ? "secondary" : "outline"}
              aria-pressed={status === key}
              className="h-7 gap-1.5 rounded-full px-3 text-xs font-normal"
              onClick={() => setStatus(key)}
            >
              {key === "ALL" ? "All" : CLAIM_STATUS_LABELS[key]}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {counts[key]}
              </span>
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column}
                    className={`h-9 whitespace-nowrap px-2 text-xs font-semibold ${
                      column === "Approved ₱" ||
                      column === "Released ₱" ||
                      column === "Outstanding ₱"
                        ? "text-right"
                        : ""
                    }`}
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {report.claims.length === 0
                      ? "No customer memo carries a claim in this window."
                      : "No claim matches this filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((claim) => {
                  const owner = customerOf(claim, byMemo);
                  const outstanding = Math.max(
                    0,
                    claim.approvedAmount - claim.releasedAmount
                  );
                  return (
                    <TableRow
                      key={claim.memoNumber}
                      className="cursor-pointer text-xs focus-visible:bg-muted/60"
                      tabIndex={0}
                      onClick={() =>
                        owner.customerCode !== "—" &&
                        void openCustomerDetail({
                          customerCode: owner.customerCode,
                          customerName: owner.customerName,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        if (owner.customerCode !== "—") {
                          void openCustomerDetail({
                            customerCode: owner.customerCode,
                            customerName: owner.customerName,
                          });
                        }
                      }}
                    >
                      <TableCell className="max-w-[150px] truncate font-medium">
                        {claim.memoNumber}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate">{owner.customerName}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {owner.customerCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge
                            status={claim.claimStatus}
                            label={claim.statusLabel}
                          />
                          {claim.createdAt && claim.claimStatus === "REJECTED" ? (
                            <Badge variant="outline" className="text-[10px]">
                              {formatReportDate(claim.updatedAt ?? claim.createdAt)}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(claim.approvedAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(claim.releasedAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {outstanding > 0 ? (
                          formatAmount(outstanding)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {claim.accountTitle || "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">
                        {claim.paymentReferences.length > 0
                          ? claim.paymentReferences.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[240px] text-muted-foreground">
                        {claim.reason || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Filtered total:{" "}
          <span className="font-medium text-foreground">
            {formatAmount(approvedTotal)}
          </span>{" "}
          approved,{" "}
          <span className="font-medium text-foreground">
            {formatAmount(outstandingTotal)}
          </span>{" "}
          outstanding. Approving, rejecting and releasing a claim all happen on
          the customer memo — this list reads them, it cannot change them.
        </p>
      </CardContent>
    </Card>
  );
}
