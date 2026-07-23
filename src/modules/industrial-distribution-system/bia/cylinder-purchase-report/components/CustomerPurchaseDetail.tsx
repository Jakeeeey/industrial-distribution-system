"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import type {
  BranchPurchaseSummary,
  ProductPurchaseSummary,
  QuantityMetrics,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import { formatQuantity, formatReturnRate } from "./analytical-view.utils";
import { ReportDataTable, type ReportColumn } from "./ReportDataTable";

const productColumns: readonly ReportColumn<ProductPurchaseSummary>[] = [
  {
    key: "product",
    label: "Product",
    value: (row) => row.productName,
    render: (row) => <Identity name={row.productName} code={row.productCode} />,
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

const branchColumns: readonly ReportColumn<BranchPurchaseSummary>[] = [
  {
    key: "branch",
    label: "Branch",
    value: (row) => row.branchName,
    render: (row) => <Identity name={row.branchName} code={row.branchCode} />,
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

const salespersonColumns: readonly ReportColumn<SalespersonPurchaseSummary>[] = [
  {
    key: "salesperson",
    label: "Salesperson",
    value: (row) => row.salesmanName,
    render: (row) => <Identity name={row.salesmanName} code={row.salesmanCode} />,
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

function Identity({ name, code }: { name: string; code: string }) {
  return (
    <div className="min-w-48">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">{code}</p>
    </div>
  );
}

interface BreakdownMobileCardProps extends QuantityMetrics {
  name: string;
  code: string;
  returnRate: number;
}

function BreakdownMobileCard({
  name,
  code,
  grossPurchasedQty,
  returnedQty,
  netPurchasedQty,
  returnRate,
}: BreakdownMobileCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <p className="truncate font-semibold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">{code}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Gross</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(grossPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Returned</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(returnedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(netPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Return Rate</dt>
          <dd className="font-semibold tabular-nums">
            {formatReturnRate(returnRate, grossPurchasedQty)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function CustomerPurchaseDetail(): React.ReactElement {
  const { selectedCustomer, closeCustomerDetail } =
    useCylinderPurchaseReport();

  return (
    <Dialog
      open={selectedCustomer !== null}
      onOpenChange={(open) => {
        if (!open) closeCustomerDetail();
      }}
    >
      {selectedCustomer ? (
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-6xl">
          <DialogHeader className="pr-8">
            <DialogTitle>{selectedCustomer.customerName}</DialogTitle>
            <DialogDescription>
              {selectedCustomer.customerCode ?? "No customer code"} · Purchase
              quantities by product, branch, and salesperson
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricSummary
              label="Gross"
              value={formatQuantity(selectedCustomer.grossPurchasedQty)}
            />
            <MetricSummary
              label="Returned"
              value={formatQuantity(selectedCustomer.returnedQty)}
            />
            <MetricSummary
              label="Net"
              value={formatQuantity(selectedCustomer.netPurchasedQty)}
            />
            <MetricSummary
              label="Return Rate"
              value={formatReturnRate(
                selectedCustomer.returnRate,
                selectedCustomer.grossPurchasedQty,
              )}
            />
          </dl>

          <Tabs defaultValue="products" className="min-w-0">
            <div className="overflow-x-auto pb-1">
              <TabsList className="grid min-w-96 grid-cols-3">
                <TabsTrigger value="products">Product</TabsTrigger>
                <TabsTrigger value="branches">Branch</TabsTrigger>
                <TabsTrigger value="salespeople">Salesperson</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="products">
              <ReportDataTable
                columns={productColumns}
                rows={selectedCustomer.productBreakdown}
                rowKey={(row) => row.productId}
                defaultSort={{ key: "net", direction: "desc" }}
                emptyMessage="No product breakdown is available for this customer."
                renderMobileCard={(row) => (
                  <BreakdownMobileCard
                    {...row}
                    name={row.productName}
                    code={row.productCode}
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="branches">
              <ReportDataTable
                columns={branchColumns}
                rows={selectedCustomer.branchBreakdown}
                rowKey={(row) => row.branchId}
                defaultSort={{ key: "net", direction: "desc" }}
                emptyMessage="No branch breakdown is available for this customer."
                renderMobileCard={(row) => (
                  <BreakdownMobileCard
                    {...row}
                    name={row.branchName}
                    code={row.branchCode}
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="salespeople">
              <ReportDataTable
                columns={salespersonColumns}
                rows={selectedCustomer.salespersonBreakdown}
                rowKey={(row) => row.salesmanId}
                defaultSort={{ key: "net", direction: "desc" }}
                emptyMessage="No salesperson breakdown is available for this customer."
                renderMobileCard={(row) => (
                  <BreakdownMobileCard
                    {...row}
                    name={row.salesmanName}
                    code={row.salesmanCode}
                  />
                )}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
