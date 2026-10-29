// ============================================================
// customer-incentive.repo.ts
// I/O layer ONLY — one Directus read per collection, no aggregation.
//
// Collections read:
//   sales_invoice, sales_invoice_details, sales_return,
//   sales_return_details, sales_invoice_sales_return,
//   customers_memo, customer_memo_invoices, customer_memo_transmittals,
//   chart_of_accounts, products, categories (is_industrial only), customer,
//   customer_classification, branches, salesman
//
// Deliberately NOT read:
//   claims_transmittal — it keys on supplier_id, so it is a supplier claims
//   vehicle and cannot carry a customer incentive assessment.
//   lpg_customer_lpg_sites.default_price_per_kg — a current value with no
//   history; using it would restate closed periods and break the cutoff.
// ============================================================

import type {
  AppliedFilterContext,
  IncentiveSourceData,
  RawAccountRow,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawMemoInvoiceRow,
  RawMemoRow,
  RawMemoTransmittalRow,
  RawProductRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  RawSalesmanRow,
} from "../types/customer-incentive.types";
import {
  type DirectusConfig,
  type DirectusFetchOptions,
  chunk,
  fetchDirectusRows,
  resolveDirectusConfig,
} from "./directus";

/** customers_memo projection, kept in one place because the field list is long. */
const MEMO_FIELDS =
  "id,memo_number,customer_id,salesman_id,supplier_reference,customer_reference,amount,applied_amount,reason,status,chart_of_account,created_at,updated_at,deleted_at,isPending,isClaimed";

export interface CustomerIncentiveRepoOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Injectable clock so the service envelope is deterministic in tests. */
  now?: Date;
  /** Test seam: overrides the env-derived Directus endpoint. */
  config?: Partial<DirectusConfig>;
}

// invoice_date, return_date and created_at are TIMESTAMP columns. A bare date
// would compare as midnight and silently drop the whole final day of the
// window, so the upper bound is extended to the last second of the cutoff.
function windowFilter(
  column: string,
  filters: AppliedFilterContext
): Record<string, unknown> {
  return {
    [column]: {
      _gte: `${filters.startDate}T00:00:00`,
      _lte: `${filters.endDate}T23:59:59`,
    },
  };
}

/**
 * A list filter becomes one `_in` clause. An empty or absent list is left out
 * entirely rather than sent as an empty `_in`, which Directus reads as "match
 * nothing" and would return a zero-row report for a filter nobody chose.
 */
function inFilter(
  column: string,
  values: readonly (number | string)[] | undefined
): Record<string, unknown> {
  return values && values.length > 0
    ? { [column]: { _in: [...values] } }
    : {};
}

function flatten<T>(batches: T[][]): T[] {
  return batches.reduce<T[]>((all, rows) => all.concat(rows), []);
}

/**
 * Reads every collection the report needs and hands them to the pure
 * aggregation layer. Callers must not interpret these rows — that is
 * `calc.ts`'s job, so the same fixtures can drive both sides.
 */
export async function fetchCustomerIncentiveSources(
  filters: AppliedFilterContext,
  options: CustomerIncentiveRepoOptions = {}
): Promise<IncentiveSourceData> {
  const config = resolveDirectusConfig();
  const merged: DirectusConfig = { ...config, ...options.config };

  const read = <T>(
    collection: string,
    query: Omit<DirectusFetchOptions, "signal" | "fetchImpl">
  ) =>
    fetchDirectusRows<T>(
      collection,
      { ...query, fetchImpl: options.fetchImpl, signal: options.signal },
      merged
    );

  // ---- Masters (small, read whole) ----
  // Only industrial categories are read: a cafeteria or services category can
  // never carry a refill incentive, so it has no business being a choice here.
  const [branches, classifications, salesmen, products, categories] =
    await Promise.all([
      // AG-FILTER: Only read Industrial Division branches (division_id = 1) and active status.
      read<RawBranchRow>("branches", {
        fields: "id,branch_name,branch_code",
        filter: { division_id: { _eq: 1 }, isActive: { _eq: 1 } },
        sort: "branch_name",
      }),
      read<RawClassificationRow>("customer_classification", {
        fields: "id,classification_name",
      }),
      read<RawSalesmanRow>("salesman", {
        fields: "id,salesman_code,salesman_name",
      }),
      // AG-FILTER: Strictly read serialized products (is_serialized = 1) per IDS guide rule.
      // Description is included to display as product name per guide rules.
      read<RawProductRow>("products", {
        fields: "product_id,product_code,product_name,description,product_weight,product_category,is_serialized",
        filter: { is_serialized: { _eq: 1 } },
      }),
      read<RawCategoryRow>("categories", {
        fields: "category_id,category_name",
        filter: { is_industrial: { _eq: 1 } },
        sort: "category_name",
      }),
    ]);

  // ---- Customers ----
  // `id` is read because customers_memo keys on customer_id while the sales
  // documents key on customer_code; both sides are needed to join them.
  const customers = await read<RawCustomerRow>("customer", {
    fields: "id,customer_code,customer_name,store_name,classification",
    filter: {
      ...inFilter("classification", filters.classificationIds),
      ...inFilter("customer_code", filters.customerCodes),
    },
  });

  // ---- Eligible refill evidence ----
  // AG-FILTER: Strictly restrict data scope to Industrial Division branches (division_id = 1).
  // If the user picked branches, use those (filtered to industrial); otherwise, default to all industrial branches.
  const industrialBranchIds = branches.map((branch) => branch.id);
  const effectiveBranchIds =
    (filters.branchIds?.length ?? 0) > 0
      ? filters.branchIds!.filter((id) => industrialBranchIds.includes(id))
      : industrialBranchIds;

  const scopeFilter = {
    ...inFilter("branch_id", effectiveBranchIds),
    ...inFilter("salesman_id", filters.salesmanIds),
    ...inFilter("customer_code", filters.customerCodes),
  };

  const invoiceFilter: Record<string, unknown> = {
    ...windowFilter("invoice_date", filters),
    ...scopeFilter,
  };

  const invoices = await read<RawInvoiceRow>("sales_invoice", {
    // `isReplaced` is read rather than filtered so a reprint surfaces as an
    // exception instead of vanishing from the volume a claim was raised on.
    // `total_amount` is read so supporting documents display their document amount.
    fields:
      "invoice_id,invoice_no,customer_code,branch_id,salesman_id,invoice_date,transaction_status,isReplaced,total_amount",
    filter: invoiceFilter,
    sort: "-invoice_date",
  });

  const invoiceIds = invoices.map((invoice) => invoice.invoice_id);
  const detailBatches = await Promise.all(
    chunk(invoiceIds).map((ids) =>
      read<RawInvoiceDetailRow>("sales_invoice_details", {
        fields: "detail_id,invoice_no,product_id,quantity,unit_price",
        filter: { invoice_no: { _in: ids } },
      })
    )
  );
  // AG-FILTER: Only retain details for serialized products (is_serialized = 1).
  // Non-serialized items (e.g. wafers, snacks, FMCG, groceries) are not cylinders and must not be loaded.
  const serializedProductIds = new Set(products.map((p) => p.product_id));
  const invoiceDetails = flatten(detailBatches).filter((d) =>
    serializedProductIds.has(Number(d.product_id))
  );

  // ---- Approved return adjustments ----
  const returnFilter: Record<string, unknown> = {
    ...windowFilter("return_date", filters),
    ...scopeFilter,
    deleted_at: { _null: true },
  };

  const returns = await read<RawReturnRow>("sales_return", {
    fields:
      "return_id,return_number,customer_code,branch_id,salesman_id,return_date,status,isPosted,deleted_at,total_amount",
    filter: returnFilter,
    sort: "-return_date",
  });

  const returnNumbers = returns.map((ret) => ret.return_number);
  const returnDetailBatches = await Promise.all(
    chunk(returnNumbers).map((numbers) =>
      read<RawReturnDetailRow>("sales_return_details", {
        fields: "detail_id,return_no,product_id,quantity,status",
        filter: { return_no: { _in: numbers } },
      })
    )
  );
  const returnDetails = flatten(returnDetailBatches).filter((d) =>
    serializedProductIds.has(Number(d.product_id))
  );

  const returnIds = returns.map((ret) => ret.return_id);
  const linkBatches = await Promise.all(
    chunk(returnIds).map((ids) =>
      read<RawReturnLinkRow>("sales_invoice_sales_return", {
        fields: "id,return_no,invoice_no,amount",
        filter: { return_no: { _in: ids } },
      })
    )
  );
  const returnLinks = flatten(linkBatches);

  // ---- Claims (customers_memo) ----
  // Memos carry no branch column, so branch scoping is applied to the sales
  // evidence and a memo keeps the branch of the customer rows it reconciles
  // against; an orphan memo surfaces as BRANCH_UNRESOLVED.
  const memoScope: Record<string, unknown> = {
    ...windowFilter("created_at", filters),
    deleted_at: { _null: true },
    status: { _neq: "DELETED" },
  };

  // AG-FILTER: Strictly scope memos to relevant industrial customers.
  // If customerCodes or classificationIds are provided, follow that cut.
  // Otherwise, only load memos for customers who actually have sales or return evidence
  // in the scoped industrial branches during this period, preventing unrelated retail /
  // non-industrial memos (e.g. multi-billion supermarket claims) from polluting this report.
  const customerScoped =
    (filters.customerCodes?.length ?? 0) > 0 ||
    (filters.classificationIds?.length ?? 0) > 0;

  const relevantCustomerCodes = new Set<string>();
  if (customerScoped) {
    customers.forEach((c) => relevantCustomerCodes.add(c.customer_code));
  } else {
    // AG-FILTER: Only identify customer codes with transactions for ELIGIBLE serialized products.
    // Invoices or returns with purely non-industrial items (e.g. supermarket retail groceries)
    // must not cause unrelated non-industrial credit memos to be pulled into this report.
    const eligibleProductIds = new Set(products.map((p) => p.product_id));
    const eligibleInvoiceNos = new Set(
      invoiceDetails
        .filter((d) => eligibleProductIds.has(Number(d.product_id)))
        .map((d) => Number(d.invoice_no))
    );
    const eligibleReturnNos = new Set(
      returnDetails
        .filter((d) => eligibleProductIds.has(Number(d.product_id)))
        .map((d) => String(d.return_no))
    );

    invoices.forEach((inv) => {
      if (inv.customer_code && eligibleInvoiceNos.has(inv.invoice_id)) {
        relevantCustomerCodes.add(inv.customer_code);
      }
    });
    returns.forEach((ret) => {
      if (ret.customer_code && eligibleReturnNos.has(String(ret.return_number))) {
        relevantCustomerCodes.add(ret.customer_code);
      }
    });
  }

  const relevantCustomerIds = customers
    .filter((c) => relevantCustomerCodes.has(c.customer_code))
    .map((c) => c.id);

  const memoBatches =
    relevantCustomerIds.length === 0
      ? []
      : await Promise.all(
          chunk(relevantCustomerIds).map((ids) =>
            read<RawMemoRow>("customers_memo", {
              fields: MEMO_FIELDS,
              filter: { ...memoScope, customer_id: { _in: ids } },
              sort: "-created_at",
            })
          )
        );
  const memos = flatten(memoBatches);

  const memoIds = memos.map((memo) => memo.id);
  const [memoInvoiceBatches, memoTransmittalBatches] = await Promise.all([
    Promise.all(
      chunk(memoIds).map((ids) =>
        read<RawMemoInvoiceRow>("customer_memo_invoices", {
          fields: "id,invoice_id,memo_id,amount,date_applied",
          filter: { memo_id: { _in: ids } },
        })
      )
    ),
    Promise.all(
      chunk(memoIds).map((ids) =>
        read<RawMemoTransmittalRow>("customer_memo_transmittals", {
          fields: "id,memo_id,transmitted_to,paid_amount,received_at,transmittal_no,created_at",
          filter: { memo_id: { _in: ids } },
        })
      )
    ),
  ]);

  const memoInvoices = flatten(memoInvoiceBatches);
  const memoTransmittals = flatten(memoTransmittalBatches);

  // ---- GL labels behind each memo ----
  const coaIds = [
    ...new Set(
      memos
        .map((memo) => memo.chart_of_account)
        .filter((id): id is number => id != null)
    ),
  ];
  const coaBatches = await Promise.all(
    chunk(coaIds).map((ids) =>
      read<RawAccountRow>("chart_of_accounts", {
        fields: "coa_id,gl_code,account_title",
        filter: { coa_id: { _in: ids } },
      })
    )
  );

  return {
    branches,
    classifications,
    salesmen,
    products,
    categories,
    customers,
    invoices,
    invoiceDetails,
    returns,
    returnDetails,
    returnLinks,
    memos,
    memoInvoices,
    memoTransmittals,
    accounts: flatten(coaBatches),
  };
}
