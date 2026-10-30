// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/route.ts
// ==============================================================================
// BFF API Route: Stock Movement and Variance Report (IDS SCM)
//
// Read-only reporting. It never posts inventory, creates a charge or releases a
// payment (spec §2), and it never mutates a source document.
//
// Sources of truth
// - Spring-backed `view-product-movements` ledger (posted in/out per document).
//   Reachable only through SPRING_API_BASE_URL; Directus has no equivalent view.
// - Directus `physical_inventory` + `physical_inventory_details`: committed counts
//   carrying system_count, physical_count and the reporting cutoff.
// - Directus `physical_inventory_details_serial`: counted serials for exceptioning.
// - Directus `cylinder_assets`: the asset register used to validate serials.
// - Directus `sales_invoice`: transaction_status, used to detect voids.
//
// Known source-data limitations, surfaced to the caller instead of hidden:
// - The movements view does not apply later voids, so voided invoices are
//   identified here and excluded, then reported as VOID_REVERSAL exceptions.
// - There is no opening-balance table anywhere in the schema. The opening figure
//   is therefore reconstructed from full movement history before the period,
//   which is only exact for products whose ledger is complete.
// - Access is scoped by the branch the caller selects; the platform has no
//   per-user branch permission table to enforce it further.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buildVarianceRows,
  summariseKpis,
  type ProductMeta,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc";
import type {
  RawCountLine,
  RawMovementRow,
  StockMovementVarianceFilters,
  StockMovementVarianceReportResponse,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/types/stock-movement-variance.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

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
  const productName = search.get("productName")?.trim() ?? "";

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
  if (!branchIdRaw) {
    return NextResponse.json(
      { ok: false, error: "A branch must be selected; the report has no cross-branch scope." },
      { status: 400 }
    );
  }

  const branchId = Number(branchIdRaw);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return NextResponse.json({ ok: false, error: "branchId is not valid." }, { status: 400 });
  }

  const filters: StockMovementVarianceFilters = {
    startDate,
    endDate,
    branchId,
    categoryId: categoryIdRaw || undefined,
    productName: productName || undefined,
  };

  const warnings: string[] = [];

  try {
    // ── 1. Resolve the authorized branch ──────────────────────────────────────
    // The movements view filters by branch NAME, so the Directus branch id has to
    // be translated before any ledger call.
    const branchRows = await directusList<{ id: number; branch_name: string; isActive?: boolean }>(
      directusBase,
      directusToken,
      "branches",
      `filter[id][_eq]=${branchId}&fields=id,branch_name,isActive`
    );

    const branch = branchRows[0];
    if (!branch?.branch_name) {
      return NextResponse.json(
        { ok: false, error: `Branch ${branchId} was not found.` },
        { status: 404 }
      );
    }
    if (branch.isActive === false || Number(branch.isActive ?? 1) === 0) {
      warnings.push(`Branch "${branch.branch_name}" is inactive; historical data is still reported.`);
    }

    // ── 2. Committed physical counts up to the cutoff (spec §4 verified records)
    // Draft and cancelled count sheets are excluded: only a committed count is a
    // verified record. One cutoff governs movements and counts (spec §8).
    // cutOff_date is a MySQL TIMESTAMP, so the bound must run to the very end of
    // the cutoff day or counts encoded later that same day would be dropped.
    const cutoffInclusive = encodeURIComponent(`${endDate} 23:59:59`);

    const countFieldQuery =
      `fields=id,physical_count,system_count,variance,offset_match,date_encoded,` +
      `ph_id.id,ph_id.ph_no,ph_id.cutOff_date,ph_id.date_encoded,ph_id.branch_id,` +
      `product_id.product_id,product_id.product_code,product_id.product_name,` +
      `product_id.unit_of_measurement_count,product_id.parent_id,` +
      `product_id.product_category.category_id,product_id.product_category.category_name` +
      `&filter[ph_id][branch_id][_eq]=${branchId}` +
      `&filter[ph_id][isComitted][_eq]=1` +
      `&filter[ph_id][isCancelled][_eq]=0` +
      `&filter[ph_id][cutOff_date][_lte]=${cutoffInclusive}` +
      `&sort=-ph_id.cutOff_date&limit=-1`;

    interface RawCountRow {
      id: number;
      physical_count?: number | string;
      system_count?: number | string;
      variance?: number | string;
      offset_match?: number | string | null;
      date_encoded?: string | null;
      ph_id?: { id?: number; ph_no?: string; cutOff_date?: string; date_encoded?: string; branch_id?: number };
      product_id?: unknown;
    }

    const countRows = await directusList<RawCountRow>(
      directusBase,
      directusToken,
      "physical_inventory_details",
      countFieldQuery
    );

    // ── 3. Counted serials, for the unmatched-serial exception (spec §8) ──────
    const detailIds = countRows.map((row) => row.id).filter((id) => Number.isFinite(id));
    interface RawSerialRow {
      pi_detail_id?: unknown;
      serial_number?: string;
    }

    const serialRows = (
      await mapPool(chunk(detailIds, 200), 4, (batch) =>
        directusList<RawSerialRow>(
          directusBase,
          directusToken,
          "physical_inventory_details_serial",
          `fields=pi_detail_id,serial_number&filter[pi_detail_id][_in]=${batch.join(",")}&limit=-1`
        )
      )
    ).flat();

    const serialsByDetail = new Map<number, string[]>();
    for (const row of serialRows) {
      const detailId = relationId(row.pi_detail_id);
      if (detailId === null || !row.serial_number) continue;
      const list = serialsByDetail.get(detailId) ?? [];
      list.push(String(row.serial_number));
      serialsByDetail.set(detailId, list);
    }

    const counts: RawCountLine[] = countRows
      .map((row) => {
        const productId = relationId(row.product_id);
        const ph = row.ph_id ?? {};
        if (productId === null || !ph?.ph_no) return null;
        return {
          id: row.id,
          phId: Number(ph.id ?? 0),
          phNo: String(ph.ph_no),
          branchId: Number(ph.branch_id ?? branchId),
          cutOffDate: ph.cutOff_date ? String(ph.cutOff_date) : null,
          dateEncoded: ph.date_encoded ? String(ph.date_encoded) : row.date_encoded ? String(row.date_encoded) : null,
          productId,
          systemCount: Number(row.system_count ?? 0),
          physicalCount: Number(row.physical_count ?? 0),
          sourceVariance: Number(row.variance ?? 0),
          offsetMatch: row.offset_match === null || row.offset_match === undefined ? null : Number(row.offset_match),
          serials: serialsByDetail.get(row.id) ?? [],
        } satisfies RawCountLine;
      })
      .filter((line): line is RawCountLine => line !== null);

    // ── 4. Posted movements from the Spring ledger view ───────────────────────
    const movementsUrl = new URL(`${springBase}/api/view-product-movements/filter`);
    movementsUrl.searchParams.set("branchName", branch.branch_name);
    if (productName) movementsUrl.searchParams.set("productName", productName);

    const movementsRes = await fetch(movementsUrl.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!movementsRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Movements ledger unavailable (status ${movementsRes.status}). The report cannot be produced without posted movement data.`,
        },
        { status: 502 }
      );
    }

    const movementsText = await movementsRes.text();
    let movements: RawMovementRow[];
    try {
      const parsed = JSON.parse(movementsText);
      movements = Array.isArray(parsed) ? parsed : [];
    } catch {
      return NextResponse.json(
        { ok: false, error: "Movements ledger returned a non-JSON payload." },
        { status: 502 }
      );
    }

    if (movements.length === 0) {
      warnings.push(
        "The movements ledger returned no rows for this branch, so every expected balance is zero."
      );
    }

    // ── 5. Void detection: reversals the ledger view never applied ────────────
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

    // ── 6. Product master for units, codes and categories ────────────────────
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
        productName: nested.product_name ? String(nested.product_name) : `Product #${pid}`,
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
        unit_of_measurement_count?: number;
        product_category?: { category_id?: unknown; category_name?: string };
      }>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_code,product_name,unit_of_measurement_count,` +
          `product_category.category_id,product_category.category_name` +
          `&filter[product_id][_in]=${batch.join(",")}&limit=-1`
      );
      for (const row of rows) {
        const unitCount = Number(row.unit_of_measurement_count ?? 1);
        productMeta[row.product_id] = {
          productCode: row.product_code ? String(row.product_code) : null,
          productName: row.product_name ? String(row.product_name) : `Product #${row.product_id}`,
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

    // ── 7. Serial register used to validate counted serials ──────────────────
    const countedSerials = Array.from(
      new Set(counts.flatMap((line) => line.serials.map((s) => s.trim()).filter(Boolean)))
    );

    const knownSerials = new Set<string>();
    await mapPool(chunk(countedSerials, 200), 4, async (batch) => {
      const rows = await directusList<{ serial_number?: string }>(
        directusBase,
        directusToken,
        "cylinder_assets",
        `fields=serial_number&filter[serial_number][_in]=${encodeURIComponent(
          batch.join(",")
        )}&limit=-1`
      );
      for (const row of rows) {
        if (row.serial_number) knownSerials.add(String(row.serial_number).toUpperCase());
      }
    }).catch((err) => {
      warnings.push(
        `Serial validation against the asset register was incomplete: ${
          err instanceof Error ? err.message : "unknown error"
        }.`
      );
    });

    // ── 8. Reconcile ─────────────────────────────────────────────────────────
    const { rows, excluded } = buildVarianceRows({
      movements,
      counts,
      productMeta,
      filters,
      voidedDocuments,
      knownSerials,
    });

    // Category filtering happens after reconciliation: the ledger view exposes no
    // category parameter, so the movement query stays a single round trip.
    const categoryId = categoryIdRaw ? Number(categoryIdRaw) : null;
    const finalRows =
      categoryId !== null && Number.isFinite(categoryId)
        ? rows.filter((row) => productMeta[row.productId]?.categoryId === categoryId)
        : rows;

    const response: StockMovementVarianceReportResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters,
      branchName: branch.branch_name,
      excludedDocuments: excluded,
      rows: finalRows,
      kpis: summariseKpis(finalRows, excluded),
      warnings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected report failure";
    console.error("[stock-movement-variance] GET failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
