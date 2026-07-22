# BIA Cylinder Purchase Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/ids/bia/cylinder-purchase-report` as one optimized dashboard with seven reconciled analytical views, master-data filters, customer drill-down, and per-view plus consolidated exports.

**Architecture:** A thin App Router page mounts a client module and provider. The browser calls one local BFF; the BFF validates filters, fetches the Spring daily-grain view once, validates and reconciles every row, then builds all dashboard datasets in one linear pass. Pure helpers own aggregation and export-table preparation so UI, XLSX, and jsPDF all consume the same typed results.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zod 4, Tailwind CSS, shadcn/Radix UI, Lucide, Sonner, jsPDF 4, jspdf-autotable 5, XLSX 0.18, Node 24 test runner.

## Global Constraints

- Follow `.agents/workflows/core/create-new-module.md` and `.agents/workflows/core/architecture-rules.md`.
- Preserve one-way flow: View -> Provider/Hook -> local BFF -> service/repository -> Spring Boot or Directus master source.
- Use `@/` aliases in production files; tests may use an explicit relative `.ts` import so Node 24 can execute them without another test dependency.
- Keep TypeScript interfaces, Zod schemas, pure helpers, repositories, and orchestration services in separate focused files.
- Use `SPRING_API_BASE_URL` on the server; never expose the Spring host or Directus token to the browser.
- The report is read-only and every report fetch uses `cache: "no-store"`.
- The default date range is the rolling last 30 calendar days, inclusive of today.
- Product lookup results must be limited to `is_serialized = 1`.
- Keep null-customer rows visible under the report-only `UNASSIGNED` key and `Unassigned Customer` label.
- All seven views and every export must derive from one aggregated response.
- PDF and print use jsPDF plus jspdf-autotable; spreadsheets use XLSX.
- Do not modify the user's existing unrelated changes in `next.config.ts`, `package-lock.json`, or `scripts/`.

---

## Planned File Structure

```text
src/modules/industrial-distribution-system/bia/cylinder-purchase-report/
|-- components/
|   |-- CylinderPurchaseReportHeader.tsx
|   |-- CylinderPurchaseFilters.tsx
|   |-- CylinderPurchaseOverview.tsx
|   |-- CylinderPurchaseDashboardNav.tsx
|   |-- ReportErrorState.tsx
|   |-- CustomerRankingView.tsx
|   |-- CustomerPurchaseDetail.tsx
|   |-- ProductPerformanceView.tsx
|   |-- ReturnAnalysisView.tsx
|   |-- BranchPerformanceView.tsx
|   |-- SalespersonPerformanceView.tsx
|   `-- ReportDataTable.tsx
|-- hooks/
|   `-- useCylinderPurchaseReport.ts
|-- providers/
|   `-- CylinderPurchaseReportProvider.tsx
|-- services/
|   |-- cylinder-purchase-report.errors.ts
|   |-- cylinder-purchase-report.helpers.ts
|   |-- cylinder-purchase-report.helpers.test.ts
|   |-- cylinder-purchase-report.repo.ts
|   |-- cylinder-purchase-report.service.ts
|   |-- cylinder-purchase-report.service.test.ts
|   |-- cylinder-purchase-report.client.ts
|   |-- cylinder-purchase-report.lookups.ts
|   |-- cylinder-purchase-report.export-model.ts
|   |-- cylinder-purchase-report.export-model.test.ts
|   |-- cylinder-purchase-report.pdf.ts
|   |-- cylinder-purchase-report.xlsx.ts
|   `-- index.ts
|-- types/
|   |-- cylinder-purchase-report.types.ts
|   `-- cylinder-purchase-report.schema.ts
|-- CylinderPurchaseReportModule.tsx
`-- index.ts

src/app/api/ids/bia/cylinder-purchase-report/route.ts
src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts
src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx
```

`types` defines the contract, `helpers` owns pure O(n) aggregation, `repo` owns Spring I/O, `service` validates and orchestrates server work, `client` owns browser BFF calls, and export files remain independent of React.

---

### Task 1: Define and prove the report contract and aggregation rules

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.ts`
- Test: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts`

**Interfaces:**
- Consumes: Spring camelCase row fields shown in the supplied API sample.
- Produces: `CylinderPurchaseRow`, `CylinderPurchaseReportFilters`, `CylinderPurchaseDashboardResponse`, `getRollingThirtyDayRange(now)`, and `aggregateCylinderPurchases(rows, filters, generatedAt)`.

- [ ] **Step 1: Write failing aggregation tests**

Use `node:test` and `node:assert/strict`. Include one normal purchase, one return-only customer/product combination, two null-customer rows, and a decimal case:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCylinderPurchases,
  getRollingThirtyDayRange,
} from "./cylinder-purchase-report.helpers.ts";
import type { CylinderPurchaseRow } from "../types/cylinder-purchase-report.types.ts";

const row = (patch: Partial<CylinderPurchaseRow> = {}): CylinderPurchaseRow => ({
  customerCode: "C-001",
  customerName: "Alpha Store",
  invoiceDate: "2026-07-01",
  productId: 11,
  productCode: "LPG-11",
  productName: "LPG 11KG",
  branchId: 1,
  branchCode: "B01",
  branchName: "Main",
  salesmanId: 7,
  salesmanCode: "S07",
  salesmanName: "Ana",
  grossPurchasedQty: 10,
  returnedQty: 2,
  netPurchasedQty: 8,
  ...patch,
});

test("rolling range contains exactly 30 inclusive dates", () => {
  assert.deepEqual(getRollingThirtyDayRange(new Date("2026-07-22T08:00:00+08:00")), {
    startDate: "2026-06-23",
    endDate: "2026-07-22",
  });
});

test("one pass aggregation reconciles all compatible views", () => {
  const rows = [
    row(),
    row({ productId: 50, productCode: "LPG-50", productName: "LPG 50KG", grossPurchasedQty: 4, returnedQty: 0, netPurchasedQty: 4 }),
    row({ customerCode: null, customerName: null, grossPurchasedQty: 1, returnedQty: 0, netPurchasedQty: 1 }),
    row({ customerCode: null, customerName: null, productId: 50, productCode: "LPG-50", productName: "LPG 50KG", grossPurchasedQty: 0, returnedQty: 3, netPurchasedQty: -3 }),
  ];
  const result = aggregateCylinderPurchases(
    rows,
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  assert.deepEqual(result.overview, {
    grossPurchasedQty: 15,
    returnedQty: 5,
    netPurchasedQty: 10,
    uniqueCustomers: 2,
    serializedProducts: 2,
  });
  assert.equal(result.customerRanking[0].customerCode, "C-001");
  assert.equal(result.customerRanking[1].customerKey, "UNASSIGNED");
  assert.equal(result.customerRanking[1].customerName, "Unassigned Customer");
  assert.equal(result.customerRanking[1].netPurchasedQty, -2);
  assert.equal(result.returnAnalysis.overall.returnRate, 5 / 15);
  assert.equal(result.customerRanking.reduce((sum, item) => sum + item.netPurchasedQty, 0), result.overview.netPurchasedQty);
  assert.equal(result.productPerformance.reduce((sum, item) => sum + item.netPurchasedQty, 0), result.overview.netPurchasedQty);
  assert.equal(result.branchPerformance.reduce((sum, item) => sum + item.netPurchasedQty, 0), result.overview.netPurchasedQty);
  assert.equal(result.salespersonPerformance.reduce((sum, item) => sum + item.netPurchasedQty, 0), result.overview.netPurchasedQty);
});

test("zero gross produces a zero return ratio", () => {
  const result = aggregateCylinderPurchases(
    [row({ grossPurchasedQty: 0, returnedQty: 2, netPurchasedQty: -2 })],
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );
  assert.equal(result.returnAnalysis.overall.returnRate, 0);
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run:

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts"
```

Expected: FAIL because the types and helper modules do not exist.

- [ ] **Step 3: Define exact TypeScript contracts**

Define identity, metrics, nested customer detail, return analysis, lookup options, and response types. Use these stable names:

```ts
export interface QuantityMetrics {
  grossPurchasedQty: number;
  returnedQty: number;
  netPurchasedQty: number;
}

export interface CylinderPurchaseRow extends QuantityMetrics {
  customerCode: string | null;
  customerName: string | null;
  invoiceDate: string;
  productId: number;
  productCode: string;
  productName: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
}

export interface CylinderPurchaseReportFilters {
  customerCode?: string;
  productId?: number;
  branchId?: number;
  salesmanId?: number;
  startDate: string;
  endDate: string;
}

export interface CustomerPurchaseSummary extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  returnRate: number;
  productBreakdown: ProductPurchaseSummary[];
  branchBreakdown: BranchPurchaseSummary[];
  salespersonBreakdown: SalespersonPurchaseSummary[];
}

export interface ProductPurchaseSummary extends QuantityMetrics {
  productId: number;
  productCode: string;
  productName: string;
  returnRate: number;
  uniqueCustomers: number;
}

export interface BranchPurchaseSummary extends QuantityMetrics {
  branchId: number;
  branchCode: string;
  branchName: string;
  returnRate: number;
  uniqueCustomers: number;
  uniqueProducts: number;
}

export interface SalespersonPurchaseSummary extends QuantityMetrics {
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
  returnRate: number;
  uniqueCustomers: number;
  uniqueProducts: number;
}

export interface ReturnAnalysisItem extends QuantityMetrics {
  key: string;
  code: string;
  label: string;
  returnRate: number;
}

export interface ReturnAnalysisDataset {
  overall: QuantityMetrics & { returnRate: number };
  byCustomer: ReturnAnalysisItem[];
  byProduct: ReturnAnalysisItem[];
  byBranch: ReturnAnalysisItem[];
  bySalesperson: ReturnAnalysisItem[];
}

export type ReportLookupType = "customers" | "products" | "branches" | "salespeople";

export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface ReportLookupResponse {
  data: ReportLookupOption[];
}

export type CylinderPurchaseDashboardView =
  | "customers"
  | "products"
  | "returns"
  | "branches"
  | "salespeople";

export interface CylinderPurchaseDashboardResponse {
  filters: CylinderPurchaseReportFilters;
  generatedAt: string;
  sourceRowCount: number;
  overview: QuantityMetrics & { uniqueCustomers: number; serializedProducts: number };
  customerRanking: CustomerPurchaseSummary[];
  productPerformance: ProductPurchaseSummary[];
  returnAnalysis: ReturnAnalysisDataset;
  branchPerformance: BranchPurchaseSummary[];
  salespersonPerformance: SalespersonPurchaseSummary[];
}
```

Use these interfaces directly in the dashboard response and nested customer breakdowns.

- [ ] **Step 4: Add Zod validation at both boundaries**

Implement:

```ts
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const cylinderPurchaseFilterSchema = z.object({
  customerCode: z.string().trim().min(1).optional(),
  productId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  salesmanId: z.coerce.number().int().positive().optional(),
  startDate: isoDate,
  endDate: isoDate,
}).refine((value) => value.startDate <= value.endDate, {
  message: "startDate must be on or before endDate",
  path: ["startDate"],
});

export const cylinderPurchaseRowSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  invoiceDate: isoDate,
  productId: z.number().int().positive(),
  productCode: z.string(),
  productName: z.string(),
  branchId: z.number().int().positive(),
  branchCode: z.string(),
  branchName: z.string(),
  salesmanId: z.number().int().positive(),
  salesmanCode: z.string(),
  salesmanName: z.string(),
  grossPurchasedQty: z.number().finite().nonnegative(),
  returnedQty: z.number().finite().nonnegative(),
  netPurchasedQty: z.number().finite(),
});

export const cylinderPurchaseRowsSchema = z.array(cylinderPurchaseRowSchema);
```

- [ ] **Step 5: Implement the O(n) aggregator**

Use one loop and reusable accumulators:

```ts
const UNASSIGNED_CUSTOMER_KEY = "UNASSIGNED";

function addMetrics(target: QuantityMetrics, row: QuantityMetrics): void {
  target.grossPurchasedQty += row.grossPurchasedQty;
  target.returnedQty += row.returnedQty;
  target.netPurchasedQty += row.netPurchasedQty;
}

function returnRate(metrics: QuantityMetrics): number {
  return metrics.grossPurchasedQty > 0
    ? metrics.returnedQty / metrics.grossPurchasedQty
    : 0;
}

export function aggregateCylinderPurchases(
  rows: CylinderPurchaseRow[],
  filters: CylinderPurchaseReportFilters,
  generatedAt = new Date().toISOString(),
): CylinderPurchaseDashboardResponse {
  const overview = { grossPurchasedQty: 0, returnedQty: 0, netPurchasedQty: 0 };
  const customers = new Map<string, MutableCustomerAccumulator>();
  const products = new Map<number, MutableProductAccumulator>();
  const branches = new Map<number, MutableBranchAccumulator>();
  const salespeople = new Map<number, MutableSalespersonAccumulator>();

  for (const row of rows) {
    addMetrics(overview, row);
    accumulateCustomer(customers, row);
    accumulateProduct(products, row);
    accumulateBranch(branches, row);
    accumulateSalesperson(salespeople, row);
  }

  const customerRanking = finalizeCustomers(customers);
  const productPerformance = finalizeProducts(products);
  const branchPerformance = finalizeBranches(branches);
  const salespersonPerformance = finalizeSalespeople(salespeople);

  return {
    filters,
    generatedAt,
    sourceRowCount: rows.length,
    overview: {
      ...overview,
      uniqueCustomers: customers.size,
      serializedProducts: products.size,
    },
    customerRanking,
    productPerformance,
    returnAnalysis: buildReturnAnalysis(overview, customerRanking, productPerformance, branchPerformance, salespersonPerformance),
    branchPerformance,
    salespersonPerformance,
  };
}
```

Finalize rankings with stable tie-breakers: net descending, then display name ascending, then stable identity ascending. Build each customer's nested product, branch, and salesperson arrays from maps accumulated during the same source-row loop.

- [ ] **Step 6: Run the aggregation tests**

Run the Step 2 command. Expected: all tests PASS.

- [ ] **Step 7: Commit the contract and aggregation slice**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts"
git commit -m "feat: add cylinder purchase report aggregation"
```

---

### Task 2: Build the Spring repository, orchestration service, and report BFF

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.errors.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.repo.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.ts`
- Test: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.test.ts`
- Create: `src/app/api/ids/bia/cylinder-purchase-report/route.ts`

**Interfaces:**
- Consumes: `CylinderPurchaseReportFilters`, `cylinderPurchaseRowsSchema`, and `aggregateCylinderPurchases` from Task 1.
- Produces: `fetchCylinderPurchaseRows(filters, fetchImpl?)` and `getCylinderPurchaseDashboard(filters, dependencies?)`.

- [ ] **Step 1: Write failing service tests for parameter forwarding and reconciliation**

Inject `fetchImpl` and a fixed clock. Assert the exact upstream URL and error class:

```ts
test("forwards only defined Spring filters", async () => {
  let requested = "";
  const fetchImpl: typeof fetch = async (input) => {
    requested = String(input);
    return Response.json([validRow]);
  };
  await getCylinderPurchaseDashboard(
    { startDate: "2026-06-23", endDate: "2026-07-22", branchId: 196 },
    { fetchImpl, now: () => new Date("2026-07-22T10:00:00.000Z"), springBaseUrl: "http://spring.test" },
  );
  assert.equal(
    requested,
    "http://spring.test/api/v-bia-cylinder-purchases/filter?branchId=196&startDate=2026-06-23&endDate=2026-07-22",
  );
});

test("rejects an inconsistent upstream net quantity", async () => {
  const fetchImpl: typeof fetch = async () => Response.json([{ ...validRow, netPurchasedQty: 999 }]);
  await assert.rejects(
    () => getCylinderPurchaseDashboard(filters, { fetchImpl, now: fixedNow, springBaseUrl: "http://spring.test" }),
    (error: unknown) => error instanceof UpstreamContractError,
  );
});
```

- [ ] **Step 2: Run the service test and confirm it fails**

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.test.ts"
```

Expected: FAIL because the service and repository do not exist.

- [ ] **Step 3: Define dependency-safe service errors**

```ts
export class UpstreamHttpError extends Error {
  constructor(public readonly status: number, statusText: string) {
    super(`Spring report request failed (${status} ${statusText}).`);
    this.name = "UpstreamHttpError";
  }
}

export class UpstreamContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamContractError";
  }
}
```

Keep these classes free of Next.js and React imports so both the repository and Node tests can load them.

- [ ] **Step 4: Implement the Spring-only repository**

```ts
const REPORT_PATH = "/api/v-bia-cylinder-purchases/filter";

export async function fetchCylinderPurchaseRows(
  filters: CylinderPurchaseReportFilters,
  options: { fetchImpl?: typeof fetch; springBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<unknown> {
  const base = (options.springBaseUrl ?? process.env.SPRING_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!base) throw new Error("SPRING_API_BASE_URL is not configured.");

  const url = new URL(`${base}${REPORT_PATH}`);
  if (filters.customerCode) url.searchParams.set("customerCode", filters.customerCode);
  if (filters.productId) url.searchParams.set("productId", String(filters.productId));
  if (filters.branchId) url.searchParams.set("branchId", String(filters.branchId));
  if (filters.salesmanId) url.searchParams.set("salesmanId", String(filters.salesmanId));
  url.searchParams.set("startDate", filters.startDate);
  url.searchParams.set("endDate", filters.endDate);

  const response = await (options.fetchImpl ?? fetch)(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  if (!response.ok) throw new UpstreamHttpError(response.status, response.statusText);
  return response.json();
}
```

Import `UpstreamHttpError` from the error file and keep the repository free of aggregation logic. Do not export this repository from a client-importable barrel; its only production consumer is the server orchestration service.

- [ ] **Step 5: Implement validation, reconciliation, timeout, and aggregation**

```ts
const QUANTITY_EPSILON = 1e-9;

export async function getCylinderPurchaseDashboard(
  filters: CylinderPurchaseReportFilters,
  dependencies: ReportServiceDependencies = {},
): Promise<CylinderPurchaseDashboardResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 20_000);
  try {
    const raw = await fetchCylinderPurchaseRows(filters, {
      fetchImpl: dependencies.fetchImpl,
      springBaseUrl: dependencies.springBaseUrl,
      signal: controller.signal,
    });
    const parsed = cylinderPurchaseRowsSchema.safeParse(raw);
    if (!parsed.success) throw new UpstreamContractError(parsed.error.message);

    for (const row of parsed.data) {
      const expected = row.grossPurchasedQty - row.returnedQty;
      if (Math.abs(expected - row.netPurchasedQty) > QUANTITY_EPSILON) {
        throw new UpstreamContractError(`Quantity mismatch for ${row.invoiceDate}/${row.productId}`);
      }
    }
    const now = dependencies.now?.() ?? new Date();
    return aggregateCylinderPurchases(parsed.data, filters, now.toISOString());
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 6: Implement the thin GET route**

Parse `request.nextUrl.searchParams`, validate with `cylinderPurchaseFilterSchema`, and return:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = cylinderPurchaseFilterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "INVALID_FILTERS", message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  try {
    return NextResponse.json(await getCylinderPurchaseDashboard(parsed.data), { status: 200 });
  } catch (error) {
    return reportErrorResponse(error);
  }
}
```

Implement the referenced response mapping in the route:

```ts
function reportErrorResponse(error: unknown): NextResponse {
  if (error instanceof UpstreamContractError) {
    return NextResponse.json({ ok: false, code: "UPSTREAM_CONTRACT_ERROR", message: "The report service returned invalid quantity data." }, { status: 502 });
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return NextResponse.json({ ok: false, code: "UPSTREAM_TIMEOUT", message: "The report service timed out." }, { status: 504 });
  }
  if (error instanceof UpstreamHttpError) {
    return NextResponse.json({ ok: false, code: "UPSTREAM_UNAVAILABLE", message: "The report service is unavailable." }, { status: 502 });
  }
  return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load the cylinder purchase report." }, { status: 500 });
}
```

Log only the error class/name and safe message.

- [ ] **Step 7: Run Task 1 and Task 2 tests**

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.test.ts"
```

Expected: all tests PASS.

- [ ] **Step 8: Commit the report BFF slice**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.errors.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.repo.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.test.ts" "src/app/api/ids/bia/cylinder-purchase-report/route.ts"
git commit -m "feat: add cylinder purchase report api"
```

---

### Task 3: Add bounded master-data lookups

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.lookups.ts`
- Create: `src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema.ts`

**Interfaces:**
- Consumes: Directus `customer`, `products`, `branches`, and `salesman` collections through server credentials.
- Produces: `GET /api/ids/bia/cylinder-purchase-report/lookups?type=<type>&q=<text>` returning `{ data: ReportLookupOption[] }`.

- [ ] **Step 1: Add lookup request validation**

```ts
export const reportLookupQuerySchema = z.object({
  type: z.enum(["customers", "products", "branches", "salespeople"]),
  q: z.string().trim().max(100).default(""),
});
```

- [ ] **Step 2: Implement the server lookup repository**

Use `DIRECTUS_URL || NEXT_PUBLIC_DIRECTUS_URL || NEXT_PUBLIC_API_BASE_URL` and `DIRECTUS_STATIC_TOKEN || DIRECTUS_TOKEN`. Encode all search text through `URLSearchParams`. Return normalized options:

```ts
export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
}
```

Queries:

- Customers: `customer`, fields `customer_code,customer_name`, search code/name, sort name, limit 50.
- Products: `products`, fields `product_id,product_code,product_name`, filter `is_serialized=1` and active records when the collection exposes `isActive`, sort name, limit 50.
- Branches: `branches`, fields `id,branch_code,branch_name`, sort name, limit `-1`.
- Salespeople: `salesman`, fields `id,salesman_code,salesman_name`, sort name, limit `-1`.

Normalize missing names to their codes, discard rows without their required identifier, and sort labels with `localeCompare`.

- [ ] **Step 3: Implement the lookup GET route**

```ts
export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = reportLookupQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "INVALID_LOOKUP_QUERY", message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await fetchReportLookups(parsed.data) });
  } catch (error) {
    console.error("[CylinderPurchaseReport:Lookups]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, code: "LOOKUP_UNAVAILABLE", message: "Unable to load filter options." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Manually verify all lookup contracts**

With the dev server running, request:

```powershell
Invoke-RestMethod 'http://localhost:3009/api/ids/bia/cylinder-purchase-report/lookups?type=customers&q=MAIN'
Invoke-RestMethod 'http://localhost:3009/api/ids/bia/cylinder-purchase-report/lookups?type=products&q=LPG'
Invoke-RestMethod 'http://localhost:3009/api/ids/bia/cylinder-purchase-report/lookups?type=branches'
Invoke-RestMethod 'http://localhost:3009/api/ids/bia/cylinder-purchase-report/lookups?type=salespeople'
```

Expected: HTTP 200; every response contains a `data` array, product results are serialized products, and no response exposes Directus metadata or credentials.

- [ ] **Step 5: Commit the lookup slice**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.lookups.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema.ts" "src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts"
git commit -m "feat: add cylinder report filter lookups"
```

---

### Task 4: Build the browser client and provider state machine

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.client.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers/CylinderPurchaseReportProvider.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/index.ts`

**Interfaces:**
- Consumes: report and lookup BFF endpoints from Tasks 2 and 3.
- Produces: `fetchCylinderPurchaseDashboard`, `fetchReportLookups`, `CylinderPurchaseReportProvider`, and `useCylinderPurchaseReport()`.

- [ ] **Step 1: Implement browser repositories with abort support**

```ts
export async function fetchCylinderPurchaseDashboard(
  filters: CylinderPurchaseReportFilters,
  signal?: AbortSignal,
): Promise<CylinderPurchaseDashboardResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const response = await fetch(`/api/ids/bia/cylinder-purchase-report?${params}`, { cache: "no-store", signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Report request failed (${response.status}).`);
  }
  return response.json() as Promise<CylinderPurchaseDashboardResponse>;
}

export async function fetchReportLookups(
  type: ReportLookupType,
  query: string,
  signal?: AbortSignal,
): Promise<ReportLookupOption[]> {
  const params = new URLSearchParams({ type, q: query });
  const response = await fetch(`/api/ids/bia/cylinder-purchase-report/lookups?${params}`, { signal });
  if (!response.ok) throw new Error("Unable to load filter options.");
  return ((await response.json()) as ReportLookupResponse).data;
}
```

- [ ] **Step 2: Implement provider state and request cancellation**

The context exposes:

```ts
interface CylinderPurchaseReportContextValue {
  report: CylinderPurchaseDashboardResponse | null;
  draftFilters: CylinderPurchaseReportFilters;
  appliedFilters: CylinderPurchaseReportFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<CylinderPurchaseReportFilters>>;
  applyFilters(): Promise<void>;
  clearFilters(): Promise<void>;
  refresh(): Promise<void>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  activeView: CylinderPurchaseDashboardView;
  setActiveView(view: CylinderPurchaseDashboardView): void;
  selectedCustomer: CustomerPurchaseSummary | null;
  selectCustomer(customer: CustomerPurchaseSummary): void;
  closeCustomerDetail(): void;
}
```

Use one `AbortController` ref for report requests. Abort before each new request and ignore `AbortError`. Keep the last successful `report` during refresh failures. Use `getRollingThirtyDayRange(new Date())` for both initial filters and Clear. Reset the active table's page and selected customer when applied filters change.

- [ ] **Step 3: Implement the thin consumer hook and barrel**

```ts
export function useCylinderPurchaseReport(): CylinderPurchaseReportContextValue {
  const context = React.useContext(CylinderPurchaseReportContext);
  if (!context) throw new Error("useCylinderPurchaseReport must be used within CylinderPurchaseReportProvider.");
  return context;
}
```

Export only browser-safe client functions from the barrel; do not export server-only repositories through a barrel imported by client components.

- [ ] **Step 4: Run type checking for the state layer**

```powershell
npm.cmd run typecheck
```

Expected: exit code 0.

- [ ] **Step 5: Commit the client state slice**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.client.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/index.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks"
git commit -m "feat: add cylinder report dashboard state"
```

---

### Task 5: Build the dashboard shell, filters, KPIs, and shared table primitive

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseFilters.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseOverview.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseDashboardNav.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReportErrorState.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReportDataTable.tsx`

**Interfaces:**
- Consumes: `useCylinderPurchaseReport()` from Task 4 and typed summary arrays from Task 1.
- Produces: responsive dashboard controls and a generic, local read-only table with sorting/search/pagination.

- [ ] **Step 1: Build the header and KPI cards**

Show the title, BIA subtitle, formatted `generatedAt`, Refresh, Export menu, and Print menu. Overview cards map directly to response fields:

```ts
const cards = [
  ["Gross Purchased", overview.grossPurchasedQty, PackagePlus],
  ["Returned Cylinders", overview.returnedQty, Undo2],
  ["Net Purchased", overview.netPurchasedQty, Scale],
  ["Unique Customers", overview.uniqueCustomers, Users],
  ["Serialized Products", overview.serializedProducts, Cylinder],
] as const;
```

Use existing shadcn `Card`, `Button`, `DropdownMenu`, and `Skeleton`. Keep the values as quantities, never currency.

- [ ] **Step 2: Build staged filters with dynamic date defaults**

Use native date inputs or the repository's existing calendar/popover primitives. Customer and product selectors use a 250 ms debounced server search; branch and salesperson options load in parallel on mount. Bind inputs to `draftFilters`. Apply calls `applyFilters`; Clear calls `clearFilters`. Disable Apply when the date range is invalid.

```ts
const [customerQuery, setCustomerQuery] = React.useState("");

React.useEffect(() => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    fetchReportLookups("customers", customerQuery, controller.signal)
      .then(setCustomerOptions)
      .catch((error) => {
        if (error.name !== "AbortError") toast.error(error.message);
      });
  }, 250);
  return () => {
    window.clearTimeout(timer);
    controller.abort();
  };
}, [customerQuery]);
```

- [ ] **Step 3: Build analytical navigation**

Use controlled `Tabs` or an equivalent accessible segmented navigation with these exact values and labels:

```ts
const views = [
  ["customers", "Customer Ranking"],
  ["products", "Product Performance"],
  ["returns", "Return Analysis"],
  ["branches", "Branch Performance"],
  ["salespeople", "Salesperson Performance"],
] as const;
```

Only mount the active view's panel.

- [ ] **Step 4: Build the shared local table**

`ReportDataTable<T>` accepts typed column definitions, `rows`, `rowKey`, `defaultSort`, optional `searchText`, optional `onRowClick`, and mobile-card renderer. Implement immutable memoized search, stable sorting, page sizes 10/25/50, and reset page to 1 when rows/search/sort change.

```ts
export interface ReportColumn<T> {
  key: string;
  label: string;
  value(row: T): string | number;
  render?(row: T): React.ReactNode;
  align?: "left" | "center" | "right";
}
```

Render eight skeleton rows during initial loading, a clear zero-state message for empty rows, a desktop table from `md` upward, and compact cards below `md`.

Implement `ReportErrorState` as a focused card accepting `{ message: string; onRetry(): void }`, rendering the safe message and a Retry button. It must not inspect raw upstream errors.

- [ ] **Step 5: Run focused lint and type checking**

```powershell
npx.cmd eslint "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseFilters.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseOverview.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseDashboardNav.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReportDataTable.tsx"
npm.cmd run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the shared dashboard UI**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components"
git commit -m "feat: add cylinder report dashboard controls"
```

---

### Task 6: Implement all analytical views and customer drill-down

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerRankingView.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerPurchaseDetail.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ProductPerformanceView.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReturnAnalysisView.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/BranchPerformanceView.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPerformanceView.tsx`

**Interfaces:**
- Consumes: aggregated arrays and `ReportDataTable` from earlier tasks.
- Produces: the five top-level analytical panels plus the seventh view, Customer Purchase Detail.

- [ ] **Step 1: Implement Customer Ranking and detail selection**

Columns: Rank, Customer, Gross, Returned, Net, Return Rate. Default sort: net descending, then customer name. Clicking a row calls `selectCustomer(row)`.

Render Customer Purchase Detail in a responsive `Dialog` with customer identity and totals, followed by internal tabs for Product, Branch, and Salesperson breakdowns. Each breakdown uses the selected customer's already-aggregated arrays and requires no network request.

- [ ] **Step 2: Implement Product Performance**

Columns: Rank, Product, Gross, Returned, Net, Return Rate, Customers. Default sort: net descending. `Customers` is the unique customer count accumulated by Task 1.

- [ ] **Step 3: Implement Return Analysis**

Provide a grouping selector with Customer, Product, Branch, and Salesperson. Columns: Group, Gross, Returned, Net, Return Rate. Default sort: returned descending. Format ratios with `Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 })`.

- [ ] **Step 4: Implement Branch Performance**

Columns: Rank, Branch, Gross, Returned, Net, Return Rate, Customers, Products. Default sort: net descending.

- [ ] **Step 5: Implement Salesperson Performance**

Columns: Rank, Salesperson, Gross, Returned, Net, Return Rate, Customers, Products. Default sort: net descending.

- [ ] **Step 6: Verify reconciliation visibly with the supplied sample fixture**

Run the dev server and load a range that contains the supplied sample dates. Confirm:

- Overview net equals the sum of customer nets.
- Product, branch, and salesperson net columns each sum to the same overview net.
- Opening a customer shows product rows that sum to the selected customer totals.
- Unassigned Customer remains selectable when null-customer rows are present.
- Zero-gross groups render `0%`, not `NaN` or `Infinity`.

- [ ] **Step 7: Run focused lint and type checking, then commit**

```powershell
npx.cmd eslint "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerRankingView.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CustomerPurchaseDetail.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ProductPerformanceView.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/ReturnAnalysisView.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/BranchPerformanceView.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPerformanceView.tsx"
npm.cmd run typecheck
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components"
git commit -m "feat: add cylinder purchase analytical views"
```

Expected: lint and typecheck exit 0 before the commit.

---

### Task 7: Add tested per-dashboard and consolidated exports

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.ts`
- Test: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.test.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.pdf.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.xlsx.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader.tsx`

**Interfaces:**
- Consumes: the complete `CylinderPurchaseDashboardResponse`, active view, and selected customer.
- Produces: `buildDashboardExportSections`, `exportDashboardPdf`, `printDashboardPdf`, `exportConsolidatedPdf`, and `exportDashboardWorkbook`.

- [ ] **Step 1: Write failing export-model tests**

```ts
const row = (patch: Partial<CylinderPurchaseRow> = {}): CylinderPurchaseRow => ({
  customerCode: "C-001", customerName: "Alpha Store", invoiceDate: "2026-07-01",
  productId: 11, productCode: "LPG-11", productName: "LPG 11KG",
  branchId: 1, branchCode: "B01", branchName: "Main",
  salesmanId: 7, salesmanCode: "S07", salesmanName: "Ana",
  grossPurchasedQty: 10, returnedQty: 2, netPurchasedQty: 8,
  ...patch,
});

const reportFixture = aggregateCylinderPurchases(
  [
    row(),
    row({ customerCode: "C-002", customerName: "Beta Store", productId: 50, productCode: "LPG-50", productName: "LPG 50KG" }),
    row({ customerCode: null, customerName: null, grossPurchasedQty: 0, returnedQty: 1, netPurchasedQty: -1 }),
  ],
  { startDate: "2026-06-23", endDate: "2026-07-22" },
  "2026-07-22T10:00:00.000Z",
);

test("active customer export contains every filtered customer, not one screen page", () => {
  const sections = buildDashboardExportSections(reportFixture, "customers");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Customer Cylinder Ranking");
  assert.equal(sections[0].rows.length, reportFixture.customerRanking.length);
});

test("consolidated export contains all seven named views", () => {
  const sections = buildConsolidatedExportSections(reportFixture);
  assert.deepEqual(sections.map((section) => section.title), [
    "Cylinder Purchase Overview",
    "Customer Cylinder Ranking",
    "Customer Purchase Detail",
    "Cylinder Product Performance",
    "Cylinder Return Analysis",
    "Branch Performance",
    "Salesperson Performance",
  ]);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.test.ts"
```

Expected: FAIL because the export-model module does not exist.

- [ ] **Step 3: Implement renderer-neutral export sections**

```ts
export interface ReportExportSection {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export function buildConsolidatedExportSections(
  report: CylinderPurchaseDashboardResponse,
): ReportExportSection[] {
  return [
    buildOverviewSection(report),
    buildCustomerSection(report.customerRanking),
    buildCustomerDetailSection(report.customerRanking),
    buildProductSection(report.productPerformance),
    buildReturnSection(report.returnAnalysis),
    buildBranchSection(report.branchPerformance),
    buildSalespersonSection(report.salespersonPerformance),
  ];
}
```

Use raw numbers in export rows. Apply display formatting only in the PDF or spreadsheet renderer.

- [ ] **Step 4: Run the export-model tests**

Run the Step 2 command. Expected: all tests PASS.

- [ ] **Step 5: Implement jsPDF and print rendering**

Use landscape A4, `jspdf-autotable`, repeated headings, filter context, generated timestamp, and page numbering:

```ts
export function exportConsolidatedPdf(report: CylinderPurchaseDashboardResponse): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const sections = buildConsolidatedExportSections(report);
  sections.forEach((section, index) => {
    if (index > 0) doc.addPage();
    drawReportHeader(doc, report, section.title);
    autoTable(doc, {
      startY: 34,
      head: [section.columns],
      body: section.rows,
      showHead: "everyPage",
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 64, 175] },
      didDrawPage: () => drawPageFooter(doc),
    });
  });
  doc.save(buildReportFilename("consolidated", report.filters));
}

export function printDashboardPdf(report: CylinderPurchaseDashboardResponse, view: CylinderPurchaseDashboardView): void {
  const doc = buildDashboardPdf(report, view);
  window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
}
```

Customer Purchase Detail in the consolidated report flattens every customer's product rows with customer code/name repeated so the section remains understandable across page breaks.

- [ ] **Step 6: Implement XLSX export**

Create a workbook with `Filters` and one active-view sheet. For consolidated spreadsheet export, use one sheet per analytical view with Excel-safe names under 31 characters. Set readable column widths and freeze the header row.

- [ ] **Step 7: Wire header actions and verify complete-array exports**

The active-view menu exposes PDF, XLSX, and Print. The consolidated menu exposes PDF and XLSX. Disable actions until a report is loaded. Confirm exported row counts match full aggregated arrays even when UI pagination shows only 10 rows.

- [ ] **Step 8: Run tests, lint, and commit**

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.test.ts"
npx.cmd eslint "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.pdf.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.xlsx.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader.tsx"
npm.cmd run typecheck
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/CylinderPurchaseReportHeader.tsx"
git commit -m "feat: add cylinder report exports"
```

Expected: tests, lint, and typecheck exit 0.

---

### Task 8: Compose the module and register the App Router page

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/CylinderPurchaseReportModule.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/index.ts`
- Create: `src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx`

**Interfaces:**
- Consumes: provider and components from Tasks 4-7.
- Produces: the requested route `/ids/bia/cylinder-purchase-report`.

- [ ] **Step 1: Compose a thin module entry point**

```tsx
function CylinderPurchaseReportContent(): React.ReactElement {
  const { report, activeView, isInitialLoading, error, refresh } = useCylinderPurchaseReport();
  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-500">
      <CylinderPurchaseReportHeader />
      <CylinderPurchaseFilters />
      {error && !report ? <ReportErrorState message={error} onRetry={refresh} /> : null}
      <CylinderPurchaseOverview report={report} isLoading={isInitialLoading} />
      <CylinderPurchaseDashboardNav />
      {activeView === "customers" ? <CustomerRankingView /> : null}
      {activeView === "products" ? <ProductPerformanceView /> : null}
      {activeView === "returns" ? <ReturnAnalysisView /> : null}
      {activeView === "branches" ? <BranchPerformanceView /> : null}
      {activeView === "salespeople" ? <SalespersonPerformanceView /> : null}
      <CustomerPurchaseDetail />
    </div>
  );
}

export default function CylinderPurchaseReportModule(): React.ReactElement {
  return (
    <CylinderPurchaseReportProvider>
      <CylinderPurchaseReportContent />
    </CylinderPurchaseReportProvider>
  );
}
```

- [ ] **Step 2: Add the barrel export**

```ts
export { default } from "./CylinderPurchaseReportModule";
export type * from "./types/cylinder-purchase-report.types";
```

- [ ] **Step 3: Add the standard IDS page shell**

Mirror the current BIA `rto-operation/page.tsx` header, cookie-derived `NavUser`, breadcrumb, `SidebarTrigger`, `Separator`, and `ScrollArea`. Change only the module import and visible breadcrumb/title to **Cylinder Purchase Report**.

The route file must export:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

- [ ] **Step 4: Run complete automated verification**

```powershell
node --test --experimental-strip-types "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service.test.ts" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.export-model.test.ts"
npm.cmd run typecheck
npx.cmd eslint "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/**/*.{ts,tsx}" "src/app/api/ids/bia/cylinder-purchase-report/**/*.ts" "src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx"
npm.cmd run build
git diff --check
```

Expected: all tests pass and every command exits 0. If PowerShell does not expand an ESLint glob, replace it with the exact touched-file list from `git diff --name-only` without linting unrelated files.

- [ ] **Step 5: Smoke-test the browser workflow**

Start the app:

```powershell
npm.cmd run dev
```

At `http://localhost:3009/ids/bia/cylinder-purchase-report`, verify:

1. The first request uses the rolling last 30 days.
2. Apply and Clear send the expected Spring-compatible query values.
3. All five navigation panels switch without a report refetch.
4. Customer Ranking opens Customer Purchase Detail without a report refetch.
5. Refresh preserves visible data while loading.
6. A failed refresh leaves the previous report visible and offers Retry.
7. Mobile width shows usable filter controls and cards without horizontal page overflow.
8. Active PDF/XLSX/Print contains all filtered rows for that dashboard.
9. Consolidated PDF contains all seven named sections with filter context and page numbers.

- [ ] **Step 6: Commit the integrated route**

```powershell
git add -- "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/CylinderPurchaseReportModule.tsx" "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/index.ts" "src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx"
git commit -m "feat: add cylinder purchase report dashboard"
```

---

## Final Review Gate

Before declaring the implementation complete:

- Confirm `git status --short` still shows the user's pre-existing unrelated changes untouched.
- Confirm every new production file uses `@/` imports rather than parent-directory traversal.
- Confirm no server-only module is reachable from a client component's import graph.
- Confirm no raw Spring or Directus error body, token, or base URL reaches the browser.
- Compare overview, customer, product, branch, and salesperson gross/returned/net totals programmatically.
- Open at least one active-dashboard PDF, one consolidated PDF, and one XLSX workbook and inspect headings, filters, row counts, page breaks, repeated headings, and numeric formatting.
- Record the exact test, typecheck, lint, build, diff-check, and browser-smoke results in the final handoff.
