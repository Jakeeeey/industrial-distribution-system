"use client";

// ============================================================
// CustomerOrderConsumptionReportModule.tsx
// Composition root: provider plus the read-only report surface.
// The three views (demand grid, monthly trend, data exceptions) share one
// tab band so a reader picks the question they are asking instead of
// scrolling past two panels to reach the third.
// Placement: CRM -> Customer Reports -> Customer Order & Consumption Report
// ============================================================

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { ConsumptionTrendChart } from "./components/ConsumptionTrendChart";
import { CustomerOrderConsumptionDrawer } from "./components/CustomerOrderConsumptionDrawer";
import { CustomerOrderConsumptionFilters } from "./components/CustomerOrderConsumptionFilters";
import { CustomerOrderConsumptionHeader } from "./components/CustomerOrderConsumptionHeader";
import { CustomerOrderConsumptionKpis } from "./components/CustomerOrderConsumptionKpis";
import { CustomerOrderConsumptionTable } from "./components/CustomerOrderConsumptionTable";
import { ExceptionsPanel } from "./components/ExceptionsPanel";
import {
  ReportEmptyState,
  ReportErrorState,
  ReportQuietState,
  ReportSkeleton,
} from "./components/ReportState";
import {
  CustomerOrderConsumptionReportProvider,
  type CustomerOrderConsumptionReportContextValue,
} from "./providers/CustomerOrderConsumptionReportProvider";
import { useCustomerOrderConsumptionReport } from "./hooks/useCustomerOrderConsumptionReport";
import type { CustomerOrderConsumptionReportResponse } from "./types/customer-order-consumption.types";

type ReportTab = "demand" | "trend" | "exceptions";

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
  isInitialLoading,
  refresh,
}: Pick<
  CustomerOrderConsumptionReportContextValue,
  "report" | "error" | "isInitialLoading" | "refresh"
>): React.ReactElement {
  const [tab, setTab] = React.useState<ReportTab>("demand");

  if (isInitialLoading) return <ReportSkeleton />;

  // A failed read shows nothing but the error: half-loaded demand figures
  // would be read as real customer behaviour.
  if (error && !report) return <ReportErrorState message={error} onRetry={() => void refresh()} />;
  if (!report) return <ReportEmptyState />;

  return (
    <div className="space-y-3">
      <CustomerOrderConsumptionKpis onOpenExceptions={() => setTab("exceptions")} />
      <ReportTabs report={report} tab={tab} onTabChange={setTab} />
    </div>
  );
}

function ReportTabs({
  report,
  tab,
  onTabChange,
}: {
  report: CustomerOrderConsumptionReportResponse;
  tab: ReportTab;
  onTabChange(next: ReportTab): void;
}): React.ReactElement {
  const monthCount = new Set(report.monthlyTrend.map((point) => point.yearMonth)).size;
  const exceptionCount = report.exceptions.length;

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => onTabChange(next as ReportTab)}
      className="gap-3"
    >
      <div className="flex w-full overflow-x-auto border-b">
        <TabsList variant="line" className="h-9 shrink-0 gap-1 bg-transparent p-0">
          <TabsTrigger value="demand" className="gap-1.5 rounded-none px-2 text-xs">
            Demand by customer
            <Count value={report.rows.length} />
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-1.5 rounded-none px-2 text-xs">
            Monthly trend
            <Count value={monthCount} />
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

      <TabsContent value="demand" className="space-y-3">
        {report.rows.length === 0 ? (
          <ReportEmptyState />
        ) : (
          <CustomerOrderConsumptionTable />
        )}
      </TabsContent>

      <TabsContent value="trend" className="space-y-3">
        {monthCount === 0 ? (
          <ReportQuietState
            title="Nothing to chart in this window"
            message="Demand exists but no row carries a readable transaction date, so no monthly bucket could be opened. Check the period filter or the source dates."
          />
        ) : (
          <ConsumptionTrendChart />
        )}
      </TabsContent>

      <TabsContent value="exceptions" className="space-y-3">
        {exceptionCount === 0 ? (
          <ReportQuietState
            title="No data exceptions"
            message="Every row in this window had a readable cylinder size or product weight, a branch and a posted billing document. Anything the report could not resolve would be listed here rather than quietly corrected."
          />
        ) : (
          <ExceptionsPanel />
        )}
      </TabsContent>
    </Tabs>
  );
}

function CustomerOrderConsumptionReport(): React.ReactElement {
  const { report, error, isInitialLoading, refresh } =
    useCustomerOrderConsumptionReport();

  return (
    <div className="space-y-4">
      <CustomerOrderConsumptionHeader />
      <CustomerOrderConsumptionFilters />
 
      <ReportBody
        report={report}
        error={error}
        isInitialLoading={isInitialLoading}
        refresh={refresh}
      />

      {error && report ? (
        <ReportErrorState message={error} onRetry={() => void refresh()} />
      ) : null}

      <CustomerOrderConsumptionDrawer />

      <footer className="text-xs text-muted-foreground">
        Read-only report. Cylinder volume covers serialized products in
        industrial categories and is a purchase proxy; actual metered or weighed
        usage is used wherever it is recorded. Returns are deducted once, in
        their own period, and no inventory, charge or payment is created here.
      </footer>
    </div>
  );
}

export default function CustomerOrderConsumptionReportModule(): React.ReactElement {
  return (
    <CustomerOrderConsumptionReportProvider>
      <CustomerOrderConsumptionReport />
    </CustomerOrderConsumptionReportProvider>
  );
}
