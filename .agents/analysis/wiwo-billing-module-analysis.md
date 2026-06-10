# WIWO Billing Module Analysis

Last analyzed: 2026-06-10

Latest implementation update: routine swaps now require incoming replacement
cylinders to capture gross weight, serial evidence, and scale-weight evidence.
Swapped-out site-cylinder assignments are stored as `REMOVED`, and active
queries explicitly exclude removed assignments.

The incoming replacement workflow is presented through a shared
`Cylinder In Weighing` modal on desktop and mobile. The connected-cylinder row
only shows a summary and opens the modal; serial verification, gross weight,
serial evidence, and scale evidence are edited inside the modal.

## Purpose and Scope

This document is the persistent technical memory for the WIWO LPG Billing and
Validation module. It covers:

- UI and API entry points
- Provider functions and business rules
- Onboarding, routine billing, upload, lookup, and cancellation flows
- Directus collections and fields touched by the module
- Cross-module dependencies on WIWO data
- Reconstructed DDL based on application usage
- Known inconsistencies, failure modes, and implementation risks

The repository contains no authoritative SQL migration or DDL files for this
module. The DDL section is therefore an inferred logical schema. Directus and
the underlying database remain the authoritative schema.

## Module Map

### Page and UI

- `src/app/(industrial-distribution-system)/ids/scm/lpg-billing-management/wiwo-billing/page.tsx`
  mounts the module.
- `WiwoBillingModule.tsx` switches between:
  - `ROUTINE`: regular check, weighing, meter comparison, and optional swap.
  - `ONBOARDING`: initial cylinder deployment and baseline creation.
- `components/WiwoForm.tsx` contains nearly all client-side state,
  calculations, validation, upload handling, draft persistence, and submission.
- `components/WiwoList.tsx` is a transaction list component, but the current
  `WiwoBillingModule.tsx` renders only `WiwoForm`; the list is not mounted there.

### API

- `GET /api/ids/scm/lpg-billing-management/wiwo-billing`
  handles list and reference lookups.
- `POST /api/ids/scm/lpg-billing-management/wiwo-billing`
  dispatches onboarding or regular billing.
- `GET /api/ids/scm/lpg-billing-management/wiwo-billing/:id`
  fetches a parent transaction and its WIWO details.
- `PATCH /api/ids/scm/lpg-billing-management/wiwo-billing/:id`
  runs cancellation/rollback when `action = CANCEL`.
- `POST /api/ids/scm/lpg-billing-management/wiwo-billing/upload`
  uploads evidence to the Directus `ids_transactions` folder.

### Provider

`providers/wiwo-billing.provider.ts` is the server-side orchestration layer.
It writes directly to multiple Directus collections and contains the principal
business logic.

## Domain Model

The module uses three main records:

1. `lpg_metered_wiwo_transactions`
   - Parent billing transaction.
   - Combines meter, WIWO, variance, pricing, sales document, status, and audit
     information.
2. `lpg_wiwo_headers`
   - Physical WIWO event header.
   - Summarizes cylinders returned/deployed and physical consumed kilograms.
3. `lpg_wiwo_details`
   - One row per returned or deployed cylinder.
   - Stores weight calculation inputs/results and resulting asset/site status.

Supporting records include customer sites, site-cylinder assignments, cylinder
assets, meter readings, sales orders, sales invoices, and attachments.

## Core Calculations

### Meter consumption

When the caller does not provide `meteredKg`:

```text
meteredKg = max(0, currentMeterReading - previousMeterReading)
```

Draft transactions can provide a precomputed `metered_kg`, which the UI uses
instead of recalculating from readings.

### Per-cylinder physical consumption

The code treats `lpg_customer_site_cylinders.current_lpg_kg` as the previous
gross cylinder weight:

```text
openingGross = current_lpg_kg
tare = cylinder_asset.tare_weight
openingNet = max(0, openingGross - tare)
remainingNet = returnedGross - tare
remainingNet = min(remainingNet, openingNet)
consumedKg = openingNet - remainingNet
```

Server validation rejects negative `remainingNet` or `consumedKg`. The UI also
rejects a returned gross weight below tare for swapped cylinders.

### WIWO total, arbitration, and amounts

```text
totalWiwoKg = sum(consumedKg for all submitted returned cylinders)
billableKg = max(meteredKg, totalWiwoKg)
varianceKg = abs(meteredKg - totalWiwoKg)
billableSource = METERED when meteredKg >= totalWiwoKg, otherwise WIWO

grossAmount = round(billableKg * pricePerKg, 2)
vatAmount = round(grossAmount * 0.12, 2)
netAmount = round(grossAmount + vatAmount, 2)
```

If meter and WIWO totals differ, non-empty remarks are required. The comparison
uses exact JavaScript numeric inequality, with no tolerance.

## Flow A: Onboarding Baseline

### Client preparation

1. User selects a site and scans/types cylinder serials.
2. Each serial is validated against:
   - `consolidator_serial_mappings`
   - `cylinder_assets`
3. Asset condition must be `GOOD`.
4. Asset status must be `AVAILABLE` or `LOADED`.
5. UI derives nominal capacity from digits in the product name, defaulting to
   50 KG when parsing fails.
6. UI validates:
   - At least one cylinder.
   - Starting gross weight is present.
   - Starting gross weight is not below tare.
   - Net gas weight does not exceed parsed product capacity.

### Server sequence

`processOnboardingBaseline` performs these writes sequentially:

1. Verify each asset has no active `CONNECTED` or `STANDBY` assignment.
2. Fetch selected cylinder assets and group them by product.
3. Create a zero-value `sales_order`.
4. Create zero-value `sales_order_details` grouped by product quantity.
5. For every cylinder:
   - Insert `lpg_customer_site_cylinders` as `CONNECTED`.
   - Set previous/current weight to submitted target gross weight.
   - Patch `cylinder_assets` to `WITH_CUSTOMER`.
6. Create a zero-value posted `sales_invoice`.
7. Insert `lpg_wiwo_headers`:
   - Type `DEPLOYMENT_ONLY`
   - Status `DRAFT`
   - Zero billable KG
8. Insert one non-billable `NEW_DEPLOYMENT` detail per cylinder.
9. Insert parent `lpg_metered_wiwo_transactions`:
   - Type `ONBOARDING_BASELINE`
   - Status `DRAFT`
   - `wiwo_kg` equals the sum of submitted gross weights
   - Billable source `NONE`, billable KG zero

### Onboarding result

The baseline establishes active site-cylinder assignments and creates logistics,
invoice, WIWO, and parent transaction records. Despite `posted_by`,
`posted_date`, and a posted sales invoice, the WIWO header and parent transaction
are left as `DRAFT`.

## Flow B: Regular Routine Check and Swap

### Draft selection and local persistence

- UI loads parent transactions with `status=DRAFT`, then keeps only
  `transaction_type=REGULAR_BILLING`.
- Selecting a draft preloads site, meter reading, period, metered KG, and price.
- Work in progress is stored in:
  - `wiwo_draft_cache_<transactionId>`
  - `wiwo_draft_transaction`
  - `wiwo_weigh_cache_<siteCylinderId>`
- Successful submission clears these WIWO local-storage keys.

### Client validation

For every active site cylinder, the user can enter returned gross weight and
mark it as swapped. Returned cylinders with a weight entry require:

- One `SERIAL_IMAGE`
- One `WEIGHT_IMAGE`

Replacement cylinders must have a validated serial, a linked swapped-out
cylinder, and a valid starting gross weight. The UI validates nominal capacity
and tare boundaries.

### Server sequence

`processRegularSwap` performs:

1. Calculate metered KG.
2. Fetch and validate every submitted active site-cylinder assignment.
3. Calculate remaining and consumed KG per returned cylinder.
4. Verify replacement assets have no active site assignment.
5. Compute total WIWO KG, variance, MAX arbitration, and source.
6. Require remarks for meter/WIWO mismatch.
7. Create a zero-value sales order and details for replacement products.
8. For each returned cylinder:
   - Always move `current_lpg_kg` to `previous_lpg_kg`.
   - Set `current_lpg_kg` to returned gross weight.
   - If swapped, mark assignment `REMOVED`, set `removed_date`, and patch asset
     to `EMPTY` with no current customer.
   - If not swapped, leave assignment connected and asset with customer.
9. For each replacement:
   - Require a validated gross weight plus serial and scale-weight photos.
   - Insert connected site-cylinder assignment.
   - Patch asset to `WITH_CUSTOMER`.
10. If billable KG is positive, create a posted sales invoice.
11. Reuse the selected draft's meter reading when available; otherwise insert a
    posted `lpg_meter_readings` row.
12. Insert a posted `CONSUMPTION_SWAP` WIWO header.
13. Insert billable `CONSUMPTION_RETURN` detail lines.
14. Insert non-billable `NEW_DEPLOYMENT` detail lines.
15. Patch site `last_meter_reading` and `last_reading_date`.
16. Patch an existing draft parent transaction or create a new posted parent.
17. Insert attachment metadata. Attachment insertion failures are logged but do
    not fail the billing transaction.

`isNoSwap` is accepted by the provider payload but is not used in server logic.

## Flow C: Cancellation and Rollback

`cancelWiwoBillingTransaction`:

1. Fetches the parent transaction and WIWO detail rows.
2. Rejects missing or already-cancelled transactions.
3. Marks WIWO header `CANCELLED` with audit reason.
4. For each `CONSUMPTION_RETURN`:
   - Sets site assignment to `CONNECTED`.
   - Clears `removed_date`.
   - Patches asset back to `WITH_CUSTOMER`.
5. For each `NEW_DEPLOYMENT`:
   - Deletes the site-cylinder assignment.
   - Patches asset to `AVAILABLE`.
6. Marks linked meter reading `VOIDED`.
7. Restores site `last_meter_reading` from the reading's previous value.
8. Marks sales order `Cancelled`.
9. Marks sales invoice `CANCELLED`.
10. Marks parent transaction `CANCELLED`.

This is a compensating-write workflow, not a database transaction.

## Lookup and Utility Functions

- `fetchWiwoBillingTransactions`
  paginates parent transactions, filtering status and searching transaction
  number/customer code.
- `fetchWiwoBillingTransactionById`
  fetches the parent and separately attaches WIWO details to the expanded header.
- `fetchCustomers`
  returns active customers.
- `fetchSites`
  returns active LPG sites, optionally by customer.
- `fetchAvailableCylinders`
  returns good `AVAILABLE`/`LOADED` assets and normalizes product relations.
- `validateSerialForOnboarding`
  validates serial mapping, asset existence, condition, status, and product.
- `fetchActiveSiteCylinders`
  returns active `CONNECTED`/`STANDBY` assignments.
- `verifyCylinderMonogamy`
  ensures an asset has no active connected/standby assignment.
- `createZeroAmountSalesOrder`
  creates logistics-only order header/details.
- `createSalesInvoice`
  calculates 12% VAT, optionally resolves a salesman from user ID, and creates a
  posted invoice.
- `withUser`
  adds selected audit user fields only when a positive user ID is available.

## API Authentication Behavior

- POST resolves the user from cookie or bearer token.
- When `NEXT_PUBLIC_AUTH_DISABLED=true`, POST can use `WIWO_DEV_USER_ID`,
  defaulting to 24.
- POST rejects requests without a resolved user.
- Cancellation reads only the cookie, not bearer authorization.
- Cancellation falls back to user ID `1` when token resolution fails.

## Directus Collections Used

### Core WIWO collections

- `lpg_metered_wiwo_transactions`
- `lpg_wiwo_headers`
- `lpg_wiwo_details`
- `lpg_metered_wiwo_transactions_attachments`

### Inventory and site state

- `lpg_customer_lpg_sites`
- `lpg_customer_site_cylinders`
- `cylinder_assets`
- `consolidator_serial_mappings`
- `products`
- `lpg_meter_readings`

### Commercial documents and references

- `customer`
- `sales_order`
- `sales_order_details`
- `sales_invoice`
- `salesman`
- Directus `folders` and `files`

## Inferred DDL

This is a compact logical reconstruction of the fields used by the module. It
is not an executable migration and omits unknown Directus metadata, exact native
types, existing constraints, indexes, and unrelated fields.

```sql
CREATE TABLE lpg_metered_wiwo_transactions (
  id BIGINT PRIMARY KEY,
  transaction_no VARCHAR(64),
  transaction_type VARCHAR(32),
  transaction_date DATE,
  billing_period_from DATE NULL,
  billing_period_to DATE NULL,
  customer_code VARCHAR(64) NOT NULL,
  lpg_site_id BIGINT NOT NULL,
  sales_order_id BIGINT NULL,
  sales_order_no VARCHAR(64) NULL,
  meter_reading_id BIGINT NULL,
  wiwo_header_id BIGINT NULL,
  metered_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  wiwo_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  variance_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  variance_reason_code VARCHAR(32) NULL,
  billable_source VARCHAR(16) NOT NULL,
  billable_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  price_per_kg DECIMAL(18,4) NULL,
  gross_amount DECIMAL(18,2) NULL,
  vat_amount DECIMAL(18,2) NULL,
  net_amount DECIMAL(18,2) NULL,
  sales_invoice_id BIGINT NULL,
  sales_invoice_no VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL,
  remarks TEXT NULL,
  created_by BIGINT NULL,
  created_date TIMESTAMP NULL,
  posted_by BIGINT NULL,
  posted_date TIMESTAMP NULL,
  modified_by BIGINT NULL,
  modified_date TIMESTAMP NULL,
  cancelled_by BIGINT NULL,
  cancelled_date TIMESTAMP NULL,
  cancelled_reason TEXT NULL
);

CREATE TABLE lpg_wiwo_headers (
  id BIGINT PRIMARY KEY,
  wiwo_no VARCHAR(64),
  lpg_site_id BIGINT NOT NULL,
  customer_code VARCHAR(64) NOT NULL,
  transaction_date DATE NOT NULL,
  wiwo_type VARCHAR(32) NOT NULL,
  total_returned_cylinders INT NOT NULL DEFAULT 0,
  total_deployed_cylinders INT NOT NULL DEFAULT 0,
  total_billable_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  price_per_kg DECIMAL(18,4) NULL,
  gross_amount DECIMAL(18,2) NULL,
  vat_amount DECIMAL(18,2) NULL,
  net_amount DECIMAL(18,2) NULL,
  wiwo_status VARCHAR(16) NOT NULL,
  sales_invoice_id BIGINT NULL,
  sales_invoice_no VARCHAR(64) NULL,
  remarks TEXT NULL,
  created_by BIGINT NULL,
  created_date TIMESTAMP NULL,
  posted_by BIGINT NULL,
  posted_date TIMESTAMP NULL,
  modified_by BIGINT NULL,
  modified_date TIMESTAMP NULL,
  cancelled_by BIGINT NULL,
  cancelled_date TIMESTAMP NULL,
  cancelled_reason TEXT NULL
);

CREATE TABLE lpg_wiwo_details (
  id BIGINT PRIMARY KEY,
  wiwo_header_id BIGINT NOT NULL,
  line_no INT NOT NULL,
  lpg_site_id BIGINT NOT NULL,
  customer_code VARCHAR(64) NOT NULL,
  line_type VARCHAR(32) NOT NULL,
  site_cylinder_id BIGINT NULL,
  cylinder_asset_id BIGINT NOT NULL,
  product_id BIGINT NULL,
  serial_number VARCHAR(128) NOT NULL,
  tare_weight_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  previous_lpg_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  returned_gross_weight_kg DECIMAL(18,3) NULL,
  remaining_lpg_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  consumed_lpg_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  billable_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  price_per_kg DECIMAL(18,4) NULL,
  gross_amount DECIMAL(18,2) NULL,
  vat_amount DECIMAL(18,2) NULL,
  net_amount DECIMAL(18,2) NULL,
  is_billable SMALLINT NOT NULL DEFAULT 0,
  result_site_cylinder_status VARCHAR(32) NULL,
  result_asset_status VARCHAR(32) NULL,
  remarks TEXT NULL,
  created_by BIGINT NULL,
  created_date TIMESTAMP NULL
);

CREATE TABLE lpg_customer_site_cylinders (
  id BIGINT PRIMARY KEY,
  lpg_site_id BIGINT NOT NULL,
  customer_code VARCHAR(64) NOT NULL,
  cylinder_asset_id BIGINT NOT NULL,
  site_cylinder_status VARCHAR(32) NOT NULL,
  previous_lpg_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  current_lpg_kg DECIMAL(18,3) NOT NULL DEFAULT 0,
  installed_date DATE NULL,
  removed_date DATE NULL,
  created_by BIGINT NULL,
  modified_by BIGINT NULL
);

CREATE TABLE lpg_meter_readings (
  id BIGINT PRIMARY KEY,
  lpg_site_id BIGINT NOT NULL,
  customer_code VARCHAR(64) NOT NULL,
  reading_date DATE NOT NULL,
  previous_reading DECIMAL(18,3) NOT NULL,
  current_reading DECIMAL(18,3) NOT NULL,
  kg_consumed DECIMAL(18,3) NOT NULL,
  raw_consumption DECIMAL(18,3) NULL,
  price_per_kg DECIMAL(18,4) NULL,
  reading_status VARCHAR(16) NOT NULL,
  created_by BIGINT NULL
);

CREATE TABLE lpg_metered_wiwo_transactions_attachments (
  id BIGINT PRIMARY KEY,
  transaction_id BIGINT NOT NULL,
  site_cylinder_id BIGINT NULL,
  cylinder_asset_id BIGINT NULL,
  attachment_type VARCHAR(32) NOT NULL,
  directus_file_id UUID NOT NULL,
  created_by BIGINT NULL
);
```

### Implied relationships

```text
lpg_metered_wiwo_transactions.wiwo_header_id -> lpg_wiwo_headers.id
lpg_metered_wiwo_transactions.meter_reading_id -> lpg_meter_readings.id
lpg_wiwo_details.wiwo_header_id -> lpg_wiwo_headers.id
lpg_wiwo_details.site_cylinder_id -> lpg_customer_site_cylinders.id
lpg_wiwo_details.cylinder_asset_id -> cylinder_assets.id
lpg_customer_site_cylinders.cylinder_asset_id -> cylinder_assets.id
lpg_metered_wiwo_transactions_attachments.transaction_id
  -> lpg_metered_wiwo_transactions.id
```

Recommended uniqueness/integrity rules, if not already present:

- Unique `transaction_no`
- Unique `wiwo_no`
- Unique `(wiwo_header_id, line_no)`
- At most one active site-cylinder row per `cylinder_asset_id`
- Non-negative meter, weight, quantity, and amount checks
- Enumerated checks for transaction, WIWO, line, asset, and assignment statuses

## Cross-Module Consumers

### Metered WIWO billing

`metered-wiwo-billing` queries WIWO headers with `wiwo_status=PENDING` for
linking to meter transactions.

### Unified billing

`unified-billing` also queries WIWO headers with `wiwo_status=PENDING`, then
uses `total_billable_kg` in arbitration.

### Kilo consumption billing

`kilo-consumption-billing`:

- Lists and reads `lpg_wiwo_headers` and `lpg_wiwo_details`.
- Maps `wiwo_no` to `transaction_no`.
- Computes physical billable KG from detail weights.
- Changes a linked WIWO header to `BILLED` after posting its parent invoice.

These consumers use status values not represented by the WIWO module's
`WiwoStatus = DRAFT | POSTED | CANCELLED` type.

## Risks and Inconsistencies

### Critical

1. Multi-table writes are not atomic.
   Any failed Directus request can leave installed/returned cylinders, sales
   documents, meter readings, WIWO records, and parent transactions out of sync.

2. Cross-module status contract is inconsistent.
   This module creates `DRAFT` or `POSTED`; metered and unified providers query
   only `PENDING`; kilo billing writes `BILLED`. A normal posted WIWO record may
   never appear in downstream pending selectors.

3. Cancellation is incomplete for in-place weighing.
   It restores assignment status/removal state but does not restore
   `previous_lpg_kg` and `current_lpg_kg`. Non-swapped cylinders therefore keep
   the posted routine weights after cancellation.

4. Cancellation of onboarding can be destructive/inaccurate.
   All `NEW_DEPLOYMENT` lines are deleted and assets become `AVAILABLE`, but
   onboarding and regular replacement lines share the same line type. The flow
   does not distinguish original asset status (`AVAILABLE` versus `LOADED`).

### High

1. Onboarding weight semantics are inconsistent.
   Detail `remaining_lpg_kg` is target gross minus tare, but parent `wiwo_kg`
   stores the sum of target gross weights. The field name suggests net physical
   LPG KG.

2. Onboarding records contradictory lifecycle state.
   WIWO and parent are `DRAFT`, while `posted_by`/`posted_date` are populated and
   the sales invoice is `POSTED`.

3. Server trusts several client-only validations.
   Product capacity checks, replacement-to-return pairing, attachment
   requirements, and some form completeness checks are not independently
   enforced by the provider.

4. Exact numeric mismatch requires remarks.
   Floating-point differences with no tolerance can force remarks for trivial
   precision variance.

5. Cancellation authentication falls back to user ID 1.
   An unauthenticated/invalid cookie can be recorded as a real privileged user.

6. Attachments are non-blocking after billing.
   Metadata failures are logged and ignored, leaving a posted transaction
   without required evidence.

### Medium

1. Timestamp-suffix document numbers are collision-prone under concurrency.
2. `createSalesInvoice` assigns `order_id` to the generated invoice number
   string rather than a sales order ID.
3. Regular detail `previous_lpg_kg` uses the assignment's old
   `previous_lpg_kg`, while consumption is calculated from old
   `current_lpg_kg`; audit detail can therefore show the wrong opening gross.
4. Site cancellation restores `last_meter_reading` but not
   `last_reading_date`, and may overwrite a newer reading if later transactions
   exist.
5. Cancellation does not prevent cancelling an older transaction after newer
   site activity.
6. No duplicate prevention exists for posting the same draft concurrently.
7. `WiwoList` exists but is not rendered by the current module root.
8. `isNoSwap` is unused.
9. `fetchAvailableCylinders` limits results to 200.
10. Header and parent foreign relations are application-enforced; actual DB
    constraints are unknown.

## Safe Change Guidance

Before modifying this module:

1. Treat parent transaction, WIWO header/details, meter reading, cylinder state,
   sales documents, and attachments as one business transaction.
2. Define a single lifecycle state machine shared by WIWO, metered, unified,
   and kilo billing modules.
3. Keep gross and net KG field meanings explicit.
4. Revalidate all financial, asset, attachment, and capacity rules server-side.
5. Make cancellation order-aware and restore exact before-images, not assumed
   statuses or weights.
6. Add idempotency/unique keys for posting and generated business numbers.
7. Verify changes against all three downstream WIWO consumers.

## Proposed Site-Period Header Refactor

Discussion date: 2026-06-10

The proposed `lpg_transaction_headers` table should act as a site-period
workspace above individual onboarding and regular billing transactions. It
should not replace `lpg_metered_wiwo_transactions`, `lpg_wiwo_headers`, or
`lpg_wiwo_details`.

The commercial workflow document establishes this ordering:

```text
Sales order -> picking/serial tagging -> sales invoice -> dispatch/delivery
-> meter/WIWO validation
```

Consequently, WIWO should select and reference an existing eligible sales
invoice. The current provider behavior that creates a new sales invoice inside
onboarding and regular WIWO processing conflicts with this workflow.

### Proposed relationship model

```text
lpg_transaction_headers
  1 -> many lpg_transaction_header_invoices
  1 -> many lpg_metered_wiwo_transactions

lpg_transaction_header_invoices
  many -> 1 sales_invoice

lpg_metered_wiwo_transactions
  1 -> 1 lpg_wiwo_headers
  1 -> 0..1 lpg_meter_readings
```

Recommended additions:

```sql
ALTER TABLE lpg_metered_wiwo_transactions
  ADD COLUMN transaction_header_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT FK_wiwo_transaction_header
    FOREIGN KEY (transaction_header_id)
    REFERENCES lpg_transaction_headers(header_id)
    ON DELETE RESTRICT;

CREATE TABLE lpg_transaction_header_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  header_id BIGINT UNSIGNED NOT NULL,
  sales_invoice_id BIGINT NOT NULL,
  invoice_role ENUM('SOURCE_DELIVERY','BILLING_REFERENCE') NOT NULL
    DEFAULT 'SOURCE_DELIVERY',
  linked_by BIGINT NULL,
  linked_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY UQ_header_invoice (header_id, sales_invoice_id),
  CONSTRAINT FK_header_invoice_header
    FOREIGN KEY (header_id)
    REFERENCES lpg_transaction_headers(header_id)
    ON DELETE RESTRICT,
  CONSTRAINT FK_header_invoice_sales_invoice
    FOREIGN KEY (sales_invoice_id)
    REFERENCES sales_invoice(invoice_id)
    ON DELETE RESTRICT
);
```

The exact native type of `sales_invoice.invoice_id` must be confirmed before
applying the DDL.

### Header constraints

Recommended:

- `UNIQUE(customer_site_id, period_from, period_to)` to prevent duplicate
  workspaces for the same exact period.
- `CHECK(period_from <= period_to)`.
- Add `CANCELLED` or `VOIDED` if posted headers must be reversible.
- Treat `is_billed` as derived lifecycle state where possible. If retained,
  update it only when every required child billing transaction has completed.
- Validate that `customer_id` equals the selected site's `customer_code`.

Overlapping periods cannot be prevented with a normal unique key and must be
checked in the API or database trigger.

### Proposed UI flow

1. Header workspace/list
   - Search existing headers by customer, site, period, and status.
   - Create header using customer site and period.
   - Customer should be derived from the selected site instead of independently
     entered.
2. Header detail/workspace
   - Show site, customer, period, status, invoice links, and child billings.
   - Allow invoice selection only while header is `DRAFT`.
3. Create billing action
   - Select transaction type: `ONBOARDING_BASELINE` or `REGULAR_BILLING`.
   - Select one eligible existing sales invoice.
   - Open the relevant onboarding or regular UI with header/site/period/invoice
     context locked.
4. Child transaction completion
   - Save the child with `transaction_header_id` and the selected invoice
     reference.
   - Do not create a new sales invoice from WIWO.
5. Header posting
   - Post only when required invoice links and child transaction validations are
     complete.

### Invoice eligibility

At minimum, an invoice candidate must:

- Belong to `lpg_transaction_headers.customer_id`.
- Resolve to the same customer site through its sales order, dispatch, or
  delivery relationship.
- Be created/dispatched/delivered within the header period according to the
  agreed business date.
- Have a valid posted/delivered status.
- Not already be linked to an incompatible header or completed WIWO billing.
- Represent LPG cylinder products relevant to the workflow.

The repository's commonly used `sales_invoice` fields do not expose a direct
customer-site field. The authoritative join path from invoice to customer site
must therefore be confirmed from the actual Sales Order/Dispatch DDL before
implementing the invoice query. Do not filter invoices by customer and date
alone because one customer may have multiple LPG sites.

### Confirmed schema and implementation status

The database now confirms:

- `lpg_transaction_headers.header_id` is `BIGINT UNSIGNED`.
- Header customer is `customer_id VARCHAR(50)`.
- Header site is `customer_site_id INT`.
- Header statuses are `DRAFT`, `POSTED`, and `CANCELLED`.
- Header audit user columns are `INT`.
- `lpg_metered_wiwo_transactions.transaction_header_id` exists as
  `BIGINT UNSIGNED` with a foreign key to the header.
- Child transaction, meter reading, WIWO header/detail, site-cylinder, and user
  foreign-key types are now known.

Implemented application slice:

1. Header list and search in the WIWO module.
2. Header creation using customer site, period, and remarks.
3. Customer derivation from the selected site.
4. API rejection of overlapping non-cancelled periods for the same site.
5. Header-first UI before onboarding or routine billing.
6. Header site and billing period initialization in `WiwoForm`.
7. `transaction_header_id` persistence for onboarding and regular child
   transactions.

Deferred:

- Existing sales-invoice selection and `lpg_transaction_header_invoices`
  application integration.
- Header posting/cancellation actions.
- Header child-transaction summary.

Invoice selection remains deferred because neither `sales_invoice` nor
`sales_order` contains a customer-site foreign key in the supplied DDL. The
dispatch/delivery relation that authoritatively maps an invoice to
`lpg_customer_lpg_sites.id` is still required.
