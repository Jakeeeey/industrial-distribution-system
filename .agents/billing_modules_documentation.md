# LPG Billing Management Documentation

This document provides a comprehensive technical analysis of the **WIWO (Weigh-In Weigh-Out) Billing** and **Metered Billing** modules within the Industrial Distribution System. It covers UI/Backend flows, database collections (DDLs), and detailed column-level posting logic.

---

## 1. DDL Collections & Entities

The system uses Directus as the backend headless CMS/API. Below are the core collections and their key columns interacted with during the billing flows.

### Foundational & Master Data Tables
*   **`customers`**: Master list of business entities.
    *   `customer_code` (PK)
    *   `customer_name`
    *   `store_name`
*   **`products`**: Master list of saleable LPG variants.
    *   `id` (PK)
    *   `product_name`
    *   `unit_of_measurement_count` (e.g., 50kg, 5kg)
*   **`user`**: System users handling the transactions.
    *   `id` (PK)
    *   Mapped across transactions as `created_by`, `modified_by`, `posted_by`, `cancelled_by`.

### Core Domain Tables
*   **`cylinder_assets`**: Master list of LPG cylinders.
    *   `id` (PK)
    *   `serial_number`
    *   `cylinder_status` (e.g., AVAILABLE, CONNECTED, RETURNED)
    *   `tare_weight`
    *   `product_id` (FK to `products`)
*   **`lpg_customer_site_cylinders`**: Junction mapping cylinders to a specific customer site.
    *   `id` (PK)
    *   `lpg_site_id` (FK)
    *   `cylinder_asset_id` (FK)
    *   `site_cylinder_status` (CONNECTED, RETURNED)
    *   `current_lpg_kg` / `previous_lpg_kg`
*   **`lpg_customer_lpg_sites`**: Customer installation details.
    *   `id` (PK)
    *   `site_name`
    *   `default_price_per_kg`

### WIWO Transactions
*   **`lpg_wiwo_headers`**: High-level grouping of a swap or onboarding event.
    *   `id` (PK)
    *   `wiwo_type` (CONSUMPTION_SWAP, DEPLOYMENT_ONLY, RETURN_ONLY)
    *   `wiwo_status` (DRAFT, POSTED, CANCELLED)
    *   `total_billable_kg`
*   **`lpg_wiwo_details`**: Line items for each cylinder involved in a header.
    *   `id` (PK)
    *   `wiwo_header_id` (FK)
    *   `line_type` (CONSUMPTION_RETURN, NEW_DEPLOYMENT)
    *   `cylinder_asset_id` (FK)
    *   `returned_gross_weight_kg` / `tare_weight_kg`
    *   `consumed_lpg_kg`

### Metered Transactions
*   **`lpg_meter_readings`**: Logs meter dials.
    *   `id` (PK)
    *   `lpg_site_id` (FK)
    *   `previous_reading` / `current_reading`
    *   `kg_consumed` (Computed based on meter conversion)
*   **`lpg_metered_wiwo_transactions`**: The arbitration/bridge table resolving meter vs WIWO variance.
    *   `id` (PK)
    *   `meter_reading_id` (FK)
    *   `wiwo_header_id` (FK - Optional)
    *   `metered_kg` / `wiwo_kg` / `variance_kg`
    *   `billable_source` (METERED, WIWO, NONE)
    *   `billable_kg`
    *   `net_amount`
*   **`lpg_metered_wiwo_transactions_attachments`**: Audit photos (e.g., dial photos, weight scale photos).
    *   `attachment_type` (SERIAL_IMAGE, WEIGHT_IMAGE, GENERAL_PHOTO)

### Financial Tables
*   **`sales_order`** & **`sales_order_details`**: Generates SOs for consumption.
*   **`sales_invoice`**: Final billing invoice sent to the customer.
*   **`lpg_transaction_header_invoices`**: Groups multiple invoices under a single billing period (Consolidation).

---

## 2. WIWO Billing Flow

### UI Flow
1.  **Selection**: The user selects a Customer and Site.
2.  **Transaction Type**: User chooses "Onboarding" (Baseline) or "Regular Swap".
3.  **Data Entry**:
    *   *Returns*: User scans/selects existing cylinders on-site and inputs the `returned_gross_weight_kg`.
    *   *Deployments*: User scans/selects new cylinders from inventory to deploy.
4.  **Submission**: User submits the transaction. Photos of serials and scales may be attached.

### Backend Function logic (`wiwo-billing.provider.ts`)

#### `processOnboardingBaseline`
*   Updates `cylinder_assets` -> Sets `cylinder_status` to `CONNECTED`.
*   Inserts into `lpg_customer_site_cylinders` -> Logs asset at site with status `CONNECTED`.
*   Inserts into `lpg_wiwo_headers` -> Sets `wiwo_type = DEPLOYMENT_ONLY`.
*   Inserts into `lpg_wiwo_details` -> Sets `line_type = NEW_DEPLOYMENT`.
*   Calls `createZeroAmountSalesOrder` & `createSalesInvoice` for tracking non-billable inventory movement.
*   Inserts photos into `lpg_metered_wiwo_transactions_attachments`.

#### `processRegularSwap`
*   **Returns**: 
    *   Updates `lpg_customer_site_cylinders` -> Sets status to `RETURNED`.
    *   Updates `cylinder_assets` -> Sets status to `RETURNED`.
    *   Inserts into `lpg_wiwo_details` -> `line_type = CONSUMPTION_RETURN`, calculates `consumed_lpg_kg = (previous_lpg_kg) - (returned_gross_weight - tare_weight)`.
*   **Deployments**: 
    *   Updates `cylinder_assets` to `CONNECTED`.
    *   Inserts new `lpg_customer_site_cylinders`.
    *   Inserts into `lpg_wiwo_details` -> `line_type = NEW_DEPLOYMENT`.
*   **Header**: Inserts `lpg_wiwo_headers` -> `wiwo_type = CONSUMPTION_SWAP`.
*   **Billing**: Evaluates `total_billable_kg`, generates `sales_order` and `sales_invoice`.

---

## 3. Metered Billing Flow

### UI Flow
1.  **Selection**: User selects the Metered Site.
2.  **Reading Entry**: User inputs the `current_reading` on the meter dial.
3.  **Arbitration (Optional)**: If there was a cylinder swap during the period, the UI pulls unbilled WIWO records. The system computes Variance = (Metered KG - WIWO KG).
4.  **Submission**: The user finalizes the transaction.

### Backend Function logic (`metered-billing.provider.ts`)

#### `createMeteredTransaction`
*   **Meter Read**: Fetches `previous_reading` via `fetchLastMeteredTransaction`.
*   Inserts into `lpg_meter_readings` -> Sets `current_reading` and calculates `kg_consumed`.
*   **Bridging**: Links `lpg_meter_readings.id` and optionally `lpg_wiwo_headers.id`.
*   Inserts into `lpg_metered_wiwo_transactions` -> 
    *   Sets `metered_kg` from meter dial.
    *   Sets `wiwo_kg` from linked WIWO swap.
    *   Sets `billable_source` and `billable_kg`.
    *   Calculates financial `net_amount` based on site pricing.
*   **Invoicing**: Generates `sales_order` / `sales_invoice`.

---

## 4. Database Interaction Flowchart

Below is the Mermaid flowchart visualizing how data flows and cascades through the tables across the functions.

![Database Interaction Flowchart](https://mermaid.ink/img/Zmxvd2NoYXJ0IFRECiAgICAlJSBBY3RvcnMKICAgIFVJW0Zyb250ZW5kIFVJIENvbXBvbmVudHNdCiAgICBEaXJlY3R1c1soRGlyZWN0dXMgREIvQVBJKV0KCiAgICAlJSBXSVdPIEZsb3cKICAgIHN1YmdyYXBoIFdJV08gW1dJV08gQmlsbGluZyBGbG93XQogICAgICAgIFVJX1dJV09bU3VibWl0IFJlZ3VsYXIgU3dhcCAvIE9uYm9hcmRdCiAgICAgICAgdXBkYXRlQ3lsW1BBVENIIGN5bGluZGVyX2Fzc2V0c1xuc3RhdHVzOiBDT05ORUNURUQvUkVUVVJORURdCiAgICAgICAgaW5zZXJ0U2l0ZUN5bFtQT1NUIGxwZ19jdXN0b21lcl9zaXRlX2N5bGluZGVyc1xudHJhY2sgaW52ZW50b3J5IGF0IHNpdGVdCiAgICAgICAgaW5zZXJ0V2l3b0hlYWRlcltQT1NUIGxwZ193aXdvX2hlYWRlcnNcbmFnZ3JlZ2F0ZSB0cmFuc2FjdGlvbl0KICAgICAgICBpbnNlcnRXaXdvRGV0YWlsW1BPU1QgbHBnX3dpd29fZGV0YWlsc1xubGluZSBpdGVtIGNvbnN1bXB0aW9uL2RlcGxveW1lbnRdCiAgICBlbmQKCiAgICAlJSBNZXRlcmVkIEZsb3cKICAgIHN1YmdyYXBoIE1FVEVSIFtNZXRlcmVkIEJpbGxpbmcgRmxvd10KICAgICAgICBVSV9NZXRlcltTdWJtaXQgTWV0ZXIgUmVhZGluZ10KICAgICAgICBpbnNlcnRNZXRlclJlYWRbUE9TVCBscGdfbWV0ZXJfcmVhZGluZ3NcbmxvZyBkaWFsLCBjYWxjIGtnX2NvbnN1bWVkXQogICAgICAgIGluc2VydE1ldGVyVHJhbnNbUE9TVCBscGdfbWV0ZXJlZF93aXdvX3RyYW5zYWN0aW9uc1xuYnJpZGdlIHRhYmxlIGZvciB2YXJpYW5jZV0KICAgIGVuZAoKICAgICUlIEZpbmFuY2lhbCAvIENvcmUKICAgIHN1YmdyYXBoIEZJTkFOQ0UgW0ZpbmFuY2lhbCBDb25zb2xpZGF0aW9uXQogICAgICAgIFNPW1BPU1Qgc2FsZXNfb3JkZXIgJiBkZXRhaWxzXQogICAgICAgIFNJW1BPU1Qgc2FsZXNfaW52b2ljZV0KICAgICAgICBUSElbUE9TVCBscGdfdHJhbnNhY3Rpb25faGVhZGVyX2ludm9pY2VzXG5ncm91cCBmb3Igc3RhdGVtZW50c10KICAgIGVuZAoKICAgICUlIENvbm5lY3Rpb25zIFdJV08KICAgIFVJIC0tPiBVSV9XSVdPCiAgICBVSV9XSVdPIC0tPiB1cGRhdGVDeWwKICAgIFVJX1dJV08gLS0+IGluc2VydFNpdGVDeWwKICAgIFVJX1dJV08gLS0+IGluc2VydFdpd29IZWFkZXIKICAgIGluc2VydFdpd29IZWFkZXIgLS0+IGluc2VydFdpd29EZXRhaWwKICAgIGluc2VydFdpd29EZXRhaWwgLS0+IFNPCgogICAgJSUgQ29ubmVjdGlvbnMgTWV0ZXIKICAgIFVJIC0tPiBVSV9NZXRlcgogICAgVUlfTWV0ZXIgLS0+IGluc2VydE1ldGVyUmVhZAogICAgaW5zZXJ0TWV0ZXJSZWFkIC0tPiBpbnNlcnRNZXRlclRyYW5zCiAgICAKICAgICUlIEJyaWRnZSBXSVdPIHRvIE1ldGVyCiAgICBpbnNlcnRXaXdvSGVhZGVyIC0uICJMaW5rZWQgaWYgVmFyaWFuY2UgY2hlY2sgbmVlZGVkIiAuLT4gaW5zZXJ0TWV0ZXJUcmFucwogICAgaW5zZXJ0TWV0ZXJUcmFucyAtLT4gU08KCiAgICAlJSBGaW5hbmNlIHJvdXRpbmcKICAgIFNPIC0tPiBTSQogICAgU0kgLS0+IFRISQogICAgVEhJIC0tPiBEaXJlY3R1cwoKICAgIHVwZGF0ZUN5bCAtLT4gRGlyZWN0dXMKICAgIGluc2VydFNpdGVDeWwgLS0+IERpcmVjdHVzCiAgICBpbnNlcnRXaXdvRGV0YWlsIC0tPiBEaXJlY3R1cwogICAgaW5zZXJ0TWV0ZXJSZWFkIC0tPiBEaXJlY3R1cwogICAgaW5zZXJ0TWV0ZXJUcmFucyAtLT4gRGlyZWN0dXMK)

---

## 5. Summary for New Developers

1. **State Independence vs Connection**: 
   - **WIWO Billing** operates purely on physical cylinder weights. A swap strictly calculates `(Initial Weight) - (Returned Weight)`.
   - **Metered Billing** operates on pipeline dials.
   - The complexity arises because Metered Sites *also* have physical cylinders. `lpg_metered_wiwo_transactions` is the "bridge" table where a physical cylinder swap (`wiwo_kg`) is compared against the pipeline dial (`metered_kg`) to calculate `variance_kg`.
2. **Directus as Backend**: All queries use `directusFetch()`. You will not find raw SQL or Prisma schemas in this repo. Look at the `providers/*.ts` files for the REST API payloads to understand table structures.
3. **Cylinder Lifecycle**: Cylinders bounce between `cylinder_assets` (Global state) and `lpg_customer_site_cylinders` (Localized customer state). Always update both in tandem.
4. **Billing Generation**: Transactions do not natively bill. They cascade into `sales_order` and `sales_invoice` endpoints, which the ERP treats as standard financial documents.
