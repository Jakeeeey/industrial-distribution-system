"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
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
  ProductPurchaseSummary,
  SalespersonCustomerProductPurchaseSummary,
  SalespersonCustomerPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import { formatQuantity, formatReturnRate } from "./analytical-view.utils";
import {
  CustomerBreakdownIdentity,
  CustomerBreakdownMobileCard,
} from "./CustomerBreakdownDisplay";
import { ReportDataTable, type ReportColumn } from "./ReportDataTable";
import {
  filterCustomerProducts,
  selectSalespersonCustomer,
  type SalespersonDetailTab,
} from "./salesperson-purchase-detail.utils";

const metricColumns = <T extends {
  grossPurchasedQty: number;
  returnedQty: number;
  netPurchasedQty: number;
  returnRate: number;
}>(): readonly ReportColumn<T>[] => [
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
];

const customerColumns: readonly ReportColumn<SalespersonCustomerPurchaseSummary>[] = [
  {
    key: "customer",
    label: "Customer",
    value: (row) => row.customerName,
    render: (row) => (
      <CustomerBreakdownIdentity
        name={row.customerName}
        code={row.customerCode ?? "No customer code"}
      />
    ),
  },
  {
    key: "products",
    label: "Cylinders",
    value: (row) => row.uniqueProducts,
    render: (row) => formatQuantity(row.uniqueProducts),
    align: "right",
  },
  ...metricColumns<SalespersonCustomerPurchaseSummary>(),
];

const productColumns: readonly ReportColumn<ProductPurchaseSummary>[] = [
  {
    key: "product",
    label: "Cylinder",
    value: (row) => row.productName,
    render: (row) => (
      <CustomerBreakdownIdentity
        name={row.productName}
        code={row.productCode}
      />
    ),
  },
  {
    key: "customers",
    label: "Customers",
    value: (row) => row.uniqueCustomers,
    render: (row) => formatQuantity(row.uniqueCustomers),
    align: "right",
  },
  ...metricColumns<ProductPurchaseSummary>(),
];

const customerProductColumns: readonly ReportColumn<SalespersonCustomerProductPurchaseSummary>[] = [
  {
    key: "customer",
    label: "Customer",
    value: (row) => row.customerName,
    render: (row) => (
      <CustomerBreakdownIdentity
        name={row.customerName}
        code={row.customerCode ?? "No customer code"}
      />
    ),
  },
  {
    key: "product",
    label: "Cylinder",
    value: (row) => row.productName,
    render: (row) => (
      <CustomerBreakdownIdentity
        name={row.productName}
        code={row.productCode}
      />
    ),
  },
  ...metricColumns<SalespersonCustomerProductPurchaseSummary>(),
];

export function SalespersonPurchaseDetail(): React.ReactElement {
  const { selectedSalesperson, closeSalespersonDetail } =
    useCylinderPurchaseReport();
  const [activeTab, setActiveTab] =
    React.useState<SalespersonDetailTab>("customers");
  const [selectedCustomerKey, setSelectedCustomerKey] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    setActiveTab("customers");
    setSelectedCustomerKey(null);
  }, [selectedSalesperson?.salesmanId]);

  const selectedCustomer = React.useMemo(
    () =>
      selectedSalesperson?.customerBreakdown.find(
        (customer) => customer.customerKey === selectedCustomerKey,
      ) ?? null,
    [selectedCustomerKey, selectedSalesperson],
  );
  const filteredCustomerProducts = React.useMemo(
    () =>
      filterCustomerProducts(
        selectedSalesperson?.customerProductBreakdown ?? [],
        selectedCustomerKey,
      ),
    [selectedCustomerKey, selectedSalesperson],
  );

  const openCustomerCylinders = React.useCallback(
    (customer: SalespersonCustomerPurchaseSummary): void => {
      const selection = selectSalespersonCustomer(customer.customerKey);
      setSelectedCustomerKey(selection.selectedCustomerKey);
      setActiveTab(selection.activeTab);
    },
    [],
  );
  const handleTabChange = React.useCallback((value: string): void => {
    setActiveTab(value as SalespersonDetailTab);
  }, []);

  return (
    <Dialog
      open={selectedSalesperson !== null}
      onOpenChange={(open) => {
        if (!open) closeSalespersonDetail();
      }}
    >
      {selectedSalesperson ? (
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-7xl">
          <DialogHeader className="pr-8">
            <DialogTitle>{selectedSalesperson.salesmanName}</DialogTitle>
            <DialogDescription>
              {selectedSalesperson.salesmanCode} · Customer and cylinder
              purchase details
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricSummary
              label="Gross"
              value={formatQuantity(selectedSalesperson.grossPurchasedQty)}
            />
            <MetricSummary
              label="Returned"
              value={formatQuantity(selectedSalesperson.returnedQty)}
            />
            <MetricSummary
              label="Net"
              value={formatQuantity(selectedSalesperson.netPurchasedQty)}
            />
            <MetricSummary
              label="Return Rate"
              value={formatReturnRate(
                selectedSalesperson.returnRate,
                selectedSalesperson.grossPurchasedQty,
              )}
            />
          </dl>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="min-w-0"
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="grid min-w-[36rem] grid-cols-3">
                <TabsTrigger value="customers">Customers</TabsTrigger>
                <TabsTrigger value="products">Cylinders</TabsTrigger>
                <TabsTrigger value="customer-products">
                  Customer Purchases
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="customers">
              <ReportDataTable
                columns={customerColumns}
                rows={selectedSalesperson.customerBreakdown}
                rowKey={(row) => row.customerKey}
                defaultSort={{ key: "net", direction: "desc" }}
                searchLabel="Search salesperson customers"
                emptyMessage="No customer purchases are available for this salesperson."
                onRowClick={openCustomerCylinders}
                rowActionLabel={(row) =>
                  `View cylinders purchased by ${row.customerName}`
                }
                renderMobileCard={(row) => (
                  <CustomerBreakdownMobileCard
                    {...row}
                    name={row.customerName}
                    code={row.customerCode ?? "No customer code"}
                  />
                )}
              />
            </TabsContent>

            <TabsContent value="products">
              <ReportDataTable
                columns={productColumns}
                rows={selectedSalesperson.productBreakdown}
                rowKey={(row) => row.productId}
                defaultSort={{ key: "net", direction: "desc" }}
                searchLabel="Search salesperson cylinders"
                emptyMessage="No cylinder purchases are available for this salesperson."
                renderMobileCard={(row) => (
                  <CustomerBreakdownMobileCard
                    {...row}
                    name={row.productName}
                    code={row.productCode}
                  />
                )}
              />
            </TabsContent>

            <TabsContent value="customer-products">
              {selectedCustomer ? (
                <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Cylinders purchased by {selectedCustomer.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.customerCode ?? "No customer code"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCustomerKey(null)}
                  >
                    Show all customers
                  </Button>
                </div>
              ) : null}
              <ReportDataTable
                columns={customerProductColumns}
                rows={filteredCustomerProducts}
                rowKey={(row) => row.key}
                defaultSort={{ key: "net", direction: "desc" }}
                searchLabel="Search customer cylinder purchases"
                emptyMessage={
                  selectedCustomer
                    ? "No cylinder purchases are available for this customer."
                    : "No customer cylinder purchases are available for this salesperson."
                }
                renderMobileCard={(row) => (
                  <CustomerBreakdownMobileCard
                    {...row}
                    name={`${row.customerName} · ${row.productName}`}
                    code={`${row.customerCode ?? "No customer code"} · ${row.productCode}`}
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
