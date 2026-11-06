import assert from "node:assert/strict";
import test from "node:test";

import { buildContext, finalizeRow, type RowAccumulator } from "./customer-order-consumption.calc";
import { accumulateCylinder } from "./customer-order-consumption.cylinder-calc";
import {
  category,
  filters,
  invoice,
  invoiceDetail,
  masters,
  postDispatch,
  product,
  returnDetail,
  returnLink,
  salesReturn,
  source,
  unit,
} from "./customer-order-consumption.test-fixtures";
import type {
  ConsumptionSourceData,
  CustomerOrderConsumptionRow,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawPostDispatchRow,
  RawReturnDetailRow,
  RawReturnLinkRow,
  RawReturnRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-order-consumption.types";

interface RunInput {
  filters?: ReturnType<typeof filters>;
  invoices?: RawInvoiceRow[];
  invoiceDetails?: RawInvoiceDetailRow[];
  returns?: RawReturnRow[];
  returnDetails?: RawReturnDetailRow[];
  returnLinks?: RawReturnLinkRow[];
  postDispatch?: RawPostDispatchRow[];
  allowedCustomerCodes?: Set<string> | null;
  masters?: Partial<ConsumptionSourceData>;
  withDocuments?: boolean;
}

/** Runs the CYLINDER pass only, then freezes the accumulators into rows. */
function run(input: RunInput): {
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  documents: SupportingDocument[];
} {
  const context = buildContext(source(masters({ ...(input.masters ?? {}) })));
  const accumulators = new Map<string, RowAccumulator>();
  const exceptions: ReportException[] = [];
  const documents: SupportingDocument[] = [];

  accumulateCylinder({
    filters: input.filters ?? filters(),
    context,
    invoices: input.invoices ?? [],
    invoiceDetails: input.invoiceDetails ?? [],
    returns: input.returns ?? [],
    returnDetails: input.returnDetails ?? [],
    returnLinks: input.returnLinks ?? [],
    postDispatch: input.postDispatch ?? [],
    allowedCustomerCodes: input.allowedCustomerCodes ?? null,
    accumulators,
    exceptions,
    documents: input.withDocuments ? documents : undefined,
  });

  return {
    rows: [...accumulators.values()].map((acc) => finalizeRow(acc, context)),
    exceptions,
    documents,
  };
}

/** One invoice of 10 x 12 kg cylinders with an accepted return of 2. */
const saleAndReturn = () => ({
  invoices: [invoice()],
  invoiceDetails: [invoiceDetail()],
  returns: [salesReturn()],
  returnDetails: [returnDetail()],
});

test("counts the fulfilled purchase once and subtracts the accepted return", () => {
  const { rows } = run(saleAndReturn());
  assert.equal(rows.length, 1);
  const row = rows[0] as CustomerOrderConsumptionRow;

  assert.equal(row.orderCount, 1, "a return is not a buying event");
  assert.equal(row.grossQty, 10);
  assert.equal(row.returnedQty, 2);
  assert.equal(row.netQty, 8);
  assert.equal(row.grossKg, 120);
  assert.equal(row.returnedKg, 24);
  assert.equal(row.netKg, 96, "ticket s4: purchased volume minus accepted returns");
  assert.equal(row.channel, "CYLINDER");
  assert.equal(row.kgIsProxy, true);
});

test("nets the amount between the sale and the return", () => {
  const { rows } = run(saleAndReturn());
  assert.equal(rows[0]?.netAmount, 800);
});

test("treats one sales order split over two invoices as one buying event", () => {
  const { rows } = run({
    invoices: [
      invoice({ invoice_id: 1, order_id: "SO-7", invoice_date: "2026-01-10" }),
      invoice({ invoice_id: 2, order_id: "SO-7", invoice_no: "SI-0002", invoice_date: "2026-01-11" }),
    ],
    invoiceDetails: [
      invoiceDetail({ invoice_no: 1, quantity: 6 }),
      invoiceDetail({ invoice_no: 2, detail_id: 2, quantity: 4 }),
    ],
  });

  assert.equal(rows[0]?.orderCount, 1);
  assert.equal(rows[0]?.grossQty, 10);
});

test("counts separate sales orders separately", () => {
  const { rows } = run({
    invoices: [
      invoice({ invoice_id: 1, order_id: "SO-1" }),
      invoice({ invoice_id: 2, order_id: "SO-2", invoice_date: "2026-01-20" }),
    ],
    invoiceDetails: [invoiceDetail({ invoice_no: 1 }), invoiceDetail({ invoice_no: 2, detail_id: 2 })],
  });
  assert.equal(rows[0]?.orderCount, 2);
});

test("an order-less invoice falls back to the invoice itself as the event", () => {
  const { rows } = run({
    invoices: [invoice({ order_id: null }), invoice({ invoice_id: 2, order_id: null })],
    invoiceDetails: [invoiceDetail(), invoiceDetail({ invoice_no: 2, detail_id: 2 })],
  });
  assert.equal(rows[0]?.orderCount, 2);
});

test("skips cancelled, voided and replacement prints", () => {
  for (const patch of [
    { transaction_status: "cancelled" },
    { transaction_status: "VOIDED" },
    { isReplaced: true },
  ]) {
    const { rows, documents } = run({
      invoices: [invoice(patch)],
      invoiceDetails: [invoiceDetail()],
    });
    assert.equal(rows.length, 0, JSON.stringify(patch));
    assert.equal(documents.length, 0);
  }
});

test("respects both ends of the reporting window", () => {
  for (const date of ["2026-01-01", "2026-01-31"]) {
    const { rows } = run({
      invoices: [invoice({ invoice_date: date })],
      invoiceDetails: [invoiceDetail()],
    });
    assert.equal(rows.length, 1, date);
  }

  for (const date of ["2025-12-31", "2026-02-01", null]) {
    const { rows } = run({
      invoices: [invoice({ invoice_date: date })],
      invoiceDetails: [invoiceDetail()],
    });
    assert.equal(rows.length, 0, String(date));
  }
});

test("suppresses a delivery dispatch recorded as not fulfilled", () => {
  const { rows, exceptions } = run({
    ...saleAndReturn(),
    returnLinks: [returnLink()],
    postDispatch: [postDispatch({ status: "Not Fulfilled" })],
  });
  assert.equal(rows.length, 0, "nothing was delivered, so nothing can be returned");
  assert.deepEqual(
    exceptions.map((item) => item.code),
    ["NOT_FULFILLED_DELIVERY"]
  );
});

test("a return with no link to the suppressed delivery is still counted", () => {
  const { rows, exceptions } = run({
    ...saleAndReturn(),
    postDispatch: [postDispatch({ status: "Not Fulfilled" })],
  });
  assert.equal(exceptions[0]?.code, "NOT_FULFILLED_DELIVERY");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.grossQty, 0);
  assert.equal(rows[0]?.returnedQty, 2, "an unlinkable return is not this report's guess");
});

test("keeps a fulfilled-with-concerns delivery but reports the concern", () => {
  const { rows, exceptions } = run({
    ...saleAndReturn(),
    postDispatch: [postDispatch({ status: "fulfilled with concerns" })],
  });
  assert.equal(rows[0]?.grossKg, 120);
  assert.equal(exceptions[0]?.code, "FULFILLED_WITH_CONCERNS");
});

test("absence of a dispatch row is normal and does not suppress anything", () => {
  const { rows, exceptions } = run({ ...saleAndReturn(), postDispatch: [] });
  assert.equal(rows[0]?.grossQty, 10);
  assert.equal(exceptions.length, 0);
});

test("rejects a return that is soft-deleted, cancelled or not posted", () => {
  for (const patch of [
    { deleted_at: "2026-01-16T00:00:00" },
    { status: "cancelled" },
    { isPosted: false },
  ]) {
    const { rows } = run({ ...saleAndReturn(), returns: [salesReturn(patch)] });
    assert.equal(rows[0]?.returnedQty, 0, JSON.stringify(patch));
    assert.equal(rows[0]?.netQty, 10);
  }
});

test("accepts a return whose isPosted flag was never stored", () => {
  // isPosted is nullable, so only an explicit false may reject the document.
  const { rows } = run({ ...saleAndReturn(), returns: [salesReturn({ isPosted: undefined })] });
  assert.equal(rows[0]?.returnedQty, 2);
});

test("drops a rejected line without discarding the whole return", () => {
  const { rows } = run({
    ...saleAndReturn(),
    returnDetails: [
      returnDetail({ detail_id: 1, quantity: 2, status: "cancelled" }),
      returnDetail({ detail_id: 2, quantity: 3 }),
    ],
  });
  assert.equal(rows[0]?.returnedQty, 3);
});

test("a return is charged to its own customer, never to the sale's", () => {
  const { rows } = run({
    ...saleAndReturn(),
    returns: [salesReturn({ customer_code: "C-999" })],
  });

  const buyer = rows.find((row) => row.customerCode === "C-001");
  const returner = rows.find((row) => row.customerCode === "C-999");
  assert.equal(buyer?.returnedQty, 0, "C-001 did not return anything");
  assert.equal(buyer?.grossQty, 10);
  assert.equal(returner?.returnedQty, 2, "the return belongs to the returning customer");
  assert.equal(returner?.grossQty, 0);
});

test("recovers a missing return branch from the linked invoice", () => {
  const { rows } = run({
    ...saleAndReturn(),
    returns: [salesReturn({ branch_id: null })],
    returnLinks: [returnLink()],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.branchName, "Manila", "the return reduced the right branch row");
  assert.equal(rows[0]?.returnedQty, 2);
});

test("drops an unbranchable return only while a branch filter is active", () => {
  const { rows } = run({
    ...saleAndReturn(),
    filters: filters({ branchIds: [10] }),
    returns: [salesReturn({ branch_id: null })],
    returnLinks: [],
  });
  assert.equal(rows[0]?.returnedQty, 0, "cannot be attributed, so it must not leak");
  assert.equal(rows[0]?.grossQty, 10);
});

test("applies the branch and salesman selections to the invoice header", () => {
  const byBranch = run({
    ...saleAndReturn(),
    filters: filters({ branchIds: [11] }),
  });
  assert.equal(byBranch.rows.length, 0);

  const byAnyOfTwoBranches = run({
    ...saleAndReturn(),
    filters: filters({ branchIds: [11, 10] }),
  });
  assert.equal(byAnyOfTwoBranches.rows.length, 1, "a selection is an OR, not an AND");

  const bySalesman = run({
    ...saleAndReturn(),
    filters: filters({ salesmanIds: [5] }),
  });
  assert.equal(bySalesman.rows.length, 1);

  const otherSalesman = run({
    ...saleAndReturn(),
    filters: filters({ salesmanIds: [6, 7] }),
  });
  assert.equal(otherSalesman.rows.length, 0);
});

test("scopes to the selected customers for the drill-down", () => {
  const { rows } = run({
    ...saleAndReturn(),
    filters: filters({ customerCodes: ["C-001"] }),
    returns: [salesReturn({ customer_code: "C-001" })],
  });
  assert.equal(rows.length, 1);

  const scoped = run({ ...saleAndReturn(), filters: filters({ customerCodes: ["C-002"] }) });
  assert.equal(scoped.rows.length, 0);
});

test("applies the classification allow-list without consulting the DB again", () => {
  const allowed = run({ ...saleAndReturn(), allowedCustomerCodes: new Set(["C-001"]) });
  assert.equal(allowed.rows.length, 1);

  const blocked = run({ ...saleAndReturn(), allowedCustomerCodes: new Set(["C-002"]) });
  assert.equal(blocked.rows.length, 0);
});

test("skips invoices that carry no lines and returns that carry no details", () => {
  const emptyInvoice = run({ invoices: [invoice()], invoiceDetails: [] });
  assert.equal(emptyInvoice.rows.length, 0);

  const emptyReturn = run({ ...saleAndReturn(), returnDetails: [] });
  assert.equal(emptyReturn.rows.length, 1);
  assert.equal(emptyReturn.rows[0]?.returnedQty, 0);
});

test("keeps the quantity of a serialized cylinder whose size is unknown", () => {
  const { rows, exceptions } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail()],
    // The category is industrial but carries no "<n>KG" size, and the master
    // weight is blank, so the line is kept with zero kg and disclosed.
    masters: { products: [product({ product_weight: 0, weight: 0 })] },
  });
  assert.equal(rows[0]?.grossQty, 10, "pieces were still bought even without a size");
  assert.equal(rows[0]?.grossKg, 0);
  assert.equal(rows[0]?.exceptionCodes.includes("MISSING_PRODUCT_WEIGHT"), true);
  assert.equal(exceptions[0]?.code, "MISSING_PRODUCT_WEIGHT");
  assert.equal(exceptions[0]?.referenceNo, "SI-0001");
});

test("reports a line whose product master row is missing instead of showing it", () => {
  const { rows, exceptions } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail({ product_id: 999 })],
  });
  assert.equal(rows.length, 0, "a product that cannot be proven serialized is out of scope");
  assert.equal(exceptions[0]?.code, "MISSING_PRODUCT_WEIGHT");
  assert.equal(exceptions[0]?.quantity, 10, "the excluded quantity is still disclosed");
  assert.equal(exceptions[0]?.referenceNo, "SI-0001");
});

test("excludes products that are not serialized cylinders", () => {
  const { rows, exceptions } = run({
    invoices: [invoice()],
    invoiceDetails: [
      invoiceDetail({ detail_id: 1, product_id: 100 }),
      invoiceDetail({ detail_id: 2, product_id: 200 }),
    ],
    returns: [salesReturn()],
    returnDetails: [returnDetail({ product_id: 200 })],
    masters: {
      products: [
        product(),
        product({ product_id: 200, product_name: "LPG Hose", is_serialized: 0, product_weight: 0 }),
      ],
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.productId, 100);
  assert.equal(rows[0]?.grossQty, 10);
  assert.equal(rows[0]?.returnedQty, 0, "a non-cylinder return is out of scope too");
  assert.equal(exceptions.length, 0, "an out-of-scope product is not a data anomaly");
});

test("excludes a serialized product whose category is not industrial", () => {
  const { rows, exceptions } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail({ product_id: 200 })],
    returns: [salesReturn()],
    returnDetails: [returnDetail({ product_id: 200 })],
    masters: {
      products: [
        product({
          product_id: 200,
          product_name: "LPG 11KG (non-industrial)",
          product_weight: 0,
          product_category: 51,
        }),
      ],
      categories: [category(), category({ category_id: 51, is_industrial: 0 })],
    },
  });

  assert.equal(rows.length, 0, "both the sale and the return are out of scope");
  assert.equal(exceptions.length, 0, "a non-industrial category is excluded, not an anomaly");
});

test("flags a serialized product whose category cannot be resolved", () => {
  const { rows, exceptions } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail()],
    masters: { products: [product({ product_category: null })] },
  });

  assert.equal(rows.length, 0);
  assert.equal(exceptions[0]?.code, "MISSING_PRODUCT_CATEGORY");
  assert.equal(exceptions[0]?.quantity, 10, "the excluded quantity is still disclosed");
  assert.equal(exceptions[0]?.referenceNo, "SI-0001");
});

test("flags a return line whose product category cannot be resolved", () => {
  const { rows, exceptions } = run({
    ...saleAndReturn(),
    returnDetails: [returnDetail({ product_id: 201 })],
    masters: {
      products: [product(), product({ product_id: 201, product_category: null })],
    },
  });

  assert.equal(rows[0]?.returnedQty, 0);
  assert.equal(exceptions[0]?.code, "MISSING_PRODUCT_CATEGORY");
  assert.equal(exceptions[0]?.referenceType, "SALES_RETURN");
  assert.equal(exceptions[0]?.referenceNo, "SR-0001");
});

test("does not list an all-out-of-scope document in the drill-down", () => {
  const { documents } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail({ product_id: 200 })],
    returns: [salesReturn()],
    returnDetails: [returnDetail({ product_id: 200 })],
    masters: {
      products: [
        product(),
        product({ product_id: 200, product_name: "LPG Hose", is_serialized: 0, product_weight: 0 }),
      ],
    },
    withDocuments: true,
  });
  assert.deepEqual(documents, [], "a zero-movement document would imply it fed the row");
});

test("multiplies the category cylinder size when product_weight is blank", () => {
  const { rows } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail()],
    masters: {
      products: [product({ product_weight: 0, weight: null, product_category: 60 })],
      categories: [
        { category_id: 60, category_name: "LPG 11KG", is_industrial: 1 },
      ],
    },
  });
  assert.equal(rows[0]?.grossKg, 110, "10 cylinders x the 11 kg category size");
  assert.equal(rows[0]?.sizeKg, 11);
});

test("uses a billed-in-kg line instead of the product-weight proxy", () => {
  const { rows } = run({
    invoices: [invoice()],
    invoiceDetails: [invoiceDetail({ unit: 4 })],
    masters: { units: [unit({ unit_id: 4, unit_name: "Kilogram", unit_shortcut: "kg" })] },
  });
  assert.equal(rows[0]?.grossKg, 10, "250 kg billed as kg must not be multiplied again");
  assert.equal(rows[0]?.quantityUnit, "kg");
});

test("returns are always kg proxies because their lines carry no unit", () => {
  const { rows } = run({
    ...saleAndReturn(),
    invoiceDetails: [invoiceDetail({ unit: 4 })],
    masters: {
      units: [unit({ unit_id: 4, unit_name: "Kilogram", unit_shortcut: "kg" })],
      products: [product({ product_weight: 12 })],
    },
  });
  // Sale billed in kg (10), return proxy by product weight (2 x 12).
  assert.equal(rows[0]?.grossKg, 10);
  assert.equal(rows[0]?.returnedKg, 24);
});

test("collects the document trail with signed return quantities", () => {
  const { documents } = run({ ...saleAndReturn(), returnLinks: [returnLink()], withDocuments: true });
  assert.deepEqual(
    documents.map((item) => [item.documentType, item.documentNo, item.quantity, item.kg]),
    [
      ["SALES_INVOICE", "SI-0001", 10, 120],
      ["SALES_RETURN", "SR-0001", -2, -24],
    ]
  );
  assert.equal(documents[1]?.reference, "1", "the adjustment keeps its invoice reference");
});

test("collects no documents for the table view", () => {
  const { documents } = run(saleAndReturn());
  assert.equal(documents.length, 0);
});

test("ignores an invoice with no customer code", () => {
  const { rows } = run({ invoices: [invoice({ customer_code: "  " })], invoiceDetails: [invoiceDetail()] });
  assert.equal(rows.length, 0);
});
