# BIA Cylinder Purchase Report Design

## Status

Approved for implementation on July 22, 2026.

## Objective

Build a dashboard module at `/ids/bia/cylinder-purchase-report` that reports serialized-cylinder purchase quantities from the Spring Boot view endpoint. The dashboard must expose seven related analytical views, preserve one consistent set of totals across them, and support per-dashboard and consolidated exports.

## Business Rules

- A cylinder product is a product whose `is_serialized` value is `1`.
- Gross purchased quantity includes non-cancelled sales-invoice quantities.
- Returned quantity includes non-cancelled returns matched to a non-cancelled original invoice.
- Net purchased quantity is gross purchased quantity minus returned quantity.
- Reporting dates are the dates of the original sales invoices.
- Payment state, collected amount, invoice value, and payment count do not affect cylinder quantities.
- The upstream view grain is one row per invoice date, customer, serialized product, branch, and salesperson combination.
- All totals must therefore use `SUM`; individual source rows are not complete customer totals.

## User Experience

The module is one dashboard page rather than seven separate routes or seven full tables stacked vertically.

### Shared header and filters

The page header contains the module title, last-refreshed timestamp, Refresh, Export, and Print actions. A shared filter bar contains:

- A date range defaulting to the rolling last 30 calendar days, inclusive of today
- Customer
- Serialized product
- Branch
- Salesperson
- Apply and Clear actions

The date range remains fully customizable. Customer, product, branch, and salesperson options come from the system master-data sources rather than being inferred from the currently filtered report rows. Selectors are searchable, and the product selector includes only serialized products.

### Seven analytical views

1. **Cylinder Purchase Overview** shows Gross Purchased, Returned Cylinders, Net Purchased, Unique Customers, and Serialized Products.
2. **Customer Cylinder Ranking** ranks customers by net purchased quantity, descending by default.
3. **Customer Purchase Detail** opens from a selected ranking row and shows product, branch, and salesperson breakdowns for that customer.
4. **Cylinder Product Performance** ranks serialized products by gross and net quantities and exposes their customer participation.
5. **Cylinder Return Analysis** shows returned quantities and return ratios by customer, product, branch, and salesperson. Return ratio is `returned / gross` when gross is greater than zero and `0` otherwise.
6. **Branch Performance** compares gross, returned, and net quantities by branch.
7. **Salesperson Performance** compares gross, returned, and net quantities by salesperson.

The overview is always visible near the top of the page. The five top-level analytical tables appear in dashboard navigation below it. Customer Purchase Detail is a drill-down from Customer Cylinder Ranking rather than another always-visible table.

Every analytical table supports sorting, text search where meaningful, pagination, responsive mobile cards, and explicit loading, empty, and error states.

## Architecture

The module follows the repository's one-way flow:

`Page -> Module/Components -> Provider/Hook -> Local BFF API -> Service -> Spring Boot or master-data source`

Proposed module boundary:

```text
src/modules/industrial-distribution-system/bia/cylinder-purchase-report/
|-- components/
|   |-- dashboard navigation and shared filters
|   |-- overview KPI cards
|   |-- one focused component per analytical view
|   `-- customer detail drill-down
|-- hooks/
|   `-- thin context consumer hook
|-- providers/
|   `-- report state, filters, active view, refresh, and request cancellation
|-- services/
|   |-- report client repository
|   |-- pure aggregation helpers
|   |-- jsPDF/XLSX export helpers
|   `-- barrel exports
|-- types/
|   |-- TypeScript domain contracts
|   `-- Zod request and upstream-response schemas
|-- CylinderPurchaseReportModule.tsx
`-- index.ts
```

App Router boundaries:

```text
src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx
src/app/api/ids/bia/cylinder-purchase-report/route.ts
src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts
```

The page is a thin route shell matching the current IDS/BIA breadcrumb and user-header pattern. The module entry point is a thin UI composer. Domain aggregation remains pure and independent of React.

## Report Data Contract

The browser submits these optional report filters to the local BFF:

```ts
interface CylinderPurchaseReportFilters {
  customerCode?: string;
  productId?: number;
  branchId?: number;
  salesmanId?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
```

The BFF forwards defined values to:

`/api/v-bia-cylinder-purchases/filter`

The Spring response row contains customer identity, invoice date, product identity, branch identity, salesperson identity, gross quantity, returned quantity, and net quantity. Customer code and name are nullable because the supplied sample contains source rows without customer identity. Required numeric identifiers and quantities must be finite numbers. Gross and returned quantities cannot be negative. Net quantity may be negative for a valid return-heavy grouping.

For every row, the BFF verifies:

`netPurchasedQty === grossPurchasedQty - returnedQty`

Quantity comparison is exact for integer values and tolerance-based if the API supplies decimal quantities. A contract violation fails the report request with a controlled upstream-data error instead of silently displaying inconsistent figures.

Rows without a customer identity are grouped under a stable internal key, `UNASSIGNED`, and displayed as **Unassigned Customer**. This label is report-only and does not rewrite upstream data.

## Aggregation and Response

The BFF validates all rows and aggregates the complete dashboard model in one O(n) pass. Keyed `Map` collections accumulate overview totals and customer, product, branch, and salesperson groupings simultaneously. Customer entries also retain nested product, branch, and salesperson groups for drill-down.

The browser receives prepared dashboard models rather than the raw daily rows:

```ts
interface CylinderPurchaseDashboardResponse {
  filters: AppliedFilterContext;
  generatedAt: string;
  sourceRowCount: number;
  overview: CylinderPurchaseOverview;
  customerRanking: CustomerPurchaseSummary[];
  productPerformance: ProductPurchaseSummary[];
  returnAnalysis: ReturnAnalysisDataset;
  branchPerformance: BranchPurchaseSummary[];
  salespersonPerformance: SalespersonPurchaseSummary[];
}
```

Customer Purchase Detail is contained in the selected customer's nested breakdown data. No second Spring request is needed when a ranking row is opened.

All view totals and exports consume this single response so that metrics cannot drift between dashboards.

## Master-Data Lookups

The module-specific lookup BFF reads the existing system master-data sources for customers, products, branches, and salespeople. It does not call API routes owned by unrelated UI modules. This preserves domain boundaries while reusing the same underlying master collections and authentication configuration.

Lookups load in parallel. Large customer and product lists use server-backed search rather than requiring the browser to download every record. Branch and salesperson lists may be loaded in full when their existing APIs return bounded result sets.

## Performance Techniques

- One Spring request is made for each applied report filter set.
- Aggregation is a single linear pass over validated rows.
- Raw source rows remain server-side and are omitted from the browser payload.
- Lookup requests run concurrently and independently of the report request.
- Searchable large-master lookups are debounced.
- A new Apply or Refresh action aborts any older in-flight browser request.
- Only the active analytical panel is mounted; inactive dashboard tables are lazy-rendered.
- Expensive sorted, searched, and paginated collections are memoized from stable aggregated arrays.
- Export helpers reuse the prepared response and do not recompute business totals from table DOM state.
- Report fetching uses `no-store` initially because no data-freshness window has been approved.

## State and Refresh Behavior

The provider owns draft filters, applied filters, report data, loading state, refresh state, error state, active dashboard, table state, and selected customer.

Filters do not query Spring on every keystroke. Apply validates and commits the draft filter set, resets relevant pagination, and requests the report. Clear restores the rolling last-30-day range and removes the four master filters.

On refresh, the last successful report remains visible with a refresh indicator. If refresh fails, the last successful report remains available and an error toast or inline retry notice explains the failure. An initial-load failure uses a full report error state with Retry.

## Failure Handling

The local BFF distinguishes:

- Invalid browser query parameters: HTTP 400
- Malformed or internally inconsistent Spring data: HTTP 502
- Spring timeout or unavailable service: HTTP 504 or HTTP 502 as appropriate
- Unexpected local failure: HTTP 500

The client shows actionable, human-readable messages without exposing secrets or raw upstream bodies. An empty valid response produces zero-valued KPIs and empty dashboard states rather than an error.

## Export and Print

jsPDF is the PDF and print engine. XLSX remains the spreadsheet export engine already present in the repository.

Two export scopes are required:

1. **Active dashboard export/print** includes the current filters, overview context, and the active analytical dataset.
2. **Consolidated PDF** contains the filter context and all seven analytical views in one document.

Exports use the complete filtered aggregated arrays, not only the current paginated screen. Long tables use deterministic page breaks, repeated column headings, page numbers, and continuation labels. Customer Purchase Detail appears in the consolidated PDF as customer subsections or a clearly labeled detail table. Generated documents include the report generation timestamp and applied filter labels.

## Testing Strategy

The repository currently has no configured test framework. Pure domain tests will use Node 24's built-in test runner and TypeScript stripping, avoiding a new framework dependency.

Aggregation fixtures cover:

- Customer, product, branch, and salesperson grouping
- Return-only rows and negative net totals
- Null customer grouping
- Duplicate daily rows
- Zero-gross return-rate behavior
- Stable ranking tie-breakers
- Decimal reconciliation tolerance
- Exact reconciliation between overview totals and every compatible grouped view

Route tests cover query validation, omitted optional filters, date ordering, upstream timeouts, malformed Spring responses, and exact parameter forwarding.

Export tests verify active-view and consolidated datasets, headings, filter context, and page-break inputs. UI smoke checks cover the rolling 30-day default, Apply, Clear, Refresh, dashboard switching, customer drill-down, loading, empty, failure, retry, and responsive presentation.

Final verification requires:

1. Targeted domain and route tests
2. `npm.cmd run typecheck`
3. ESLint on touched files
4. `npm.cmd run build`
5. `git diff --check`
6. Browser smoke test at `/ids/bia/cylinder-purchase-report`

## Acceptance Criteria

- The route loads one coherent dashboard containing all seven approved views.
- The default report period is the rolling last 30 days and can be changed dynamically.
- Filters use existing system master data and reach Spring using the documented query names.
- Gross, returned, and net totals reconcile across overview, customer, product, branch, and salesperson views.
- Customer totals equal the sum of their product-detail rows.
- Customer ranking defaults to descending net quantity with a deterministic customer-name tie-breaker.
- Return ratios never divide by zero.
- Null-customer rows remain visible under Unassigned Customer.
- Stale requests cannot replace a newer applied result.
- Per-dashboard PDF/print and spreadsheet export include all filtered rows for that dashboard.
- Consolidated jsPDF output includes all seven views and applied filter context.
- Loading, empty, refresh, and failure states remain usable on desktop and mobile.

## Out of Scope

- Changing the Spring Boot view or its business rules
- Persisting report snapshots
- Scheduled or emailed reports
- Adding database writes to this read-only BIA module
- Introducing a new client state library or test framework
