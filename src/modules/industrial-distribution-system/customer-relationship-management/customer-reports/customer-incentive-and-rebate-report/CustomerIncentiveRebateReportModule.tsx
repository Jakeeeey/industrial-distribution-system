"use client";

// ============================================================
// CustomerIncentiveRebateReportModule.tsx
// Composition root: provider plus the read-only report surface.
// The three views (incentive by customer, claims register, data exceptions)
// share one tab band so a reader picks the question they are asking.
// Placement: CRM -> Customer Reports -> Customer Incentive & Rebate Report
// ============================================================

import * as React from "react";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { ClaimsLedger } from "./components/ClaimsLedger";
import { ExceptionsPanel } from "./components/ExceptionsPanel";
import { IncentiveDrawer } from "./components/IncentiveDrawer";
import { IncentiveFilters } from "./components/IncentiveFilters";
import { IncentiveHeader } from "./components/IncentiveHeader";
import { IncentiveKpis } from "./components/IncentiveKpis";
import { IncentiveTable } from "./components/IncentiveTable";
import {
  ReportEmptyState,
  ReportErrorState,
  ReportPromptState,
  ReportQuietState,
  ReportSkeleton,
} from "./components/ReportState";
import { useCustomerIncentiveReport } from "./hooks/useCustomerIncentiveReport";
import {
  CustomerIncentiveReportProvider,
  type CustomerIncentiveReportContextValue,
} from "./providers/CustomerIncentiveReportProvider";
import type { CustomerIncentiveReportResponse } from "./types/customer-incentive.types";

type ReportTab = "incentive" | "claims" | "exceptions";

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

/**
 * Body of the report. Split out so the provider can wrap it while the page
 * stays a one-line import.
 */
function ReportBody({
  report,
  error,
  appliedFilters,
  isInitialLoading,
  refresh,
}: Pick<
  CustomerIncentiveReportContextValue,
  "report" | "error" | "appliedFilters" | "isInitialLoading" | "refresh"
>): React.ReactElement {
  const [tab, setTab] = React.useState<ReportTab>("incentive");

  // A period is only read when the reader applies one, so the first paint is a
  // prompt. An unrequested figure here would be indistinguishable from an
  // answer about the current quarter.
  if (!appliedFilters) return <ReportPromptState />;

  if (isInitialLoading) return <ReportSkeleton />;

  // A failed read shows nothing but the error: a half-loaded earned amount is
  // the kind of number a payment gets released against.
  if (error && !report) {
    return <ReportErrorState message={error} onRetry={() => void refresh()} />;
  }
  if (!report) return <ReportEmptyState filters={appliedFilters} />;

  return (
    <div className="space-y-3">
      <IncentiveKpis onOpenExceptions={() => setTab("exceptions")} />
      <ReportTabs report={report} tab={tab} onTabChange={setTab} />
    </div>
  );
}

function ReportTabs({
  report,
  tab,
  onTabChange,
}: {
  report: CustomerIncentiveReportResponse;
  tab: ReportTab;
  onTabChange(next: ReportTab): void;
}): React.ReactElement {
  const exceptionCount = report.exceptions.length;
  const claimCount = report.claims.length;

  return (
    <Tabs value={tab} onValueChange={(next) => onTabChange(next as ReportTab)} className="gap-3">
      <div className="flex w-full overflow-x-auto border-b">
        <TabsList variant="line" className="h-9 shrink-0 gap-1 bg-transparent p-0">
          <TabsTrigger value="incentive" className="gap-1.5 rounded-none px-2 text-xs">
            Incentive by customer
            <Count value={report.rows.length} />
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-1.5 rounded-none px-2 text-xs">
            Claims register
            <Count value={claimCount} />
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="gap-1.5 rounded-none px-2 text-xs">
            Data exceptions
            {exceptionCount > 0 ? (
              <Badge
                variant="destructive"
                className="min-w-5 rounded-full px-1.5 py-0 text-[10px] tabular-nums"
              >
                {exceptionCount}
              </Badge>
            ) : (
              <Count value={0} />
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="incentive" className="space-y-3">
        {report.rows.length === 0 ? (
          <ReportEmptyState filters={report.filters} />
        ) : (
          <IncentiveTable />
        )}
      </TabsContent>

      <TabsContent value="claims" className="space-y-3">
        {claimCount === 0 ? (
          <ReportQuietState
            title="No incentive claim raised in this window"
            message="No memo falls inside this window. The earned figures in the first tab are unaffected."
          />
        ) : (
          <ClaimsLedger />
        )}
      </TabsContent>

      <TabsContent value="exceptions" className="space-y-3">
        {exceptionCount === 0 ? (
          <ReportQuietState
            title="No data exceptions"
            message="Every line resolved to a size and a branch, and nothing was settled beyond its approved amount. Anything the source could not answer would be listed here rather than corrected silently."
          />
        ) : (
          <ExceptionsPanel />
        )}
      </TabsContent>
    </Tabs>
  );
}

function CustomerIncentiveRebateReport(): React.ReactElement {
  const {
    report,
    error,
    appliedFilters,
    isInitialLoading,
    refresh
  } = useCustomerIncentiveReport();

  return (
    <div className="space-y-4">
      <IncentiveHeader />
      <IncentiveFilters />
      <ReportBody
        report={report}
        error={error}
        appliedFilters={appliedFilters}
        isInitialLoading={isInitialLoading}
        refresh={refresh}
      />

      {error && report ? (
        <ReportErrorState message={error} onRetry={() => void refresh()} />
      ) : null}

      <IncentiveDrawer />

      <footer className="flex items-start gap-2.5 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
        <Info
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          <span className="font-medium text-foreground">Read-only.</span>{" "}
          &ldquo;Earned&rdquo; is eligible invoiced gas valued at the ₱/kg on the
          invoice line, less accepted returns. Nothing is posted, charged or
          released here.
        </p>
      </footer>
    </div>
  );
}

export default function CustomerIncentiveRebateReportModule(): React.ReactElement {
  return (
    <CustomerIncentiveReportProvider>
      <CustomerIncentiveRebateReport />
    </CustomerIncentiveReportProvider>
  );
}
