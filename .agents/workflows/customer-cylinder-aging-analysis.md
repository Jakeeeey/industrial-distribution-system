# Customer Cylinder Aging Module Analysis

## 1. Overview & Data Flow
The **Customer Cylinder Aging** module is a Business Intelligence & Analytics (BIA) tool designed to track how long cylinders have been deployed to customers, assess customer activity status, and recommend operational actions (e.g., Pull-Out, Follow-Up).

### Key Flow Architecture
The module follows a **BFF (Backend-For-Frontend) Pattern** with a Directus Headless CMS backend:
1. **Frontend Request:** The UI requests data via the Next.js API route (`/api/ids/bia/customer-cylinder-aging`), using filter parameters (date range, branch, product, customer code).
2. **BFF Processing (`route.ts`):** 
   - Instead of complex SQL joins, the BFF orchestrates multi-step fetches to Directus since Directus cannot join easily on non-PK string Foreign Keys.
   - It fetches `cylinder_assets` (with nested products and branches).
   - It fetches related `customers` separately.
   - It deeply traverses POS and Bulk sales modules (fetching serial mappings, sales invoices, consolidators, dispatches, and sales orders) to track transaction history.
3. **Data Aggregation & Computation:** The BFF computes aging days and translates them into thresholds for `CustomerActivityStatus` and `RecommendedAction`.
4. **State Management:** The data is pushed to a React Context (`CustomerCylinderAgingProvider`), which supplies the views with `records`, `summaries`, and handles the View Mode (Summary vs. Detail).

---

## 2. Structure & Hierarchy
The module is structured under `src/modules/industrial-distribution-system/bia/customer-cylinder-aging`.

* **`CustomerCylinderAgingModule.tsx`**: The main entry point and orchestrator. It wraps the content in the Provider and determines whether to show the Summary View or the Detail View.
* **`providers/`**:
  * `CustomerCylinderAgingProvider.tsx`: React Context handling data state (`records`, `summaries`), loading states, UI mode (`summary` | `detail`), pagination, and fetching actions.
* **`components/`**:
  * `CylinderAgingSummaryTable.tsx`: The master list table aggregated by customer.
  * `CustomerCylinderDetailView.tsx`: Deep dive into a specific customer's aging cylinders and transaction history.
  * `CylinderAgingKPICards.tsx`: High-level metrics display.
  * `CylinderAgingFilterBar.tsx`: User inputs for querying the data.
  * `CylinderAgingTable.tsx`: Reusable data grid component.
* **`services/`**:
  * `customer-cylinder-aging.repo.ts`: Thin client fetch wrappers calling the Next.js BFF.
* **`types/`**:
  * `customer-cylinder-aging.types.ts`: Core TypeScript definitions.
  * `customer-cylinder-aging.schema.ts`: Zod validation schemas for filters.
* **`BFF Route`**: `src/app/api/ids/bia/customer-cylinder-aging/route.ts` orchestrates the Directus logic.

---

## 3. Core Functions & Business Logic
All critical calculations are shifted to the Next.js BFF layer to maintain a thin client.

### Aging & Metrics Calculations
- **Days With Customer:** `TO_DAYS(CURDATE()) - TO_DAYS(aging_basis_date)`. The `aging_basis_date` prioritizes the last deployment date. If unavailable, it falls back to `modified_date` or `created_date`.
- **Customer Activity Status:** Evaluates days since the last transaction.
  * `0-7`: ACTIVE
  * `8-15`: MONITORING
  * `16-30`: WARNING
  * `31-60`: INACTIVE
  * `61+`: CRITICAL
- **Recommended Actions:** 
  * `> 61 days`: FOR_PULL_OUT_REVIEW
  * `> 31 days`: FOLLOW_UP_CUSTOMER
  * `> 16 days`: MONITOR_CUSTOMER

### Unifying Transactions
The `fetchTransactionsForSerials` function normalizes diverse transaction sources (POS directly vs. Bulk dispatch plans, sales orders, and post-dispatch invoices) into a `UnifiedTransaction` schema for predictable UI consumption.

---

## 4. Frontend Details
- **Tech Stack:** React, Tailwind CSS, Lucide Icons, and `sonner` for toast notifications.
- **Design System:** The UI leverages an `animate-in fade-in` approach with modern layouts, utilizing subtle glassmorphism and distinct KPI cards.
- **Client-Side Filtering:** Pagination and text-search logic are separated. Search filters exist purely on the client over the loaded dataset, whereas complex filters (Date, Branch, Product) trigger a new network fetch to the BFF.
- **Component Interactivity:** The detail view switches the entire context. When a customer is selected in the `SummaryTable`, the `Provider` updates `viewMode` to `"detail"` and fires `fetchCustomerCylinderDetail()`.

---

## 5. Directus DDL / Underlying Collections
Because this system uses **Directus Headless CMS**, there are no static SQL DDL files (e.g., `CREATE TABLE`) stored in the repository. Schema definitions are managed via Directus Collections. 

Based on the BFF route queries, here are the **Data Collections (Tables)** used for this module:

1. **`cylinder_assets`**: The core asset table containing serial numbers, status, condition, and foreign keys to `product_id`, `current_branch_id`, and `current_customer_code`.
2. **`customers`**: Holds customer metadata (`customer_name`, `store_name`, `contact_number`, address parts).
3. **`products`**: Linked to cylinders for product weights and codes.
4. **`branches`**: Linked for origin context.
5. **POS Flow:**
   - `pos_transactions`
   - `pos_transaction_serial`
   - `sales_invoice` (POS linked)
6. **Bulk Flow (Dispatch & Consolidators):**
   - `sales_order` & `sales_order_details`
   - `consolidator` & `consolidator_details`
   - `consolidator_serial_mappings`
   - `consolidator_dispatches`
   - `dispatch_plan` & `dispatch_plan_details`
   - `post_dispatch_plan`
   - `post_dispatch_invoices`

These collections replace traditional SQL DDL, acting as the system's database schema exposed via the Directus REST API.
