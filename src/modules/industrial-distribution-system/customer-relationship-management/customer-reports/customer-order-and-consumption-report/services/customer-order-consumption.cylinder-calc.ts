// ============================================================
// customer-order-consumption.cylinder-calc.ts
// CYLINDER channel: purchased volume from sales_invoice lines, with
// accepted sales_return lines deducted. Only serialized products in
// industrial categories are in scope; kg is a PROXY (qty x cylinder size
// from the product category, with product_weight as fallback) — there is no
// meter or weighbridge behind these rows.
// Pure function: the repo layer supplies the already-fetched rows.
// ============================================================

import type {
  CustomerOrderConsumptionFilters,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawPostDispatchRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-order-consumption.types";
import {
  type ConsumptionContext,
  type RowAccumulator,
  accumulateMonth,
  cylinderProductScope,
  ensureAccumulator,
  exception,
  isRejected,
  resolveLineKg,
  withinWindow,
} from "./customer-order-consumption.calc";
import {
  dateOnly,
  isTruthyFlag,
  normalizeStatus,
  selectionSet,
  toNumber,
} from "./customer-order-consumption.helpers";

export interface CylinderCalcInput {
  filters: CustomerOrderConsumptionFilters;
  context: ConsumptionContext;
  invoices: RawInvoiceRow[];
  invoiceDetails: RawInvoiceDetailRow[];
  returns: RawReturnRow[];
  returnDetails: RawReturnDetailRow[];
  returnLinks: RawReturnLinkRow[];
  postDispatch: RawPostDispatchRow[];
  /** null = every customer passes; otherwise pre-filtered by classification. */
  allowedCustomerCodes: Set<string> | null;
  accumulators: Map<string, RowAccumulator>;
  exceptions: ReportException[];
  /** Drill-down only: collect the human-readable documents behind the rows. */
  documents?: SupportingDocument[];
}

/** An invoice is only a real purchase event when it carries a customer. */
function invoiceCustomerCode(invoice: RawInvoiceRow): string | null {
  const code = String(invoice.customer_code ?? "").trim();
  return code ? code : null;
}

/**
 * One ordering event, not one document. A sales order split across two
 * invoices must still read as a single buy, otherwise the frequency metric
 * the ticket asks for drifts with the billing layout.
 */
function orderEventKey(invoice: RawInvoiceRow): string {
  const order = String(invoice.order_id ?? "").trim();
  return order ? `SO:${order}` : `INV:${invoice.invoice_id}`;
}

/**
 * post_dispatch_invoices carries the delivery verdict the invoice header
 * does not. Absence is normal (most invoices never reach this table), so
 * only an explicit "Not Fulfilled" suppresses the quantities.
 */
function buildDeliveryStatuses(
  rows: RawPostDispatchRow[]
): Map<number, string> {
  const statuses = new Map<number, string>();
  for (const row of rows) {
    if (row.invoice_id == null) continue;
    statuses.set(row.invoice_id, normalizeStatus(row.status));
  }
  return statuses;
}

/**
 * A return raised against an undelivered invoice cannot be real gas coming
 * back, so the same suppression has to reach the return side or the row ends
 * up with negative demand and no purchase behind it.
 */
function suppressedInvoiceIds(deliveryStatuses: Map<number, string>): Set<number> {
  const ids = new Set<number>();
  for (const [invoiceId, status] of deliveryStatuses) {
    if (status === "not fulfilled") ids.add(invoiceId);
  }
  return ids;
}

function groupDetailsByKey<T>(
  rows: T[],
  keyOf: (row: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

/**
 * Folds fulfilled sales and accepted returns into the CYLINDER half of the
 * report. Mutates `accumulators`, `exceptions` and `documents` in place so
 * one pass over the rows is enough.
 */
export function accumulateCylinder(input: CylinderCalcInput): void {
  const {
    filters,
    context,
    accumulators,
    exceptions,
    allowedCustomerCodes,
    documents,
  } = input;

  // Each picker is a multi-select. An empty selection leaves the gate null so
  // neither row loop pays for a lookup it does not need.
  const onlyCustomers = selectionSet(filters.customerCodes);
  const onlyBranches = selectionSet(filters.branchIds);
  const onlySalesmen = selectionSet(filters.salesmanIds);

  // A document with no branch or salesman cannot survive a selection: it is
  // not one of the picked branches, rather than an unknown one.
  const branchPicked = (value: number | null): boolean =>
    !onlyBranches || (value != null && onlyBranches.has(toNumber(value)));
  const salesmanPicked = (value: number | null): boolean =>
    !onlySalesmen || (value != null && onlySalesmen.has(toNumber(value)));

  const invoicesById = new Map<number, RawInvoiceRow>(
    input.invoices.map((invoice) => [invoice.invoice_id, invoice])
  );
  const deliveryStatuses = buildDeliveryStatuses(input.postDispatch);
  const notFulfilled = suppressedInvoiceIds(deliveryStatuses);
  const detailsByInvoice = groupDetailsByKey(
    input.invoiceDetails,
    (detail) => String(detail.invoice_no)
  );
  const detailsByReturn = groupDetailsByKey(
    input.returnDetails,
    (detail) => String(detail.return_no)
  );
  // return_id -> the invoices that return was raised against. Used only to
  // recover a branch when the return row itself has none, and to keep the
  // adjustment reference the ticket requires.
  const linksByReturn = groupDetailsByKey(
    input.returnLinks,
    (link) => String(link.return_no)
  );

  for (const invoice of input.invoices) {
    const customerCode = invoiceCustomerCode(invoice);
    if (!customerCode) continue;
    if (onlyCustomers && !onlyCustomers.has(customerCode)) continue;
    if (allowedCustomerCodes && !allowedCustomerCodes.has(customerCode)) continue;
    if (!withinWindow(invoice.invoice_date, filters.startDate, filters.endDate)) continue;
    if (isRejected(invoice.transaction_status, invoice.isReplaced)) continue;
    if (!branchPicked(invoice.branch_id)) continue;
    if (!salesmanPicked(invoice.salesman_id)) continue;

    const lines = detailsByInvoice.get(String(invoice.invoice_id)) ?? [];
    if (lines.length === 0) continue;

    const delivery = deliveryStatuses.get(invoice.invoice_id);
    const suppressed = delivery === "not fulfilled";
    if (suppressed) {
      exceptions.push(
        exception({
          code: "NOT_FULFILLED_DELIVERY",
          channel: "CYLINDER",
          customerCode,
          customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
          referenceType: "SALES_INVOICE",
          referenceNo: invoice.invoice_no ?? String(invoice.invoice_id),
          detail: "Dispatch recorded the delivery as Not Fulfilled; quantities excluded.",
        })
      );
      continue;
    }

    if (delivery === "fulfilled with concerns") {
      exceptions.push(
        exception({
          code: "FULFILLED_WITH_CONCERNS",
          channel: "CYLINDER",
          customerCode,
          customerName: context.customers.get(customerCode)?.customer_name ?? customerCode,
          referenceType: "SALES_INVOICE",
          referenceNo: invoice.invoice_no ?? String(invoice.invoice_id),
          detail: "Delivery completed with concerns; quantities are included.",
        })
      );
    }

    const orderKey = orderEventKey(invoice);
    let invoiceQty = 0;
    let invoiceKg = 0;

    for (const line of lines) {
      const quantity = toNumber(line.quantity);
      if (quantity === 0) continue;

      const scope = cylinderProductScope(line.product_id, context);
      if (scope !== "included") {
        // A missing master row or category cannot be proven to be an
        // industrial cylinder, so the line stays out of the table but is
        // disclosed instead of dropped.
        if (scope === "missing" || scope === "missing_category") {
          exceptions.push(
            exception({
              code:
                scope === "missing"
                  ? "MISSING_PRODUCT_WEIGHT"
                  : "MISSING_PRODUCT_CATEGORY",
              channel: "CYLINDER",
              customerCode,
              customerName:
                context.customers.get(customerCode)?.customer_name ?? customerCode,
              referenceType: "SALES_INVOICE",
              referenceNo: invoice.invoice_no ?? String(invoice.invoice_id),
              detail:
                scope === "missing"
                  ? "Product master row not found"
                  : "Product is not linked to a fetched category",
              quantity,
            })
          );
        }
        continue;
      }

      const resolved = resolveLineKg(quantity, line.product_id, line.unit, context);
      const acc = ensureAccumulator(accumulators, {
        customerCode,
        branchId: invoice.branch_id ?? null,
        channel: "CYLINDER",
        productId: line.product_id,
      });

      if (resolved.unitLabel) acc.quantityUnit = resolved.unitLabel;
      if (resolved.exception) {
        acc.exceptionCodes.add(resolved.exception);
        if (resolved.detail) {
          exceptions.push(
            exception({
              code: resolved.exception,
              channel: "CYLINDER",
              customerCode,
              customerName:
                context.customers.get(customerCode)?.customer_name ?? customerCode,
              referenceType: "SALES_INVOICE",
              referenceNo: invoice.invoice_no ?? String(invoice.invoice_id),
              detail: resolved.detail,
              quantity,
            })
          );
        }
      }

      acc.netAmount += toNumber(line.gross_amount ?? line.total_amount);
      accumulateMonth(acc, invoice.invoice_date, {
        orderKey,
        qty: quantity,
        kg: resolved.kg,
      });
      invoiceQty += quantity;
      invoiceKg += resolved.kg;
    }

    // A document whose lines were all out of scope would appear in the
    // drill-down with zero movement, implying it contributed to the row.
    if (invoiceQty !== 0 || invoiceKg !== 0) {
      documents?.push({
        documentType: "SALES_INVOICE",
        documentNo: invoice.invoice_no ?? String(invoice.invoice_id),
        date: dateOnly(invoice.invoice_date),
        status: invoice.transaction_status ?? "",
        quantity: invoiceQty,
        kg: invoiceKg,
        amount: toNumber(invoice.net_amount ?? invoice.gross_amount),
        reference: String(invoice.order_id ?? ""),
      });
    }
  }

  for (const ret of input.returns) {
    const customerCode = String(ret.customer_code ?? "").trim();
    if (!customerCode) continue;
    if (onlyCustomers && !onlyCustomers.has(customerCode)) continue;
    if (allowedCustomerCodes && !allowedCustomerCodes.has(customerCode)) continue;
    if (!withinWindow(ret.return_date, filters.startDate, filters.endDate)) continue;
    // deleted_at is a soft-delete stamp; isPosted is nullable, so only an
    // explicit false rejects the document.
    if (ret.deleted_at) continue;
    if (isRejected(ret.status)) continue;
    if (ret.isPosted !== undefined && !isTruthyFlag(ret.isPosted)) continue;
    if (!branchPicked(ret.branch_id)) continue;
    if (!salesmanPicked(ret.salesman_id)) continue;

    const lines = detailsByReturn.get(String(ret.return_number)) ?? [];
    if (lines.length === 0) continue;

    // sales_invoice_sales_return.invoice_no holds the invoice id, so a return
    // raised against a suppressed delivery is dropped with it.
    const links = linksByReturn.get(String(ret.return_id)) ?? [];
    if (links.some((link) => notFulfilled.has(link.invoice_no))) continue;

    const branchId = resolveReturnBranch(ret, linksByReturn, invoicesById);
    if (branchId == null && onlyBranches) continue;

    let returnQty = 0;
    let returnKg = 0;

    for (const line of lines) {
      const quantity = toNumber(line.quantity);
      if (quantity === 0) continue;
      if (isRejected(line.status)) continue;

      const scope = cylinderProductScope(line.product_id, context);
      if (scope !== "included") {
        if (scope === "missing" || scope === "missing_category") {
          exceptions.push(
            exception({
              code:
                scope === "missing"
                  ? "MISSING_PRODUCT_WEIGHT"
                  : "MISSING_PRODUCT_CATEGORY",
              channel: "CYLINDER",
              customerCode,
              customerName:
                context.customers.get(customerCode)?.customer_name ?? customerCode,
              referenceType: "SALES_RETURN",
              referenceNo: ret.return_number,
              detail:
                scope === "missing"
                  ? "Product master row not found"
                  : "Product is not linked to a fetched category",
              quantity,
            })
          );
        }
        continue;
      }

      // sales_return_details has no unit column, so kg is always the
      // cylinder-size proxy and never a billed-in-kg quantity.
      const resolved = resolveLineKg(quantity, line.product_id, null, context);
      const acc = ensureAccumulator(accumulators, {
        customerCode,
        branchId,
        channel: "CYLINDER",
        productId: line.product_id,
      });

      if (resolved.unitLabel) acc.quantityUnit = resolved.unitLabel;
      if (resolved.exception) {
        acc.exceptionCodes.add(resolved.exception);
        if (resolved.detail) {
          exceptions.push(
            exception({
              code: resolved.exception,
              channel: "CYLINDER",
              customerCode,
              customerName:
                context.customers.get(customerCode)?.customer_name ?? customerCode,
              referenceType: "SALES_RETURN",
              referenceNo: ret.return_number,
              detail: resolved.detail,
              quantity,
            })
          );
        }
      }

      acc.netAmount -= toNumber(line.gross_amount ?? line.total_amount);
      // Returns carry no order of their own: they reduce the previously
      // counted quantity without creating a new ordering event.
      accumulateMonth(acc, ret.return_date, {
        returnedQty: quantity,
        returnedKg: resolved.kg,
      });
      returnQty += quantity;
      returnKg += resolved.kg;
    }

    if (returnQty !== 0 || returnKg !== 0) {
      documents?.push({
        documentType: "SALES_RETURN",
        documentNo: ret.return_number,
        date: dateOnly(ret.return_date),
        status: ret.status ?? "",
        quantity: -returnQty,
        kg: -returnKg,
        amount: -toNumber(ret.gross_amount),
        reference: linkedInvoiceNos(linksByReturn, ret.return_id).join(", "),
      });
    }
  }
}

/**
 * A return posted against another branch would flip the sign on the wrong
 * row, so fall back to the branch of the linked invoice before giving up.
 */
function resolveReturnBranch(
  ret: RawReturnRow,
  linksByReturn: Map<string, RawReturnLinkRow[]>,
  invoicesById: Map<number, RawInvoiceRow>
): number | null {
  if (ret.branch_id != null) return ret.branch_id;
  for (const link of linksByReturn.get(String(ret.return_id)) ?? []) {
    const branchId = invoicesById.get(link.invoice_no)?.branch_id;
    if (branchId != null) return branchId;
  }
  return null;
}

function linkedInvoiceNos(
  linksByReturn: Map<string, RawReturnLinkRow[]>,
  returnId: number
): string[] {
  return (linksByReturn.get(String(returnId)) ?? []).map(
    (link) => String(link.invoice_no)
  );
}
