// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.aggregation.ts
// ==============================================================================
// Utilization Aggregation — turning classified assets into the report.
//
// Asset-level classification lives in cylinder-utilization.classify.ts; this
// file owns the two things the spec asks the report to show: the branch ×
// cylinder-size results grid (spec §11) and the fleet-wide KPI summary (spec §7).
// It is pure and synchronous: the BFF route owns every fetch and the classifier
// owns every bucket, so the ratios here can be reasoned about without a network.
//
// Invariants enforced here:
// - fleet = circulating + available + idle + maintenance + unavailable + unclassified
// - eligibleFleet = fleet − unavailable − unclassified, so a written-off cylinder
//   can never depress the utilization ratio of a working branch
// - the grid totals and the KPI strip are both derived from the same classified
//   records, so the two can never disagree
//
// Complies with VoSync standards:
// - Pure TypeScript service layer (no fetch, no React)
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { computeRate, computeUtilization, normalizeCode } from "./cylinder-utilization.rules";
import { classifyAssets, type ProductMeta } from "./cylinder-utilization.classify";
import { buildMovementIndex } from "./cylinder-utilization.movements";
import type {
  CylinderUtilizationAssetRecord,
  CylinderUtilizationKPIs,
  CylinderUtilizationRow,
  RawCylinderAssetRow,
  RawDeliveryMovementRow,
  RawSiteCylinderMovementRow,
  UtilizationBucket,
} from "../types/cylinder-utilization-report.types";

export type { ProductMeta };

/** Everything the aggregation needs; the route is responsible for fetching it. */
export interface UtilizationBuildInput {
  assets: RawCylinderAssetRow[];
  deliveries: RawDeliveryMovementRow[];
  orderStatusById: Map<number, string>;
  siteCylinders: RawSiteCylinderMovementRow[];
  products: Map<number, ProductMeta>;
  branchNames: Map<number, string>;
  cutoffMs: number;
}

/** The fully built dataset: grid rows, KPI strip and the classified asset index. */
export interface UtilizationBuildResult {
  rows: CylinderUtilizationRow[];
  kpis: CylinderUtilizationKPIs;
  assets: CylinderUtilizationAssetRecord[];
  movementsConsidered: number;
  reversalsExcluded: number;
}

/** Mutable per-grouping accumulator; only alive inside buildUtilizationReport. */
interface GroupAccumulator {
  branchId: number | null;
  branchName: string;
  productId: number | null;
  sizeLabel: string;
  productCode: string | null;
  counts: Record<UtilizationBucket, number>;
  idleDaysTotal: number;
  idleDaysCount: number;
}

/** Zeroed bucket counters for one grouping. */
function emptyCounts(): Record<UtilizationBucket, number> {
  return { CIRCULATING: 0, AVAILABLE: 0, IDLE: 0, MAINTENANCE: 0, UNAVAILABLE: 0, UNCLASSIFIED: 0 };
}

/**
 * Builds the report dataset from already-filtered rows.
 * `assets` must already exclude soft-deleted records and honour the branch / size
 * filters — filtering is the route's job so it can be pushed to Directus.
 */
export function buildUtilizationReport(input: UtilizationBuildInput): UtilizationBuildResult {
  const { deliveries, orderStatusById, siteCylinders, ...classifyInput } = input;

  const movementIndex = buildMovementIndex(deliveries, orderStatusById, siteCylinders, classifyInput.cutoffMs);
  const classified = classifyAssets({ ...classifyInput, movementIndex });

  // ── Classified assets → branch × size groupings ───────────────────────────
  const groups = new Map<string, GroupAccumulator>();

  for (const asset of classified) {
    const product = asset.productId !== null ? input.products.get(asset.productId) : undefined;
    const key = `${asset.branchId ?? "null"}::${asset.productId ?? "null"}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        branchId: asset.branchId,
        branchName: asset.branchName,
        productId: asset.productId,
        sizeLabel: asset.sizeLabel,
        productCode: product?.code ?? null,
        counts: emptyCounts(),
        idleDaysTotal: 0,
        idleDaysCount: 0,
      };
      groups.set(key, group);
    }

    group.counts[asset.bucket] += 1;
    if (asset.bucket === "IDLE" && asset.idleDays !== null) {
      group.idleDaysTotal += asset.idleDays;
      group.idleDaysCount += 1;
    }
  }

  // ── Grouping totals → results grid ────────────────────────────────────────
  const rows: CylinderUtilizationRow[] = [];
  for (const group of groups.values()) {
    const { counts } = group;
    const fleet =
      counts.CIRCULATING + counts.AVAILABLE + counts.IDLE + counts.MAINTENANCE + counts.UNAVAILABLE + counts.UNCLASSIFIED;
    const eligibleFleet = fleet - counts.UNAVAILABLE - counts.UNCLASSIFIED;

    rows.push({
      branchId: group.branchId,
      branchName: group.branchName,
      productId: group.productId,
      sizeLabel: group.sizeLabel,
      productCode: group.productCode,
      fleet,
      circulating: counts.CIRCULATING,
      available: counts.AVAILABLE,
      idle: counts.IDLE,
      maintenance: counts.MAINTENANCE,
      unavailable: counts.UNAVAILABLE,
      unclassified: counts.UNCLASSIFIED,
      eligibleFleet,
      utilization: computeUtilization(counts.CIRCULATING, eligibleFleet),
      idleRate: computeRate(counts.IDLE, eligibleFleet),
      averageIdleDays: group.idleDaysCount > 0 ? Math.round(group.idleDaysTotal / group.idleDaysCount) : null,
    });
  }

  // Branch then size for a stable, predictable reading order.
  rows.sort((a, b) => {
    if (a.branchName !== b.branchName) return a.branchName.localeCompare(b.branchName);
    return a.sizeLabel.localeCompare(b.sizeLabel);
  });

  // ── Fleet-wide KPI strip ──────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, row) => {
      acc.fleet += row.fleet;
      acc.circulating += row.circulating;
      acc.available += row.available;
      acc.idle += row.idle;
      acc.maintenance += row.maintenance;
      acc.unavailable += row.unavailable;
      acc.unclassified += row.unclassified;
      acc.eligible += row.eligibleFleet;
      return acc;
    },
    { fleet: 0, circulating: 0, available: 0, idle: 0, maintenance: 0, unavailable: 0, unclassified: 0, eligible: 0 }
  );

  const branchKeys = new Set(rows.filter((r) => r.fleet > 0).map((r) => `${r.branchId ?? "null"}`));
  const sizeKeys = new Set(rows.filter((r) => r.fleet > 0).map((r) => `${r.productId ?? "null"}`));

  const kpis: CylinderUtilizationKPIs = {
    totalFleet: totals.fleet,
    eligibleFleet: totals.eligible,
    circulating: totals.circulating,
    available: totals.available,
    idle: totals.idle,
    maintenance: totals.maintenance,
    unavailable: totals.unavailable,
    unclassified: totals.unclassified,
    utilization: computeUtilization(totals.circulating, totals.eligible),
    idleRate: computeRate(totals.idle, totals.eligible),
    maintenanceRate: computeRate(totals.maintenance, totals.eligible),
    branchesReported: branchKeys.size,
    sizesReported: sizeKeys.size,
    movementsConsidered: movementIndex.verifiedMovements,
    reversalsExcluded: movementIndex.reversalsExcluded,
  };

  return {
    rows,
    kpis,
    assets: classified,
    movementsConsidered: movementIndex.verifiedMovements,
    reversalsExcluded: movementIndex.reversalsExcluded,
  };
}

/**
 * Selects the supporting cylinders behind one results row for the details panel.
 * Matching is done on the resolved labels rather than the ids alone so the
 * "Unassigned branch" / "Unmapped size" pseudo-groups stay drillable.
 */
export function selectDetailAssets(
  assets: CylinderUtilizationAssetRecord[],
  filter: { branchId: number | null; productId: number | null; bucket?: UtilizationBucket | null }
): CylinderUtilizationAssetRecord[] {
  const bucket = filter.bucket ? normalizeCode(filter.bucket) : null;

  return assets
    .filter((asset) => {
      const branchMatches = (asset.branchId ?? null) === filter.branchId;
      const sizeMatches = (asset.productId ?? null) === filter.productId;
      const bucketMatches = !bucket || asset.bucket === bucket;
      return branchMatches && sizeMatches && bucketMatches;
    })
    .sort((a, b) => {
      // Longest-dormant first: the review queue an asset custodian works through.
      const aDays = a.idleDays ?? -1;
      const bDays = b.idleDays ?? -1;
      if (aDays !== bDays) return bDays - aDays;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
}
