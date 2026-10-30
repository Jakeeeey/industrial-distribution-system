// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.movements.ts
// ==============================================================================
// Movement Index — pure composition of the serial/asset-keyed activity trail.
//
// Spec §4 requires idle to be measured from real movement and requires verified
// records plus their linked reversals to be honoured. `cylinder_assets` carries no
// last-movement column, so activity is assembled from the two collections that key
// directly onto an asset in a single read:
//   - sales_order_details_serial   (serial_number + delivery_date + sales_order_id)
//   - lpg_customer_site_cylinders  (cylinder_asset_id + installed/removed_date)
//
// A movement is only applied when its document is verified under its own posting
// workflow (a Delivered/Fulfilled sales order). Reversals are retained as evidence
// and counted into `reversalsExcluded` so the exclusion is visible, never silent.
//
// Complies with VoSync standards:
// - Pure TypeScript: no fetch, no React (runs on server and client)
// - Full comments left behind for long-term maintainability
// ==============================================================================

import {
  daysBetween,
  normalizeSerial,
  toMillis,
} from "./cylinder-utilization.helpers";
import type { ActivityBasisSource, RawDeliveryMovementRow, RawSiteCylinderMovementRow, SupportingMovementDocument } from "../types/cylinder-utilization-report.types";

/** Sales order statuses that count as a verified, revenue-bearing delivery. */
const VERIFIED_ORDER_STATUSES: readonly string[] = ["DELIVERED", "FULFILLED"];

/** Order statuses that represent a linked reversal / cancellation of a delivery. */
const REVERSAL_ORDER_STATUSES: readonly string[] = ["CANCEL", "CANCELLED", "VOID", "VOIDED", "RETURN"];

/** One resolved last-activity stamp with the source that produced it. */
export interface ActivityStamp {
  millis: number;
  basis: ActivityBasisSource;
}

/**
 * The assembled trail for one asset: the applied activity stamp plus every
 * supporting document seen (counted or not) for the drill-down panel.
 */
export interface AssetMovementTrail {
  activity: ActivityStamp | null;
  documents: SupportingMovementDocument[];
  countedCount: number;
  reversalCount: number;
}

/** Index keyed two ways because the sources key two ways (serial vs asset id). */
export interface MovementIndex {
  bySerial: Map<string, AssetMovementTrail>;
  byAssetId: Map<number, AssetMovementTrail>;
  verifiedMovements: number;
  reversalsExcluded: number;
}

/** Creates an empty trail so callers can append without null checks. */
function createTrail(): AssetMovementTrail {
  return { activity: null, documents: [], countedCount: 0, reversalCount: 0 };
}

/** Fetch-or-create so multiple movements can accumulate onto one asset. */
function ensureTrail<K extends string | number>(map: Map<K, AssetMovementTrail>, key: K): AssetMovementTrail {
  const existing = map.get(key);
  if (existing) return existing;
  const created = createTrail();
  map.set(key, created);
  return created;
}

/**
 * Applies one candidate activity to a trail, keeping the most recent stamp that
 * still falls on or before the reporting cutoff (spec §4 "preserve the reporting
 * cutoff": a later record must not retroactively un-idle an asset).
 */
function applyActivity(trail: AssetMovementTrail, millis: number, basis: ActivityBasisSource, cutoffMs: number): void {
  if (millis > cutoffMs) return;
  if (!trail.activity || millis > trail.activity.millis) {
    trail.activity = { millis, basis };
  }
}

/**
 * Builds the movement index from the raw Directus rows.
 *
 * @param deliveries       serial-keyed delivery movements
 * @param orderStatusById  sales_order_id → upper-cased order_status, used as the
 *                         verification gate for each delivery
 * @param siteCylinders    asset-keyed metered-site installations
 * @param cutoffMs         reporting cutoff; later movements are not applied
 */
export function buildMovementIndex(
  deliveries: RawDeliveryMovementRow[],
  orderStatusById: Map<number, string>,
  siteCylinders: RawSiteCylinderMovementRow[],
  cutoffMs: number,
  siteNamesById?: Map<number, string>,
  startMs?: number
): MovementIndex {
  const index: MovementIndex = {
    bySerial: new Map(),
    byAssetId: new Map(),
    verifiedMovements: 0,
    reversalsExcluded: 0,
  };

  // ── 1. Verified customer deliveries / swaps, keyed on serial ───────────────
  for (const row of deliveries) {
    const serial = normalizeSerial(row.serial_number);
    if (!serial) continue;

    const orderId = row.sales_order_id === null || row.sales_order_id === undefined ? NaN : Number(row.sales_order_id);
    const rawStatus = Number.isFinite(orderId) ? orderStatusById.get(orderId) ?? null : null;
    const status = (rawStatus || "").trim().toUpperCase();
    const isVerified = VERIFIED_ORDER_STATUSES.includes(status);
    const isReversal = REVERSAL_ORDER_STATUSES.includes(status);

    const trail = ensureTrail(index.bySerial, serial);
    const millis = toMillis(row.delivery_date);

    trail.documents.push({
      id: `SODS-${row.id}`,
      sourceModule: isReversal ? "SALES_ORDER_REVERSAL" : "SALES_ORDER",
      documentNo: orderId ? `SO #${orderId}` : "Unlinked serial row",
      documentDate: row.delivery_date ?? null,
      documentStatus: status || null,
      customerCode: row.customer_code ?? null,
      counted: isVerified && millis !== null,
      note: isReversal
        ? "Linked reversal — retained as evidence, excluded from activity"
        : isVerified
          ? null
          : "Order not yet Delivered/Fulfilled, excluded from activity",
    });

    if (isReversal) {
      index.reversalsExcluded += 1;
      trail.reversalCount += 1;
      continue; // A reversal never establishes activity on its own.
    }

    if (isVerified && millis !== null) {
      applyActivity(trail, millis, "SALES_DELIVERY", cutoffMs);
      const inPeriod = startMs !== undefined ? millis >= startMs && millis <= cutoffMs : millis <= cutoffMs;
      if (inPeriod) {
        index.verifiedMovements += 1;
      }
      trail.countedCount += 1;
    }
  }

  // ── 2. Metered-site installations, keyed on the asset id ───────────────────
  for (const row of siteCylinders) {
    const assetId = Number(row.cylinder_asset_id);
    if (!Number.isFinite(assetId)) continue;

    // The latest of install / removal is the activity; a live installation has no
    // removed_date, so installed_date stands in for it.
    const installed = toMillis(row.installed_date);
    const removed = toMillis(row.removed_date);
    const millis = removed !== null ? removed : installed;
    if (millis === null) continue;

    const siteId = row.lpg_site_id !== null && row.lpg_site_id !== undefined ? Number(row.lpg_site_id) : null;
    const siteName = siteId !== null && Number.isFinite(siteId) ? siteNamesById?.get(siteId) ?? null : null;
    // AG-COMMENT: Displays resolved site_name from lpg_customer_lpg_sites instead of Site #ID per user request
    const documentNo = siteName || (siteId !== null && Number.isFinite(siteId) ? `Site #${siteId}` : "Unlinked site cylinder");

    const trail = ensureTrail(index.byAssetId, assetId);
    trail.documents.push({
      id: `SITE-${row.id}`,
      sourceModule: "METERED_SITE",
      documentNo,
      documentDate: new Date(millis).toISOString().split("T")[0],
      documentStatus: (row.site_cylinder_status || "").toUpperCase() || null,
      customerCode: row.customer_code ?? null,
      counted: true,
      siteName: siteName ?? null,
    });

    applyActivity(trail, millis, "SITE_INSTALLATION", cutoffMs);
    const inPeriod = startMs !== undefined ? millis >= startMs && millis <= cutoffMs : millis <= cutoffMs;
    if (inPeriod) {
      index.verifiedMovements += 1;
    }
    trail.countedCount += 1;
  }

  return index;
}

/**
 * Merges the audit stamp on the asset row itself with any movement-derived stamp
 * and returns whichever is most recent, together with the basis that won.
 *
 * Both bases are checked per the design decision for this report: `modified_date`
 * is `ON UPDATE CURRENT_TIMESTAMP` in the DDL, so a status transition does refresh
 * it, but an unrelated field edit refreshes it too — the movement trail is what
 * catches those resets and keeps a genuinely dormant cylinder from looking active.
 */
export function resolveActivity(
  auditMillis: number | null,
  trail: AssetMovementTrail | undefined
): ActivityStamp | null {
  const movement = trail?.activity ?? null;
  if (!movement) return auditMillis === null ? null : { millis: auditMillis, basis: "ASSET_RECORD" };
  if (auditMillis === null) return movement;
  return auditMillis > movement.millis ? { millis: auditMillis, basis: "ASSET_RECORD" } : movement;
}

/** Whole days an asset has been dormant as of the cutoff; null when undated. */
export function resolveIdleDays(activity: ActivityStamp | null, cutoffMs: number): number | null {
  if (!activity) return null;
  return daysBetween(activity.millis, cutoffMs);
}
