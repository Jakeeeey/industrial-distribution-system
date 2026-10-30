// src/app/api/ids/bia/cylinder-analytics/cylinder-utilization-report/route.ts
// ==============================================================================
// BFF API Route: Cylinder Utilization Report (IDS BIA Subsystem)
//
// Pure read-only aggregation. Per spec §2 it never posts inventory, creates a
// charge or releases a payment, and it never mutates a source document.
//
// Sources of truth (validated against the codebase, as spec §2 and §9 require):
// - Directus `cylinder_assets`: the asset register — the only authoritative fleet
//   record. Supplies status, condition, branch and customer custody.
// - Directus `products`: cylinder size (name / code / kilogram rating).
// - Directus `branches`: branch directory and names.
// - Directus `sales_order_details_serial` + `sales_order`: serial-keyed verified
//   delivery movements that refine an asset's last-activity date.
// - Directus `lpg_customer_site_cylinders`: asset-keyed metered-site installations.
//
// Known source-data limitations, surfaced in the response instead of hidden:
// - There is no asset history or snapshot table anywhere in the schema, so the
//   fleet composition is always the live register. The reporting cutoff is honoured
//   as the clock the dormancy maths are measured against, not as a replay point.
// - `cylinder_assets` has no last-movement column. Idle is measured from the most
//   recent of the audit stamp and the movement trail assembled in the service layer.
// - Stock adjustments are not read as a separate movement source: their posting
//   writes refresh the asset row, so they already reach the audit-stamp basis.
// - Branch scoping is the branch the caller selects; the platform has no per-user
//   branch permission table to enforce it further.
//
// Complies with VoSync standards:
// - Thin gateway: every fetch here, every calculation in the module service layer
// - Zod validation before any value reaches a Directus filter
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  buildSizeLabel,
  formatGeneratedAt,
  normalizeSerial,
  toId,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.helpers";
import {
  buildUtilizationReport,
  selectDetailAssets,
  type ProductMeta,
  type UtilizationBuildResult,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.aggregation";
import { getRuleSnapshot } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.rules";
import {
  cylinderUtilizationDetailSchema,
  cylinderUtilizationQuerySchema,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/types/cylinder-utilization-report.schema";
import type {
  CylinderUtilizationDetailResponse,
  CylinderUtilizationFilters,
  CylinderUtilizationReportResponse,
  RawCylinderAssetRow,
  RawDeliveryMovementRow,
  RawSiteCylinderMovementRow,
  UtilizationBucket,
  UtilizationSourceLimitation,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/types/cylinder-utilization-report.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serials / ids per Directus request — keeps filter URLs well inside proxy limits. */
const CHUNK_SIZE = 200;

/** The limitations are structural, so they are declared once and echoed verbatim. */
const SOURCE_LIMITATIONS: UtilizationSourceLimitation[] = [
  {
    code: "NO_HISTORICAL_SNAPSHOT",
    message:
      "No asset history or snapshot collection exists in the schema. Fleet composition is read from the live cylinder_assets register; the reporting cutoff is applied as the measurement clock, not as a replay point.",
  },
  {
    code: "PERIOD_START_IS_CONTEXT_ONLY",
    message:
      "Because the fleet is read live, the period start cannot reconstruct what the register looked like on that day. It is recorded for audit context and printed with the report; only the reporting cutoff changes the figures.",
  },
  {
    code: "DERIVED_LAST_MOVEMENT",
    message:
      "cylinder_assets has no last-movement column. Idle is measured from the most recent of the row audit stamp, verified delivery movements and metered-site installation records.",
  },
  {
    code: "PARTIAL_MOVEMENT_BASIS",
    message:
      "Stock adjustments are not read as a movement source; their posting writes refresh the asset row, so they reach the activity basis through the audit stamp. A movement recorded without touching the asset row would not reset an asset's idle clock.",
  },
  {
    code: "NO_BRANCH_PERMISSION_TABLE",
    message:
      "Cross-branch access is limited by the branch the caller selects. The platform has no per-user branch permission table, so scoping is enforced by this selection rather than by stored grants.",
  },
];

/** Reads Directus coordinates, tolerating both the public and server env names. */
function getDirectusConfig(): { url: string; token: string } {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

function getDirectusHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Splits a list into fixed-size batches so IN-filters never build a huge URL. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Reads a Directus list endpoint and returns its rows.
 * A failed collection read resolves to an empty array: a missing optional movement
 * source must degrade the activity basis, not blank the whole report.
 */
async function fetchRows<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const res = await fetch(url, { headers, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

/** Today in the reporting timezone, as YYYY-MM-DD. */
function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** First day of the current reporting month — the default period opening. */
function monthStartIso(): string {
  // Derived from the Manila calendar day rather than a Date constructed in the
  // server's own timezone: converting a Manila midnight through toISOString()
  // shifted the default period back one day.
  return `${todayIso().slice(0, 7)}-01`;
}

/** Normalises "ALL" / "" / absent into a single "no scoping" value. */
function resolveSelector(raw: string | null): number | null {
  if (!raw || raw === "ALL") return null;
  return toId(raw);
}

/** Narrows the validated bucket selector to the aggregation contract's shape. */
function resolveBucket(raw?: string): UtilizationBucket | null {
  if (!raw || raw === "ALL") return null;
  return raw as UtilizationBucket;
}

/** Human label for one size id, falling back to a stub when it has no master row. */
function resolveSizeLabel(productId: number | null, products: Map<number, ProductMeta>): string {
  if (productId === null) return "Unmapped size";
  const meta = products.get(productId);
  return meta ? buildSizeLabel(meta.name, meta.code, meta.weight) : `Size #${productId}`;
}

/** Human label for one branch id, falling back to a stub when it has no master row. */
function resolveBranchLabel(branchId: number | null, branchNames: Map<number, string>): string {
  if (branchId === null) return "Unassigned branch";
  return branchNames.get(branchId) ?? `Branch #${branchId}`;
}

/**
 * Loads the masters, the in-scope fleet and its movement trail, then hands the
 * whole set to the pure aggregation service. Both the report and the drill-down
 * run through here so their figures can never be computed two different ways.
 */
async function loadDataset(
  filters: CylinderUtilizationFilters,
  directusBase: string,
  headers: Record<string, string>
): Promise<UtilizationBuildResult & { branchNames: Map<number, string>; products: Map<number, ProductMeta> }> {
  // ── 1. Branch directory ───────────────────────────────────────────────────
  const branchRows = await fetchRows<{ id: number; branch_name: string | null }>(
    `${directusBase}/items/branches?fields=id,branch_name&limit=-1`,
    headers
  );
  const branchNames = new Map<number, string>();
  branchRows.forEach((b) => {
    const id = toId(b.id);
    if (id !== null && b.branch_name) branchNames.set(id, b.branch_name);
  });

  // ── 2. Product master (cylinder sizes) ───────────────────────────────────
  const productRows = await fetchRows<{
    product_id: number;
    product_code: string | null;
    product_name: string | null;
    description: string | null;
    product_weight: number | null;
  }>(
    `${directusBase}/items/products?fields=product_id,product_code,product_name,description,product_weight&limit=-1`,
    headers
  );
  const products = new Map<number, ProductMeta>();
  productRows.forEach((p) => {
    const id = toId(p.product_id);
    if (id === null) return;
    // `description` carries the marketing size on LPG stock items; the name is the
    // safer primary label, so weight is appended by buildSizeLabel instead.
    products.set(id, {
      name: p.product_name || p.description || null,
      code: p.product_code || null,
      weight: p.product_weight === null || p.product_weight === undefined ? null : Number(p.product_weight),
    });
  });

  // ── 3. Fleet in scope (soft-deleted assets excluded at the source) ───────
  const assetFilter: Record<string, unknown> = { is_deleted: { _neq: 1 } };
  if (filters.branchId !== undefined && filters.branchId !== "" && filters.branchId !== "ALL") {
    assetFilter.current_branch_id = { _eq: Number(filters.branchId) };
  }
  if (filters.productId !== undefined && filters.productId !== "" && filters.productId !== "ALL") {
    assetFilter.product_id = { _eq: Number(filters.productId) };
  }

  const assets = await fetchRows<RawCylinderAssetRow>(
    `${directusBase}/items/cylinder_assets?filter=${encodeURIComponent(
      JSON.stringify(assetFilter)
    )}&fields=id,serial_number,product_id,cylinder_status,cylinder_condition,current_customer_code,current_branch_id,created_date,modified_date&limit=-1`,
    headers
  );

  // A cutoff in the future is clamped to today: a clock that has not arrived would
  // otherwise report every dormant cylinder as active.
  const todayMs = new Date(`${todayIso()}T23:59:59`).getTime();
  const parsedCutoff = new Date(`${filters.endDate}T23:59:59`).getTime();
  const cutoffMs = Number.isFinite(parsedCutoff) ? Math.min(parsedCutoff, todayMs) : todayMs;

  // ── 4. Verified delivery movements, batched on the in-scope serials ──────
  const serials = assets.map((a) => normalizeSerial(a.serial_number)).filter(Boolean);
  const deliveries: RawDeliveryMovementRow[] = [];
  for (const group of chunk(Array.from(new Set(serials)), CHUNK_SIZE)) {
    const encoded = encodeURIComponent(group.join(","));
    deliveries.push(
      ...(await fetchRows<RawDeliveryMovementRow>(
        `${directusBase}/items/sales_order_details_serial?filter[serial_number][_in]=${encoded}&fields=id,sales_order_id,serial_number,delivery_date,customer_code,branch_id,product_id&limit=-1`,
        headers
      ))
    );
  }

  // ── 5. Order status, the verification gate for each delivery ─────────────
  const orderIds = Array.from(
    new Set(deliveries.map((d) => toId(d.sales_order_id)).filter((id): id is number => id !== null))
  );
  const orderStatusById = new Map<number, string>();
  for (const group of chunk(orderIds, CHUNK_SIZE)) {
    const rows = await fetchRows<{ order_id: number; order_status: string | null }>(
      `${directusBase}/items/sales_order?filter[order_id][_in]=${encodeURIComponent(group.join(","))}&fields=order_id,order_status&limit=-1`,
      headers
    );
    rows.forEach((o) => {
      const id = toId(o.order_id);
      if (id !== null) orderStatusById.set(id, (o.order_status || "").trim().toUpperCase());
    });
  }

  // ── 6. Metered-site installations, batched on the in-scope asset ids ─────
  const assetIds = assets.map((a) => toId(a.id)).filter((id): id is number => id !== null);
  const siteCylinders: RawSiteCylinderMovementRow[] = [];
  for (const group of chunk(Array.from(new Set(assetIds)), CHUNK_SIZE)) {
    siteCylinders.push(
      ...(await fetchRows<RawSiteCylinderMovementRow>(
        `${directusBase}/items/lpg_customer_site_cylinders?filter[cylinder_asset_id][_in]=${encodeURIComponent(
          group.join(",")
        )}&fields=id,lpg_site_id,customer_code,cylinder_asset_id,installed_date,removed_date,site_cylinder_status&limit=-1`,
        headers
      ))
    );
  }

  const result = buildUtilizationReport({
    assets,
    deliveries,
    orderStatusById,
    siteCylinders,
    products,
    branchNames,
    cutoffMs,
  });

  return { ...result, branchNames, products };
}

/**
 * GET /api/ids/bia/cylinder-analytics/cylinder-utilization-report
 *
 * Returns the branch × cylinder-size grid, the KPI strip, the rule snapshot the
 * figures were built from, and the structural limitations of the source data.
 * `?detail=1` switches to the supporting-record drill-down for one grouping.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const { url: directusBase, token } = getDirectusConfig();
  const headers = getDirectusHeaders(token);

  // The drill-down needs the same dataset, so it is dispatched before the parse of
  // the summary filters to keep each contract validated by its own schema.
  if (searchParams.get("detail") === "1") {
    return handleDrillDown(searchParams, directusBase, headers);
  }

  // ── Summary request ───────────────────────────────────────────────────────
  const parsed = cylinderUtilizationQuerySchema.safeParse({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    branchId: searchParams.get("branchId") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid report filters", issues: parsed.error.issues }, { status: 400 });
  }

  const filters: CylinderUtilizationFilters = {
    startDate: parsed.data.startDate || monthStartIso(),
    endDate: parsed.data.endDate || todayIso(),
    branchId: parsed.data.branchId ?? "ALL",
    productId: parsed.data.productId ?? "",
  };

  try {
    const dataset = await loadDataset(filters, directusBase, headers);

    const payload: CylinderUtilizationReportResponse = {
      rows: dataset.rows,
      kpis: dataset.kpis,
      rules: getRuleSnapshot(),
      limitations: SOURCE_LIMITATIONS,
      filters,
      reportingCutoff: filters.endDate,
      generatedAt: formatGeneratedAt(new Date()),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[CylinderUtilization:Report] Aggregation error:", error);
    return NextResponse.json({ message: "Failed to generate report", error: String(error) }, { status: 500 });
  }
}

/**
 * Supports spec §5 "open supporting documents": returns the individual cylinders
 * behind one branch × size grouping, optionally narrowed to a single bucket, each
 * carrying its resolved bucket, dormancy, activity basis and movement evidence.
 *
 * The fleet is loaded scoped by branch only and the size is matched in memory, so
 * the "Unassigned branch" and "Unmapped size" pseudo-groupings stay drillable.
 */
async function handleDrillDown(
  searchParams: URLSearchParams,
  directusBase: string,
  headers: Record<string, string>
): Promise<NextResponse> {
  const parsed = cylinderUtilizationDetailSchema.safeParse({
    detail: "1",
    branchId: searchParams.get("branchId") ?? "",
    productId: searchParams.get("productId") ?? "",
    bucket: searchParams.get("bucket") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid drill-down request", issues: parsed.error.issues }, { status: 400 });
  }

  const branchId = resolveSelector(parsed.data.branchId);
  const productId = resolveSelector(parsed.data.productId);
  const bucket = resolveBucket(parsed.data.bucket);
  const endDate = parsed.data.endDate || todayIso();

  try {
    const dataset = await loadDataset(
      {
        startDate: parsed.data.startDate || monthStartIso(),
        endDate,
        branchId: branchId === null ? "ALL" : branchId,
      },
      directusBase,
      headers
    );

    const payload: CylinderUtilizationDetailResponse = {
      branchId,
      branchName: resolveBranchLabel(branchId, dataset.branchNames),
      productId,
      sizeLabel: resolveSizeLabel(productId, dataset.products),
      bucket,
      assets: selectDetailAssets(dataset.assets, { branchId, productId, bucket }),
      rules: getRuleSnapshot(),
      reportingCutoff: endDate,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[CylinderUtilization:Detail] Drill-down error:", error);
    return NextResponse.json({ message: "Failed to load supporting records", error: String(error) }, { status: 500 });
  }
}
