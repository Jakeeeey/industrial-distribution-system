"use client";

import * as React from "react";

import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import type { SalespersonPurchaseSummary } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import {
  formatQuantity,
  formatReturnRate,
  rankReportRows,
  type RankedReportRow,
} from "./analytical-view.utils";
import { ReportDataTable, type ReportColumn } from "./ReportDataTable";
import { SalespersonPurchaseDetail } from "./SalespersonPurchaseDetail";

type SalespersonPerformanceRow = RankedReportRow<SalespersonPurchaseSummary>;

const columns: readonly ReportColumn<SalespersonPerformanceRow>[] = [
  { key: "rank", label: "Rank", value: (row) => row.rank, align: "center" },
  {
    key: "salesperson",
    label: "Salesperson",
    value: (row) => row.data.salesmanName,
    render: (row) => (
      <div className="min-w-48">
        <p className="font-semibold text-foreground">{row.data.salesmanName}</p>
        <p className="text-xs text-muted-foreground">{row.data.salesmanCode}</p>
      </div>
    ),
  },
  {
    key: "gross",
    label: "Gross",
    value: (row) => row.data.grossPurchasedQty,
    render: (row) => formatQuantity(row.data.grossPurchasedQty),
    align: "right",
  },
  {
    key: "returned",
    label: "Returned",
    value: (row) => row.data.returnedQty,
    render: (row) => formatQuantity(row.data.returnedQty),
    align: "right",
  },
  {
    key: "net",
    label: "Net",
    value: (row) => row.data.netPurchasedQty,
    render: (row) => formatQuantity(row.data.netPurchasedQty),
    align: "right",
  },
  {
    key: "returnRate",
    label: "Return Rate",
    value: (row) => row.data.returnRate,
    render: (row) =>
      formatReturnRate(row.data.returnRate, row.data.grossPurchasedQty),
    align: "right",
  },
  {
    key: "customers",
    label: "Customers",
    value: (row) => row.data.uniqueCustomers,
    render: (row) => formatQuantity(row.data.uniqueCustomers),
    align: "right",
  },
  {
    key: "products",
    label: "Products",
    value: (row) => row.data.uniqueProducts,
    render: (row) => formatQuantity(row.data.uniqueProducts),
    align: "right",
  },
 ] as const;

function SalespersonMobileCard({ row }: { row: SalespersonPerformanceRow }) {
  const { data } = row;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {data.salesmanName}
          </p>
          <p className="text-xs text-muted-foreground">{data.salesmanCode}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold tabular-nums">
          #{row.rank}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Gross</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(data.grossPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Returned</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(data.returnedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(data.netPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Return Rate</dt>
          <dd className="font-semibold tabular-nums">
            {formatReturnRate(data.returnRate, data.grossPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Customers</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(data.uniqueCustomers)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Products</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(data.uniqueProducts)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function SalespersonPerformanceView(): React.ReactElement {
  const { report, openSalespersonDetail } = useCylinderPurchaseReport();
  const rows = React.useMemo(
    () => rankReportRows(report?.salespersonPerformance ?? []),
    [report?.salespersonPerformance],
  );

  return (
    <section aria-label="Salesperson performance">
      <ReportDataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.data.salesmanId}
        defaultSort={{ key: "net", direction: "desc" }}
        searchLabel="Search salesperson performance"
        onRowClick={(row) => openSalespersonDetail(row.data)}
        rowActionLabel={(row) =>
          `View purchase details for ${row.data.salesmanName}`
        }
        renderMobileCard={(row) => <SalespersonMobileCard row={row} />}
      />
      <SalespersonPurchaseDetail />
    </section>
  );
}
