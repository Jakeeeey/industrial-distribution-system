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
} from "./billing-consolidation.repo";

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
            finalWiwoHeader = {
              id: 0,
              wiwo_no: "WIWO-ONB-BASELINE",
              lpg_site_id: tx.lpg_site_id,
              customer_code: tx.customer_code,
              transaction_date: tx.transaction_date,
              wiwo_type: "DEPLOYMENT_ONLY",
              total_returned_cylinders: 0,
              total_deployed_cylinders: activeCylinders.length,
              total_billable_kg: 0,
              price_per_kg: tx.price_per_kg,
              gross_amount: 0,
              discount_amount: 0,
              vat_amount: 0,
              net_amount: 0,
              wiwo_status: "POSTED", // Renders table as read-only
              remarks: "Synthesized baseline cylinders list",
              details: activeCylinders.map((cyl, idx) => {
                const tare = Number(cyl.cylinder_asset_id?.tare_weight ?? 0);
                const gross = Number(cyl.current_lpg_kg ?? 0);
                const prodName = cyl.cylinder_asset_id?.product_id?.product_name || null;

                return {
                  id: cyl.id,
                  wiwo_header_id: 0,
                  line_no: idx + 1,
                  lpg_site_id: tx.lpg_site_id,
                  customer_code: tx.customer_code,
                  line_type: "NEW_DEPLOYMENT",
                  site_cylinder_id: cyl.id,
                  cylinder_asset_id: cyl.cylinder_asset_id?.id ?? 0,
                  product_id: 0,
                  serial_number: cyl.cylinder_asset_id?.serial_number ?? "UNKNOWN",
                  tare_weight_kg: tare,
                  previous_lpg_kg: Number(cyl.previous_lpg_kg ?? 0),
                  returned_gross_weight_kg: gross,
                  remaining_lpg_kg: Math.max(0, gross - tare),
                  consumed_lpg_kg: 0,
                  billable_kg: 0,
                  price_per_kg: tx.price_per_kg,
                  gross_amount: 0,
                  discount_amount: 0,
                  vat_amount: 0,
                  net_amount: 0,
                  is_billable: 0,
                  remarks: null,
                  product: prodName ? { product_name: prodName } : undefined,
                };
              }),
            };
          }
        } catch (err) {
          console.error("Failed to fetch active cylinders for onboarding baseline transaction:", err);
        }
      }

      return {
        ...tx,
        meter_reading: meterReading ?? undefined,
        wiwo_header: finalWiwoHeader ?? undefined,
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

  return { header, transactions: enriched };
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

  const kgConsumed = parseFloat((rawConsumption * existing.conversion_factor).toFixed(3));
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
  let totalNet = 0;
  let totalDiscount = 0;

  for (const tx of transactions) {
    if (tx.status !== "CANCELLED") {
      totalGross += tx.gross_amount;
      totalVat += tx.vat_amount;
      totalNet += tx.net_amount;
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
  const invoice = await repoCreateSalesInvoice({
    invoice_no: invoiceNo,
    order_id: invoiceNo,
    customer_code: header.customer_id,
    invoice_date: today,
    gross_amount: parseFloat(totalGross.toFixed(2)),
    vat_amount: parseFloat(totalVat.toFixed(2)),
    // AG-CHANGE: In a VAT-inclusive system, total_amount is equal to the sum of transaction net_amounts
    net_amount: parseFloat(totalNet.toFixed(2)),
    total_amount: parseFloat(totalNet.toFixed(2)),
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

  // 8. Update header status to POSTED and mark as billed (read-only)
  await repoPatchHeader(headerId, {
    status: "POSTED",
    is_billed: 1,
    posted_by: approved_by,
    posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
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
    "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus"
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
