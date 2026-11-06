// ============================================================
// customer-incentive.lookups.ts
// Typeahead reads for the filter bar. Only the five whitelisted
// collections can be reached; the query type is validated by Zod upstream.
// ============================================================

import type {
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawSalesmanRow,
  ReportLookupOption,
} from "../types/customer-incentive.types";
import type { ReportLookupQueryInput } from "../types/customer-incentive.schema";
import { parseCategorySizeKg } from "./customer-incentive.helpers";
import {
  type DirectusConfig,
  fetchDirectusRows,
  resolveDirectusConfig,
} from "./directus";

export interface LookupRepoOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  config?: Partial<DirectusConfig>;
}

// Fetch all options without truncation so client-side caching in sessionStorage
// holds the complete customer/option dataset.
const LOOKUP_LIMIT = -1;

function containsFilter(field: string, q?: string): Record<string, unknown> {
  if (!q) return {};
  return { [field]: { _contains: q } };
}

/**
 * Resolves filter-bar options for one lookup type.
 * Labels always carry the code so two similarly named customers cannot be
 * picked by mistake.
 */
export async function fetchReportLookupOptions(
  query: ReportLookupQueryInput,
  options: LookupRepoOptions = {}
): Promise<ReportLookupOption[]> {
  const config = { ...resolveDirectusConfig(), ...options.config };
  const read = <T>(
    collection: string,
    fields: string,
    filter: Record<string, unknown>,
    sort: string
  ) =>
    fetchDirectusRows<T>(
      collection,
      {
        fields,
        filter,
        sort,
        limit: LOOKUP_LIMIT,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
      },
      config
    );

  if (query.type === "branches") {
    // AG-FILTER: Strictly filter branches for Industrial Division (division_id = 1) and active status.
    const branchFilter: Record<string, unknown> = {
      division_id: { _eq: 1 },
      isActive: { _eq: 1 },
      ...containsFilter("branch_name", query.q),
    };
    const rows = await read<RawBranchRow>(
      "branches",
      "id,branch_name,branch_code",
      branchFilter,
      "branch_name"
    );
    return rows.map((row) => ({
      value: String(row.id),
      label: `${row.branch_name ?? row.id}${row.branch_code ? ` (${row.branch_code})` : ""}`,
      code: row.branch_code ?? undefined,
    }));
  }

  if (query.type === "salesmen") {
    const rows = await read<RawSalesmanRow>(
      "salesman",
      "id,salesman_code,salesman_name",
      containsFilter("salesman_name", query.q),
      "salesman_name"
    );
    return rows.map((row) => ({
      value: String(row.id),
      label: `${row.salesman_name ?? row.id} (${row.salesman_code ?? "—"})`,
      code: row.salesman_code ?? undefined,
    }));
  }

  if (query.type === "classifications") {
    const rows = await read<RawClassificationRow>(
      "customer_classification",
      "id,classification_name",
      containsFilter("classification_name", query.q),
      "classification_name"
    );
    return rows.map((row) => ({
      value: String(row.id),
      label: row.classification_name ?? String(row.id),
    }));
  }

  if (query.type === "categories") {
    const rows = await read<RawCategoryRow>(
      "categories",
      "category_id,category_name",
      {
        is_industrial: { _eq: 1 },
        ...containsFilter("category_name", query.q),
      },
      "category_name"
    );
    // A category with no "<n>KG" in its name cannot state what is being
    // priced per kilogram, so offering it would let the reader pick a filter
    // whose figure the report cannot compute. It is dropped here rather than
    // surfacing as a zero-row answer later.
    return rows
      .map((row) => ({ row, sizeKg: parseCategorySizeKg(row.category_name) }))
      .filter(
        (
          entry
        ): entry is { row: RawCategoryRow; sizeKg: number } =>
          entry.sizeKg !== null
      )
      .map(({ row, sizeKg }) => ({
        value: String(row.category_id),
        // Display only the category name to avoid redundant suffixes like "1.4KG — 1.4 kg"
        label: row.category_name ?? String(row.category_id),
        code: row.category_name ?? undefined,
        sizeKg,
      }));
  }

  const rows = await read<RawCustomerRow>(
    "customer",
    "id,customer_code,customer_name,store_name,classification",
    {
      ...(query.q
        ? {
            _or: [
              { customer_name: { _contains: query.q } },
              { customer_code: { _contains: query.q } },
              { store_name: { _contains: query.q } },
            ],
          }
        : {}),
    },
    "customer_name"
  );

  return rows.map((row) => ({
    value: row.customer_code,
    label: `${row.customer_name ?? row.customer_code}${
      row.store_name && row.store_name !== row.customer_name ? ` — ${row.store_name}` : ""
    }`,
    code: row.customer_code,
  }));
}
