// ============================================================
// customer-order-consumption.lpg-calc.ts
// LPG channel: ACTUAL RECORDED consumption, native kg end to end.
//
// Precedence rule that keeps the three LPG ledgers from triple counting:
//   1. lpg_metered_wiwo_transactions (the reconciled billing ledger) wins.
//   2. A meter reading or WIWO header named by a POSTED unified row is
//      already represented there, so the raw rows are skipped.
//   3. Only unconsumed, POSTED lpg_wiwo_headers / lpg_meter_readings rows
//      fall through, for sites billed before the unified ledger existed.
// ============================================================

import type {
  CustomerOrderConsumptionFilters,
  RawInvoiceRow,
  RawLpgSiteRow,
  RawMeterReadingRow,
  RawUnifiedLpgRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-order-consumption.types";
import {
  type ConsumptionContext,
  type RowAccumulator,
  accumulateMonth,
  ensureAccumulator,
  exception,
  withinWindow,
} from "./customer-order-consumption.calc";
import {
  dateOnly,
  isTruthyFlag,
  normalizeStatus,
  selectionSet,
  toNumber,
} from "./customer-order-consumption.helpers";

// The unified ledger has no product dimension, so its rows land on this
// synthetic id and finalise as "Site supply" instead of faking a product.
const SITE_SUPPLY_PRODUCT_ID = 0;

interface SupplyAccumulatorInput {
  customerCode: string;
  branchId: number | null;
  productId: number;
}

export interface LpgCalcInput {
  filters: CustomerOrderConsumptionFilters;
  context: ConsumptionContext;
  lpgSites: RawLpgSiteRow[];
  unifiedLpg: RawUnifiedLpgRow[];
  wiwoHeaders: RawWiwoHeaderRow[];
  wiwoDetails: RawWiwoDetailRow[];
  meterReadings: RawMeterReadingRow[];
  /** Window-fetched invoices — the only branch evidence an LPG row can reach. */
  invoices: RawInvoiceRow[];
  allowedCustomerCodes: Set<string> | null;
  accumulators: Map<string, RowAccumulator>;
  exceptions: ReportException[];
  documents?: SupportingDocument[];
}

function customerOf(
  rowCustomerCode: string | null | undefined,
  site: RawLpgSiteRow | undefined
): string | null {
  const code = String(rowCustomerCode ?? site?.customer_code ?? "").trim();
  return code ? code : null;
}

/**
 * Branch is never stored on an LPG row, so it is recovered from the invoice
 * the transaction was billed to. A linked invoice outside the fetched window
 * is reported rather than guessed, because inventing a branch would breach
 * the cross-branch restriction the ticket sets.
 */
function resolveBranch(
  salesInvoiceId: number | null,
  invoicesById: Map<number, RawInvoiceRow>
): { branchId: number | null; reason: string | null } {
  if (salesInvoiceId == null) {
    return { branchId: null, reason: "not billed to an invoice yet" };
  }
  const invoice = invoicesById.get(salesInvoiceId);
  if (!invoice) {
    return { branchId: null, reason: `linked invoice ${salesInvoiceId} is outside the fetched window` };
  }
  if (invoice.branch_id == null) {
    return { branchId: null, reason: `invoice ${invoice.invoice_no ?? salesInvoiceId} has no branch` };
  }
  return { branchId: invoice.branch_id, reason: null };
}

/** POSTED is the only state that makes an LPG row a real supply event. */
function isPosted(status: string | null | undefined): boolean {
  return normalizeStatus(status) === "posted";
}

export function accumulateLpg(input: LpgCalcInput): void {
  const {
    filters,
    context,
    accumulators,
    exceptions,
    documents,
    allowedCustomerCodes,
  } = input;

  const invoicesById = new Map<number, RawInvoiceRow>(
    input.invoices.map((invoice) => [invoice.invoice_id, invoice])
  );
  const sitesById = new Map<number, RawLpgSiteRow>(
    input.lpgSites.map((site) => [site.id, site])
  );
  const detailsByHeader = new Map<string, RawWiwoDetailRow[]>()
  for (const detail of input.wiwoDetails) {
    const key = String(detail.wiwo_header_id)
    const bucket = detailsByHeader.get(key)
    if (bucket) bucket.push(detail)
    else detailsByHeader.set(key, [detail])
  }

  // Any unified row — draft or cancelled still shields its source rows:
  // the ledger owns them, and counting the raw copy would double the kg.
  const consumedMeterIds = new Set<number>()
  const consumedWiwoIds = new Set<number>()
  for (const row of input.unifiedLpg) {
    if (row.meter_reading_id != null) consumedMeterIds.add(row.meter_reading_id)
    if (row.wiwo_header_id != null) consumedWiwoIds.add(row.wiwo_header_id)
  }

  // Multi-select pickers: an empty selection means "no gate", not "no rows".
  const onlyCustomers = selectionSet(filters.customerCodes)
  const onlyBranches = selectionSet(filters.branchIds)

  const acceptCustomer = (customerCode: string | null): boolean => {
    if (!customerCode) return false
    if (onlyCustomers && !onlyCustomers.has(customerCode)) return false
    if (allowedCustomerCodes && !allowedCustomerCodes.has(customerCode)) return false
    return true
  }

  // An LPG row carries no branch of its own, so the branch is the one on the
  // invoice that billed it — and an unlinked row cannot survive a selection.
  const branchGate = (branchId: number | null): boolean =>
    !onlyBranches || (branchId != null && onlyBranches.has(toNumber(branchId)))

  const record = (
    supply: SupplyAccumulatorInput,
    site: RawLpgSiteRow | undefined,
    orderKey: string,
    dateValue: string | null,
    values: { kg: number; qty?: number; meteredKg?: number; wiwoKg?: number; varianceKg?: number; amount?: number }
  ): RowAccumulator => {
    const acc = ensureAccumulator(accumulators, {
      customerCode: supply.customerCode,
      branchId: supply.branchId,
      channel: "LPG",
      productId: supply.productId,
    })
    acc.billingMode = site?.billing_mode ?? null
    acc.quantityUnit = "kg"
    acc.meteredKg += values.meteredKg ?? 0
    acc.wiwoKg += values.wiwoKg ?? 0
    acc.varianceKg += values.varianceKg ?? 0
    acc.netAmount += values.amount ?? 0
    // Consumption is measured in kg, so the piece metric mirrors it and the
    // table never shows a quantity that cannot be added to another unit.
    accumulateMonth(acc, dateValue, {
      orderKey,
      qty: values.qty ?? values.kg,
      kg: values.kg,
    })
    return acc
  }

  for (const row of input.unifiedLpg) {
    if (!isPosted(row.status)) continue
    if (!withinWindow(row.transaction_date, filters.startDate, filters.endDate)) continue

    const site = sitesById.get(row.lpg_site_id)
    const customerCode = customerOf(row.customer_code, site)
    if (!acceptCustomer(customerCode)) continue
    const code = customerCode as string

    // The opening fill of a newly connected site is not demand, and folding
    // it in would read as a spike on a customer who has not used gas yet.
    if (normalizeStatus(row.transaction_type) === "onboarding_baseline") {
      exceptions.push(
        exception({
          code: "LPG_BASELINE_EXCLUDED",
          channel: "LPG",
          customerCode: code,
          customerName: context.customers.get(code)?.customer_name ?? code,
          referenceType: "LPG_TRANSACTION",
          referenceNo: row.transaction_no ?? String(row.id),
          detail: "Onboarding baseline fill; not counted as consumption.",
          kg: toNumber(row.billable_kg),
        })
      )
      documents?.push({
        documentType: "LPG_BILLING",
        documentNo: row.transaction_no ?? String(row.id),
        date: dateOnly(row.transaction_date),
        status: `${row.status} / ${row.transaction_type}`,
        quantity: 0,
        kg: 0,
        amount: 0,
        reference: row.sales_invoice_no ?? "",
      })
      continue
    }

    const { branchId, reason } = resolveBranch(row.sales_invoice_id, invoicesById)
    if (reason) {
      const unbilled = row.sales_invoice_id == null
      exceptions.push(
        exception({
          code: unbilled ? "UNBILLED_LPG_TRANSACTION" : "BRANCH_UNKNOWN",
          channel: "LPG",
          customerCode: code,
          customerName: context.customers.get(code)?.customer_name ?? code,
          referenceType: "LPG_TRANSACTION",
          referenceNo: row.transaction_no ?? String(row.id),
          detail: `Branch could not be derived because the transaction is ${reason}.`,
          kg: toNumber(row.billable_kg),
        })
      )
    }
    // With a branch filter active an unattributable row cannot be placed,
    // so it is dropped after being reported instead of leaking into "all".
    if (!branchGate(branchId)) continue

    const meteredKg = toNumber(row.metered_kg)
    const wiwoKg = toNumber(row.wiwo_kg)
    const varianceKg = toNumber(row.variance_kg)
    const source = normalizeStatus(row.billable_source)
    // The billing engine already chose metered or weighed kg, so its choice
    // is the billed figure. Without that choice fall back to the meter.
    const kg =
      source !== "none" && toNumber(row.billable_kg) > 0
        ? toNumber(row.billable_kg)
        : meteredKg || wiwoKg

    if (kg <= 0) continue

    const acc = record(
      { customerCode: code, branchId, productId: SITE_SUPPLY_PRODUCT_ID },
      site,
      `LPG:${row.id}`,
      row.transaction_date,
      {
        kg,
        meteredKg,
        wiwoKg,
        varianceKg,
        amount: toNumber(row.net_amount),
      }
    )

    if (Math.abs(varianceKg) > 0.0005) {
      acc.exceptionCodes.add("LPG_VARIANCE")
      exceptions.push(
        exception({
          code: "LPG_VARIANCE",
          channel: "LPG",
          customerCode: code,
          customerName: context.customers.get(code)?.customer_name ?? code,
          referenceType: "LPG_TRANSACTION",
          referenceNo: row.transaction_no ?? String(row.id),
          detail: `Meter ${meteredKg} kg vs weighed ${wiwoKg} kg (${row.variance_reason_code ?? "no reason code"}).`,
          kg: varianceKg,
        })
      )
    }

    documents?.push({
      documentType: "LPG_BILLING",
      documentNo: row.transaction_no ?? String(row.id),
      date: dateOnly(row.transaction_date),
      status: `${row.status} / ${row.transaction_type} / ${row.billable_source ?? "NONE"}`,
      quantity: kg,
      kg,
      amount: toNumber(row.net_amount),
      reference: row.sales_invoice_no ?? "",
    })
  }

  // ---- Fallback: WIWO headers no unified row has taken ----
  for (const header of input.wiwoHeaders) {
    if (consumedWiwoIds.has(header.id)) continue
    if (!isPosted(header.wiwo_status)) continue
    if (!withinWindow(header.transaction_date, filters.startDate, filters.endDate)) continue

    const site = sitesById.get(header.lpg_site_id)
    const customerCode = customerOf(header.customer_code, site)
    if (!acceptCustomer(customerCode)) continue
    const code = customerCode as string

    const { branchId, reason } = resolveBranch(header.sales_invoice_id, invoicesById)
    if (reason && normalizeStatus(header.wiwo_type) !== "deployment_only") {
      exceptions.push(
        exception({
          code: header.sales_invoice_id == null ? "UNBILLED_LPG_TRANSACTION" : "BRANCH_UNKNOWN",
          channel: "LPG",
          customerCode: code,
          customerName: context.customers.get(code)?.customer_name ?? code,
          referenceType: "WIWO",
          referenceNo: header.wiwo_no ?? String(header.id),
          detail: `Branch could not be derived because the transaction is ${reason}.`,
          kg: toNumber(header.total_billable_kg),
        })
      )
    }
    if (!branchGate(branchId)) continue

    // A deployment-only swap moves cylinders without metering gas, so it is
    // listed as a document but must not add consumption kg.
    if (normalizeStatus(header.wiwo_type) === "deployment_only") {
      documents?.push({
        documentType: "WIWO",
        documentNo: header.wiwo_no ?? String(header.id),
        date: dateOnly(header.transaction_date),
        status: `${header.wiwo_status} / ${header.wiwo_type}`,
        quantity: 0,
        kg: 0,
        amount: toNumber(header.net_amount),
        reference: header.sales_invoice_no ?? "",
      })
      continue
    }

    const details = detailsByHeader.get(String(header.id)) ?? []
    let headerKg = 0

    if (details.length === 0) {
      // No lines fetched (or none ever written): the header total is all the
      // schema offers, so it is used and reported on product 0.
      const kg = toNumber(header.total_billable_kg)
      if (kg > 0) {
        record(
          { customerCode: code, branchId, productId: SITE_SUPPLY_PRODUCT_ID },
          site,
          `WIWO:${header.id}`,
          header.transaction_date,
          { kg, wiwoKg: kg, amount: toNumber(header.net_amount) }
        )
        headerKg = kg
      }
    }

    for (const detail of details) {
      const consumedKg = toNumber(detail.consumed_lpg_kg)
      const billableKg = toNumber(detail.billable_kg)
      // NEW_DEPLOYMENT lines carry no consumption and RETURN_ONLY lines are
      // gas coming back, so only the consumption/adjustment lines add demand.
      if (!isTruthyFlag(detail.is_billable)) continue
      const lineType = normalizeStatus(detail.line_type)
      if (lineType === "new_deployment" || lineType === "return_only") continue

      const kg = billableKg > 0 ? billableKg : consumedKg
      if (kg <= 0) continue

      record(
        { customerCode: code, branchId, productId: detail.product_id ?? SITE_SUPPLY_PRODUCT_ID },
        site,
        `WIWO:${header.id}`,
        header.transaction_date,
        { kg, wiwoKg: consumedKg || kg, amount: toNumber(detail.net_amount) }
      )
      headerKg += kg
    }

    documents?.push({
      documentType: "WIWO",
      documentNo: header.wiwo_no ?? String(header.id),
      date: dateOnly(header.transaction_date),
      status: `${header.wiwo_status} / ${header.wiwo_type}`,
      quantity: headerKg,
      kg: headerKg,
      amount: toNumber(header.net_amount),
      reference: header.sales_invoice_no ?? "",
    })
  }

  // ---- Fallback: meter readings no unified row has taken ----
  for (const reading of input.meterReadings) {
    if (consumedMeterIds.has(reading.id)) continue
    if (!isPosted(reading.reading_status)) continue
    if (!withinWindow(reading.reading_date, filters.startDate, filters.endDate)) continue

    const site = sitesById.get(reading.lpg_site_id)
    const customerCode = customerOf(reading.customer_code, site)
    if (!acceptCustomer(customerCode)) continue
    const code = customerCode as string

    const { branchId, reason } = resolveBranch(reading.sales_invoice_id, invoicesById)
    if (reason) {
      exceptions.push(
        exception({
          code: reading.sales_invoice_id == null ? "UNBILLED_LPG_TRANSACTION" : "BRANCH_UNKNOWN",
          channel: "LPG",
          customerCode: code,
          customerName: context.customers.get(code)?.customer_name ?? code,
          referenceType: "METER_READING",
          referenceNo: reading.reading_no ?? String(reading.id),
          detail: `Branch could not be derived because the transaction is ${reason}.`,
          kg: toNumber(reading.kg_consumed),
        })
      )
    }
    if (!branchGate(branchId)) continue

    // kg_consumed is already converted by the reading's own factor, so the
    // raw meter_unit (M3/LITER) is never multiplied here.
    const kg = toNumber(reading.kg_consumed)
    if (kg <= 0) continue

    record(
      { customerCode: code, branchId, productId: SITE_SUPPLY_PRODUCT_ID },
      site,
      `MTR:${reading.id}`,
      reading.reading_date,
      { kg, meteredKg: kg, amount: toNumber(reading.net_amount) }
    )

    documents?.push({
      documentType: "METER_READING",
      documentNo: reading.reading_no ?? String(reading.id),
      date: dateOnly(reading.reading_date),
      status: `${reading.reading_status} / ${reading.meter_unit ?? ""}`,
      quantity: kg,
      kg,
      amount: toNumber(reading.net_amount),
      reference: reading.sales_invoice_no ?? "",
    })
  }
}
