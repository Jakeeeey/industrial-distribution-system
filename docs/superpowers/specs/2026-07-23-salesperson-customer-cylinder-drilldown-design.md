# Salesperson Customer Cylinder Drill-Down Design

## Goal

Let users identify the cylinders purchased by a specific customer from within
the existing Salesperson Purchase Detail dialog.

## Interaction

The Customers tab gains a `View cylinders` action for every customer on desktop
and mobile. Activating the action:

1. Selects that customer inside the open salesperson detail dialog.
2. Switches the active tab to `Customer Purchases`.
3. Filters the existing customer/product breakdown to the selected customer.
4. Shows the heading `Cylinders purchased by <customer name>`.
5. Shows a `Show all customers` button that removes the customer filter without
   closing the dialog.

The filtered table continues to show customer identity, cylinder/product
identity, gross purchased, returned, net purchased, and return rate. Search,
sorting, and pagination continue to use the shared `ReportDataTable`.

Closing the salesperson dialog clears the selected customer. Opening a different
salesperson starts on the Customers tab with no customer filter.

## Architecture and Data Flow

`SalespersonPurchaseDetail` owns local `activeTab` and `selectedCustomerKey`
state because this is temporary presentation state scoped to one open dialog.
It derives visible customer/product rows with `useMemo` from
`selectedSalesperson.customerProductBreakdown`.

The existing dashboard response already contains the required
customer/product combinations. The change adds no response fields, server
aggregation, Spring request, or route.

The Customers table uses `ReportDataTable`'s established `onRowClick` and
`rowActionLabel` contract, producing accessible native action buttons on both
desktop and mobile. The label identifies the customer, for example:
`View cylinders purchased by ABETH STORE`.

## Empty and Reset States

If the selected customer has no matching customer/product rows, the table shows
`No cylinder purchases are available for this customer.` The reset button
restores all customer/product rows and the original empty message.

When `selectedSalesperson` changes or becomes null, the component resets to the
Customers tab and clears `selectedCustomerKey`.

## Testing

Tests will cover:

- Selecting a customer returns the `customer-products` tab and customer key.
- Filtering includes only rows belonging to the selected customer.
- Clearing selection restores all rows.
- Component composition includes accessible customer row actions, controlled
  tab state, customer-specific heading, and reset action.
- Full module tests, scoped ESLint, TypeScript, and diff validation remain clean.

## Out of Scope

- Nested dialogs.
- A separate customer detail route.
- New API or aggregation fields.
- Changes to PDF or Excel exports.
