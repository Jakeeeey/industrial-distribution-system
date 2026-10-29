// ============================================================
// customer-incentive.calc.ts
// Pure aggregation — no I/O, no fetch, no React, no module-level state.
// Everything this report asserts about money is decided here so the same
// fixtures drive the table, the drill-down and both exports.
//
// The §4 formula is  eligible units x size kg x ₱/kg. The schema holds no
// incentive-rate table and no approved rebate percentage, so the ₱/kg used is
// the rate already recorded on the invoice line (unit_price / product_weight),
// quantity-weighted. That makes "earned" the recorded value of the eligible
// gas rather than an independent rebate entitlement — so the report reconciles
// it against what finance actually approved on the memo and surfaces the
// difference as §10 Variance instead of hiding it.
// ============================================================

import type {
  AppliedFilterContext,
  ClaimStatus,
  CustomerIncentiveEvidence,
  CustomerIncentiveRow,
  ExceptionCode,
  IncentiveClaimSummary,
  IncentiveOverview,
  IncentiveSourceData,
  RawCategoryRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawProductRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-incentive.types";
import { CLAIM_STATUS_LABELS } from "../types/customer-incentive.types";
import {
  claimStatusLabel,
  dateOnly,
  deriveClaimStatus,
  isAcceptedDocument,
  isTruthyFlag,
  isVoidedMemoStatus,
  normalizeStatus,
  parseCategorySizeKg,
  releasedAmountOf,
  resolveSizeKg,
  round2,
  safeRatio,
  toClaimStatus,
  toNumber,
} from "./customer-incentive.helpers";

/** product_weight is a MySQL double, so equality is tested with a tolerance. */
const WEIGHT_TOLERANCE = 0.01;

/** Higher rank = further along §6's lifecycle. REJECTED ranks lowest. */
const STATUS_RANK: Record<ClaimStatus, number> = {
  REJECTED: 0,
  FOR_REVIEW: 1,
  APPROVED: 2,
  PARTIALLY_RELEASED: 3,
  RELEASED: 4,
};

/** Normalises a customer code for matching across collections. */
export function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

export interface ReportContext {
  products: Map<string, RawProductRow>;
  branches: Map<string, string>;
  customersByCode: Map<
    string,
    { customer_name: string | null; store_name: string | null; classification: number | null }
  >;
  /** customers_memo.customer_id -> customer.customer_code. */
  customerCodeById: Map<string, string>;
  classifications: Map<string, string>;
  salesmen: Map<string, string>;
  accounts: Map<string, string>;
  /** category_id -> the industrial category row, for the size in its name. */
  categories: Map<string, RawCategoryRow>;
  /** Ids of the invoices actually fetched for this window. */
  windowInvoiceIds: Set<string>;
}

interface EvidenceKey {
  customerCode: string;
  branchId: number | null;
  productId: number;
}

export interface EvidenceAccumulator extends EvidenceKey {
  grossUnits: number;
  /** Σ qty x unit_price over accepted, priced lines. */
  lineValue: number;
  /** Units on lines that carried a usable unit price. */
  pricedUnits: number;
  returnedUnits: number;
  invoiceIds: Set<string>;
  returnNumbers: Set<string>;
  salesmanIds: Set<string>;
  exceptionCodes: Set<string>;
}

export interface AccumulateArgs {
  context: ReportContext;
  accumulators: Map<string, EvidenceAccumulator>;
  exceptions: ReportException[];
  documents?: SupportingDocument[];
}

export function buildContext(source: IncentiveSourceData): ReportContext {
  const branches = new Map<string, string>();
  source.branches.forEach((branch) => {
    branches.set(
      String(branch.id),
      branch.branch_name || branch.branch_code || `Branch ${branch.id}`
    );
  });

  const classifications = new Map<string, string>();
  source.classifications.forEach((row) => {
    classifications.set(String(row.id), row.classification_name || "Unclassified");
  });

  const salesmen = new Map<string, string>();
  source.salesmen.forEach((row) => {
    salesmen.set(String(row.id), row.salesman_name || row.salesman_code || `Salesman ${row.id}`);
  });

  const customersByCode = new Map<
    string,
    { customer_name: string | null; store_name: string | null; classification: number | null }
  >();
  const customerCodeById = new Map<string, string>();
  source.customers.forEach((customer) => {
    customersByCode.set(normalizeCode(customer.customer_code), {
      customer_name: customer.customer_name,
      store_name: customer.store_name,
      classification: customer.classification,
    });
    if (customer.customer_code) {
      customerCodeById.set(String(customer.id), customer.customer_code);
    }
  });

  const products = new Map<string, RawProductRow>();
  source.products.forEach((product) => products.set(String(product.product_id), product));

  const categories = new Map<string, RawCategoryRow>();
  source.categories.forEach((category) => {
    categories.set(String(category.category_id), category);
  });

  // Store only the clean account_title without prepending gl_code
  const accounts = new Map<string, string>();
  source.accounts.forEach((account) => {
    accounts.set(
      String(account.coa_id),
      account.account_title ?? ""
    );
  });

  return {
    products,
    branches,
    customersByCode,
    customerCodeById,
    classifications,
    salesmen,
    accounts,
    categories,
    windowInvoiceIds: new Set(source.invoices.map((invoice) => String(invoice.invoice_id))),
  };
}

/**
 * The kg one unit of this product carries.
 *
 * The category name wins over `product_weight`, because serialized cylinders
 * commonly store 0 in the weight column — the same precedence the customer
 * order and consumption report uses. Null means the size is genuinely
 * unknown, which the caller reports rather than guessing at.
 */
export function resolveProductSizeKg(
  product: RawProductRow | undefined,
  context: ReportContext
): number | null {
  if (!product) return null;
  // AG-FIX: A product must strictly belong to an industrial category (is_industrial = 1).
  // Non-industrial products (e.g. palm oil, groceries, FMCG) whose packaging or case happens
  // to weigh 11 kg must never resolve an industrial cylinder size or earn refill incentives.
  if (
    product.product_category == null ||
    !context.categories.has(String(product.product_category))
  ) {
    return null;
  }
  const fromCategory = parseCategorySizeKg(
    context.categories.get(String(product.product_category))?.category_name
  );
  if (fromCategory != null) return fromCategory;
  return toNumber(product.product_weight) || null;
}

/**
 * Whether an invoiced product is a refill this incentive is measured on.
 *
 * Chosen industrial categories decide by membership — that is the catalogue the
 * reader named, and each product's own category is what its kg are taken from,
 * so several sizes can be measured in one pass. With no category chosen the
 * single size decides alone. A product whose size cannot be resolved is never
 * eligible; the caller reports it instead of guessing.
 */
export function isEligibleProduct(
  product: RawProductRow | undefined,
  context: ReportContext,
  filters: Pick<AppliedFilterContext, "categoryIds" | "sizeKg">
): boolean {
  if (!product) return false;
  // AG-FIX: Strictly guard that the product belongs to an industrial category.
  if (
    product.product_category == null ||
    !context.categories.has(String(product.product_category))
  ) {
    return false;
  }
  const categoryIds = filters.categoryIds ?? [];
  if (categoryIds.length > 0) {
    return categoryIds.includes(product.product_category);
  }
  // AG-RULE: If specific sizeKg is requested, match that size.
  // When no category and no sizeKg is specified, ALL industrial cylinder sizes are eligible ("no specified kg selected means it's all").
  if (filters.sizeKg != null && filters.sizeKg > 0) {
    const size = resolveProductSizeKg(product, context);
    if (size == null) return false;
    return Math.abs(size - filters.sizeKg) <= WEIGHT_TOLERANCE;
  }
  return resolveProductSizeKg(product, context) != null;
}

export function record(
  accumulators: Map<string, EvidenceAccumulator>,
  key: EvidenceKey
): EvidenceAccumulator {
  const id = `${normalizeCode(key.customerCode)}|${key.branchId ?? "null"}|${key.productId}`;
  const existing = accumulators.get(id);
  if (existing) return existing;

  const created: EvidenceAccumulator = {
    ...key,
    grossUnits: 0,
    lineValue: 0,
    pricedUnits: 0,
    returnedUnits: 0,
    invoiceIds: new Set(),
    returnNumbers: new Set(),
    salesmanIds: new Set(),
    exceptionCodes: new Set(),
  };
  accumulators.set(id, created);
  return created;
}

function customerNameFor(context: ReportContext, code: string, fallback?: string | null): string {
  return context.customersByCode.get(normalizeCode(code))?.customer_name ?? fallback ?? code ?? "";
}

// ------------------------------------------------------------
// Eligible refill evidence
// ------------------------------------------------------------

/**
 * Folds accepted invoice lines for the eligible cylinder size into the
 * accumulator index. A voided or replaced invoice never earns (§4), an
 * unconfirmed product weight is reported rather than guessed at, and a line
 * without a price is counted but flagged so it cannot silently value gas at
 * nothing.
 */
export function accumulateInvoices(
  args: AccumulateArgs & {
    filters: AppliedFilterContext;
    invoices: RawInvoiceRow[];
    details: IncentiveSourceData["invoiceDetails"];
  }
): void {
  const { filters, context, invoices, details, accumulators, exceptions } = args;
  const { documents } = args;
  const sizeKg = filters.sizeKg ? resolveSizeKg(filters.sizeKg) : 0;

  const detailsByInvoice = new Map<string, IncentiveSourceData["invoiceDetails"]>();
  details.forEach((detail) => {
    const bucket = detailsByInvoice.get(String(detail.invoice_no));
    if (bucket) bucket.push(detail);
    else detailsByInvoice.set(String(detail.invoice_no), [detail]);
  });

  /**
   * Reports a line only when its product could not be tested against the
   * eligible size at all. A product that resolves to a different size, or
   * sits in another category, is the filter working and stays silent — the
   * alternative is one exception per non-matching line on every invoice.
   */
  const reportUntestableLine = (
    invoice: RawInvoiceRow,
    customerName: string,
    line: RawInvoiceDetailRow,
    product: RawProductRow | undefined,
    quantity: number
  ): void => {
    // AG-FILTER: Only products in the serialized cylinder master (is_serialized = 1) can be evaluated.
    // Line items for products that are undefined (!product) or non-serialized (is_serialized != 1)
    // (such as food, snacks, FMCG, groceries, wafers, retail items) are NOT cylinders and must stay completely silent.
    if (
      !product ||
      (product.is_serialized != null &&
        product.is_serialized !== "" &&
        Number(product.is_serialized) !== 1 &&
        product.is_serialized !== true &&
        product.is_serialized !== "1")
    ) {
      return;
    }

    // Non-industrial products (e.g. food, FMCG, groceries, toiletries) belong to
    // categories outside the industrial catalogue and are intentionally excluded
    // from cylinder refill incentive calculations. They must stay silent.
    if (
      product.product_category != null &&
      !context.categories.has(String(product.product_category))
    ) {
      return;
    }

    const categoryScoped = (filters.categoryIds?.length ?? 0) > 0;
    const code: ExceptionCode | null =
      categoryScoped && product.product_category == null
        ? "PRODUCT_NOT_CATEGORISED"
        : resolveProductSizeKg(product, context) == null
          ? "MISSING_PRODUCT_WEIGHT"
          : null;
    if (!code) return;

    record(accumulators, {
      customerCode: normalizeCode(invoice.customer_code),
      branchId: invoice.branch_id,
      productId: line.product_id,
    }).exceptionCodes.add(code);

    exceptions.push({
      code,
      severity: "warning",
      customerCode: invoice.customer_code,
      customerName,
      referenceType: "PRODUCT",
      referenceNo: product?.product_code ?? String(line.product_id),
      detail:
        code === "PRODUCT_NOT_CATEGORISED"
          ? `Product ${
              product?.product_name ?? line.product_id
            } carries no category on the master, so it cannot be matched to the selected cylinder categories. ${quantity} unit(s) were not counted.`
          : `Product ${
              product?.product_name ?? line.product_id
            } states no cylinder size on its category name or weight, so ${quantity} unit(s) could not be confirmed as ${
              categoryScoped
                ? "one of the selected cylinder categories"
                : `a ${sizeKg} kg refill`
            } and were not counted.`,
      amount: null,
    });
  };

  invoices.forEach((invoice) => {
    // AG-FILTER: Only accumulate invoices matching the requested branch filter.
    if (
      filters.branchIds &&
      filters.branchIds.length > 0 &&
      (invoice.branch_id == null || !filters.branchIds.includes(invoice.branch_id))
    ) {
      return;
    }

    const customerCode = normalizeCode(invoice.customer_code);
    if (!customerCode) return;
    const customerName = customerNameFor(context, customerCode, invoice.customer_code);

    if (isTruthyFlag(invoice.isReplaced) || !isAcceptedDocument(invoice.transaction_status)) {
      const reprint = isTruthyFlag(invoice.isReplaced);
      exceptions.push({
        code: "VOIDED_INVOICE_EXCLUDED",
        severity: "info",
        customerCode: invoice.customer_code,
        customerName,
        referenceType: "INVOICE",
        referenceNo: invoice.invoice_no || String(invoice.invoice_id),
        detail: reprint
          ? `Invoice ${
              invoice.invoice_no ?? invoice.invoice_id
            } is a reprint of a document already issued, so its units were left out rather than counted a second time.`
          : `Invoice ${
              invoice.invoice_no ?? invoice.invoice_id
            } is ${normalizeStatus(
              invoice.transaction_status
            )} and was excluded from eligible volume.`,
        amount: null,
      });
      return;
    }

    let countedOnInvoice = 0;
    let invoiceEligibleValue = 0;

    (detailsByInvoice.get(String(invoice.invoice_id)) ?? []).forEach((line) => {
      const product = context.products.get(String(line.product_id));
      // AG-FILTER: Only serialized industrial products can be considered for refill incentives.
      // Non-serialized items (e.g. wafers, snacks, FMCG, groceries) must stay completely silent.
      if (
        !product ||
        (product.is_serialized != null &&
          product.is_serialized !== "" &&
          Number(product.is_serialized) !== 1 &&
          product.is_serialized !== true &&
          product.is_serialized !== "1")
      ) {
        return;
      }
      const quantity = toNumber(line.quantity);
      const eligible = isEligibleProduct(product, context, filters);

      if (!eligible) {
        reportUntestableLine(invoice, customerName, line, product, quantity);
        return;
      }

      if (quantity === 0) return;

      const target = record(accumulators, {
        customerCode,
        branchId: invoice.branch_id,
        productId: line.product_id,
      });
      target.grossUnits += quantity;
      target.invoiceIds.add(String(invoice.invoice_id));
      if (invoice.salesman_id != null) {
        target.salesmanIds.add(String(invoice.salesman_id));
      }
      countedOnInvoice += quantity;

      const unitPrice = toNumber(line.unit_price);
      if (unitPrice > 0) {
        target.pricedUnits += quantity;
        target.lineValue += quantity * unitPrice;
        invoiceEligibleValue += quantity * unitPrice;
      } else {
        target.exceptionCodes.add("NO_RATE_SNAPSHOT" satisfies ExceptionCode);
        exceptions.push({
          code: "NO_RATE_SNAPSHOT",
          severity: "warning",
          customerCode: invoice.customer_code,
          customerName,
          referenceType: "INVOICE",
          referenceNo: invoice.invoice_no || String(invoice.invoice_id),
          detail: `Line ${line.detail_id} on invoice ${
            invoice.invoice_no ?? invoice.invoice_id
          } carries no unit price, so ${quantity} unit(s) earned nothing at the recorded rate.`,
          amount: null,
        });
      }
    });

    if (countedOnInvoice > 0 && documents) {
      // Document amount reflects the recorded total_amount on sales_invoice,
      // falling back to the calculated eligible line value.
      const docAmount =
        invoice.total_amount != null
          ? round2(toNumber(invoice.total_amount))
          : invoiceEligibleValue > 0
            ? round2(invoiceEligibleValue)
            : null;

      documents.push({
        documentType: "SALES_INVOICE",
        documentNo: invoice.invoice_no || String(invoice.invoice_id),
        date: dateOnly(invoice.invoice_date),
        amount: docAmount,
        status: invoice.transaction_status,
        detail: `${countedOnInvoice} eligible unit(s) delivered.`,
      });
    }
  });
}

/**
 * Deducts approved returns in their own period (§4's approved return
 * adjustments). Returns reduce the same customer/branch/product key the
 * invoice pass built.
 */
export function accumulateReturns(
  args: AccumulateArgs & {
    filters: AppliedFilterContext;
    returns: IncentiveSourceData["returns"];
    returnDetails: IncentiveSourceData["returnDetails"];
  }
): void {
  // A return that does deduct needs no exception of its own: the document
  // trail shows why a line has fewer eligible units than it was invoiced for.
  // A return held back for want of a posting is different — the reader would
  // otherwise see a deduction they expected simply missing.
  const { filters, context, returns, returnDetails, accumulators, exceptions } = args;
  const { documents } = args;

  const detailsByReturn = new Map<string, IncentiveSourceData["returnDetails"]>();
  returnDetails.forEach((detail) => {
    const bucket = detailsByReturn.get(String(detail.return_no));
    if (bucket) bucket.push(detail);
    else detailsByReturn.set(String(detail.return_no), [detail]);
  });

  returns.forEach((ret) => {
    // AG-FILTER: Only accumulate returns matching the requested branch filter.
    if (
      filters.branchIds &&
      filters.branchIds.length > 0 &&
      (ret.branch_id == null || !filters.branchIds.includes(ret.branch_id))
    ) {
      return;
    }

    const customerCode = normalizeCode(ret.customer_code);
    if (!customerCode || !isAcceptedDocument(ret.status)) return;

    // Only an explicit false is read as unposted. Null and absent still
    // deduct, because holding a return back would raise the earned figure —
    // and an inflated earned figure is what a payment gets released against.
    if (ret.isPosted !== null && ret.isPosted !== undefined && !isTruthyFlag(ret.isPosted)) {
      const held = (detailsByReturn.get(String(ret.return_number)) ?? []).reduce(
        (total, line) =>
          isAcceptedDocument(line.status) &&
          isEligibleProduct(context.products.get(String(line.product_id)), context, filters)
            ? total + toNumber(line.quantity)
            : total,
        0
      );
      if (held > 0) {
        exceptions.push({
          code: "UNPOSTED_RETURN_EXCLUDED",
          severity: "warning",
          customerCode: ret.customer_code,
          customerName: customerNameFor(context, customerCode, ret.customer_code),
          referenceType: "RETURN",
          referenceNo: ret.return_number,
          detail: `Return ${ret.return_number} is flagged unposted, so ${held} unit(s) were not deducted from eligible volume. Post it and re-run the window for the deduction to apply.`,
          amount: null,
        });
      }
      return;
    }

    let counted = 0;

    (detailsByReturn.get(String(ret.return_number)) ?? []).forEach((line) => {
      if (!isAcceptedDocument(line.status)) return;
      const product = context.products.get(String(line.product_id));
      // AG-FILTER: Only serialized industrial products can be considered for refill incentives.
      if (
        !product ||
        (product.is_serialized != null &&
          product.is_serialized !== "" &&
          Number(product.is_serialized) !== 1 &&
          product.is_serialized !== true &&
          product.is_serialized !== "1")
      ) {
        return;
      }
      if (!isEligibleProduct(product, context, filters)) return;

      const quantity = toNumber(line.quantity);
      if (quantity === 0) return;

      const target = record(accumulators, {
        customerCode,
        branchId: ret.branch_id,
        productId: line.product_id,
      });
      target.returnedUnits += quantity;
      target.returnNumbers.add(ret.return_number);
      counted += quantity;
    });

    if (counted === 0) return;

    // Document amount reflects the return's total_amount if recorded.
    const returnDocAmount =
      ret.total_amount != null
        ? round2(toNumber(ret.total_amount))
        : null;

    documents?.push({
      documentType: "SALES_RETURN",
      documentNo: ret.return_number,
      date: dateOnly(ret.return_date),
      amount: returnDocAmount,
      status: ret.status,
      detail: `${counted} eligible unit(s) returned and deducted.`,
    });
  });
}

// ------------------------------------------------------------
// Claims
// ------------------------------------------------------------

/** Money approved and settled for one customer, rolled up from its memos. */
export interface CustomerClaimMoney {
  customerCode: string;
  claimCount: number;
  approvedAmount: number;
  releasedAmount: number;
  statuses: Set<ClaimStatus>;
  memoNumbers: string[];
  paymentReferences: Set<string>;
  exceptionCodes: Set<string>;
}

export function newClaimMoney(customerCode: string): CustomerClaimMoney {
  return {
    customerCode,
    claimCount: 0,
    approvedAmount: 0,
    releasedAmount: 0,
    statuses: new Set(),
    memoNumbers: [],
    paymentReferences: new Set(),
    exceptionCodes: new Set(),
  };
}

/**
 * Folds customers_memo into claim summaries and per-customer money.
 *
 * A memo is the only place an approved or settled incentive figure exists, so
 * nothing here is modelled — an unrecognised status earns nothing and is
 * reported instead of being mapped to the nearest-looking business state.
 */
export function accumulateClaims(args: {
  context: ReportContext;
  money: Map<string, CustomerClaimMoney>;
  claims: IncentiveClaimSummary[];
  exceptions: ReportException[];
  documents?: SupportingDocument[];
  source: IncentiveSourceData;
}): void {
  const { context, money, claims, exceptions, source } = args;
  const { documents } = args;

  const transmittalsByMemo = new Map<string, IncentiveSourceData["memoTransmittals"]>();
  source.memoTransmittals.forEach((row) => {
    const bucket = transmittalsByMemo.get(String(row.memo_id));
    if (bucket) bucket.push(row);
    else transmittalsByMemo.set(String(row.memo_id), [row]);
  });

  const appliedByMemo = new Map<string, IncentiveSourceData["memoInvoices"]>();
  source.memoInvoices.forEach((row) => {
    const bucket = appliedByMemo.get(String(row.memo_id));
    if (bucket) bucket.push(row);
    else appliedByMemo.set(String(row.memo_id), [row]);
  });

  // §8 asks for duplicate-claim prevention. Two memos for the same customer
  // at the same amount are suspicious but not proof, so they are flagged and
  // left in the totals for a reviewer to adjudicate.
  const duplicateCounts = new Map<string, number>();
  source.memos.forEach((memo) => {
    if (isVoidedMemoStatus(memo.status)) return;
    const code =
      context.customerCodeById.get(String(memo.customer_id)) ?? `#${memo.customer_id}`;
    const key = `${normalizeCode(code)}|${round2(toNumber(memo.amount))}`;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  });

  source.memos.forEach((memo) => {
    if (isVoidedMemoStatus(memo.status)) return;
    if (memo.deleted_at) return;

    const resolvedCode = context.customerCodeById.get(String(memo.customer_id));
    const customerCode = resolvedCode ?? `#${memo.customer_id}`;
    const customerName = resolvedCode
      ? customerNameFor(context, resolvedCode)
      : `Customer #${memo.customer_id}`;

    if (!resolvedCode) {
      exceptions.push({
        code: "MEMO_WITHOUT_CUSTOMER",
        severity: "warning",
        customerCode: null,
        customerName,
        referenceType: "MEMO",
        referenceNo: memo.memo_number,
        detail: `Memo ${memo.memo_number} references customer_id ${memo.customer_id}, which is not in the customer master, so it cannot be attributed to a branch or a scheme.`,
        amount: round2(toNumber(memo.amount)),
      });
    }

    const memoStatus = toClaimStatus(memo.status);
    if (!memoStatus) {
      exceptions.push({
        code: "MEMO_STATUS_UNRECOGNISED",
        severity: "critical",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: memo.memo_number,
        detail: `Memo ${memo.memo_number} carries status "${
          memo.status ?? "empty"
        }", which is outside the approved lifecycle. It is shown but excluded from approved and released totals.`,
        amount: round2(toNumber(memo.amount)),
      });
      return;
    }

    const bucket = transmittalsByMemo.get(String(memo.id)) ?? [];
    const transmittalTotal = bucket.reduce(
      (sum, row) => sum + toNumber(row.paid_amount),
      0
    );
    const approvedAmount = round2(toNumber(memo.amount));
    const releasedAmount = round2(
      releasedAmountOf(toNumber(memo.applied_amount), transmittalTotal)
    );
    const claimStatus = deriveClaimStatus(
      memoStatus,
      approvedAmount,
      releasedAmount
    );

    const paymentReferences = bucket
      .map((row) => row.transmittal_no)
      .filter((value): value is string => Boolean(value));

    const claim: IncentiveClaimSummary = {
      memoNumber: memo.memo_number,
      claimStatus,
      statusLabel: claimStatusLabel(claimStatus),
      approvedAmount,
      releasedAmount,
      reason: memo.reason?.trim() || null,
      createdAt: dateOnly(memo.created_at),
      updatedAt: dateOnly(memo.updated_at),
      accountTitle: context.accounts.get(String(memo.chart_of_account)) || null,
      paymentReferences,
    };
    claims.push(claim);

    documents?.push({
      documentType: "CUSTOMER_MEMO",
      documentNo: memo.memo_number,
      date: dateOnly(memo.created_at),
      amount: approvedAmount,
      status: memo.status,
      detail: `${claim.statusLabel}${memo.reason ? ` — ${memo.reason}` : ""}`,
    });
    bucket.forEach((row) => {
      documents?.push({
        documentType: "TRANSMITTAL",
        documentNo: row.transmittal_no || String(row.id),
        date: dateOnly(row.received_at),
        amount: round2(toNumber(row.paid_amount)),
        status: null,
        detail: `Settled against memo ${memo.memo_number}${
          row.transmitted_to ? ` (${row.transmitted_to})` : ""
        }.`,
      });
    });

    const entry = money.get(normalizeCode(customerCode)) ?? newClaimMoney(customerCode);
    money.set(normalizeCode(customerCode), entry);
    entry.claimCount += 1;
    entry.approvedAmount += approvedAmount;
    entry.releasedAmount += releasedAmount;
    entry.statuses.add(claimStatus);
    entry.memoNumbers.push(memo.memo_number);
    paymentReferences.forEach((reference) => entry.paymentReferences.add(reference));

    if (releasedAmount > approvedAmount && approvedAmount > 0) {
      entry.exceptionCodes.add("OVER_RELEASED" satisfies ExceptionCode);
      exceptions.push({
        code: "OVER_RELEASED",
        severity: "critical",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: memo.memo_number,
        detail: `Released ${releasedAmount.toFixed(2)} exceeds the approved ${approvedAmount.toFixed(
          2
        )} on this memo — settlement is ahead of approval.`,
        amount: round2(releasedAmount - approvedAmount),
      });
    }

    if ((duplicateCounts.get(`${normalizeCode(customerCode)}|${approvedAmount}`) ?? 0) > 1) {
      entry.exceptionCodes.add("DUPLICATE_MEMO_SUSPECTED" satisfies ExceptionCode);
      exceptions.push({
        code: "DUPLICATE_MEMO_SUSPECTED",
        severity: "warning",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: memo.memo_number,
        detail: `Another memo for this customer carries the same ${approvedAmount.toFixed(
          2
        )} amount. Confirm this is not a duplicate payout before releasing.`,
        amount: approvedAmount,
      });
    }

    appliedByMemo.get(String(memo.id))?.forEach((row) => {
      if (row.invoice_id == null || context.windowInvoiceIds.has(String(row.invoice_id))) return;
      exceptions.push({
        code: "MEMO_OUTSIDE_WINDOW",
        severity: "info",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: memo.memo_number,
        detail: `Memo ${memo.memo_number} was applied to invoice id ${row.invoice_id}, which sits outside the selected period. Eligibility is measured on the window; the settlement is not.`,
        amount: round2(toNumber(row.amount)),
      });
    });
  });
}

// ------------------------------------------------------------
// Finalisation
// ------------------------------------------------------------

function finalizeEvidence(
  acc: EvidenceAccumulator,
  context: ReportContext,
  sizeKg: number
): CustomerIncentiveEvidence {
  const eligibleUnits = Math.max(0, acc.grossUnits - acc.returnedUnits);
  const product = context.products.get(String(acc.productId));
  // The product's own size, not the filter's, is what the kg are counted in:
  // a category-scoped row must still reconcile if the reader widen the filter.
  const unitKg = resolveProductSizeKg(product, context);
  const weight = unitKg ?? sizeKg;

  const eligibleKg = round2(eligibleUnits * weight);
  const returnedValue = acc.pricedUnits > 0
    ? safeRatio(acc.lineValue, acc.pricedUnits) * acc.returnedUnits
    : 0;

  // The recorded line value covers every priced unit, gross of the returns
  // deducted below, so earned is the net of the two.
  const grossValue = round2(acc.lineValue);
  const adjustmentAmount = round2(Math.min(returnedValue, grossValue));

  return {
    branchId: acc.branchId,
    branchName:
      acc.branchId == null
        ? "Unassigned"
        : context.branches.get(String(acc.branchId)) ?? `Branch ${acc.branchId}`,
    productId: acc.productId,
    productCode: product?.product_code ?? String(acc.productId),
    productName: product?.product_name ?? `Product ${acc.productId}`,
    sizeKg: unitKg,
    grossUnits: acc.grossUnits,
    returnedUnits: acc.returnedUnits,
    eligibleUnits,
    eligibleKg,
    ratePerKg:
      acc.pricedUnits > 0 && eligibleKg > 0
        ? round2(safeRatio(grossValue - adjustmentAmount, eligibleKg))
        : null,
    earnedAmount: round2(grossValue - adjustmentAmount),
    adjustmentAmount,
    invoiceCount: acc.invoiceIds.size,
    returnCount: acc.returnNumbers.size,
    salesmanNames: [
      ...new Set(
        [...acc.salesmanIds].map((id) => context.salesmen.get(id) ?? `Salesman ${id}`)
      ),
    ],
    exceptionCodes: [...acc.exceptionCodes],
  };
}

/** Most advanced status, so a settled customer never reads as still pending. */
export function rollUpStatuses(statuses: Set<ClaimStatus>): ClaimStatus | "NO_CLAIM" {
  if (statuses.size === 0) return "NO_CLAIM";
  let best: ClaimStatus | null = null;
  statuses.forEach((status) => {
    if (best == null || STATUS_RANK[status] > STATUS_RANK[best]) best = status;
  });
  return best ?? "NO_CLAIM";
}

/**
 * Turns the accumulator index into the customer-level table. Evidence stays
 * per branch/product because that is where the documents live; the money
 * stays at customer level because that is where the memo is approved.
 */
export function finalizeRows(
  filters: AppliedFilterContext,
  context: ReportContext,
  accumulators: Map<string, EvidenceAccumulator>,
  money: Map<string, CustomerClaimMoney>,
  exceptions: ReportException[]
): CustomerIncentiveRow[] {
  const sizeKg = filters.sizeKg ? resolveSizeKg(filters.sizeKg) : 0;

  const byCustomer = new Map<string, EvidenceAccumulator[]>();
  accumulators.forEach((acc) => {
    const key = normalizeCode(acc.customerCode);
    const bucket = byCustomer.get(key);
    if (bucket) bucket.push(acc);
    else byCustomer.set(key, [acc]);
  });

  const codes = new Set([...byCustomer.keys(), ...money.keys()]);
  const rows: CustomerIncentiveRow[] = [];

  codes.forEach((code) => {
    const evidence = (byCustomer.get(code) ?? [])
      .map((acc) => finalizeEvidence(acc, context, sizeKg))
      .sort((a, b) => b.earnedAmount - a.earnedAmount);

    const entry = money.get(code) ?? newClaimMoney(code);
    const customer = context.customersByCode.get(code);
    const customerCode = customer ? code : entry.customerCode;
    const customerName = customer?.customer_name ?? customerCode;

    const grossUnits = evidence.reduce((sum, row) => sum + row.grossUnits, 0);
    const returnedUnits = evidence.reduce((sum, row) => sum + row.returnedUnits, 0);
    const eligibleUnits = evidence.reduce((sum, row) => sum + row.eligibleUnits, 0);
    const eligibleKg = round2(evidence.reduce((sum, row) => sum + row.eligibleKg, 0));
    const earnedAmount = round2(evidence.reduce((sum, row) => sum + row.earnedAmount, 0));
    const adjustmentAmount = round2(
      evidence.reduce((sum, row) => sum + row.adjustmentAmount, 0)
    );

    // Suppress zero-value phantom rows: If a customer has no incentive claims and
    // no eligible/invoiced cylinder units (for example, if they only had exceptions
    // or zero gross units), they do not belong in the customer incentive results table.
    if (entry.claimCount === 0 && grossUnits === 0 && returnedUnits === 0) {
      return;
    }

    // AG-FILTER: If a branch filter is explicitly applied, a customer with zero eligible evidence
    // in this branch (and not explicitly selected by customer code) does not belong
    // in this branch's report.
    const isBranchFiltered = (filters.branchIds?.length ?? 0) > 0;
    const isCustomerExplicitlySelected =
      (filters.customerCodes?.length ?? 0) > 0 &&
      filters.customerCodes!.includes(customerCode);

    if (isBranchFiltered && evidence.length === 0 && !isCustomerExplicitlySelected) {
      return;
    }

    const exceptionCodes = new Set<string>();
    evidence.forEach((row) => row.exceptionCodes.forEach((value) => exceptionCodes.add(value)));
    entry.exceptionCodes.forEach((value) => exceptionCodes.add(value));

    if (returnedUnits > grossUnits) {
      exceptionCodes.add("RETURNED_UNITS_EXCEEDED" satisfies ExceptionCode);
      exceptions.push({
        code: "RETURNED_UNITS_EXCEEDED",
        severity: "warning",
        customerCode,
        customerName,
        referenceType: "INVOICE",
        referenceNo: customerCode,
        detail: `Returns (${returnedUnits}) exceed invoiced units (${grossUnits}) in this window, so eligibility is floored at zero.`,
        amount: null,
      });
    }

    const approvedAmount = round2(entry.approvedAmount);
    const releasedAmount = round2(entry.releasedAmount);

    if (approvedAmount > 0 && eligibleKg === 0) {
      exceptionCodes.add("MEMO_WITHOUT_EVIDENCE" satisfies ExceptionCode);
      exceptions.push({
        code: "MEMO_WITHOUT_EVIDENCE",
        severity: "critical",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: entry.memoNumbers[0] ?? customerCode,
        detail: `${approvedAmount.toFixed(
          2
        )} approved with no eligible refill evidence in the window — the claim cannot be substantiated from invoiced volume.`,
        amount: approvedAmount,
      });
    }

    const claimStatus = rollUpStatuses(entry.statuses);
    const branchNames = [...new Set(evidence.map((row) => row.branchName))];
    // AG-AUDIT: If there is no branch evidence or branch is Unassigned, flag BRANCH_UNRESOLVED.
    if (branchNames.length === 0 || branchNames.includes("Unassigned")) {
      exceptionCodes.add("BRANCH_UNRESOLVED" satisfies ExceptionCode);
      exceptions.push({
        code: "BRANCH_UNRESOLVED",
        severity: "warning",
        customerCode,
        customerName,
        referenceType: "MEMO",
        referenceNo: entry.memoNumbers[0] ?? customerCode,
        detail: `Customer ${customerName} carries no fulfilling branch on their transactions in this window — memo attribution is unassigned.`,
        amount: approvedAmount,
      });
    }

    const salesmanNames = [
      ...new Set(
        (byCustomer.get(code) ?? [])
          .flatMap((acc) => [...acc.salesmanIds])
          .map((id) => context.salesmen.get(id) ?? `Salesman ${id}`)
      ),
    ];

    rows.push({
      customerCode,
      customerName,
      storeName: customer?.store_name ?? "",
      classificationName:
        context.classifications.get(String(customer?.classification ?? "")) ?? "Unclassified",
      branchNames,
      salesmanNames,
      grossUnits,
      returnedUnits,
      eligibleUnits,
      eligibleKg,
      ratePerKg:
        eligibleKg > 0 && earnedAmount > 0 ? round2(safeRatio(earnedAmount, eligibleKg)) : null,
      rateIsKnown: evidence.some((row) => row.ratePerKg != null),
      earnedAmount,
      adjustmentAmount,
      claimCount: entry.claimCount,
      approvedAmount,
      releasedAmount,
      outstandingAmount: round2(Math.max(0, approvedAmount - releasedAmount)),
      varianceAmount: round2(approvedAmount - earnedAmount),
      impliedRatePerKg:
        eligibleKg > 0 && approvedAmount > 0
          ? round2(safeRatio(approvedAmount, eligibleKg))
          : null,
      claimStatus,
      statusLabel: claimStatusLabel(claimStatus),
      claimStatuses: [...entry.statuses].sort(
        (a, b) => STATUS_RANK[b] - STATUS_RANK[a]
      ),
      memoNumbers: entry.memoNumbers,
      paymentReferences: [...entry.paymentReferences],
      exceptionCodes: [...exceptionCodes],
      evidence,
    });
  });

  const sorted = rows.sort((a, b) => {
    const byName = a.customerName.localeCompare(b.customerName);
    if (byName !== 0) return byName;
    return b.approvedAmount - a.approvedAmount;
  });

  const wanted = filters.claimStatus;
  if (!wanted) return sorted;

  // A status cut removes customers from the whole answer, not only from the
  // grid, so their exceptions go with them — otherwise the two tabs would
  // describe different sets of customers while claiming one filter.
  const kept = sorted.filter((row) => row.claimStatus === wanted);
  const visible = new Set(kept.map((row) => row.customerCode));
  for (let index = exceptions.length - 1; index >= 0; index -= 1) {
    const code = exceptions[index].customerCode;
    if (code && !visible.has(code)) exceptions.splice(index, 1);
  }
  return kept;
}

/** KPI strip totals. Every figure is a sum over the displayed rows. */
export function buildOverview(
  rows: CustomerIncentiveRow[],
  exceptions: ReportException[]
): IncentiveOverview {
  const claimCounts: Record<ClaimStatus, number> = {
    FOR_REVIEW: 0,
    APPROVED: 0,
    PARTIALLY_RELEASED: 0,
    RELEASED: 0,
    REJECTED: 0,
  };

  rows.forEach((row) => {
    row.claimStatuses.forEach((status) => {
      claimCounts[status] += 1;
    });
  });

  return {
    customerCount: rows.filter((row) => row.claimCount > 0 || row.eligibleKg > 0).length,
    rowRowCount: rows.length,
    eligibleUnits: round2(rows.reduce((sum, row) => sum + row.eligibleUnits, 0)),
    eligibleKg: round2(rows.reduce((sum, row) => sum + row.eligibleKg, 0)),
    earnedAmount: round2(rows.reduce((sum, row) => sum + row.earnedAmount, 0)),
    adjustmentAmount: round2(
      rows.reduce((sum, row) => sum + row.adjustmentAmount, 0)
    ),
    approvedAmount: round2(rows.reduce((sum, row) => sum + row.approvedAmount, 0)),
    releasedAmount: round2(rows.reduce((sum, row) => sum + row.releasedAmount, 0)),
    outstandingAmount: round2(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)),
    varianceAmount: round2(rows.reduce((sum, row) => sum + row.varianceAmount, 0)),
    claimCounts,
    exceptionCount: exceptions.length,
  };
}

export { CLAIM_STATUS_LABELS };
