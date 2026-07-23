# Salesperson Purchase Detail Design

## Goal

Add a `View details` action to every row and mobile card in the Salesperson
Performance view. The action opens a responsive dialog showing the salesperson's
customers, cylinders/products, and customer-by-cylinder purchase details for the
currently applied report filters.

## User Experience

The existing Salesperson Performance ranking remains the entry point. Each
salesperson row and mobile card includes a native `View details` button. Opening
the detail dialog shows:

- The salesperson name and code.
- Summary metrics for gross purchased, returned, net purchased, and return rate.
- A **Customers** tab with one row per customer.
- A **Cylinders** tab with one row per product.
- A **Customer Purchases** tab with one row per customer/product combination.

Each tab uses the existing searchable, sortable, paginated `ReportDataTable`.
Every breakdown row shows gross purchased, returned, net purchased, and return
rate. Customer and cylinder identities show both name and code. The dialog uses
the same responsive and accessible interaction pattern as the existing customer
detail dialog.

## Data Contract

`SalespersonPurchaseSummary` gains three nested arrays:

- `customerBreakdown: SalespersonCustomerPurchaseSummary[]`
- `productBreakdown: ProductPurchaseSummary[]`
- `customerProductBreakdown: SalespersonCustomerProductPurchaseSummary[]`

The customer summary contains the customer key, nullable code, display name,
quantity metrics, return rate, and unique product count. The customer/product
summary contains a stable composite key, customer identity, product identity,
quantity metrics, and return rate.

Unassigned customers continue to use the module's existing unassigned-customer
identity rules.

## Aggregation and Data Flow

The server adds salesperson-local customer, product, and customer/product
accumulators during the existing single pass over the Spring response. Finalizers
convert them into stable, ranked arrays. The browser receives the detail data in
the same dashboard response, so opening the dialog makes no additional network
request.

All details automatically respect customer, product, branch, salesperson, and
date filters because they are derived from the same filtered source rows.

The report provider owns `selectedSalesperson`, `openSalespersonDetail`, and
`closeSalespersonDetail`, mirroring the existing selected-customer behavior. The
dialog is mounted by the Salesperson Performance view.

## Error and Empty States

The existing dashboard loading, stale-data, and refresh-error behavior remains
unchanged. If a breakdown has no records, its table displays a specific empty
message. Closing the dialog clears the selected salesperson.

## Export Scope

This change does not add new export worksheets or PDF sections. Existing active
and consolidated exports retain their current salesperson summary output. The
nested detail data is an interactive drill-down only.

## Testing

Tests will cover:

- One-pass aggregation of salesperson customers, products, and
  customer/product combinations.
- Separation of the same product purchased by different customers.
- Unassigned-customer handling.
- Reconciliation of nested totals with the parent salesperson totals.
- Provider selection/reset behavior where practical through pure state helpers
  or composition checks.
- Presence of accessible `View details` actions and all three dialog tabs.
- Existing module regression tests, scoped lint, and TypeScript type checking.

## Out of Scope

- Invoice numbers, monetary sales amounts, or transaction-level invoice rows.
- A separate salesperson detail route.
- Additional Spring API calls.
- Changes to the seven-view dashboard navigation.
