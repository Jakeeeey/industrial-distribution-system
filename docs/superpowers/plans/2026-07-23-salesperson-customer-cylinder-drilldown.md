# Salesperson Customer Cylinder Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each salesperson customer row reveal that customer's purchased cylinders in the existing Customer Purchases tab.

**Architecture:** Add pure selection/filter helpers for testable behavior, then keep controlled tab and customer selection state inside `SalespersonPurchaseDetail`. Reuse the existing customer-product data and `ReportDataTable` row-action contract.

**Tech Stack:** React 19, TypeScript, Radix/shadcn Tabs, Node test runner, ESLint.

## Global Constraints

- Implement directly on `Purchase-Order-Module`.
- Do not add an API request, response field, nested dialog, route, or export.
- Use accessible customer-specific row action labels.
- Reset local drill-down state when the salesperson changes or the dialog closes.
- Follow red-green-refactor.

---

### Task 1: Customer Cylinder Selection Helpers

**Files:**
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/salesperson-purchase-detail.utils.ts`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/salesperson-purchase-detail.utils.test.ts`

**Interfaces:**
- Consumes: `SalespersonCustomerProductPurchaseSummary[]`.
- Produces: `selectSalespersonCustomer(customerKey)` and `filterCustomerProducts(rows, customerKey)`.

- [ ] **Step 1: Write failing tests**

Assert that selecting `"MAIN-32577"` produces:

```ts
{ activeTab: "customer-products", selectedCustomerKey: "MAIN-32577" }
```

Assert filtering returns only rows whose `customerKey` matches, while `null`
returns all rows unchanged.

- [ ] **Step 2: Verify RED**

```powershell
node --test --experimental-strip-types src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/salesperson-purchase-detail.utils.test.ts
```

Expected: FAIL because the utility module does not exist.

- [ ] **Step 3: Implement the pure helpers**

```ts
export type SalespersonDetailTab =
  | "customers"
  | "products"
  | "customer-products";

export function selectSalespersonCustomer(customerKey: string) {
  return {
    activeTab: "customer-products" as const,
    selectedCustomerKey: customerKey,
  };
}
```

`filterCustomerProducts` returns the input rows for `null`, otherwise rows
matching the selected key.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused test, then:

```powershell
git add src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components
git commit -m "test: define customer cylinder drill-down behavior"
```

### Task 2: Controlled Same-Dialog Drill-Down

**Files:**
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.tsx`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.composition.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers and existing `selectedSalesperson.customerProductBreakdown`.
- Produces: customer row actions, controlled tabs, filtered rows, heading, and reset button.

- [ ] **Step 1: Add failing composition assertions**

Assert the component contains:

```ts
assert.match(source, /onRowClick=\{openCustomerCylinders\}/);
assert.match(source, /rowActionLabel=\{\(row\) =>/);
assert.match(source, /value=\{activeTab\}/);
assert.match(source, /onValueChange=\{handleTabChange\}/);
assert.match(source, /Cylinders purchased by/);
assert.match(source, /Show all customers/);
```

- [ ] **Step 2: Verify RED**

Run the composition test and confirm it fails because controlled drill-down UI
is absent.

- [ ] **Step 3: Implement controlled state and filtering**

Add `activeTab`, `selectedCustomerKey`, selected customer lookup, and memoized
filtered customer-product rows. Reset both values when `selectedSalesperson`
changes. Selecting a customer applies `selectSalespersonCustomer`.

- [ ] **Step 4: Wire customer actions and reset UI**

Pass `onRowClick={openCustomerCylinders}` and a customer-specific
`rowActionLabel` to the Customers table. Make Tabs controlled. In Customer
Purchases, render the selected-customer heading and `Show all customers`
button; reset clears only `selectedCustomerKey`.

- [ ] **Step 5: Verify focused behavior and commit**

Run utility tests, composition tests, TypeScript, and scoped lint. Commit:

```powershell
git add src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components
git commit -m "feat: drill into customer cylinder purchases"
```

### Task 3: Final Regression

**Files:**
- Modify only if verification exposes an in-scope defect.

- [ ] **Step 1: Run all cylinder report tests**

```powershell
$tests = Get-ChildItem src/modules/industrial-distribution-system/bia/cylinder-purchase-report,src/app/api/ids/bia/cylinder-purchase-report -Recurse -Filter '*.test.ts' | ForEach-Object FullName
node --test --experimental-strip-types @tests
```

- [ ] **Step 2: Run scoped lint, typecheck, and diff check**

```powershell
npx.cmd eslint src/modules/industrial-distribution-system/bia/cylinder-purchase-report src/app/api/ids/bia/cylinder-purchase-report/route.ts src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts 'src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx' --quiet
npm.cmd run typecheck -- --pretty false
git diff --check a02f0ce7..HEAD
git status --short
```

Expected: every command exits 0 and the working tree is clean.
