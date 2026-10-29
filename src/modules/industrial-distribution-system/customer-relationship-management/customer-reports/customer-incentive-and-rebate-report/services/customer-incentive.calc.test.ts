import assert from "node:assert/strict";
import test from "node:test";

import { round2 } from "./customer-incentive.helpers";
import { buildCustomerIncentiveReport } from "./customer-incentive.service";
import type {
  AppliedFilterContext,
  IncentiveSourceData,
  RawInvoiceDetailRow,
  RawInvoiceRow,
  RawMemoRow,
  RawProductRow,
  RawReturnRow,
} from "../types/customer-incentive.types";

const WINDOW = { startDate: "2026-07-01", endDate: "2026-09-30" };

function filters(overrides: Partial<AppliedFilterContext> = {}): AppliedFilterContext {
  return { ...WINDOW, sizeKg: 11, ...overrides };
}

function invoice(overrides: Partial<RawInvoiceRow> = {}): RawInvoiceRow {
  return {
    invoice_id: 1001,
    invoice_no: "SI-1001",
    customer_code: "C-001",
    branch_id: 1,
    salesman_id: 5,
    invoice_date: "2026-07-10T08:00:00Z",
    transaction_status: "POSTED",
    ...overrides,
  };
}

function line(overrides: Partial<RawInvoiceDetailRow> = {}): RawInvoiceDetailRow {
  return {
    detail_id: 1,
    invoice_no: 1001,
    product_id: 100,
    quantity: 10,
    unit_price: 550,
    ...overrides,
  };
}

/** The 11 kg cylinder of `source()`, on its own so a test can bend one field. */
function product(overrides: Partial<RawProductRow> = {}): RawProductRow {
  return {
    product_id: 100,
    product_code: "CYL-11",
    product_name: "11kg Cylinder",
    product_weight: 11,
    product_category: 500,
    ...overrides,
  };
}

function ret(overrides: Partial<RawReturnRow> = {}): RawReturnRow {
  return {
    return_id: 5001,
    return_number: "SR-5001",
    customer_code: "C-001",
    branch_id: 1,
    salesman_id: 5,
    return_date: "2026-07-20",
    status: "POSTED",
    deleted_at: null,
    ...overrides,
  };
}

function memo(overrides: Partial<RawMemoRow> = {}): RawMemoRow {
  return {
    id: 9001,
    memo_number: "CM-9001",
    customer_id: 1,
    salesman_id: 5,
    supplier_reference: null,
    customer_reference: null,
    amount: 4000,
    applied_amount: 1500,
    reason: null,
    status: "APPROVED",
    chart_of_account: 77,
    created_at: "2026-07-25",
    updated_at: "2026-07-26",
    deleted_at: null,
    isPending: false,
    isClaimed: true,
    ...overrides,
  };
}

/**
 * C-001 buys 10 x 11 kg at ₱550/piece (₱50/kg), returns 2, and has one memo
 * approved for ₱4,000 of which ₱1,500 was settled. A 45 kg cylinder and a
 * product with no recorded weight sit on the same invoice to prove neither is
 * counted, and a cancelled invoice carries 5 more eligible units that must be
 * excluded (§4). The two cylinders belong to the industrial categories
 * "LPG 11KG" and "LPG 45KG"; the unweighed product has no category at all.
 */
function source(overrides: Partial<IncentiveSourceData> = {}): IncentiveSourceData {
  return {
    branches: [{ id: 1, branch_name: "Manila", branch_code: "MNL" }],
    classifications: [{ id: 10, classification_name: "Rebate Tier 1" }],
    salesmen: [{ id: 5, salesman_code: "S-5", salesman_name: "Ramon" }],
    customers: [
      {
        id: 1,
        customer_code: "C-001",
        customer_name: "Acme Retail",
        store_name: "Acme QC",
        classification: 10,
      },
    ],
    products: [
      {
        product_id: 100,
        product_code: "CYL-11",
        product_name: "11kg Cylinder",
        product_weight: 11,
        product_category: 500,
      },
      {
        product_id: 200,
        product_code: "CYL-45",
        product_name: "45kg Cylinder",
        product_weight: 45,
        product_category: 501,
      },
      {
        product_id: 300,
        product_code: "NO-WEIGHT",
        product_name: "Unweighed Product",
        product_weight: null,
        product_category: null,
      },
    ],
    categories: [
      { category_id: 500, category_name: "LPG 11KG" },
      { category_id: 501, category_name: "LPG 45KG" },
    ],
    invoices: [
      invoice(),
      invoice({
        invoice_id: 1002,
        invoice_no: "SI-1002",
        transaction_status: "CANCELLED",
      }),
    ],
    invoiceDetails: [
      line(),
      line({ detail_id: 2, product_id: 200, quantity: 4, unit_price: 2000 }),
      line({ detail_id: 3, product_id: 300, quantity: 2, unit_price: 100 }),
      line({ detail_id: 4, invoice_no: 1002, quantity: 5, unit_price: 550 }),
    ],
    returns: [ret()],
    returnDetails: [
      {
        detail_id: 11,
        return_no: "SR-5001",
        product_id: 100,
        quantity: 2,
        status: "POSTED",
      },
    ],
    returnLinks: [],
    memos: [memo()],
    memoInvoices: [
      {
        id: 1,
        invoice_id: 1001,
        memo_id: 9001,
        amount: 4000,
        date_applied: "2026-07-26",
      },
    ],
    memoTransmittals: [
      {
        id: 2,
        memo_id: 9001,
        transmitted_to: "Finance",
        paid_amount: 1500,
        received_at: "2026-07-27",
        transmittal_no: "DT-2",
        created_at: "2026-07-27",
      },
    ],
    accounts: [{ coa_id: 77, gl_code: "4200", account_title: "Rebates" }],
    ...overrides,
  };
}

const GENERATED = new Date("2026-10-01T01:00:00Z");

function onlyRow(report: ReturnType<typeof buildCustomerIncentiveReport>) {
  assert.equal(report.rows.length, 1, "expected exactly one customer row");
  return report.rows[0];
}

function codes(report: ReturnType<typeof buildCustomerIncentiveReport>) {
  return report.exceptions.map((item) => item.code);
}

test("values eligible gas at the recorded line rate and deducts returns once", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  const row = onlyRow(report);

  assert.equal(row.customerName, "Acme Retail");
  assert.equal(row.classificationName, "Rebate Tier 1");
  assert.deepEqual(row.branchNames, ["Manila"]);
  assert.deepEqual(row.salesmanNames, ["Ramon"]);

  // 10 invoiced, 2 returned -> 8 eligible -> 88 kg of gas.
  assert.equal(row.grossUnits, 10);
  assert.equal(row.returnedUnits, 2);
  assert.equal(row.eligibleUnits, 8);
  assert.equal(row.eligibleKg, 88);

  // ₱550 x 10 gross, ₱1,100 of returns deducted, so ₱4,400 earned at ₱50/kg.
  assert.equal(row.earnedAmount, 4400);
  assert.equal(row.adjustmentAmount, 1100);
  assert.equal(row.ratePerKg, 50);
  assert.equal(row.rateIsKnown, true);

  assert.deepEqual(row.memoNumbers, ["CM-9001"]);
  assert.deepEqual(row.paymentReferences, ["DT-2"]);
});

test("a 45 kg cylinder and an unweighed product never enter eligible volume", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  const row = onlyRow(report);

  const productIds = row.evidence.map((item) => item.productId);
  assert.deepEqual(productIds, [100, 300]);
  assert.ok(codes(report).includes("MISSING_PRODUCT_WEIGHT"));
  assert.equal(row.eligibleUnits, 8, "the unweighed line must contribute no units");
});

test("a cylinder sized only by its category name still earns", () => {
  // Serialized cylinders commonly store 0 in product_weight, so the category
  // name ("LPG 11KG") is the only place the gas per unit is written down.
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      products: [product({ product_weight: 0 })],
      invoiceDetails: [line()],
      returns: [],
      returnDetails: [],
    }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.equal(row.eligibleUnits, 10);
  assert.equal(row.eligibleKg, 110);
  assert.equal(row.ratePerKg, 50);
  assert.equal(row.evidence[0].sizeKg, 11, "the drawer shows the category size");
  assert.ok(!codes(report).includes("MISSING_PRODUCT_WEIGHT"));
});

test("a picked category selects by membership, not by its size", () => {
  const report = buildCustomerIncentiveReport(
    // sizeKg is deliberately stale: the chosen category is the authority.
    filters({ categoryIds: [501], sizeKg: undefined }),
    source(),
    GENERATED
  );
  const row = onlyRow(report);

  // Only the 45 kg cylinder sits in "LPG 45KG", so its 4 units are the answer.
  assert.equal(row.grossUnits, 4);
  assert.equal(row.eligibleUnits, 4);
  assert.equal(row.eligibleKg, 180);
  // Each counted unit is valued at the size of its own category, so the report
  // does not claim a single size it never filtered by.
  assert.equal(row.evidence[0].sizeKg, 45);
  assert.deepEqual(report.filters.categoryLabels, ["LPG 45KG"]);
});

test("two picked categories are earned in one pass", () => {
  const report = buildCustomerIncentiveReport(
    filters({ categoryIds: [500, 501] }),
    source(),
    GENERATED
  );
  const row = onlyRow(report);

  // 10 x 11 kg from "LPG 11KG" (2 returned) plus 4 x 45 kg from "LPG 45KG".
  assert.equal(row.grossUnits, 14);
  assert.equal(row.returnedUnits, 2);
  assert.equal(row.eligibleUnits, 12);
  assert.equal(row.eligibleKg, 88 + 180);

  // ₱550/piece on the 11 kg line, ₱2,000/piece on the 45 kg line, so the mixed
  // total carries one blended rate rather than either line's own.
  assert.equal(row.earnedAmount, 4400 + 8000);
  assert.equal(row.ratePerKg, round2(12400 / 268));
});

test("an uncategorised product is reported, not silently dropped by a category filter", () => {
  const report = buildCustomerIncentiveReport(
    filters({ categoryIds: [500] }),
    source(),
    GENERATED
  );
  const finding = report.exceptions.find(
    (item) => item.code === "PRODUCT_NOT_CATEGORISED"
  );

  assert.ok(finding, "a product that cannot be matched must be visible");
  assert.equal(finding.referenceNo, "NO-WEIGHT");
  // The 45 kg cylinder is simply out of scope, which is the filter working.
  assert.ok(!codes(report).includes("MISSING_PRODUCT_WEIGHT"));
});

test("a cancelled invoice is excluded and reported, not silently dropped", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  assert.ok(codes(report).includes("VOIDED_INVOICE_EXCLUDED"));
  // Its 5 eligible units must not appear anywhere.
  assert.equal(onlyRow(report).grossUnits, 10);
});

test("a reprint of an invoice already issued does not count its units twice", () => {
  // bit(1) reaches Directus consumers as true, 1 or "1", and a sibling report
  // has met { data: [1] }. Every shape must exclude the reprint, or the same
  // delivery earns twice and a claim is raised on volume never delivered.
  for (const flag of [true, 1, "1", { data: [1] }]) {
    const report = buildCustomerIncentiveReport(
      filters(),
      source({
        invoices: [
          invoice(),
          invoice({ invoice_id: 1003, invoice_no: "SI-1003", isReplaced: flag }),
        ],
        invoiceDetails: [line(), line({ detail_id: 9, invoice_no: 1003, quantity: 5 })],
      }),
      GENERATED
    );

    assert.equal(
      onlyRow(report).grossUnits,
      10,
      `isReplaced = ${JSON.stringify(flag)} must exclude the reprint`
    );
    const excluded = report.exceptions.find(
      (item) => item.code === "VOIDED_INVOICE_EXCLUDED"
    );
    assert.match(excluded?.detail ?? "", /reprint/);
  }
});

test("a return flagged unposted is held back and reported, not dropped quietly", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ returns: [ret({ isPosted: 0 })] }),
    GENERATED
  );
  const row = onlyRow(report);

  // The 2 returned units stay counted, so the earned figure is the gross one.
  assert.equal(row.returnedUnits, 0);
  assert.equal(row.eligibleUnits, 10);
  assert.ok(codes(report).includes("UNPOSTED_RETURN_EXCLUDED"));
});

test("a legacy return with no posting flag still reduces the earned figure", () => {
  // isPosted is nullable. Reading NULL as unposted would give the customer
  // back the units they handed in and inflate what a payment is released on.
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ returns: [ret({ isPosted: null })] }),
    GENERATED
  );

  assert.equal(onlyRow(report).eligibleUnits, 8);
  assert.ok(!codes(report).includes("UNPOSTED_RETURN_EXCLUDED"));
});

test("reconciles the approved claim against the recorded earned value", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  const row = onlyRow(report);

  assert.equal(row.claimCount, 1);
  assert.equal(row.approvedAmount, 4000);
  assert.equal(row.releasedAmount, 1500);
  assert.equal(row.outstandingAmount, 2500);
  // §10 variance: approved minus earned, with the sign kept.
  assert.equal(row.varianceAmount, -400);
  assert.equal(row.impliedRatePerKg, 45.45);
  // Approved money with only part of it settled is a partially released claim.
  assert.equal(row.claimStatus, "PARTIALLY_RELEASED");
  assert.equal(row.statusLabel, "Partially Released");
});

test("the reporting cutoff is the applied end date", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  assert.equal(report.reportingCutoff, WINDOW.endDate);
  assert.equal(report.generatedAt, GENERATED.toISOString());
});

test("overview totals are sums over the displayed rows", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  const { overview } = report;

  assert.equal(overview.customerCount, 1);
  assert.equal(overview.eligibleUnits, 8);
  assert.equal(overview.eligibleKg, 88);
  assert.equal(overview.earnedAmount, 4400);
  assert.equal(overview.adjustmentAmount, 1100);
  assert.equal(overview.approvedAmount, 4000);
  assert.equal(overview.releasedAmount, 1500);
  assert.equal(overview.outstandingAmount, 2500);
  assert.equal(overview.varianceAmount, -400);
  assert.equal(overview.claimCounts.PARTIALLY_RELEASED, 1);
  assert.equal(overview.claimCounts.APPROVED, 0);
  assert.equal(overview.claimCounts.FOR_REVIEW, 0);
  assert.equal(
    overview.exceptionCount,
    report.exceptions.length
  );
});

test("a withdrawn memo carries no approved money", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ memos: [memo({ status: "DELETED" })] }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.equal(row.claimCount, 0);
  assert.equal(row.approvedAmount, 0);
  assert.equal(row.claimStatus, "NO_CLAIM");
  assert.equal(report.claims.length, 0);
});

test("an unrecognised memo status earns nothing and is reported", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ memos: [memo({ status: "PAID" })] }),
    GENERATED
  );

  assert.ok(codes(report).includes("MEMO_STATUS_UNRECOGNISED"));
  assert.equal(report.claims.length, 0);
  assert.equal(onlyRow(report).approvedAmount, 0);
});

test("settlement ahead of approval is flagged, and outstanding floors at zero", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      memos: [memo({ amount: 1000, applied_amount: 1200 })],
      // No transmittal, so applied_amount alone decides what was released.
      memoTransmittals: [],
    }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.ok(codes(report).includes("OVER_RELEASED"));
  assert.equal(row.releasedAmount, 1200);
  assert.equal(row.outstandingAmount, 0);
});

test("two memos at the same amount are flagged as a suspected duplicate", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      memos: [
        memo(),
        memo({ id: 9002, memo_number: "CM-9002", status: "FOR APPROVAL", applied_amount: 0 }),
      ],
    }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.ok(codes(report).includes("DUPLICATE_MEMO_SUSPECTED"));
  assert.equal(row.claimCount, 2);
  assert.equal(row.approvedAmount, 8000);
  // The roll-up keeps the most advanced status but never hides the other.
  assert.equal(row.claimStatus, "PARTIALLY_RELEASED");
  assert.deepEqual(row.claimStatuses, ["PARTIALLY_RELEASED", "FOR_REVIEW"]);
});

test("a claim with no eligible volume in the window is reported, not netted off", () => {
  const report = buildCustomerIncentiveReport(
    filters({ sizeKg: 50 }),
    source(),
    GENERATED
  );
  const row = onlyRow(report);

  assert.equal(row.eligibleKg, 0);
  assert.equal(row.earnedAmount, 0);
  assert.equal(row.approvedAmount, 4000);
  assert.ok(codes(report).includes("MEMO_WITHOUT_EVIDENCE"));
  // Approved money against nothing earned is a positive variance.
  assert.equal(row.varianceAmount, 4000);
});

test("a memo applied outside the window is reported against the cutoff", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      memoInvoices: [
        {
          id: 1,
          invoice_id: 9999,
          memo_id: 9001,
          amount: 4000,
          date_applied: "2026-07-26",
        },
      ],
    }),
    GENERATED
  );

  assert.ok(codes(report).includes("MEMO_OUTSIDE_WINDOW"));
});

test("a memo with no matching customer cannot be attributed", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ memos: [memo({ customer_id: 4242 })] }),
    GENERATED
  );

  assert.ok(codes(report).includes("MEMO_WITHOUT_CUSTOMER"));
  const orphan = report.rows.find((row) => row.customerCode === "#4242");
  assert.ok(orphan, "the unattributed memo must still surface as a row");
  assert.equal(orphan.approvedAmount, 4000);
});

test("returns that outnumber invoiced units floor eligibility at zero", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      returnDetails: [
        {
          detail_id: 11,
          return_no: "SR-5001",
          product_id: 100,
          quantity: 14,
          status: "POSTED",
        },
      ],
    }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.ok(codes(report).includes("RETURNED_UNITS_EXCEEDED"));
  assert.equal(row.returnedUnits, 14);
  assert.equal(row.eligibleUnits, 0);
  assert.equal(row.eligibleKg, 0);
  assert.equal(row.earnedAmount, 0);
});

test("an eligible line without a price is counted but never valued", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      invoices: [invoice()],
      invoiceDetails: [line({ unit_price: 0 })],
      returns: [],
      returnDetails: [],
    }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.ok(codes(report).includes("NO_RATE_SNAPSHOT"));
  assert.equal(row.eligibleUnits, 10);
  assert.equal(row.earnedAmount, 0);
  assert.equal(row.rateIsKnown, false);
  assert.equal(row.ratePerKg, null);
});

test("the claim status filter cuts customers from the whole answer", () => {
  const unmatched = buildCustomerIncentiveReport(
    filters({ claimStatus: "FOR_REVIEW" }),
    source(),
    GENERATED
  );

  // The single memo is approved and partly settled, so this customer leaves the
  // report entirely under a For Review cut.
  assert.equal(unmatched.rows.length, 0);
  assert.equal(unmatched.overview.approvedAmount, 0);
  // ...and its memo leaves the claims register with it.
  assert.equal(unmatched.claims.length, 0);
  assert.ok(
    unmatched.exceptions.every((item) => item.customerCode !== "C-001"),
    "exceptions of filtered-out customers must not survive in the other tab"
  );

  const matched = buildCustomerIncentiveReport(
    filters({ claimStatus: "PARTIALLY_RELEASED" }),
    source(),
    GENERATED
  );
  assert.equal(matched.rows.length, 1);
  assert.equal(matched.claims.length, 1);
  assert.equal(matched.overview.approvedAmount, 4000);
  // The kept customer keeps its own findings.
  assert.ok(codes(matched).includes("MISSING_PRODUCT_WEIGHT"));
});

test("settlement makes Released reachable, which the memo status never does", () => {
  // customers_memo.status is an enum nobody in the application advances past
  // APPROVED, so without the money this cut could never match a row.
  const report = buildCustomerIncentiveReport(
    filters({ claimStatus: "RELEASED" }),
    source({ memos: [memo({ applied_amount: 4000 })], memoTransmittals: [] }),
    GENERATED
  );

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].claimStatus, "RELEASED");
  assert.equal(report.rows[0].outstandingAmount, 0);
});

test("an approved memo with nothing settled still reads as Approved", () => {
  const report = buildCustomerIncentiveReport(
    filters({ claimStatus: "APPROVED" }),
    source({ memos: [memo({ applied_amount: 0 })], memoTransmittals: [] }),
    GENERATED
  );

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].claimStatus, "APPROVED");
});

test("money never promotes a claim that was never approved", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      memos: [memo({ status: "FOR APPROVAL", applied_amount: 4000 })],
      memoTransmittals: [],
    }),
    GENERATED
  );

  assert.equal(onlyRow(report).claimStatus, "FOR_REVIEW");
});

test("branch scoping and the document trail stay attached to the row", () => {
  const report = buildCustomerIncentiveReport(filters(), source(), GENERATED);
  const row = onlyRow(report);
  const evidence = row.evidence.find((item) => item.productId === 100);

  assert.ok(evidence);
  assert.equal(evidence.branchId, 1);
  assert.equal(evidence.branchName, "Manila");
  assert.equal(evidence.invoiceCount, 1);
  assert.equal(evidence.returnCount, 1);
  assert.equal(evidence.eligibleKg, 88);
  assert.deepEqual(evidence.salesmanNames, ["Ramon"]);
});

test("non-industrial products stay silent and zero-value customers are suppressed from report rows", () => {
  // C-002 buys non-industrial FMCG goods (category 999, not in categories master)
  // and has no incentive claims. They must not appear as a blank row or trigger false MISSING_PRODUCT_WEIGHT.
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      customers: [
        { id: 1, customer_code: "C-001", customer_name: "Acme Retail", store_name: "Acme", classification: 10 },
        { id: 2, customer_code: "C-002", customer_name: "Grocery Buyer", store_name: "Corner Shop", classification: 10 },
      ],
      products: [
        product(),
        {
          product_id: 999,
          product_code: "SHAMPOO",
          product_name: "Hair Shampoo 200ml",
          product_weight: 0,
          product_category: 999, // Non-industrial category
        },
      ],
      invoices: [
        invoice(),
        invoice({
          invoice_id: 2001,
          invoice_no: "SI-2001",
          customer_code: "C-002",
        }),
      ],
      invoiceDetails: [
        line(),
        line({ detail_id: 50, invoice_no: 2001, product_id: 999, quantity: 24, unit_price: 50 }),
      ],
    }),
    GENERATED
  );

  // C-002 has 0 eligible units and 0 claims, so only C-001 should be in the report rows.
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].customerCode, "C-001");
  // Non-industrial product 999 must not generate MISSING_PRODUCT_WEIGHT exception
  const shampooExceptions = report.exceptions.filter((item) => item.referenceNo === "SHAMPOO");
  assert.equal(shampooExceptions.length, 0);
});


test("non-industrial product weighing 11kg (e.g. palm oil) is excluded from eligible volume", () => {
  const report = buildCustomerIncentiveReport(
    filters(), // sizeKg = 11, categoryIds = []
    source({
      customers: [
        { id: 1, customer_code: "C-ONG", customer_name: "Christoper Ong", store_name: "San Quintin", classification: 10 },
      ],
      products: [
        {
          product_id: 888,
          product_code: "MZL1LBAS",
          product_name: "Mama Pina's Palm Oil 1L x 12 MZL BAS",
          product_weight: 11, // package happens to weigh 11kg
          product_category: 998, // non-industrial category
        },
      ],
      invoices: [
        invoice({
          invoice_id: 3001,
          invoice_no: "SI-3001",
          customer_code: "C-ONG",
        }),
      ],
      invoiceDetails: [
        line({ detail_id: 88, invoice_no: 3001, product_id: 888, quantity: 3, unit_price: 125 }),
      ],
      memos: [
      ],
    }),
    GENERATED
  );

  // Christoper Ong only purchased Palm Oil, so he has 0 eligible units and 0 claims.
  assert.equal(report.rows.length, 0);
  assert.equal(report.overview.eligibleUnits, 0);
  assert.equal(report.overview.earnedAmount, 0);
});

test("when filtering by branch, customers with zero eligible volume in that branch are excluded", () => {
  // Source fixture has customer C-001 with memo of 4000 and invoices in branch 1 (Manila).
  // When filtering by branch 2 (Alaminos), C-001 has 0 evidence in branch 2, so they must be excluded.
  const report = buildCustomerIncentiveReport(
    filters({ branchIds: [2] }),
    source(),
    GENERATED
  );

  assert.equal(report.rows.length, 0);
  assert.equal(report.overview.customerCount, 0);
  assert.equal(report.overview.approvedAmount, 0);
});

test("an unassigned memo without branch evidence flags BRANCH_UNRESOLVED and shows empty branch", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({ invoices: [], invoiceDetails: [], returns: [], returnDetails: [] }),
    GENERATED
  );
  const row = onlyRow(report);

  assert.deepEqual(row.branchNames, []);
  assert.ok(codes(report).includes("BRANCH_UNRESOLVED"));
});

test("non-serialized product (is_serialized = 0 e.g. Richeese Wafer) or unrecognised non-cylinder line item does not trigger MISSING_PRODUCT_WEIGHT", () => {
  const report = buildCustomerIncentiveReport(
    filters(),
    source({
      customers: [
        { id: 10, customer_code: "MAIN-31293", customer_name: "Bing Store", store_name: "Bing Store", classification: 10 },
      ],
      products: [
        product(),
        {
          product_id: 22159,
          product_code: "WAFER-01",
          product_name: "Richeese Wafer 20g x 20ib x 10pcs",
          description: "Richeese Wafer 20g x 20ib x 10pcs Pack",
          product_weight: 0.1,
          product_category: 187,
          is_serialized: 0,
        },
      ],
      invoices: [
        invoice({
          invoice_id: 4001,
          invoice_no: "SI-4001",
          customer_code: "MAIN-31293",
        }),
      ],
      invoiceDetails: [
        line({ detail_id: 101, invoice_no: 4001, product_id: 22159, quantity: 10, unit_price: 55 }),
        line({ detail_id: 102, invoice_no: 4001, product_id: 99999, quantity: 5, unit_price: 30 }),
      ],
      memos: [],
      returns: [],
      returnDetails: [],
    }),
    GENERATED
  );

  const missingWeightExceptions = report.exceptions.filter(
    (e) => e.code === "MISSING_PRODUCT_WEIGHT"
  );
  assert.equal(missingWeightExceptions.length, 0);
  assert.equal(report.rows.length, 0);
});

test("when no category and no sizeKg is specified, all industrial cylinder sizes are eligible", () => {
  const report = buildCustomerIncentiveReport(
    filters({ sizeKg: undefined }),
    source(),
    GENERATED
  );

  const row = onlyRow(report);
  // In source():
  // - 10 units of 11kg, 2 returned -> 8 eligible units * 11kg = 88kg.
  // - 4 units of 45kg -> 4 eligible units * 45kg = 180kg.
  // Total eligible units = 12 units, total eligible kg = 268 kg.
  assert.equal(row.eligibleUnits, 12);
  assert.equal(row.eligibleKg, 268);
  assert.equal(report.overview.eligibleUnits, 12);
  assert.equal(report.overview.eligibleKg, 268);
});

