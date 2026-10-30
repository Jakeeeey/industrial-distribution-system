"use client";

// ============================================================
// ExceptionsPanel.tsx
// Data-quality findings the report refuses to silently repair (ticket s6):
// missing product weights, unbillable LPG rows, undelivered dispatches.
// ============================================================

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatKgCompact,
  formatQty,
} from "../services/customer-order-consumption.helpers";
import type {
  ExceptionCode,
  ReportException,
} from "../types/customer-order-consumption.types";

const CODE_HELP: Record<ExceptionCode, string> = {
  MISSING_PRODUCT_WEIGHT:
    "The product has no category cylinder size and no master weight, so purchased pieces cannot be expressed as kilograms. A missing product master row is disclosed here too.",
  MISSING_PRODUCT_CATEGORY:
    "The product has no fetched category, so it cannot be proven to be an industrial cylinder. The line is excluded and disclosed here.",
  NON_KG_WEIGHT_UNIT:
    "The product weight is stored in a unit with no conversion factor in the schema; nothing was guessed.",
  UNBILLED_LPG_TRANSACTION:
    "A posted meter or weigh record is not billed to an invoice yet, so no branch can be derived.",
  BRANCH_UNKNOWN:
    "The billing invoice is outside the fetched window or carries no branch.",
  LPG_VARIANCE:
    "Metered and weighed kilograms differ; both figures are kept for reconciliation.",
  LPG_BASELINE_EXCLUDED:
    "An onboarding baseline fill is not consumption, so it was excluded from the demand totals.",
  NOT_FULFILLED_DELIVERY:
    "Dispatch marked the delivery as Not Fulfilled, so those quantities are excluded.",
  FULFILLED_WITH_CONCERNS:
    "The delivery was completed with concerns; quantities are included but worth reviewing.",
};

function groupByCode(
  exceptions: ReportException[]
): Map<ExceptionCode, ReportException[]> {
  const grouped = new Map<ExceptionCode, ReportException[]>();
  for (const item of exceptions) {
    const bucket = grouped.get(item.code);
    if (bucket) bucket.push(item);
    else grouped.set(item.code, [item]);
  }
  return grouped;
}

const OCCURRENCES_PER_CODE = 8;

export function ExceptionsPanel(): React.ReactElement | null {
  const { report } = useCustomerOrderConsumptionReport();

  if (!report || report.exceptions.length === 0) return null;

  // Largest code first: one missing product weight repeated across a catalogue
  // is a single master-data fix, and it should read that way.
  const groups = [...groupByCode(report.exceptions).entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  return (
    <Card className="border-amber-200 bg-amber-50/40 py-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-4 text-amber-700" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Findings grouped by code
          </h2>
          <span className="text-xs text-muted-foreground">
            {formatQty(report.exceptions.length)} finding
            {report.exceptions.length === 1 ? "" : "s"} across{" "}
            {formatQty(groups.length)} code{groups.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3">
          {groups.map(([code, items]) => {
            const shown = items.slice(0, OCCURRENCES_PER_CODE);
            const hidden = items.length - shown.length;
            const involvedKg = items.reduce(
              (sum, item) => sum + Math.abs(item.kg),
              0
            );
            return (
              <div key={code} className="rounded-md border bg-background/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{code}</Badge>
                  <span className="text-xs font-medium">
                    {formatQty(items.length)} occurrence{items.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {involvedKg > 0
                      ? `${formatKgCompact(involvedKg)} kg involved`
                      : "no kilogram impact"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{CODE_HELP[code]}</p>
                <ul className="mt-2 space-y-1">
                  {shown.map((item, index) => (
                    <li
                      key={`${item.referenceNo}-${index}`}
                      className="flex flex-wrap gap-x-2 text-xs"
                    >
                      <span className="font-medium">{item.customerName}</span>
                      <span className="text-muted-foreground">{item.referenceNo}</span>
                      <span className="text-muted-foreground">
                        ({item.referenceType} · {item.channel})
                      </span>
                      <span className="text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
                  {hidden > 0 ? (
                    <li className="text-xs text-muted-foreground">
                      …and {formatQty(hidden)} more — the Excel export lists every
                      occurrence.
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
