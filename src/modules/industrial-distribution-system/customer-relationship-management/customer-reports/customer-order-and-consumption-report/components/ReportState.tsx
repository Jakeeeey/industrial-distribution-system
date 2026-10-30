"use client";

// ============================================================
// ReportState.tsx
// Loading, error and empty shells. Kept in one file because they share the
// same card frame and only differ in what they say.
// ============================================================

import * as React from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StateProps {
  message?: string;
  onRetry?(): void;
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
        Reading sales, returns and LPG records…
      </p>
    </div>
  );
}

export function ReportErrorState({ message, onRetry }: StateProps): React.ReactElement {
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-start gap-3 px-4 py-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle aria-hidden="true" className="size-4" />
          The report could not be loaded
        </div>
        <p className="text-sm text-muted-foreground">
          {message ??
            "The sales or LPG source did not answer. No numbers are shown rather than partial ones."}
        </p>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReportEmptyState(): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-2 px-4 py-8">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Inbox aria-hidden="true" className="size-4 text-muted-foreground" />
          No demand recorded in this window
        </div>
        <p className="text-sm text-muted-foreground">
          No row in this window matched the report&rsquo;s scope. Cylinder demand
          counts only serialized products in industrial categories; LPG demand
          counts metered or weighed usage. Widen the period, or clear the branch,
          customer, salesman or classification filter. An empty result here is a
          real answer, not a missing one — but it is worth checking the window
          first.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Per-tab "nothing in this view" message. Distinct from the empty report: the
 * demand exists, only this particular cut of it has no rows to show.
 */
export function ReportQuietState({
  title,
  message,
}: {
  title: string;
  message: string;
}): React.ReactElement {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-1.5 px-4 py-8">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
