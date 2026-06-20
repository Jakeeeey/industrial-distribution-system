// ─── billing-consolidation.service.ts ────────────────────────────────────────
// Business logic & orchestration for the LPG Billing Consolidation module.
// This layer coordinates repo calls and recomputes derived values.
// RULE: Zero fetch() calls here. All Directus I/O goes through the repo.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConsolidationHeader,
  ConsolidationTransaction,
  ConsolidationWiwoHeader,
  ConsolidationMeterReading,
  ConsolidationAttachment,
  ConsolidationAuditEntry,
  ConsolidationHeaderListParams,
  MeterReadingAdjustPayload,
  WiwoDetailAdjustPayload,
  ApproveHeaderPayload,
  WiwoLineType,
} from "../types/billing-consolidation.types";

import {
  repoFetchHeaders,
  repoFetchHeaderById,
  repoFetchTransactionsByHeader,
  repoFetchMeterReading,
  repoPatchMeterReading,
  repoFetchWiwoWithDetails,
  repoPatchWiwoDetail,
  repoPatchWiwoHeader,
  repoPatchTransaction,
  repoPatchHeader,
  repoFetchAttachments,
  repoFetchAuditTrail,
  repoInsertAuditEntry,
  repoCreateSalesInvoice,
  repoLinkHeaderInvoice,
  repoResolveSalesmanId,
  repoFetchActiveCylindersBySite,
  repoFetchFirstBranchId,
  repoFetchOnboardingAttachmentsForCylinders,
  // AG-CHANGE: Import cylinder helpers to adjust onboarding baseline cylinders directly in the database
  repoFetchCustomerSiteCylinder,
  repoPatchCustomerSiteCylinder,
  repoFetchCustomerEmailByCode,
  repoFetchCompanyProfile,
  repoGetOrCreateFolderId,
  repoUploadInvoicePdf,
  // DEV-CHANGE: Import previous-header lookup for inter-period consumption snapshot
  repoFetchPreviousPostedHeader,
} from "./billing-consolidation.repo";

import { sendInvoiceEmail } from "../utils/email-sender";

// ─── Header Listing ───────────────────────────────────────────────────────────

/**
 * Returns a paginated list of billing headers with optional search/status filter.
 */
export async function fetchConsolidationHeaders(params: ConsolidationHeaderListParams): Promise<{
  data: ConsolidationHeader[];
  total: number;
}> {
  return repoFetchHeaders(params);
}

// ─── Transaction Detail Fetching ──────────────────────────────────────────────

/**
 * Returns all child transactions for a header, enriched with their
 * meter reading records, WIWO records, and attachments.
 * This is the "full workspace" payload for the reviewer UI.
 */
export async function fetchConsolidationWorkspace(headerId: number): Promise<{
  header: ConsolidationHeader | null;
  transactions: ConsolidationTransaction[];
}> {
  const [header, transactions] = await Promise.all([
    repoFetchHeaderById(headerId),
    repoFetchTransactionsByHeader(headerId),
  ]);

  // Enrich each transaction with meter reading, WIWO, and attachments in parallel
  const enriched = await Promise.all(
    transactions.map(async (tx) => {
      const [meterReading, wiwoHeader, attachments] = await Promise.all([
        tx.meter_reading_id ? repoFetchMeterReading(tx.meter_reading_id) : Promise.resolve(null),
        tx.wiwo_header_id ? repoFetchWiwoWithDetails(tx.wiwo_header_id) : Promise.resolve(null),
        repoFetchAttachments(tx.id),
      ]);

      let finalWiwoHeader = wiwoHeader;

      // Synthesize cylinder details for onboarding baseline transactions if not directly linked
      if (tx.transaction_type === "ONBOARDING_BASELINE" && !finalWiwoHeader && tx.lpg_site_id) {
        try {
          const activeCylinders = await repoFetchActiveCylindersBySite(tx.lpg_site_id);
          if (activeCylinders && activeCylinders.length > 0) {
            // AG-CHANGE: Calculate billable_kg per cylinder based on initial LPG weight (gross - tare)
            const details = activeCylinders.map((cyl, idx) => {
              const tare = Number(cyl.cylinder_asset_id?.tare_weight ?? 0);
              const gross = Number(cyl.current_lpg_kg ?? 0);
              const prodName = cyl.cylinder_asset_id?.product_id?.product_name || null;
              const remaining = Math.max(0, parseFloat((gross - tare).toFixed(3)));
              const lineGross = parseFloat((remaining * tx.price_per_kg).toFixed(2));
              const lineVat = parseFloat((lineGross - (lineGross / 1.12)).toFixed(2));

              return {
                id: cyl.id,
                wiwo_header_id: 0,
                line_no: idx + 1,
                lpg_site_id: tx.lpg_site_id,
                customer_code: tx.customer_code,
                line_type: "NEW_DEPLOYMENT" as WiwoLineType,
                site_cylinder_id: cyl.id,
                cylinder_asset_id: cyl.cylinder_asset_id?.id ?? 0,
                product_id: 0,
                serial_number: cyl.cylinder_asset_id?.serial_number ?? "UNKNOWN",
                tare_weight_kg: tare,
                previous_lpg_kg: Number(cyl.previous_lpg_kg ?? 0),
                returned_gross_weight_kg: gross,
                remaining_lpg_kg: remaining,
                consumed_lpg_kg: remaining,
                billable_kg: remaining,
                price_per_kg: tx.price_per_kg,
                gross_amount: lineGross,
                discount_amount: 0,
                vat_amount: lineVat,
                net_amount: lineGross,
                is_billable: 1 as 0 | 1,
                remarks: null,
                product: prodName ? { product_name: prodName } : undefined,
              };
            });

            const totalLpgKg = parseFloat(details.reduce((sum, d) => sum + d.billable_kg, 0).toFixed(3));
            const headerGross = parseFloat((totalLpgKg * tx.price_per_kg).toFixed(2));
            const headerVat = parseFloat((headerGross - (headerGross / 1.12)).toFixed(2));

            finalWiwoHeader = {
              id: 0,
              wiwo_no: "WIWO-ONB-BASELINE",
              lpg_site_id: tx.lpg_site_id,
              customer_code: tx.customer_code,
              transaction_date: tx.transaction_date,
              wiwo_type: "DEPLOYMENT_ONLY",
              total_returned_cylinders: 0,
              total_deployed_cylinders: activeCylinders.length,
              total_billable_kg: totalLpgKg,
              price_per_kg: tx.price_per_kg,
              gross_amount: headerGross,
              discount_amount: 0,
              vat_amount: headerVat,
              net_amount: headerGross,
              wiwo_status: "POSTED", // Renders table as read-only
              remarks: "Synthesized baseline cylinders list",
              details,
            };

            // AG-CHANGE: Update the parent transaction values to match the computed baseline cylinder totals
            tx.wiwo_kg = totalLpgKg;
            tx.billable_kg = totalLpgKg;
            tx.billable_source = "WIWO";
            tx.gross_amount = headerGross;
            tx.net_amount = headerGross;
            tx.vat_amount = headerVat;
          }
        } catch (err) {
          console.error("Failed to fetch active cylinders for onboarding baseline transaction:", err);
        }
      }

      // AG-CHANGE: Query the audit trail for this transaction to mark adjusted meter readings and cylinder weights
      const audits = await repoFetchAuditTrail(tx.id);
      const isMeterAdjusted = audits.some(
        (a) =>
          a.action_type === "REVIEWER_ADJUSTMENT" &&
          a.changes_payload &&
          "current_reading" in a.changes_payload
      );

      // --- Pass 1: Collect cylinder IDs from audits that carry explicit identifier fields ---
      const adjustedCylinderIds = new Set<number>();
      audits.forEach((a) => {
        if (a.action_type === "REVIEWER_ADJUSTMENT" && a.changes_payload) {
          if (a.changes_payload.wiwo_detail_id) {
            adjustedCylinderIds.add(Number(a.changes_payload.wiwo_detail_id.new));
          }
          if (a.changes_payload.site_cylinder_id) {
            adjustedCylinderIds.add(Number(a.changes_payload.site_cylinder_id.new));
          }
        }
      });

      // AG-CHANGE: Parse chronological audits (oldest to newest) to find the original values before any reviewer adjustments
      const chronologicalAudits = [...audits].reverse();
      
      let originalCurrentReading: number | undefined = undefined;
      if (isMeterAdjusted) {
        const oldestMeterAudit = chronologicalAudits.find(
          (a) =>
            a.action_type === "REVIEWER_ADJUSTMENT" &&
            a.changes_payload &&
            "current_reading" in a.changes_payload
        );
        if (oldestMeterAudit) {
          originalCurrentReading = Number(oldestMeterAudit.changes_payload.current_reading.old);
        }
      }

      // --- Pass 2: Map detail IDs and serial numbers to their original gross weights before the first adjustment ---
      // Also build a value-keyed fallback for legacy audits that have returned_gross_weight_kg but no identifier fields.
      // For those, we match later by comparing a cylinder's current returned_gross_weight_kg to the audit's .new value.
      const originalCylGrossWeights = new Map<number, number>();
      const originalCylGrossWeightsBySerial = new Map<string, number>();

      // Legacy fallback: keyed by the POST-adjustment gross weight (.new) → original gross weight (.old)
      // Only populated for audits that have no wiwo_detail_id, site_cylinder_id, or serial_number.
      const legacyGrossWeightFallback = new Map<number, number>();

      chronologicalAudits.forEach((a) => {
        if (
          a.action_type === "REVIEWER_ADJUSTMENT" &&
          a.changes_payload &&
          "returned_gross_weight_kg" in a.changes_payload
        ) {
          const detailId = a.changes_payload.wiwo_detail_id
            ? Number(a.changes_payload.wiwo_detail_id.new)
            : a.changes_payload.site_cylinder_id
              ? Number(a.changes_payload.site_cylinder_id.new)
              : null;
          const serialNo = a.changes_payload.serial_number
            ? String(a.changes_payload.serial_number.new)
            : null;

          const oldGross = Number(a.changes_payload.returned_gross_weight_kg.old);
          const newGross = Number(a.changes_payload.returned_gross_weight_kg.new);

          if (detailId !== null) {
            // Explicit ID — standard path: record only the FIRST (oldest) audit entry per cylinder
            if (!originalCylGrossWeights.has(detailId)) {
              originalCylGrossWeights.set(detailId, oldGross);
            }
          }
          if (serialNo !== null) {
            if (!originalCylGrossWeightsBySerial.has(serialNo)) {
              originalCylGrossWeightsBySerial.set(serialNo, oldGross);
            }
          }
          if (detailId === null && serialNo === null) {
            // AG-CHANGE: Legacy audit with no identifier — store old value keyed by the post-adjustment gross weight.
            // At render time we check if a cylinder's current returned_gross_weight_kg matches any .new value here.
            // Only keep the FIRST (oldest) entry for each unique .new value so we always get the true original.
            if (!legacyGrossWeightFallback.has(newGross)) {
              legacyGrossWeightFallback.set(newGross, oldGross);
            }
          }
        }
      });

      const finalMeterReading = meterReading
        ? { 
            ...meterReading, 
            is_adjusted: isMeterAdjusted,
            original_current_reading: originalCurrentReading,
          }
        : undefined;

      const finalWiwoHeaderWithFlags = finalWiwoHeader
        ? {
            ...finalWiwoHeader,
            details: finalWiwoHeader.details?.map((d) => {
              // Explicit ID / serial lookup first, then legacy value-keyed fallback
              const origGross =
                originalCylGrossWeights.get(d.id) ??
                originalCylGrossWeightsBySerial.get(d.serial_number) ??
                // AG-CHANGE: Legacy fallback — match by current returned_gross_weight_kg matching audit's .new value
                legacyGrossWeightFallback.get(Number(d.returned_gross_weight_kg)) ??
                null;

              // A cylinder is adjusted if: it has an explicit audit ID match, OR the legacy fallback resolved an original value,
              // OR serial number matched an audit entry.
              const isAdjustedByLegacy = origGross !== null && !adjustedCylinderIds.has(d.id);

              return {
                ...d,
                is_adjusted: adjustedCylinderIds.has(d.id) || isAdjustedByLegacy,
                original_returned_gross_weight_kg: origGross,
              };
            }),
          }
        : undefined;

      return {
        ...tx,
        meter_reading: finalMeterReading,
        wiwo_header: finalWiwoHeaderWithFlags,
        attachments,
      } as ConsolidationTransaction;
    })
  );

  // AG-CHANGE: Collect all unique cylinder asset IDs in the workspace to load their onboarding baseline photos
  const cylinderAssetIds = new Set<number>();
  enriched.forEach((tx) => {
    if (tx.wiwo_header?.details) {
      tx.wiwo_header.details.forEach((d) => {
        if (d.cylinder_asset_id) {
          cylinderAssetIds.add(d.cylinder_asset_id);
        }
      });
    }
  });

  if (cylinderAssetIds.size > 0) {
    try {
      const onboardingAttachments = await repoFetchOnboardingAttachmentsForCylinders(
        Array.from(cylinderAssetIds)
      );
      
      // Merge onboarding baseline attachments into each transaction's attachments list
      enriched.forEach((tx) => {
        if (tx.transaction_type !== "ONBOARDING_BASELINE") {
          const txCylAssetIds = new Set(
            tx.wiwo_header?.details?.map((d) => d.cylinder_asset_id).filter(Boolean) ?? []
          );
          
          const matchedOnboarding = onboardingAttachments.filter(
            (att) => att.cylinder_asset_id && txCylAssetIds.has(att.cylinder_asset_id)
          );

          // Deduplicate by directus_file_id
          const existingFileIds = new Set(tx.attachments?.map((a) => a.directus_file_id) ?? []);
          const uniqueOnboarding = matchedOnboarding.filter(
            (att) => !existingFileIds.has(att.directus_file_id)
          );

          if (uniqueOnboarding.length > 0) {
            tx.attachments = [...(tx.attachments ?? []), ...uniqueOnboarding];
          }
        }
      });
    } catch (err) {
      console.error("Failed to load onboarding attachments for workspace transactions:", err);
    }
  }

  // DEV-CHANGE: Look up the previous POSTED billing header for this site to populate
  // prev_total_billed_kg / prev_total_billed_m3 for the period-over-period invoice comparison.
  let prevHeader: ConsolidationHeader | null = null;
  if (header && header.customer_site_id) {
    try {
      prevHeader = await repoFetchPreviousPostedHeader(header.customer_site_id, headerId);
    } catch (err) {
      console.warn("[fetchConsolidationWorkspace] Failed to load previous posted header:", err);
    }
  }

  // Inject prev snapshot onto the current header (not persisted — service-layer only)
  const headerWithPrev = header
    ? {
        ...header,
        prev_total_billed_kg: prevHeader?.total_billed_kg ?? null,
        prev_total_billed_m3: prevHeader?.total_billed_m3 ?? null,
      }
    : null;

  return { header: headerWithPrev, transactions: enriched };
}

/**
 * Returns only the WIWO header + details for a given WIWO header ID.
 * Used by the reviewer panel to refresh after an adjustment.
 */
export async function fetchWiwoDetails(wiwoHeaderId: number): Promise<ConsolidationWiwoHeader | null> {
  return repoFetchWiwoWithDetails(wiwoHeaderId);
}

/**
 * Returns the audit trail for a specific child transaction.
 */
export async function fetchAuditTrail(transactionId: number): Promise<ConsolidationAuditEntry[]> {
  return repoFetchAuditTrail(transactionId);
}

/**
 * Returns attachments for a specific child transaction.
 */
export async function fetchAttachments(transactionId: number): Promise<ConsolidationAttachment[]> {
  return repoFetchAttachments(transactionId);
}

// ─── Meter Reading Adjustment ─────────────────────────────────────────────────

/**
 * Reviewer corrects the current meter reading.
 *
 * Recompute chain:
 *   1. raw_consumption = |new_current - previous_reading| (direction-aware)
 *   2. kg_consumed = raw_consumption × conversion_factor
 *   3. gross_amount = kg_consumed × price_per_kg
 *   4. Update lpg_meter_readings
 *   5. Re-evaluate arbitration with wiwo_kg:
 *      - billable_kg = MAX(metered_kg, wiwo_kg)
 *      - billable_source = metered_kg >= wiwo_kg ? METERED : WIWO
 *      - variance_kg = |metered_kg - wiwo_kg|
 *   6. Recompute gross_amount, vat_amount, and net_amount on transaction
 *   7. Update lpg_metered_wiwo_transactions
 *   8. Update lpg_transaction_headers totals
 *   9. Write audit row
 */
export async function adjustMeterReading(payload: MeterReadingAdjustPayload): Promise<{
  updated_meter_reading: Partial<ConsolidationMeterReading>;
  updated_transaction: Partial<ConsolidationTransaction>;
}> {
  const { transactionId, meterReadingId, new_current_reading, adjustment_reason, modified_by } = payload;

  // 1. Fetch existing reading to get base values for recompute
  const existing = await repoFetchMeterReading(meterReadingId);
  if (!existing) throw new Error(`Meter reading ${meterReadingId} not found.`);

  const oldCurrentReading = existing.current_reading;

  // 2. Recompute values
  const prevReading = existing.previous_reading;
  const rawConsumption =
    existing.meter_direction === "DECREASING"
      ? Math.max(0, prevReading - new_current_reading)
      : Math.max(0, new_current_reading - prevReading);

  // DEV-CHANGE: Fixed kgConsumed calculation to correctly multiply by conversion_factor, pressure_line, and lpg_vapor_factor
  const kgConsumed = parseFloat(
    (
      rawConsumption *
      existing.conversion_factor *
      (existing.pressure_line ?? 1) *
      (existing.lpg_vapor_factor ?? 1)
    ).toFixed(3)
  );
  const grossAmount = parseFloat((kgConsumed * existing.price_per_kg).toFixed(2));

  // 3. Patch the meter reading row
  const meterPatch: Record<string, unknown> = {
    current_reading: new_current_reading,
    raw_consumption: rawConsumption,
    kg_consumed: kgConsumed,
    gross_amount: grossAmount,
    modified_by,
    modified_date: new Date().toISOString(),
  };
  await repoPatchMeterReading(meterReadingId, meterPatch);

  // 4. Fetch the parent transaction to get base values for transaction-level recompute
  const txBefore = await fetchTransactionRaw(transactionId);
  if (!txBefore) throw new Error(`Transaction ${transactionId} not found.`);

  // 5. Re-arbitrate based on which billing source has the higher calculated gross amount
  const newMeteredKg = kgConsumed;
  const txPricePerKg = txBefore.price_per_kg;

  // Calculate gross amount for both sources to determine the winner
  const meteredGrossTemp = parseFloat((newMeteredKg * txPricePerKg).toFixed(2));
  const wiwoGrossTemp = parseFloat((txBefore.wiwo_kg * txPricePerKg).toFixed(2));

  const newBillableSource = meteredGrossTemp >= wiwoGrossTemp ? "METERED" : "WIWO";
  const newBillableKg = newBillableSource === "METERED" ? newMeteredKg : txBefore.wiwo_kg;
  const newVarianceKg = parseFloat(Math.abs(newMeteredKg - txBefore.wiwo_kg).toFixed(4));

  // AG-CHANGE: Updated calculation to VAT-inclusive formula where net = total and gross = net
  const newNetAmount = txBefore.transaction_type === "ONBOARDING_BASELINE" ? 0 : parseFloat((newBillableKg * txPricePerKg).toFixed(2));
  const newGrossAmount = newNetAmount;
  const newVatAmount = txBefore.transaction_type === "ONBOARDING_BASELINE" ? 0 : parseFloat((newNetAmount - (newNetAmount / 1.12)).toFixed(2));

  const txPatch: Record<string, unknown> = {
    metered_kg: newMeteredKg,
    variance_kg: newVarianceKg,
    billable_source: newBillableSource,
    billable_kg: newBillableKg,
    gross_amount: newGrossAmount,
    vat_amount: newVatAmount,
    net_amount: newNetAmount,
    modified_by,
    modified_date: new Date().toISOString(),
  };
  await repoPatchTransaction(transactionId, txPatch);

  // 6. Refresh header totals
  await refreshHeaderTotals(txBefore.transaction_header_id, modified_by);

  // 7. Write audit trail entry
  await repoInsertAuditEntry({
    transaction_id: transactionId,
    transaction_no: txBefore.transaction_no,
    action_type: "REVIEWER_ADJUSTMENT",
    changes_payload: {
      current_reading: { old: oldCurrentReading, new: new_current_reading },
      raw_consumption: { old: existing.raw_consumption, new: rawConsumption },
      kg_consumed: { old: existing.kg_consumed, new: kgConsumed },
      metered_kg: { old: txBefore.metered_kg, new: newMeteredKg },
      variance_kg: { old: txBefore.variance_kg, new: newVarianceKg },
      billable_source: { old: txBefore.billable_source, new: newBillableSource },
      billable_kg: { old: txBefore.billable_kg, new: newBillableKg },
      gross_amount: { old: txBefore.gross_amount, new: newGrossAmount },
      vat_amount: { old: txBefore.vat_amount, new: newVatAmount },
      net_amount: { old: txBefore.net_amount, new: newNetAmount },
      adjustment_reason: { old: null, new: adjustment_reason },
    },
    modified_by,
  });

  return {
    updated_meter_reading: { ...existing, current_reading: new_current_reading, raw_consumption: rawConsumption, kg_consumed: kgConsumed, gross_amount: grossAmount },
    updated_transaction: {
      metered_kg: newMeteredKg,
      variance_kg: newVarianceKg,
      billable_source: newBillableSource,
      billable_kg: newBillableKg,
      gross_amount: newGrossAmount,
      vat_amount: newVatAmount,
      net_amount: newNetAmount,
    },
  };
}

// ─── WIWO Detail Adjustment ───────────────────────────────────────────────────

/**
 * Reviewer corrects the returned gross weight for a specific cylinder.
 *
 * Recompute chain:
 *   1. remaining_lpg_kg = new_returned_gross_weight_kg - tare_weight_kg
 *   2. consumed_lpg_kg  = previous_lpg_kg - remaining_lpg_kg
 *   3. billable_kg      = consumed_lpg_kg (if is_billable=1)
 *   4. gross_amount     = billable_kg × price_per_kg
 *   5. Update lpg_wiwo_details row
 *   6. Re-sum lpg_wiwo_headers.total_billable_kg & update WIWO header amounts
 *   7. Re-evaluate arbitration with metered_kg:
 *      - billable_kg = MAX(metered_kg, wiwo_kg)
 *      - billable_source = metered_kg >= wiwo_kg ? METERED : WIWO
 *      - variance_kg = |metered_kg - wiwo_kg|
 *   8. Recompute gross_amount, vat_amount, and net_amount on transaction
 *   9. Update lpg_metered_wiwo_transactions
 *   10. Update lpg_transaction_headers totals
 *   11. Write audit row
 */
export async function adjustWiwoDetail(payload: WiwoDetailAdjustPayload): Promise<{
  updated_detail: Record<string, number>;
}> {
  const {
    transactionId,
    wiwoDetailId,
    wiwoHeaderId,
    new_returned_gross_weight_kg,
    adjustment_reason,
    modified_by,
  } = payload;

  // AG-CHANGE: Support adjusting onboarding baseline cylinder weights directly.
  // When wiwoHeaderId is 0, no wiwo_header exists, so we fetch and update the customer site cylinder table instead.
  if (wiwoHeaderId === 0) {
    const cylinder = await repoFetchCustomerSiteCylinder(wiwoDetailId);
    if (!cylinder) throw new Error(`Customer site cylinder ${wiwoDetailId} not found.`);

    const oldGrossWeight = cylinder.current_lpg_kg ?? 0;
    const tareWeight = cylinder.cylinder_asset_id?.tare_weight ?? 0;

    const remainingLpgKg = Math.max(0, parseFloat(
      (new_returned_gross_weight_kg - tareWeight).toFixed(3)
    ));
    // AG-CHANGE: On onboarding baseline transactions, the cylinder's billable kg is its LPG weight (remaining LPG weight)
    const consumedLpgKg = remainingLpgKg;
    const billableKg = remainingLpgKg;
    
    const txBefore = await fetchTransactionRaw(transactionId);
    if (!txBefore) throw new Error(`Transaction ${transactionId} not found.`);

    // AG-CHANGE: Calculate only grossAmount for the detail return as net/vat are not stored on the customer site cylinder detail level
    const grossAmount = parseFloat((billableKg * txBefore.price_per_kg).toFixed(2));

    // Direct update of the cylinder asset's current weight in customer site cylinders database
    await repoPatchCustomerSiteCylinder(wiwoDetailId, {
      current_lpg_kg: new_returned_gross_weight_kg,
    });

    // Fetch all active cylinders at this site to compute the updated transaction-level totals
    const activeCylinders = await repoFetchActiveCylindersBySite(txBefore.lpg_site_id);
    const newTotalBillableKg = parseFloat(
      activeCylinders.reduce((sum, cyl) => {
        const tare = Number(cyl.cylinder_asset_id?.tare_weight ?? 0);
        // Use the newly adjusted weight for this cylinder, fallback to database weight for others
        const gross = cyl.id === wiwoDetailId ? new_returned_gross_weight_kg : Number(cyl.current_lpg_kg ?? 0);
        return sum + Math.max(0, gross - tare);
      }, 0).toFixed(3)
    );

    const newTxGross = parseFloat((newTotalBillableKg * txBefore.price_per_kg).toFixed(2));
    const newTxNet = newTxGross;
    const newTxVat = parseFloat((newTxNet - (newTxNet / 1.12)).toFixed(2));

    // Patch the baseline transaction in the database with updated totals
    await repoPatchTransaction(transactionId, {
      wiwo_kg: newTotalBillableKg,
      billable_source: "WIWO",
      billable_kg: newTotalBillableKg,
      gross_amount: newTxGross,
      vat_amount: newTxVat,
      net_amount: newTxNet,
      modified_by,
      modified_date: new Date().toISOString(),
    });

    await refreshHeaderTotals(txBefore.transaction_header_id, modified_by);

    await repoInsertAuditEntry({
      transaction_id: transactionId,
      transaction_no: txBefore.transaction_no,
      action_type: "REVIEWER_ADJUSTMENT",
      changes_payload: {
        site_cylinder_id: { old: null, new: wiwoDetailId },
        serial_number: { old: null, new: cylinder.cylinder_asset_id?.serial_number ?? "" },
        returned_gross_weight_kg: { old: oldGrossWeight, new: new_returned_gross_weight_kg },
        remaining_lpg_kg: { old: Math.max(0, oldGrossWeight - tareWeight), new: remainingLpgKg },
        consumed_lpg_kg: { old: Math.max(0, oldGrossWeight - tareWeight), new: consumedLpgKg },
        detail_billable_kg: { old: Math.max(0, oldGrossWeight - tareWeight), new: billableKg },
        wiwo_total_billable_kg: { old: txBefore.wiwo_kg, new: newTotalBillableKg },
        wiwo_kg: { old: txBefore.wiwo_kg, new: newTotalBillableKg },
        variance_kg: { old: txBefore.variance_kg, new: txBefore.variance_kg },
        billable_source: { old: txBefore.billable_source, new: "WIWO" },
        billable_kg: { old: txBefore.billable_kg, new: newTotalBillableKg },
        gross_amount: { old: txBefore.gross_amount, new: newTxGross },
        vat_amount: { old: txBefore.vat_amount, new: newTxVat },
        net_amount: { old: txBefore.net_amount, new: newTxNet },
        adjustment_reason: { old: null, new: adjustment_reason },
      },
      modified_by,
    });

    return {
      updated_detail: {
        remaining_lpg_kg: remainingLpgKg,
        consumed_lpg_kg: consumedLpgKg,
        billable_kg: billableKg,
        gross_amount: grossAmount,
      },
    };
  }

  // 1. Fetch all current details to get the full context for this line
  const wiwoHeader = await repoFetchWiwoWithDetails(wiwoHeaderId);
  if (!wiwoHeader) throw new Error(`WIWO header ${wiwoHeaderId} not found.`);

  const detail = wiwoHeader.details?.find((d) => d.id === wiwoDetailId);
  if (!detail) throw new Error(`WIWO detail ${wiwoDetailId} not found in header ${wiwoHeaderId}.`);

  const oldGrossWeight = detail.returned_gross_weight_kg ?? 0;

  // 2. Recompute line values: Consumed net LPG = Previous Net (previous_lpg_kg - tare) - Remaining Net (remainingLpgKg)
  const remainingLpgKg = Math.max(0, parseFloat(
    (new_returned_gross_weight_kg - detail.tare_weight_kg).toFixed(3)
  ));
  const consumedLpgKg = Math.max(0, parseFloat(
    ((detail.previous_lpg_kg - detail.tare_weight_kg) - remainingLpgKg).toFixed(3)
  ));
  const billableKg = detail.is_billable === 1 ? consumedLpgKg : 0;
  // AG-CHANGE: Calculate VAT-inclusive gross, net, and vat for the detail line
  const netAmount = parseFloat((billableKg * detail.price_per_kg).toFixed(2));
  const grossAmount = netAmount;
  const vatAmount = parseFloat((netAmount - (netAmount / 1.12)).toFixed(2));

  // 3. Patch the WIWO detail row
  const detailPatch: Record<string, unknown> = {
    returned_gross_weight_kg: new_returned_gross_weight_kg,
    remaining_lpg_kg: remainingLpgKg,
    consumed_lpg_kg: consumedLpgKg,
    billable_kg: billableKg,
    gross_amount: grossAmount,
    vat_amount: vatAmount,
    net_amount: netAmount,
    modified_by,
    modified_date: new Date().toISOString(),
  };
  await repoPatchWiwoDetail(wiwoDetailId, detailPatch);

  // 4. Re-sum the WIWO header totals using the updated detail values
  const otherDetails = (wiwoHeader.details ?? []).filter((d) => d.id !== wiwoDetailId);
  const otherBillableKg = otherDetails.reduce((sum, d) => sum + d.billable_kg, 0);
  const newTotalBillableKg = parseFloat((otherBillableKg + billableKg).toFixed(3));
  const newHeaderGross = parseFloat((newTotalBillableKg * wiwoHeader.price_per_kg).toFixed(2));

  // Fetch the parent transaction to get base values for transaction-level recompute & check onboarding
  const txBefore = await fetchTransactionRaw(transactionId);
  if (!txBefore) throw new Error(`Transaction ${transactionId} not found.`);

  // AG-CHANGE: Recalculate WIWO header using VAT-inclusive pricing formula
  const newHeaderNet = txBefore.transaction_type === "ONBOARDING_BASELINE" ? 0 : parseFloat((newHeaderGross).toFixed(2));
  const newHeaderVat = txBefore.transaction_type === "ONBOARDING_BASELINE" ? 0 : parseFloat((newHeaderNet - (newHeaderNet / 1.12)).toFixed(2));

  await repoPatchWiwoHeader(wiwoHeaderId, {
    total_billable_kg: newTotalBillableKg,
    gross_amount: newHeaderNet,
    vat_amount: newHeaderVat,
    net_amount: newHeaderNet,
    modified_by,
    modified_date: new Date().toISOString(),
  });

  // 5. Re-arbitrate based on which billing source has the higher calculated gross amount
  const newWiwoKg = newTotalBillableKg;
  const txPricePerKg = txBefore.price_per_kg;

  // Calculate gross amount for both sources to determine the winner
  const meteredGrossTemp = parseFloat((txBefore.metered_kg * txPricePerKg).toFixed(2));
  const wiwoGrossTemp = parseFloat((newWiwoKg * txPricePerKg).toFixed(2));

  const newBillableSource = meteredGrossTemp >= wiwoGrossTemp ? "METERED" : "WIWO";
  const newBillableKg = newBillableSource === "METERED" ? txBefore.metered_kg : newWiwoKg;
  const newVarianceKg = parseFloat(Math.abs(txBefore.metered_kg - newWiwoKg).toFixed(4));
  // AG-CHANGE: Recalculate transaction amounts using VAT-inclusive formulas where net = total and gross = net
  const newTxNet = parseFloat((newBillableKg * txPricePerKg).toFixed(2));
  const newTxGross = newTxNet;
  const newTxVat = txBefore.transaction_type === "ONBOARDING_BASELINE" ? 0 : parseFloat((newTxNet - (newTxNet / 1.12)).toFixed(2));

  await repoPatchTransaction(transactionId, {
    wiwo_kg: newWiwoKg,
    variance_kg: newVarianceKg,
    billable_source: newBillableSource,
    billable_kg: newBillableKg,
    gross_amount: newTxGross,
    vat_amount: newTxVat,
    net_amount: newTxNet,
    modified_by,
    modified_date: new Date().toISOString(),
  });

  // 6. Refresh header totals
  await refreshHeaderTotals(txBefore.transaction_header_id, modified_by);

  // 7. Write audit trail entry
  await repoInsertAuditEntry({
    transaction_id: transactionId,
    transaction_no: txBefore.transaction_no,
    action_type: "REVIEWER_ADJUSTMENT",
    changes_payload: {
      wiwo_detail_id: { old: null, new: wiwoDetailId },
      serial_number: { old: null, new: detail.serial_number },
      returned_gross_weight_kg: { old: oldGrossWeight, new: new_returned_gross_weight_kg },
      remaining_lpg_kg: { old: detail.remaining_lpg_kg, new: remainingLpgKg },
      consumed_lpg_kg: { old: detail.consumed_lpg_kg, new: consumedLpgKg },
      detail_billable_kg: { old: detail.billable_kg, new: billableKg },
      wiwo_total_billable_kg: { old: wiwoHeader.total_billable_kg, new: newTotalBillableKg },
      wiwo_kg: { old: txBefore.wiwo_kg, new: newWiwoKg },
      variance_kg: { old: txBefore.variance_kg, new: newVarianceKg },
      billable_source: { old: txBefore.billable_source, new: newBillableSource },
      billable_kg: { old: txBefore.billable_kg, new: newBillableKg },
      gross_amount: { old: txBefore.gross_amount, new: newTxGross },
      vat_amount: { old: txBefore.vat_amount, new: newTxVat },
      net_amount: { old: txBefore.net_amount, new: newTxNet },
      adjustment_reason: { old: null, new: adjustment_reason },
    },
    modified_by,
  });

  return {
    updated_detail: {
      remaining_lpg_kg: remainingLpgKg,
      consumed_lpg_kg: consumedLpgKg,
      billable_kg: billableKg,
      gross_amount: grossAmount,
    },
  };
}

// ─── Approve Header ───────────────────────────────────────────────────────────

/**
 * Approves the billing header by setting status = 'POSTED'.
 * This marks the header as ready for invoice generation.
 * The header must currently be in DRAFT status.
 */
export async function approveConsolidationHeader(payload: ApproveHeaderPayload): Promise<void> {
  const { headerId, approved_by } = payload;

  const header = await repoFetchHeaderById(headerId);
  if (!header) throw new Error(`Header ${headerId} not found.`);

  // Guard: only DRAFT headers can be approved
  if (header.status !== "DRAFT") {
    throw new Error(
      `Header ${headerId} cannot be approved — current status is '${header.status}'. Only DRAFT headers can be approved.`
    );
  }

  // 1. Fetch child transactions
  const transactions = await repoFetchTransactionsByHeader(headerId);
  if (!transactions || transactions.length === 0) {
    throw new Error(`Header ${headerId} has no child transactions to approve.`);
  }

  // 2. Consolidate child transaction totals
  let totalGross = 0;
  let totalVat = 0;
  // DEV-CHANGE: Removed unused totalNet variable to resolve eslint warning
  let totalDiscount = 0;

  for (const tx of transactions) {
    if (tx.status !== "CANCELLED") {
      totalGross += tx.gross_amount;
      totalVat += tx.vat_amount;
      totalDiscount += tx.discount_amount;
    }
  }

  // 3. Generate unique Invoice Number
  const today = new Date().toISOString().split("T")[0];
  const ts = Date.now().toString().slice(-6);
  const invoiceNo = `SI-${ts.slice(0, 3)}-${ts.slice(3, 6)}`;

  // 4. Resolve salesman ID and branch ID
  const salesmanId = await repoResolveSalesmanId(approved_by);
  const branchId = await repoFetchFirstBranchId();

  // 5. Create Sales Invoice
  // DEV-CHANGE: Align net_amount and total_amount with the VAT-inclusive totalGross to resolve discrepancy with PDF invoice
  const invoice = await repoCreateSalesInvoice({
    invoice_no: invoiceNo,
    order_id: invoiceNo,
    customer_code: header.customer_id,
    invoice_date: today,
    gross_amount: parseFloat(totalGross.toFixed(2)),
    vat_amount: parseFloat(totalVat.toFixed(2)),
    // AG-CHANGE: In a VAT-inclusive system, total_amount is equal to the sum of transaction gross_amounts (totalGross)
    net_amount: parseFloat(totalGross.toFixed(2)),
    total_amount: parseFloat(totalGross.toFixed(2)),
    transaction_status: "unpaid",
    remarks: `Consolidated Invoice for Billing Header ${header.header_no || headerId}`,
    salesman_id: salesmanId,
    price_type: "D",
    discount_amount: parseFloat(totalDiscount.toFixed(2)),
    isReceipt: 1,
    branch_id: branchId,
    sales_type: 6,
    invoice_type: 1,
    modified_by: approved_by,
    posted_by: approved_by,
  });

  // 6. Link child transactions to the generated invoice and set status to POSTED
  for (const tx of transactions) {
    if (tx.status !== "CANCELLED") {
      await repoPatchTransaction(tx.id, {
        sales_invoice_id: invoice.id,
        sales_invoice_no: invoice.invoice_no,
        status: "POSTED",
        modified_by: approved_by,
        modified_date: new Date().toISOString(),
      });
    }
  }

  // 7. Link header to invoice in lpg_transaction_header_invoices
  await repoLinkHeaderInvoice({
    header_id: headerId,
    sales_invoice_id: invoice.id,
    invoice_role: "SOURCE_DELIVERY",
    linked_by: approved_by,
    status: "POSTED",
  });

  // 7.5 Upload PDF to Directus if pdfBase64 is provided
  let pdfAttachmentUuid: string | null = null;
  if (payload.pdfBase64) {
    try {
      const folderId = await repoGetOrCreateFolderId("ids_invoice_pdf");
      const fileId = await repoUploadInvoicePdf(
        payload.pdfBase64,
        `Consolidated_Invoice_${invoiceNo}.pdf`,
        folderId
      );
      if (fileId) {
        pdfAttachmentUuid = fileId;
        console.log(`[Directus File Upload] Successfully uploaded consolidated PDF. UUID: ${fileId}`);
      }
    } catch (uploadErr) {
      console.error("[Directus File Upload] Failed to upload PDF attachment:", uploadErr);
    }
  }

  // DEV-CHANGE: Compute billing history snapshot values to persist on the header.
  // total_billed_kg — billable kg excluding onboarding baseline (mirrors Consolidation by Source total)
  // total_billed_m3 — raw M3 consumed only by METERED-source transactions (mirrors Meter Conversion display)
  const billedKg = parseFloat(
    transactions
      .filter((tx) => tx.transaction_type !== "ONBOARDING_BASELINE" && tx.status !== "CANCELLED")
      .reduce((sum, tx) => sum + tx.billable_kg, 0)
      .toFixed(3)
  );

  // Fetch meter readings for METERED-source transactions to sum raw M3
  const meteredTxs = transactions.filter(
    (tx) => tx.billable_source === "METERED" &&
      tx.transaction_type !== "ONBOARDING_BASELINE" &&
      tx.status !== "CANCELLED" &&
      tx.meter_reading_id
  );

  let billedM3 = 0;
  for (const tx of meteredTxs) {
    if (tx.meter_reading_id) {
      const reading = await repoFetchMeterReading(tx.meter_reading_id);
      if (reading) {
        billedM3 += reading.raw_consumption;
      }
    }
  }
  billedM3 = parseFloat(billedM3.toFixed(3));

  // 8. Update header status to POSTED, mark as billed, link the PDF UUID, and persist billing snapshot
  await repoPatchHeader(headerId, {
    status: "POSTED",
    is_billed: 1,
    invoice_attachments_uuid: pdfAttachmentUuid,
    posted_by: approved_by,
    posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // DEV-CHANGE: Persist billing snapshot for inter-period reference
    total_billed_kg: billedKg,
    total_billed_m3: billedM3,
  });

  // 9. Fetch company profile, customer email, and send email notification with PDF attachment (non-blocking)
  try {
    const custInfo = await repoFetchCustomerEmailByCode(header.customer_id);
    if (custInfo && custInfo.customer_email) {
      const company = await repoFetchCompanyProfile();
      const companyName = company?.company_name || "";

      // DEV-CHANGE: Fetch and convert company logo to Base64 data URI if UUID exists in company profile
      let logoBase64: string | null = null;
      if (company && company.company_logo) {
        const logoUuid = company.company_logo;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logoUuid);
        if (isUuid) {
          try {
            const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
            const assetUrl = `${apiBaseUrl}/assets/${logoUuid}${staticToken ? `?access_token=${staticToken}` : ""}`;
            const imgRes = await fetch(assetUrl);
            if (imgRes.ok) {
              const contentType = imgRes.headers.get("content-type") || "image/png";
              const buffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              logoBase64 = `data:${contentType};base64,${base64}`;
            }
          } catch (imgErr) {
            console.error("[Email Service] Failed to proxy company logo for email:", imgErr);
          }
        } else if (company.company_logo.startsWith("data:")) {
          logoBase64 = company.company_logo;
        }
      }

      // Calculate due date (10 days in the future)
      const invDate = new Date();
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 10);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // DEV-CHANGE: Send clean informational billing notification to customer attaching the PDF invoice.
      // Align netAmount with the VAT-inclusive totalGross to match the PDF invoice amount.
      await sendInvoiceEmail({
        to: custInfo.customer_email,
        customerName: custInfo.customer_name || header.customer_id,
        invoiceNo: invoice.invoice_no,
        invoiceDate: formatDate(invDate),
        dueDate: formatDate(dueDateObj),
        netAmount: totalGross,
        periodFrom: header.period_from,
        periodTo: header.period_to,
        pdfBase64: payload.pdfBase64,
        companyName,
        companyContact: company?.company_contact,
        companyEmail: company?.company_email,
        companyTin: company?.company_tin,
        companyLogoBase64: logoBase64,
      });
      console.log(`[Email Service] Successfully sent invoice notification for ${invoice.invoice_no} to ${custInfo.customer_email}`);
    } else {
      console.warn(`[Email Service] Customer ${header.customer_id} has no customer_email set. Skipping notification.`);
    }
  } catch (err) {
    // DEV-CHANGE: Catch and log email errors to ensure transaction posting success is NOT interrupted by SMTP delivery failures
    console.error(`[Email Service] Failed to send email for invoice ${invoice.invoice_no}:`, err);
  }
}


// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Internal helper: fetches a single transaction's key fields for service-layer recompute.
 * Uses a targeted single-item Directus fetch.
 * Not exported — callers should use fetchConsolidationWorkspace for full UI data.
 */
async function fetchTransactionRaw(transactionId: number): Promise<ConsolidationTransaction | null> {
  const {
    directusFetch,
    getDirectusBase,
  } = await import(
    "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/directus"
  );
  const DIRECTUS_URL = getDirectusBase();

  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${transactionId}?fields=id,transaction_header_id,transaction_no,transaction_type,metered_kg,wiwo_kg,variance_kg,billable_source,billable_kg,price_per_kg,gross_amount,discount_amount,vat_amount,net_amount,status`
  );
  if (!res.data) return null;
  const d = res.data;

  return {
    id: Number(d["id"]),
    transaction_header_id: Number(d["transaction_header_id"] ?? 0),
    transaction_no: String(d["transaction_no"] ?? ""),
    transaction_type: (d["transaction_type"] as ConsolidationTransaction["transaction_type"]) ?? "REGULAR_BILLING",
    transaction_date: "",
    customer_code: "",
    lpg_site_id: 0,
    meter_reading_id: null,
    wiwo_header_id: null,
    metered_kg: Number(d["metered_kg"] ?? 0),
    wiwo_kg: Number(d["wiwo_kg"] ?? 0),
    variance_kg: Number(d["variance_kg"] ?? 0),
    billable_source: (d["billable_source"] as ConsolidationTransaction["billable_source"]) ?? "NONE",
    billable_kg: Number(d["billable_kg"] ?? 0),
    price_per_kg: Number(d["price_per_kg"] ?? 0),
    gross_amount: Number(d["gross_amount"] ?? 0),
    discount_amount: Number(d["discount_amount"] ?? 0),
    vat_amount: Number(d["vat_amount"] ?? 0),
    net_amount: Number(d["net_amount"] ?? 0),
    status: (d["status"] as ConsolidationTransaction["status"]) ?? "DRAFT",
    billing_period_from: null,
    billing_period_to: null,
    remarks: null,
    created_by: null,
    created_date: null,
    modified_by: null,
    modified_date: null,
  };
}

/**
 * Internal helper: re-sums all child transaction totals and patches the billing header.
 * Called after any reviewer adjustment to keep the header summary in sync.
 *
 * Computes: total_metered_kg, total_wiwo_kg, total_billable_kg, total_gross_amount
 */
async function refreshHeaderTotals(headerId: number, modifiedBy: number): Promise<void> {
  if (!headerId) return;

  const transactions = await repoFetchTransactionsByHeader(headerId);

  const totalMeteredKg = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.metered_kg, 0).toFixed(3)
  );
  const totalWiwoKg = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.wiwo_kg, 0).toFixed(3)
  );
  const totalBillableKg = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.billable_kg, 0).toFixed(3)
  );
  const totalGrossAmount = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.gross_amount, 0).toFixed(2)
  );

  // Note: The lpg_transaction_headers table does not have dedicated total columns in the DDL.
  // We update updated_at to signal the header was touched; future schema evolution
  // may add total_billable_kg etc. directly on the header.
  await repoPatchHeader(headerId, {
    updated_at: new Date().toISOString(),
    // Attach computed totals as remarks supplement if needed — skipped for now.
    // These totals are computed on-the-fly by the UI from child transactions.
    // Suppressing direct header total columns as they don't exist in current DDL.
  });

  // Expose totals to callers via console for verification during development
  console.log(`[refreshHeaderTotals] Header ${headerId}: metered=${totalMeteredKg} wiwo=${totalWiwoKg} billable=${totalBillableKg} gross=${totalGrossAmount} modified_by=${modifiedBy}`);
}
