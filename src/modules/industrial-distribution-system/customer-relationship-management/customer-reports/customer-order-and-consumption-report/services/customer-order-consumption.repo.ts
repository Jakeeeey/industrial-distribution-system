// ============================================================
// customer-order-consumption.repo.ts
// I/O layer ONLY — one Directus read per collection, no aggregation.
//
// Collections read:
//   sales_invoice, sales_invoice_details, sales_return,
//   sales_return_details, sales_invoice_sales_return, post_dispatch_invoices,
//   lpg_metered_wiwo_transactions, lpg_wiwo_headers, lpg_wiwo_details,
//   lpg_meter_readings, lpg_customer_lpg_sites,
//   customer, customer_classification, products, units, weight_unit,
//   categories, branches, salesman
// ============================================================

import type {
  ConsumptionSourceData,
  CustomerOrderConsumptionFilters,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawLpgSiteRow,
  RawMeterReadingRow,
  RawPostDispatchRow,
  RawProductRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  RawSalesmanRow,
  RawUnitRow,
  RawUnifiedLpgRow,
  RawWeightUnitRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
} from "../types/customer-order-consumption.types";
import {
  type DirectusConfig,
  type DirectusFetchOptions,
  chunk,
  fetchDirectusRows,
  resolveDirectusConfig,
} from "./directus";

export interface CustomerOrderConsumptionRepoOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Injectable clock so the service envelope is deterministic in tests. */
  now?: Date;
  /** Test seam: overrides the env-derived Directus endpoint. */
  config?: Partial<DirectusConfig>;
}

// invoice_date and return_date are TIMESTAMP columns. A bare date would
// compare as midnight and silently drop the whole final day of the window.
function windowFilter(
  column: string,
  filters: CustomerOrderConsumptionFilters,
  timeStamped: boolean
): Record<string, unknown> {
  const start = timeStamped ? `${filters.startDate}T00:00:00` : filters.startDate;
  const end = timeStamped ? `${filters.endDate}T23:59:59` : filters.endDate;
  return { [column]: { _gte: start, _lte: end } };
}

function flatten(batches: unknown[][]): unknown[] {
  return batches.reduce<unknown[]>((all, rows) => all.concat(rows), []);
}

/**
 * A multi-select becomes an `_in` clause. An empty or absent selection adds
 * nothing, because "everything" is the absence of a filter, never a filter
 * that matches no row.
 */
function selectedIn(
  column: string,
  values?: readonly (string | number)[]
): Record<string, unknown> {
  if (!values || values.length === 0) return {};
  return { [column]: { _in: [...values] } };
}

/**
 * Reads every collection the report needs and hands them to the pure
 * aggregation layer. Callers must not interpret these rows — that is
 * `calc.ts`'s job, so the same fixtures can drive both channels.
 */
export async function fetchCustomerOrderConsumptionSources(
  filters: CustomerOrderConsumptionFilters,
  options: CustomerOrderConsumptionRepoOptions = {}
): Promise<ConsumptionSourceData> {
  const config = resolveDirectusConfig();
  const merged: DirectusConfig = { ...config, ...options.config };

  const read = <T>(collection: string, query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">) =>
    fetchDirectusRows<T>(collection, {
      ...query,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
    }, merged);

  // ---- Masters (small, read whole) ----
  const [branches, units, weightUnits, categories, classifications, salesmen, products, lpgSites] =
    await Promise.all([
      read<RawBranchRow>("branches", {
        fields: "id,branch_name,branch_code",
        filter: { division_id: { _eq: 1 }, isActive: { _eq: 1 } },
      }),
      read<RawUnitRow>("units", { fields: "unit_id,unit_name,unit_shortcut" }),
      read<RawWeightUnitRow>("weight_unit", { fields: "id,code,name" }),
      read<RawCategoryRow>("categories", {
        fields: "category_id,category_name,is_industrial",
      }),
      read<RawClassificationRow>("customer_classification", { fields: "id,classification_name" }),
      read<RawSalesmanRow>("salesman", { fields: "id,salesman_code,salesman_name" }),
      read<RawProductRow>("products", {
        fields: "product_id,product_code,product_name,product_weight,weight,weight_unit_id,is_serialized,product_category",
      }),
      read<RawLpgSiteRow>("lpg_customer_lpg_sites", {
        fields: "id,customer_code,site_name,billing_mode",
      }),
    ]);

  // ---- Customers (scoped by the classification / code filters) ----
  const customerFilter: Record<string, unknown> = {
    ...selectedIn("classification", filters.classificationIds),
    ...selectedIn("customer_code", filters.customerCodes),
  };

  const customers = await read<RawCustomerRow>("customer", {
    fields: "customer_code,customer_name,store_name,classification",
    filter: customerFilter,
  });

  // ---- CYLINDER channel sources ----
  const invoiceFilter: Record<string, unknown> = {
    ...windowFilter("invoice_date", filters, true),
    ...selectedIn("branch_id", filters.branchIds),
    ...selectedIn("salesman_id", filters.salesmanIds),
    ...selectedIn("customer_code", filters.customerCodes),
  };

  const invoices = await read<RawInvoiceRow>("sales_invoice", {
    fields: "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount,discount_amount,isReplaced,isDispatched",
    filter: invoiceFilter,
    sort: "-invoice_date",
  });

  const invoiceIds = invoices.map((invoice) => invoice.invoice_id);
  const detailBatches = await Promise.all(
    chunk(invoiceIds).map((ids) =>
      read<RawInvoiceDetailRow>("sales_invoice_details", {
        fields: "detail_id,invoice_no,product_id,unit,quantity,unit_price,total_amount,discount_amount,gross_amount",
        filter: { invoice_no: { _in: ids } },
      })
    )
  );
  const invoiceDetails = flatten(detailBatches) as RawInvoiceDetailRow[];

  const dispatchBatches = await Promise.all(
    chunk(invoiceIds).map((ids) =>
      read<RawPostDispatchRow>("post_dispatch_invoices", {
        fields: "id,invoice_id,status",
        filter: { invoice_id: { _in: ids } },
      })
    )
  );
  const postDispatch = flatten(dispatchBatches) as RawPostDispatchRow[];

  const returnFilter: Record<string, unknown> = {
    ...windowFilter("return_date", filters, true),
    ...selectedIn("branch_id", filters.branchIds),
    ...selectedIn("salesman_id", filters.salesmanIds),
    ...selectedIn("customer_code", filters.customerCodes),
    deleted_at: { _null: true },
  };

  const returns = await read<RawReturnRow>("sales_return", {
    fields: "return_id,return_number,customer_code,branch_id,salesman_id,return_date,gross_amount,order_id,invoice_no,status,isPosted,deleted_at",
    filter: returnFilter,
    sort: "-return_date",
  });

  const returnNumbers = returns.map((ret) => ret.return_number);
  const returnDetailBatches = await Promise.all(
    chunk(returnNumbers).map((numbers) =>
      read<RawReturnDetailRow>("sales_return_details", {
        fields: "detail_id,return_no,product_id,quantity,total_amount,gross_amount,status",
        filter: { return_no: { _in: numbers } },
      })
    )
  );
  const returnDetails = flatten(returnDetailBatches) as RawReturnDetailRow[];

  const returnIds = returns.map((ret) => ret.return_id);
  const linkBatches = await Promise.all(
    chunk(returnIds).map((ids) =>
      read<RawReturnLinkRow>("sales_invoice_sales_return", {
        fields: "id,return_no,invoice_no,amount",
        filter: { return_no: { _in: ids } },
      })
    )
  );
  const returnLinks = flatten(linkBatches) as RawReturnLinkRow[];

  // ---- LPG channel sources ----
  // No LPG table carries a branch, so branch and salesman narrowing happens
  // in the aggregation pass, against the invoice that billed the transaction.
  const lpgScope: Record<string, unknown> = selectedIn(
    "customer_code",
    filters.customerCodes
  );

  const [unifiedLpg, wiwoHeaders, meterReadings] = await Promise.all([
    read<RawUnifiedLpgRow>("lpg_metered_wiwo_transactions", {
      fields: "id,transaction_no,transaction_type,lpg_site_id,customer_code,sales_order_id,sales_order_no,meter_reading_id,wiwo_header_id,transaction_date,billing_period_from,billing_period_to,metered_kg,wiwo_kg,variance_kg,variance_reason_code,billable_source,billable_kg,price_per_kg,gross_amount,discount_amount,net_amount,sales_invoice_id,sales_invoice_no,status",
      filter: { status: { _eq: "POSTED" }, ...windowFilter("transaction_date", filters, false), ...lpgScope },
    }),
    read<RawWiwoHeaderRow>("lpg_wiwo_headers", {
      fields: "id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_billable_kg,gross_amount,net_amount,wiwo_status,sales_invoice_id,sales_invoice_no",
      filter: { wiwo_status: { _eq: "POSTED" }, ...windowFilter("transaction_date", filters, false), ...lpgScope },
    }),
    read<RawMeterReadingRow>("lpg_meter_readings", {
      fields: "id,lpg_site_id,customer_code,reading_no,reading_date,billing_period_from,billing_period_to,meter_unit,kg_consumed,price_per_kg,gross_amount,net_amount,reading_status,sales_invoice_id,sales_invoice_no",
      filter: { reading_status: { _eq: "POSTED" }, ...windowFilter("reading_date", filters, false), ...lpgScope },
    }),
  ]);

  const wiwoHeaderIds = wiwoHeaders.map((header) => header.id);
  const wiwoDetailBatches = await Promise.all(
    chunk(wiwoHeaderIds).map((ids) =>
      read<RawWiwoDetailRow>("lpg_wiwo_details", {
        fields: "id,wiwo_header_id,lpg_site_id,customer_code,line_type,product_id,serial_number,tare_weight_kg,consumed_lpg_kg,billable_kg,price_per_kg,gross_amount,net_amount,is_billable",
        filter: { wiwo_header_id: { _in: ids } },
      })
    )
  );
  const wiwoDetails = flatten(wiwoDetailBatches) as RawWiwoDetailRow[];

  // ---- Branch recovery for LPG rows ----
  // An LPG transaction billed before the window still belongs to the report;
  // its invoice is fetched by id so the branch is real instead of unknown.
  const windowInvoiceIds = new Set(invoiceIds);
  const outsideInvoiceIds = [
    ...new Set(
      [
        ...unifiedLpg.map((row) => row.sales_invoice_id),
        ...wiwoHeaders.map((row) => row.sales_invoice_id),
        ...meterReadings.map((row) => row.sales_invoice_id),
      ].filter((id): id is number => id != null && !windowInvoiceIds.has(id))
    ),
  ];

  const outsideBatches = await Promise.all(
    chunk(outsideInvoiceIds).map((ids) =>
      read<RawInvoiceRow>("sales_invoice", {
        fields: "invoice_id,order_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,net_amount,gross_amount,discount_amount,isReplaced,isDispatched",
        filter: { invoice_id: { _in: ids } },
      })
    )
  );

  return {
    invoices: [...invoices, ...flatten(outsideBatches)] as RawInvoiceRow[],
    invoiceDetails,
    returns,
    returnDetails,
    returnLinks,
    products,
    units,
    weightUnits,
    categories,
    customers,
    classifications,
    branches,
    salesmen,
    lpgSites,
    unifiedLpg,
    wiwoHeaders,
    wiwoDetails,
    meterReadings,
    // The window filter above already dropped any row outside it, and the
    // extra invoices only exist to resolve a branch.
    postDispatch,
  };
}
