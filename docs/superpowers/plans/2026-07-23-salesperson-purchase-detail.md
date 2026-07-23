# Salesperson Purchase Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filter-aware salesperson drill-down showing customer totals, cylinder totals, and customer-by-cylinder purchase totals.

**Architecture:** Extend the existing one-pass accumulator with salesperson-local maps and finalize those maps into nested response arrays. Add provider selection state and a focused responsive dialog that reuses `ReportDataTable`; opening details makes no additional request.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Radix/shadcn Dialog and Tabs, Node test runner, ESLint.

## Global Constraints

- Implement directly on `Purchase-Order-Module`.
- Use the existing dashboard response; do not add another Spring API request.
- Respect all active report filters and the default rolling 30-day range.
- Preserve existing export contents.
- Use native accessible buttons and the existing responsive table patterns.
- Follow red-green-refactor for each production behavior.

---

### Task 1: Nested Salesperson Aggregation

**Files:**
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.accumulators.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.aggregation.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.finalizers.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts`

**Interfaces:**
- Consumes: `CylinderPurchaseRow`, `QuantityMetrics`, and the existing customer identity normalization.
- Produces: `SalespersonCustomerPurchaseSummary`, `SalespersonCustomerProductPurchaseSummary`, plus `customerBreakdown`, `productBreakdown`, and `customerProductBreakdown` on `SalespersonPurchaseSummary`.

- [ ] **Step 1: Write failing aggregation tests**

Add tests that aggregate rows for one salesperson across two customers and two
products and assert:

```ts
assert.deepEqual(
  salesperson.customerBreakdown.map((row) => ({
    customerKey: row.customerKey,
    products: row.uniqueProducts,
    net: row.netPurchasedQty,
  })),
  [
    { customerKey: "CUST-001", products: 2, net: 8 },
    { customerKey: "CUST-002", products: 1, net: 3 },
  ],
);

assert.deepEqual(
  salesperson.customerProductBreakdown.map((row) => row.key),
  ["CUST-001::101", "CUST-001::102", "CUST-002::101"],
);

assert.equal(
  salesperson.customerBreakdown.reduce(
    (total, row) => total + row.netPurchasedQty,
    0,
  ),
  salesperson.netPurchasedQty,
);
```

Add one null-customer row and assert its key and display name use the existing
unassigned-customer constants.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --experimental-strip-types src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers.test.ts
```

Expected: FAIL because the three salesperson breakdown properties do not exist.

- [ ] **Step 3: Add nested types and accumulator maps**

Define:

```ts
export interface SalespersonCustomerPurchaseSummary extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  returnRate: number;
  uniqueProducts: number;
}

export interface SalespersonCustomerProductPurchaseSummary
  extends QuantityMetrics {
  key: string;
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  productId: number;
  productCode: string;
  productName: string;
  returnRate: number;
}
```

Extend `SalespersonPurchaseSummary` with the three arrays. Extend each
`SalespersonAccumulator` with customer, product, and customer-product maps.
During the existing row pass, update all three maps using
`${customerKey}::${productId}` as the composite key.

- [ ] **Step 4: Finalize stable detail arrays**

Add focused finalizers that:

```ts
customerBreakdown.sort(
  byRank((row) => row.customerName, (row) => row.customerKey),
);
productBreakdown = finalizeProducts(salesperson.products);
customerProductBreakdown.sort(
  byRank(
    (row) => `${row.customerName}\u0000${row.productName}`,
    (row) => row.key,
  ),
);
```

Populate all three arrays in `finalizeSalespeople`.

- [ ] **Step 5: Run focused and service regression tests**

Run:

```powershell
$tests = Get-ChildItem src/modules/industrial-distribution-system/bia/cylinder-purchase-report/services -Filter '*.test.ts' | ForEach-Object FullName
node --test --experimental-strip-types @tests
```

Expected: all service tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/industrial-distribution-system/bia/cylinder-purchase-report
git commit -m "feat: aggregate salesperson purchase details"
```

### Task 2: Salesperson Detail Selection and Dialog

**Files:**
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers/CylinderPurchaseReportProvider.tsx`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport.ts`
- Modify: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPerformanceView.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.tsx`
- Create: `src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.composition.test.ts`

**Interfaces:**
- Consumes: nested `SalespersonPurchaseSummary` arrays from Task 1 and the existing `ReportDataTable`.
- Produces: `selectedSalesperson`, `openSalespersonDetail(salesperson)`, `closeSalespersonDetail()`, and the detail dialog.

- [ ] **Step 1: Write failing composition tests**

Create a source composition test that asserts:

```ts
assert.match(performanceSource, /View details/);
assert.match(performanceSource, /openSalespersonDetail/);
assert.match(detailSource, /value="customers"/);
assert.match(detailSource, /value="products"/);
assert.match(detailSource, /value="customer-products"/);
assert.match(detailSource, /selectedSalesperson\.customerBreakdown/);
assert.match(detailSource, /selectedSalesperson\.productBreakdown/);
assert.match(detailSource, /selectedSalesperson\.customerProductBreakdown/);
```

- [ ] **Step 2: Run the composition test and verify RED**

Run:

```powershell
node --test --experimental-strip-types src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.composition.test.ts
```

Expected: FAIL because the new dialog file and selection action are absent.

- [ ] **Step 3: Add provider selection state**

Add to the provider context:

```ts
selectedSalesperson: SalespersonPurchaseSummary | null;
openSalespersonDetail: (salesperson: SalespersonPurchaseSummary) => void;
closeSalespersonDetail: () => void;
```

Clear the selection whenever a new report result replaces the current report,
matching the existing selected-customer reset behavior.

- [ ] **Step 4: Add the responsive detail dialog**

Create `SalespersonPurchaseDetail` with:

- Header containing salesperson name and code.
- Four metric cards: Gross, Returned, Net, Return Rate.
- Tabs with exact values `customers`, `products`, and `customer-products`.
- Searchable `ReportDataTable` instances sorted by net descending.
- Customer, product, and combined customer/product identities.
- Specific empty messages for each tab.
- Mobile cards using the existing metric formatting.

- [ ] **Step 5: Add accessible detail actions**

Add an `Actions` table column containing:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => openSalespersonDetail(row.data)}
>
  View details
</Button>
```

Add the same native button to `SalespersonMobileCard`, and mount
`<SalespersonPurchaseDetail />` once beside the table.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
node --test --experimental-strip-types src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components/SalespersonPurchaseDetail.composition.test.ts
npm.cmd run typecheck -- --pretty false
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/modules/industrial-distribution-system/bia/cylinder-purchase-report
git commit -m "feat: add salesperson purchase detail dialog"
```

### Task 3: Module Regression Verification

**Files:**
- Modify only if a regression test exposes a salesperson-detail defect.

**Interfaces:**
- Consumes: completed nested aggregation and detail dialog.
- Produces: verified integrated feature on `Purchase-Order-Module`.

- [ ] **Step 1: Run every module test**

```powershell
$tests = Get-ChildItem src/modules/industrial-distribution-system/bia/cylinder-purchase-report,src/app/api/ids/bia/cylinder-purchase-report -Recurse -Filter '*.test.ts' | ForEach-Object FullName
node --test --experimental-strip-types @tests
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run scoped lint**

```powershell
npx.cmd eslint src/modules/industrial-distribution-system/bia/cylinder-purchase-report src/app/api/ids/bia/cylinder-purchase-report/route.ts src/app/api/ids/bia/cylinder-purchase-report/lookups/route.ts 'src/app/(industrial-distribution-system)/ids/bia/cylinder-purchase-report/page.tsx' --quiet
```

Expected: exit code 0.

- [ ] **Step 3: Run TypeScript and diff checks**

```powershell
npm.cmd run typecheck -- --pretty false
git diff --check HEAD~2..HEAD
git status --short
```

Expected: typecheck and diff check exit 0; working tree is clean.

- [ ] **Step 4: Inspect the final commit range**

```powershell
git log --oneline -4
git show --stat --oneline HEAD~2..HEAD
```

Confirm the changes are limited to the approved salesperson-detail scope.
