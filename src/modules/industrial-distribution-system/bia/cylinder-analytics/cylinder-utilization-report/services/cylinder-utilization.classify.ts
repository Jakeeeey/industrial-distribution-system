// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.classify.ts
// ==============================================================================
// Asset Classification — one cylinder in, one bucket out.
//
// The per-asset half of the utilization maths: resolve the branch and size
// labels, derive the last-activity stamp from every candidate basis, measure the
// dormancy against the cutoff and place the asset in exactly one bucket. It is
// pure and synchronous — the BFF route owns every fetch, this file owns the
// asset-level decision the grid is later grouped from.
//
// Invariants enforced here:
// - One asset resolves to exactly one bucket (see classifyAsset precedence)
// - An asset with no product or branch master row still produces a row, under
//   the "Unmapped size" / "Unassigned branch" pseudo-labels
//
// Complies with VoSync standards:
// - Pure TypeScript service layer (no fetch, no React)
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { classifyAsset } from "./cylinder-utilization.rules";
import {
  buildSizeLabel,
  normalizeSerial,
  toId,
  toMillis,
} from "./cylinder-utilization.helpers";
import {
  resolveActivity,
  resolveIdleDays,
  type AssetMovementTrail,
  type MovementIndex,
} from "./cylinder-utilization.movements";
import type {
  CylinderUtilizationAssetRecord,
  RawCylinderAssetRow,
} from "../types/cylinder-utilization-report.types";

/** Product master slice needed to label the cylinder size column. */
export interface ProductMeta {
  name: string | null;
  code: string | null;
  weight: number | null;
}

/** Everything the classifier reads; the route is responsible for fetching it. */
export interface ClassifyAssetsInput {
  assets: RawCylinderAssetRow[];
  movementIndex: MovementIndex;
  products: Map<number, ProductMeta>;
  branchNames: Map<number, string>;
  cutoffMs: number;
}

/** Branch label used when an asset carries no `current_branch_id`. */
const UNASSIGNED_BRANCH = "Unassigned branch";

/** Size label used when an asset's product id has no master row. */
const UNMAPPED_SIZE = "Unmapped size";

/**
 * Merges the serial-keyed and asset-keyed trails for one cylinder.
 * The two movement sources key differently, so a single asset can legitimately
 * appear in both maps; the later stamp wins and both document sets are kept as
 * supporting evidence.
 */
function mergeTrails(...trails: Array<AssetMovementTrail | undefined>): AssetMovementTrail {
  const merged: AssetMovementTrail = { activity: null, documents: [], countedCount: 0, reversalCount: 0 };
  const documents: AssetMovementTrail["documents"] = [];

  for (const trail of trails) {
    if (!trail) continue;
    documents.push(...trail.documents);
    merged.countedCount += trail.countedCount;
    merged.reversalCount += trail.reversalCount;
    if (trail.activity && (!merged.activity || trail.activity.millis > merged.activity.millis)) {
      merged.activity = trail.activity;
    }
  }

  merged.documents = documents;
  return merged;
}

/** Explains why an asset landed in UNCLASSIFIED, for the exception column. */
function exceptionReason(status?: string | null): string {
  const raw = (status || "").trim();
  if (!raw) return "Status is missing on the asset record";
  return `Status "${raw}" is outside the source ENUM domain`;
}

/**
 * Classify every asset in the (already-filtered) fleet snapshot.
 * Filtering is the route's job so it can be pushed to Directus; this function
 * only decides buckets, so the grid and the drill-down always agree — they read
 * the same records rather than re-deriving them.
 */
export function classifyAssets(input: ClassifyAssetsInput): CylinderUtilizationAssetRecord[] {
  const { assets, movementIndex, products, branchNames, cutoffMs } = input;
  const classified: CylinderUtilizationAssetRecord[] = [];

  for (const asset of assets) {
    const assetId = toId(asset.id);
    if (assetId === null) continue;

    const productId = toId(asset.product_id);
    const branchId = toId(asset.current_branch_id);
    const product = productId !== null ? products.get(productId) : undefined;
    const sizeLabel = product
      ? buildSizeLabel(product.name, product.code, product.weight)
      : UNMAPPED_SIZE;
    const branchName = branchId !== null ? branchNames.get(branchId) ?? UNASSIGNED_BRANCH : UNASSIGNED_BRANCH;

    // Resolve last activity from BOTH candidate bases, then take the most recent.
    const trail = mergeTrails(
      movementIndex.bySerial.get(normalizeSerial(asset.serial_number)),
      movementIndex.byAssetId.get(assetId)
    );
    const auditMillis = toMillis(asset.modified_date) ?? toMillis(asset.created_date);
    const activity = resolveActivity(auditMillis, trail);
    const idleDays = resolveIdleDays(activity, cutoffMs);
    const bucket = classifyAsset(asset.cylinder_status, asset.cylinder_condition, idleDays);

    classified.push({
      assetId,
      serialNumber: asset.serial_number || `#${assetId}`,
      sizeLabel,
      productId,
      branchId,
      branchName,
      customerCode: asset.current_customer_code ?? null,
      status: asset.cylinder_status ?? null,
      condition: asset.cylinder_condition ?? null,
      bucket,
      lastActivityDate: activity ? new Date(activity.millis).toISOString().split("T")[0] : null,
      activityBasis: activity?.basis ?? null,
      idleDays,
      isException: bucket === "UNCLASSIFIED",
      exceptionReason: bucket === "UNCLASSIFIED" ? exceptionReason(asset.cylinder_status) : null,
      movements: trail.documents,
    });
  }

  return classified;
}
