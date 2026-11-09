// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/route.ts
// ==============================================================================
// BFF API Route: Stock Movement and Variance Report (IDS SCM)
//
// Read-only reporting. It never posts inventory, creates a charge or releases a
// payment (spec §2), and it never mutates a source document.
//
// Scope: `branchId` narrows the report to one branch; omitting it reconciles
// every branch the filter bar offers ("All branches"). Reconciliation is always
// performed per branch and never across branches, because a count sheet and a
// movement ledger line only ever belong to one warehouse.
//
// Product scope: only products flagged `is_serialized` are reconciled. The
// movements view accepts no such parameter, so both sources are gated by the
// same id set read from the product master; the counts and the ledger can never
// disagree about what is in scope.
//
// Sources of truth
// - Spring-backed `view-product-movements` ledger (posted in/out per document).
//   Reachable only through SPRING_API_BASE_URL; Directus has no equivalent view.
//   The view keys on branch NAME, so each branch costs one ledger call.
// - Directus `physical_inventory` + `physical_inventory_details`: committed counts
//   carrying system_count, physical_count and the reporting cutoff.
// - Directus `sales_invoice`: transaction_status, used to detect voids.
//
// Known source-data limitations, surfaced to the caller instead of hidden:
// - The movements view does not apply later voids, so voided invoices are
//   identified here and excluded from every balance.
// - There is no opening-balance table anywhere in the schema. The opening figure
//   is therefore reconstructed from full movement history before the period,
//   which is only exact for products whose ledger is complete.
// - Access is scoped by the branch the caller selects; the platform has no
//   per-user branch permission table to enforce it further.
// - When an individual branch ledger cannot be read, that branch is omitted from
//   the result and named in `warnings` rather than reported as a zero balance.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buildVarianceRows,
  productDisplayName,
  receiptMatchKey,
  summariseKpis,
  type ProductMeta,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc";
import type {
  RawCountLine,
  RawMovementRow,
  StockMovementVarianceFilters,
  StockMovementVarianceReportResponse,
  StockMovementVarianceRow,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/types/stock-movement-variance.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/** How many branch ledger calls may be in flight at once. */
const LEDGER_CONCURRENCY = 2;

/** Attempts per branch ledger call before the branch is reported as unreadable. */
const LEDGER_ATTEMPTS = 4;

/**
 * Retrieves the Directus endpoint and static token from environment.
 * NEXT_PUBLIC_API_BASE_URL is the value actually configured for this deployment.
 */
function getDirectusConfig(): { url: string; token: string } {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

/**
 * Performs a Directus read and unwraps the `{ data: [...] }` envelope.
 */
async function directusList<T>(
  base: string,
  token: string,
  collection: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${base}/items/${collection}?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${collection} query failed with status ${res.status}`);
  }

  const payload = (await res.json()) as { data?: T[] } | T[];
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

/** Chunks an array so Directus `_in` filters never exceed a sane URL length. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs a batch of async tasks with a bounded concurrency to protect the gateway. */
async function mapPool<In, Out>(
  items: In[],
  limit: number,
  task: (item: In) => Promise<Out>
): Promise<Out[]> {
  const results: Out[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/** A rate limit or a gateway fault is worth waiting out; anything else is final. */
function isRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Honours Retry-After when the gateway sends it, otherwise backs off exponentially. */
function retryWaitMs(res: Response, attempt: number): number {
  const announced = Number(res.headers.get("retry-after"));
  if (Number.isFinite(announced) && announced > 0) return Math.min(announced * 1000, 15000);
  return Math.min(500 * 2 ** attempt, 5000);
}

/**
 * Reads the movements ledger for one branch. The gateway rate-limits concurrent
 * branch calls, so a 429 is retried rather than reported as an unreadable branch.
 */
async function fetchLedger(url: string, token: string): Promise<Response> {
  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  for (let attempt = 0; attempt < LEDGER_ATTEMPTS - 1 && isRetryable(res.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryWaitMs(res, attempt)));
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  }

  return res;
}

/** Unwraps a Directus relation value that may be an id or a nested object. */
function relationId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.product_id ?? obj.id ?? obj.branch_id ?? obj.category_id;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads the branch name off a movement row, whichever casing the view used. */
function movementBranchName(row: RawMovementRow): string {
  return String(row.branchName ?? (row as Record<string, unknown>).branch_name ?? "").trim();
}

interface BranchScope {
  id: number;
  name: string;
}

/**
 * The movements view posts some purchase receipts with an empty number and
 * exposes no document id at all, so those rows are traced back through
 * `purchase_order_receiving` on branch + product + the exact second the stock
 * was received, and the parent purchase order is named instead. A match that
 * points at more than one order is left unnamed rather than guessed, because
 * a wrong reference on a receipt is worse than none.
 */
async function attachReceiptReferences(
  movements: RawMovementRow[],
  directusBase: string,
  directusToken: string,
  branchIds: number[]
): Promise<void> {
  const blanks = movements.filter((row) => {
    const docType = String(row.docType ?? "").toUpperCase();
    const docNo = String(row.docNo ?? row.doc_no ?? "").trim();
    return docType === "PURCHASE RECEIPT" && !docNo;
  });
  if (blanks.length === 0 || branchIds.length === 0) return;

  const stamps = blanks
    .map((row) => String(row.ts ?? "").replace("T", " ").slice(0, 19))
    .filter(Boolean)
    .sort();
  if (stamps.length === 0) return;

  const receiving = await directusList<{
    purchase_order_id?: number;
    product_id?: number;
    branch_id?: number;
    received_date?: string;
  }>(
    directusBase,
    directusToken,
    "purchase_order_receiving",
    "fields=purchase_order_id,product_id,branch_id,received_date" +
      "&filter[receipt_no][_null]=true" +
      `&filter[branch_id][_in]=${branchIds.join(",")}` +
      `&filter[received_date][_between]=${encodeURIComponent(
        `${stamps[0].replace(" ", "T")},${stamps[stamps.length - 1].replace(" ", "T")}`
      )}` +
      "&limit=-1"
  );

  const ordersByKey = new Map<string, Set<number>>();
  for (const row of receiving) {
    const orderId = Number(row.purchase_order_id);
    if (!orderId) continue;
    const key = receiptMatchKey(Number(row.branch_id), Number(row.product_id), row.received_date);
    const bucket = ordersByKey.get(key);
    if (bucket) bucket.add(orderId);
    else ordersByKey.set(key, new Set([orderId]));
  }

  const orderIds = [...new Set(receiving.map((row) => Number(row.purchase_order_id)))].filter(
    (id) => id > 0
  );
  const orders =
    orderIds.length === 0
      ? []
      : await directusList<{ purchase_order_id?: number; purchase_order_no?: string }>(
          directusBase,
          directusToken,
          "purchase_order",
          `fields=purchase_order_id,purchase_order_no&filter[purchase_order_id][_in]=${orderIds.join(
            ","
          )}&limit=-1`
        );
  const numberById = new Map(
    orders.map((order) => [Number(order.purchase_order_id), String(order.purchase_order_no ?? "")])
  );

  for (const row of blanks) {
    const key = receiptMatchKey(
      relationId(row.branchId ?? (row as Record<string, unknown>).branch_id) ?? 0,
      relationId(row.productId ?? (row as Record<string, unknown>).product_id) ?? 0,
      row.ts
    );
    const matches = ordersByKey.get(key);
    if (!matches || matches.size !== 1) continue;
    const number = numberById.get([...matches][0]);
    if (number) row.receiptRef = number;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing access token" },
      { status: 401 }
    );
  }

  const { url: directusBase, token: directusToken } = getDirectusConfig();
  if (!directusBase || !directusToken) {
    return NextResponse.json(
      { ok: false, error: "Directus is not configured for this environment." },
      { status: 500 }
    );
  }

  const springBase = process.env.SPRING_API_BASE_URL?.trim().replace(/\/$/, "");
  if (!springBase) {
    return NextResponse.json(
      { ok: false, error: "SPRING_API_BASE_URL is not configured; movements are unavailable." },
      { status: 500 }
    );
  }

  const search = new URL(req.url).searchParams;
  const startDate = search.get("startDate")?.trim() ?? "";
  const endDate = search.get("endDate")?.trim() ?? "";
  const branchIdRaw = search.get("branchId")?.trim() ?? "";
  const categoryIdRaw = search.get("categoryId")?.trim() ?? "";
  const productIdRaw = search.get("productId")?.trim() ?? "";

  if (!startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "startDate and endDate are both required." },
      { status: 400 }
    );
  }
  if (startDate > endDate) {
    return NextResponse.json(
      { ok: false, error: "The reporting period start cannot be after its cutoff." },
      { status: 400 }
    );
  }

  const requestedBranchId = branchIdRaw ? Number(branchIdRaw) : null;
  if (requestedBranchId !== null && (!Number.isFinite(requestedBranchId) || requestedBranchId <= 0)) {
    return NextResponse.json({ ok: false, error: "branchId is not valid." }, { status: 400 });
  }

  const requestedProductId = productIdRaw ? Number(productIdRaw) : null;
  if (
    requestedProductId !== null &&
    (!Number.isFinite(requestedProductId) || requestedProductId <= 0)
  ) {
    return NextResponse.json({ ok: false, error: "productId is not valid." }, { status: 400 });
  }

  const warnings: string[] = [];

  try {
    // ── 1. Resolve the branch scope ───────────────────────────────────────────
    // The movements view filters by branch NAME, so every branch in scope has to
    // be translated before any ledger call. "All branches" uses exactly the same
    // predicate the lookups route feeds the dropdown, so the two never disagree.
    const branchRows = await directusList<{ id: number; branch_name: string; isActive?: boolean }>(
      directusBase,
      directusToken,
      "branches",
      requestedBranchId !== null
        ? `filter[id][_eq]=${requestedBranchId}&filter[division_id][_eq]=1&fields=id,branch_name,isActive`
        : `fields=id,branch_name&filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`
    );

    const scope: BranchScope[] = branchRows
      .filter((row) => Boolean(row.branch_name))
      .map((row) => ({ id: Number(row.id), name: String(row.branch_name) }));

    if (scope.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            requestedBranchId !== null
              ? `Branch ${requestedBranchId} was not found.`
              : "No active Industrial-division branches are available to report on.",
        },
        { status: 404 }
      );
    }

    for (const branch of scope) {
      const source = branchRows.find((row) => Number(row.id) === branch.id);
      if (source?.isActive === false || Number(source?.isActive ?? 1) === 0) {
        warnings.push(`Branch "${branch.name}" is inactive; historical data is still reported.`);
      }
    }

    const singleBranch = requestedBranchId !== null;
    const scopeIds = scope.map((branch) => branch.id);
    const branchFilter = singleBranch
      ? `filter[ph_id][branch_id][_eq]=${scopeIds[0]}`
      : `filter[ph_id][branch_id][_in]=${scopeIds.join(",")}`;

    // ── 1b. Resolve the selected product's master name ───────────────────────
    // The movements view only accepts a product NAME, but names are not unique in
    // this schema, so the picker sends an id. The name looked up here is the
    // master `product_name` the view is keyed on — never the `description` the
    // screen shows — and the id is applied again after reconciliation so a
    // same-name twin cannot sneak into the result.
    let ledgerProductName = "";
    if (requestedProductId !== null) {
      const productRows = await directusList<{ product_id: number; product_name?: string }>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_name&filter[product_id][_eq]=${requestedProductId}&limit=1`
      );

      ledgerProductName = String(productRows[0]?.product_name ?? "").trim();
      if (!ledgerProductName) {
        return NextResponse.json(
          {
            ok: false,
            error: `Product ${requestedProductId} has no name on record, so the movement ledger cannot be queried for it.`,
          },
          { status: 404 }
        );
      }
    }

    // ── 1c. Serialized product scope ─────────────────────────────────────────
    // Cylinder stock is what this report reconciles, so only products flagged
    // `is_serialized` are eligible. The ledger view cannot express this, so the
    // gate is read once from the product master and applied to both sources.
    const serializedRows = await directusList<{ product_id: number }>(
      directusBase,
      directusToken,
      "products",
      `fields=product_id&filter[is_serialized][_eq]=1&limit=-1`
    );

    const serializedProductIds = new Set(
      serializedRows.map((row) => Number(row.product_id)).filter((id) => Number.isFinite(id))
    );

    if (serializedProductIds.size === 0) {
      // Reporting zero lines here would blame the period for a master-data state.
      return NextResponse.json(
        {
          ok: false,
          error: "No product is flagged as serialized, so there is nothing for this report to reconcile.",
        },
        { status: 404 }
      );
    }

    // ── 2. Committed physical counts up to the cutoff (spec §4 verified records)
    // Draft and cancelled count sheets are excluded: only a committed count is a
    // verified record. One cutoff governs movements and counts (spec §8).
    // cutOff_date is a MySQL TIMESTAMP, so the bound must run to the very end of
    // the cutoff day or counts encoded later that same day would be dropped.
    const cutoffInclusive = encodeURIComponent(`${endDate} 23:59:59`);

    const countFieldQuery =
      `fields=id,physical_count,system_count,variance,date_encoded,` +
      `ph_id.id,ph_id.ph_no,ph_id.cutOff_date,ph_id.date_encoded,ph_id.branch_id,` +
      `product_id.product_id,product_id.product_code,product_id.product_name,` +
      `product_id.description,` +
      `product_id.unit_of_measurement_count,product_id.parent_id,` +
      `product_id.product_category.category_id,product_id.product_category.category_name` +
      `&${branchFilter}` +
      `&filter[ph_id][isComitted][_eq]=1` +
      `&filter[ph_id][isCancelled][_eq]=0` +
      `&filter[ph_id][cutOff_date][_lte]=${cutoffInclusive}` +
      `&sort=-ph_id.cutOff_date&limit=-1`;

    interface RawCountRow {
      id: number;
      physical_count?: number | string;
      system_count?: number | string;
      variance?: number | string;
      date_encoded?: string | null;
      ph_id?: { id?: number; ph_no?: string; cutOff_date?: string; date_encoded?: string; branch_id?: number };
      product_id?: unknown;
    }

    // Cut to the serialized scope here so the product-master seeding below never
    // spends a round trip on a product this report excludes.
    const countRows = (
      await directusList<RawCountRow>(
        directusBase,
        directusToken,
        "physical_inventory_details",
        countFieldQuery
      )
    ).filter((row) => {
      const pid = relationId(row.product_id);
      return pid !== null && serializedProductIds.has(pid);
    });

    const counts: RawCountLine[] = countRows
      .map((row) => {
        const productId = relationId(row.product_id);
        const ph = row.ph_id ?? {};
        if (productId === null || !ph?.ph_no) return null;
        return {
          id: row.id,
          phId: Number(ph.id ?? 0),
          phNo: String(ph.ph_no),
          branchId: Number(ph.branch_id ?? 0),
          cutOffDate: ph.cutOff_date ? String(ph.cutOff_date) : null,
          dateEncoded: ph.date_encoded ? String(ph.date_encoded) : row.date_encoded ? String(row.date_encoded) : null,
          productId,
          systemCount: Number(row.system_count ?? 0),
          physicalCount: Number(row.physical_count ?? 0),
          sourceVariance: Number(row.variance ?? 0),
        } satisfies RawCountLine;
      })
      .filter((line): line is RawCountLine => line !== null);

    // Counts bucket per branch: a count sheet never evidences another branch.
    const countsByBranch = new Map<number, RawCountLine[]>();
    for (const line of counts) {
      const bucket = countsByBranch.get(line.branchId);
      if (bucket) bucket.push(line);
      else countsByBranch.set(line.branchId, [line]);
    }

    // ── 3. Posted movements from the Spring ledger view, one call per branch ──
    const ledgerByBranch = new Map<number, RawMovementRow[]>();

    interface LedgerResult {
      rows: RawMovementRow[] | null;
      error?: string;
      /** How many rows the view returned before the serialized scope cut them. */
      sourceRowCount: number;
    }

    const ledgerResults = await mapPool(
      scope,
      LEDGER_CONCURRENCY,
      async (branch): Promise<LedgerResult> => {
        const movementsUrl = new URL(`${springBase}/api/view-product-movements/filter`);
        movementsUrl.searchParams.set("branchName", branch.name);
        if (ledgerProductName) movementsUrl.searchParams.set("productName", ledgerProductName);

        try {
          const res = await fetchLedger(movementsUrl.toString(), token);

          if (!res.ok) return { rows: null, error: `status ${res.status}`, sourceRowCount: 0 };

          const parsed = JSON.parse(await res.text());
          if (!Array.isArray(parsed)) {
            return { rows: null, error: "a non-list payload", sourceRowCount: 0 };
          }

          // The view is trusted to honour branchName, but a stray row from another
          // warehouse would corrupt both branches, so rows are re-keyed defensively.
          const rows = (parsed as RawMovementRow[]).filter((row) => {
            const pid = relationId(
              row.productId ?? (row as Record<string, unknown>).product_id
            );
            if (pid === null || !serializedProductIds.has(pid)) return false;

            const name = movementBranchName(row);
            if (!name) {
              if (!row.branchId) row.branchId = branch.id;
              row.branchName = branch.name;
              return true;
            }
            return name.trim().toUpperCase() === branch.name.trim().toUpperCase();
          });

          return { rows, sourceRowCount: parsed.length };
        } catch (err) {
          return {
            rows: null,
            error: err instanceof Error ? err.message : "unknown error",
            sourceRowCount: 0,
          };
        }
      }
    );

    const movements: RawMovementRow[] = [];
    const reconciled: BranchScope[] = [];

    ledgerResults.forEach((result, index) => {
      const branch = scope[index];
      if (!result || result.rows === null) {
        // A failed ledger is omitted outright: reporting it as an empty ledger
        // would invent variances for a branch that was simply unreachable.
        warnings.push(
          `Branch "${branch.name}" was omitted because its movement ledger could not be read${
            result?.error ? ` (${result.error})` : ""
          }.`
        );
        return;
      }
      ledgerByBranch.set(branch.id, result.rows);
      reconciled.push(branch);
      movements.push(...result.rows);
      if (result.sourceRowCount === 0) {
        // Only a genuinely empty ledger is worth flagging: a branch whose whole
        // history is non-serialized legitimately contributes no lines here.
        warnings.push(
          `The movements ledger returned no rows for "${branch.name}", so its expected balances are zero.`
        );
      }
    });

    if (reconciled.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No branch movement ledger could be read for this period." },
        { status: 502 }
      );
    }

    // ── 4. Void detection: reversals the ledger view never applied ────────────
    // The movements view includes sales invoices regardless of their later void,
    // so voided documents are resolved here and excluded from every balance.
    const salesInvoiceDocNos = Array.from(
      new Set(
        movements
          .filter((row) => {
            const docType = String(row.docType ?? "").toUpperCase();
            const docNo = String(row.docNo ?? row.doc_no ?? "").toUpperCase();
            return docType === "SALES INVOICE" || docNo.startsWith("SI");
          })
          .map((row) => String(row.docNo ?? row.doc_no ?? "").trim())
          .filter(Boolean)
      )
    );

    const voidedDocuments = new Set<string>();
    await mapPool(chunk(salesInvoiceDocNos, 150), 4, async (batch) => {
      const rows = await directusList<{ invoice_no?: string; transaction_status?: string }>(
        directusBase,
        directusToken,
        "sales_invoice",
        `fields=invoice_no,transaction_status&filter[invoice_no][_in]=${encodeURIComponent(
          batch.join(",")
        )}&filter[transaction_status][_eq]=Void&limit=-1`
      );
      for (const row of rows) {
        if (row.invoice_no) voidedDocuments.add(String(row.invoice_no).toUpperCase());
      }
    }).catch((err) => {
      // Void resolution must not break the report; it degrades to a warning.
      warnings.push(
        `Voided-document check was incomplete: ${err instanceof Error ? err.message : "unknown error"}.`
      );
    });

    // ── 4b. Citable reference for receipts posted without a number ───────────
    try {
      await attachReceiptReferences(
        movements,
        directusBase,
        directusToken,
        reconciled.map((branch) => branch.id)
      );
    } catch (err) {
      // A missing reference must not break the reconciliation; the drawer then
      // falls back to naming the supplier.
      warnings.push(
        `Unnumbered receipts could not be traced to their purchase orders: ${
          err instanceof Error ? err.message : "unknown error"
        }.`
      );
    }

    // ── 5. Product master for units, codes and categories ────────────────────
    const movementProductIds = new Set<number>();
    for (const row of movements) {
      const pid = relationId(row.productId ?? (row as Record<string, unknown>).product_id);
      if (pid !== null) movementProductIds.add(pid);
    }

    const productMeta: Record<number, ProductMeta> = {};

    // Count rows already carry nested product data, so seed from them first.
    for (const row of countRows) {
      const pid = relationId(row.product_id);
      if (pid === null) continue;
      const nested = (typeof row.product_id === "object" ? row.product_id : {}) as Record<
        string,
        unknown
      >;
      const category = nested.product_category as
        | { category_id?: unknown; category_name?: string }
        | undefined;
      const unitCount = Number(nested.unit_of_measurement_count ?? 1);
      productMeta[pid] = {
        productCode: nested.product_code ? String(nested.product_code) : null,
        productName:
          productDisplayName(nested.description, nested.product_name, nested.product_code) ||
          `Product #${pid}`,
        unitCount: Number.isFinite(unitCount) && unitCount > 0 ? unitCount : 1,
        categoryId: relationId(category?.category_id),
        categoryName: category?.category_name ? String(category.category_name) : null,
      };
    }

    // Then fill any product that only appears in the ledger.
    const missingIds = [...movementProductIds].filter((id) => !productMeta[id]);
    await mapPool(chunk(missingIds, 200), 4, async (batch) => {
      const rows = await directusList<{
        product_id: number;
        product_code?: string;
        product_name?: string;
        description?: string;
        unit_of_measurement_count?: number;
        product_category?: { category_id?: unknown; category_name?: string };
      }>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_code,product_name,description,unit_of_measurement_count,` +
          `product_category.category_id,product_category.category_name` +
          `&filter[product_id][_in]=${batch.join(",")}&limit=-1`
      );
      for (const row of rows) {
        const unitCount = Number(row.unit_of_measurement_count ?? 1);
        productMeta[row.product_id] = {
          productCode: row.product_code ? String(row.product_code) : null,
          productName:
            productDisplayName(row.description, row.product_name, row.product_code) ||
            `Product #${row.product_id}`,
          unitCount: Number.isFinite(unitCount) && unitCount > 0 ? unitCount : 1,
          categoryId: relationId(row.product_category?.category_id),
          categoryName: row.product_category?.category_name
            ? String(row.product_category.category_name)
            : null,
        };
      }
    }).catch((err) => {
      warnings.push(
        `Some product masters could not be resolved: ${err instanceof Error ? err.message : "unknown error"}.`
      );
    });

    // ── 6. Reconcile each branch, then merge ─────────────────────────────────
    const rows: StockMovementVarianceRow[] = [];

    for (const branch of reconciled) {
      const branchFilters: StockMovementVarianceFilters = {
        startDate,
        endDate,
        branchId: branch.id,
        categoryId: categoryIdRaw || undefined,
      };

      rows.push(
        ...buildVarianceRows({
          movements: ledgerByBranch.get(branch.id) ?? [],
          counts: countsByBranch.get(branch.id) ?? [],
          productMeta,
          filters: branchFilters,
          scopeBranchName: branch.name,
          voidedDocuments,
        })
      );
    }

    // Category filtering happens after reconciliation: the ledger view exposes no
    // category parameter, so the movement query stays a single round trip.
    const categoryId = categoryIdRaw ? Number(categoryIdRaw) : null;
    let finalRows =
      categoryId !== null && Number.isFinite(categoryId)
        ? rows.filter((row) => productMeta[row.productId]?.categoryId === categoryId)
        : rows;

    // The ledger was queried by product NAME, and names repeat in this schema, so
    // the selected id is applied here to cut any same-name twin back out.
    if (requestedProductId !== null) {
      finalRows = finalRows.filter((row) => row.productId === requestedProductId);
    }

    const response: StockMovementVarianceReportResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: {
        startDate,
        endDate,
        branchId: singleBranch ? scopeIds[0] : undefined,
        categoryId: categoryIdRaw || undefined,
        productId: requestedProductId ?? undefined,
        productName: ledgerProductName || undefined,
      },
      branchName: singleBranch ? scope[0].name : null,
      branchesReconciled: reconciled.length,
      rows: finalRows,
      kpis: summariseKpis(finalRows),
      warnings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected report failure";
    console.error("[stock-movement-variance] GET failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
