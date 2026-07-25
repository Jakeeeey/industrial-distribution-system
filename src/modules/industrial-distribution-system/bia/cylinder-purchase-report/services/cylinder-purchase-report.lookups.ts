import type {
  ReportLookupOption,
  ReportLookupType,
} from "../types/cylinder-purchase-report.types.ts";

type DirectusLookupRow = Record<string, unknown>;

interface LookupConfig {
  collection: string;
  fields: string;
  sort: string;
  limit: string;
  identifier: string;
  code: string;
  name: string;
  searchFields?: readonly string[];
}

export interface ReportLookupRequest {
  type: ReportLookupType;
  q: string;
}

export interface CylinderPurchaseReportLookupOptions {
  directusBaseUrl?: string;
  directusToken?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

const LOOKUP_CONFIG: Record<ReportLookupType, LookupConfig> = {
  customers: {
    collection: "customer",
    fields: "customer_code,customer_name",
    sort: "customer_name",
    limit: "50",
    identifier: "customer_code",
    code: "customer_code",
    name: "customer_name",
    searchFields: ["customer_code", "customer_name"],
  },
  products: {
    collection: "products",
    fields: "product_id,product_code,product_name",
    sort: "product_name",
    limit: "50",
    identifier: "product_id",
    code: "product_code",
    name: "product_name",
    searchFields: ["product_code", "product_name"],
  },
  branches: {
    collection: "branches",
    fields: "id,branch_code,branch_name",
    sort: "branch_name",
    limit: "-1",
    identifier: "id",
    code: "branch_code",
    name: "branch_name",
  },
  salespeople: {
    collection: "salesman",
    fields: "id,salesman_code,salesman_name",
    sort: "salesman_name",
    limit: "-1",
    identifier: "id",
    code: "salesman_code",
    name: "salesman_name",
  },
};

function configuredDirectusBaseUrl(options: CylinderPurchaseReportLookupOptions): string {
  const baseUrl = [
    options.directusBaseUrl,
    process.env.DIRECTUS_URL,
    process.env.NEXT_PUBLIC_DIRECTUS_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  if (!baseUrl) {
    throw new Error("Directus is not configured.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function configuredDirectusToken(options: CylinderPurchaseReportLookupOptions): string | undefined {
  return [options.directusToken, process.env.DIRECTUS_STATIC_TOKEN, process.env.DIRECTUS_TOKEN]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

function lookupValue(row: DirectusLookupRow, field: string): string | undefined {
  const value = row[field];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function normalizeOptions(
  rows: unknown,
  config: LookupConfig,
): ReportLookupOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is DirectusLookupRow => typeof row === "object" && row !== null)
    .flatMap((row): ReportLookupOption[] => {
      const value = lookupValue(row, config.identifier);
      if (!value) {
        return [];
      }
      const code = lookupValue(row, config.code);
      const label = lookupValue(row, config.name) ?? code ?? value;
      return [{ value, label, ...(code ? { code } : {}) }];
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function fetchReportLookups(
  request: ReportLookupRequest,
  options: CylinderPurchaseReportLookupOptions = {},
): Promise<ReportLookupOption[]> {
  const config = LOOKUP_CONFIG[request.type];
  const params = new URLSearchParams({
    fields: config.fields,
    sort: config.sort,
    limit: config.limit,
  });

  if (request.type === "products") {
    params.set("filter[is_serialized][_eq]", "1");
    params.set("filter[isActive][_eq]", "1");
  }
  if (request.q && config.searchFields) {
    config.searchFields.forEach((field, index) => {
      params.set(`filter[_or][${index}][${field}][_icontains]`, request.q);
    });
  }

  const token = configuredDirectusToken(options);
  const response = await (options.fetchImpl ?? fetch)(
    new URL(`/items/${config.collection}?${params.toString()}`, configuredDirectusBaseUrl(options)),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Directus lookup request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  const rows =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data?: unknown }).data
      : undefined;
  return normalizeOptions(rows, config);
}
