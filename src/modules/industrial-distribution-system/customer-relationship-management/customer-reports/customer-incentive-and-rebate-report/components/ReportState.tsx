"use client";

// ============================================================
// ReportState.tsx
// Prompt, loading, error and empty shells. Kept in one file because they
// share the same centred card frame and only differ in what they say.
// ============================================================

import * as React from "react";
import {
  AlertTriangle,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { claimStatusLabel, eligibleSizeLabel } from "../services/customer-incentive.helpers";
import type { AppliedFilterContext } from "../types/customer-incentive.types";

function StateFrame({
  icon,
  title,
  tone = "muted",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "muted" | "destructive";
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card
      className={
        tone === "destructive"
          ? "border-destructive/40"
          : "border-dashed bg-muted/20"
      }
    >
      <CardContent className="flex flex-col items-center gap-2 px-4 py-8 text-center sm:py-10">
        <span
          className={
            tone === "destructive"
              ? "flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
              : "flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
          }
        >
          {icon}
        </span>
        <h3
          className={
            tone === "destructive"
              ? "text-sm font-semibold text-destructive"
              : "text-sm font-semibold"
          }
        >
          {title}
        </h3>
        <div className="max-w-2xl space-y-1 text-[13px] leading-5 text-muted-foreground">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-44 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-9 w-96 max-w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Reading invoices, returns and approved customer memos…
      </p>
    </div>
  );
}

export function ReportErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?(): void;
}): React.ReactElement {
  return (
    <StateFrame
      tone="destructive"
      icon={<AlertTriangle aria-hidden="true" className="size-4" />}
      title="The report could not be loaded"
    >
      <p>
        {message ??
          "The sales or claims source did not answer, so no figure is shown in its place."}
      </p>
      {onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-2 gap-2"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      ) : null}
    </StateFrame>
  );
}

/**
 * Opening screen. Nothing is read until the reader applies a window, so the
 * first paint is a prompt rather than a period's figures nobody asked for.
 */
export function ReportPromptState(): React.ReactElement {
  return (
    <StateFrame
      icon={<Filter aria-hidden="true" className="size-4" />}
      title="No report loaded"
    >
      <p>
        Choose a period above, then load the report. Figures change only when a
        window is applied.
      </p>
    </StateFrame>
  );
}

export function ReportEmptyState({
  filters,
}: {
  filters?: AppliedFilterContext | null;
}): React.ReactElement {
  if (filters?.claimStatus) {
    return (
      <StateFrame
        icon={<Filter aria-hidden="true" className="size-4" />}
        title={`No customer's most advanced claim is ${claimStatusLabel(
          filters.claimStatus
        )}`}
      >
        <p>
          A memo joins the report through its own created date, so a claim raised
          in an earlier period is absent even while it is still unresolved.
        </p>
      </StateFrame>
    );
  }

  if (filters?.categoryIds?.length) {
    return (
      <StateFrame
        icon={<Inbox aria-hidden="true" className="size-4" />}
        title={`Nothing was invoiced under ${eligibleSizeLabel(filters)}`}
      >
        <p>
          Eligibility is category membership, so the same size sold under another
          category is not counted here. Uncategorised lines are listed on the
          exceptions tab.
        </p>
      </StateFrame>
    );
  }

  return (
    <StateFrame
      icon={<Inbox aria-hidden="true" className="size-4" />}
      title="No eligible volume in this window"
    >
      <p>
        Widen the period, or clear the branch, customer, salesman or
        classification filter.
      </p>
      <p>
        Check the cylinder size next: an uncategorised product with no recorded
        weight can never be eligible.
      </p>
    </StateFrame>
  );
}

/**
 * Per-tab "nothing in this view" message. Distinct from the empty report: the
 * incentive evidence exists, only this particular cut of it has no rows.
 */
export function ReportQuietState({
  title,
  message,
}: {
  title: string;
  message: string;
}): React.ReactElement {
  return (
    <StateFrame
      icon={<Search aria-hidden="true" className="size-4" />}
      title={title}
    >
      <p>{message}</p>
    </StateFrame>
  );
}
