"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import type { ReturnAnalysisItem } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import {
  formatQuantity,
  formatReturnRate,
  getReturnAnalysisRows,
  type ReturnGrouping,
} from "./analytical-view.utils";
import { ReportDataTable, type ReportColumn } from "./ReportDataTable";

const columns: readonly ReportColumn<ReturnAnalysisItem>[] = [
  {
    key: "group",
    label: "Group",
    value: (row) => row.label,
    render: (row) => (
      <div className="min-w-48">
        <p className="font-semibold text-foreground">{row.label}</p>
        <p className="text-xs text-muted-foreground">{row.code}</p>
      </div>
    ),
  },
  {
    key: "gross",
    label: "Gross",
    value: (row) => row.grossPurchasedQty,
    render: (row) => formatQuantity(row.grossPurchasedQty),
    align: "right",
  },
  {
    key: "returned",
    label: "Returned",
    value: (row) => row.returnedQty,
    render: (row) => formatQuantity(row.returnedQty),
    align: "right",
  },
  {
    key: "net",
    label: "Net",
    value: (row) => row.netPurchasedQty,
    render: (row) => formatQuantity(row.netPurchasedQty),
    align: "right",
  },
  {
    key: "returnRate",
    label: "Return Rate",
    value: (row) => row.returnRate,
    render: (row) => formatReturnRate(row.returnRate, row.grossPurchasedQty),
    align: "right",
  },
] as const;

const groupingOptions: ReadonlyArray<readonly [ReturnGrouping, string]> = [
  ["customer", "Customer"],
  ["product", "Product"],
  ["branch", "Branch"],
  ["salesperson", "Salesperson"],
];

function ReturnAnalysisMobileCard({ row }: { row: ReturnAnalysisItem }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <p className="truncate font-semibold text-foreground">{row.label}</p>
      <p className="text-xs text-muted-foreground">{row.code}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Gross</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(row.grossPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Returned</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(row.returnedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(row.netPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Return Rate</dt>
          <dd className="font-semibold tabular-nums">
            {formatReturnRate(row.returnRate, row.grossPurchasedQty)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ReturnAnalysisView(): React.ReactElement {
  const { report } = useCylinderPurchaseReport();
  const [grouping, setGrouping] =
    React.useState<ReturnGrouping>("customer");
  const rows = React.useMemo(
    () =>
      report ? getReturnAnalysisRows(report.returnAnalysis, grouping) : [],
    [grouping, report],
  );

  return (
    <section aria-label="Return analysis" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Label htmlFor="return-analysis-grouping">Group by</Label>
        <Select
          value={grouping}
          onValueChange={(value) => setGrouping(value as ReturnGrouping)}
        >
          <SelectTrigger
            id="return-analysis-grouping"
            className="w-full sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupingOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReportDataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        defaultSort={{ key: "returned", direction: "desc" }}
        renderMobileCard={(row) => <ReturnAnalysisMobileCard row={row} />}
      />
    </section>
  );
}
