import assert from "node:assert/strict";
import test from "node:test";

import { fetchCustomerOrderConsumptionSources } from "./customer-order-consumption.repo";
import { filters, invoice, unifiedLpg } from "./customer-order-consumption.test-fixtures";

// The repo resolves its endpoint from the environment before anything else,
// so the URL variable has to exist. A dummy value is enough: the test injects
// its own transport and never contacts a real Directus.
process.env.NEXT_PUBLIC_API_BASE_URL = "http://directus.test";

interface Captured {
  collection: string;
  filter: Record<string, unknown>;
  fields: string;
}

function parseFilter(url: URL): Record<string, unknown> {
  const raw = url.searchParams.get("filter");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

/**
 * Answers every collection from `tables` and records the query it was asked,
 * so the test can assert the Directus filter grammar itself. A collection may
 * instead be a function of the filter, which is how one collection read twice
 * (windowed, then by id) is given two different answers.
 */
function harness(
  tables: Record<string, unknown[] | ((filter: Record<string, unknown>) => unknown[])> = {}
) {
  const captured: Captured[] = [];
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const collection = url.pathname.split("/").pop() as string;
    const filter = parseFilter(url);
    captured.push({
      collection,
      filter,
      fields: url.searchParams.get("fields") ?? "",
    });
    const table = tables[collection];
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: typeof table === "function" ? table(filter) : (table ?? []) }),
    } as unknown as Response;
  }) as typeof fetch;

  const options = { fetchImpl: fakeFetch, config: { baseUrl: "http://directus.test", token: "test-token" } };
  const forCollection = (collection: string) => captured.filter((item) => item.collection === collection);

  return { captured, forCollection, options };
}

test("timestamped window filters pad to the full day", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  const invoiceQuery = forCollection("sales_invoice").find((item) => item.filter.invoice_date)?.filter;
  assert.deepEqual(invoiceQuery?.invoice_date, {
    _gte: "2026-01-01T00:00:00",
    _lte: "2026-01-31T23:59:59",
  }, "a bare end date compares as midnight and drops the final day");

  const returnQuery = forCollection("sales_return")[0]?.filter;
  assert.deepEqual(returnQuery?.return_date, {
    _gte: "2026-01-01T00:00:00",
    _lte: "2026-01-31T23:59:59",
  });
});

test("date-only LPG columns are compared as plain dates", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  assert.deepEqual(forCollection("lpg_metered_wiwo_transactions")[0]?.filter.transaction_date, {
    _gte: "2026-01-01",
    _lte: "2026-01-31",
  });
  assert.deepEqual(forCollection("lpg_meter_readings")[0]?.filter.reading_date, {
    _gte: "2026-01-01",
    _lte: "2026-01-31",
  });
});

test("only posted LPG ledgers are read and soft-deleted returns are excluded", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  assert.deepEqual(forCollection("lpg_metered_wiwo_transactions")[0]?.filter.status, { _eq: "POSTED" });
  assert.deepEqual(forCollection("lpg_wiwo_headers")[0]?.filter.wiwo_status, { _eq: "POSTED" });
  assert.deepEqual(forCollection("lpg_meter_readings")[0]?.filter.reading_status, { _eq: "POSTED" });
  assert.deepEqual(forCollection("sales_return")[0]?.filter.deleted_at, { _null: true });
});

test("nullable flags are never compared with _neq", async () => {
  // SQL `!= 1` drops NULL rows, and isReplaced/isPosted are nullable, so the
  // rejection decision belongs in the aggregation layer instead.
  const { captured, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  for (const item of captured) {
    assert.notDeepEqual(item.filter.isReplaced, { _neq: true }, item.collection);
    assert.notDeepEqual(item.filter.isPosted, { _neq: false }, item.collection);
  }
});

test("the branch, salesman and customer selections reach both movement queries", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(
    filters({ branchIds: [10], salesmanIds: [5], customerCodes: ["C-001"] }),
    options
  );

  for (const collection of ["sales_invoice", "sales_return"]) {
    const query = forCollection(collection)[0]?.filter;
    assert.deepEqual(query?.branch_id, { _in: [10] }, collection);
    assert.deepEqual(query?.salesman_id, { _in: [5] }, collection);
    assert.deepEqual(query?.customer_code, { _in: ["C-001"] }, collection);
  }

  // An LPG row has no branch column, so only the customer can scope it here.
  assert.deepEqual(forCollection("lpg_metered_wiwo_transactions")[0]?.filter.customer_code, {
    _in: ["C-001"],
  });
  assert.equal(forCollection("lpg_metered_wiwo_transactions")[0]?.filter.branch_id, undefined);
});

test("a multi-select is one _in, not a request per pick", async () => {
  const { forCollection, captured, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters({ branchIds: [10, 11, 12] }), options);

  assert.deepEqual(forCollection("sales_invoice")[0]?.filter.branch_id, { _in: [10, 11, 12] });
  assert.equal(captured.filter((item) => item.collection === "sales_invoice").length, 1);
});

test("an empty selection sends no clause at all", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(
    filters({ branchIds: [], customerCodes: [], salesmanIds: [], classificationIds: [] }),
    options
  );

  assert.equal(forCollection("sales_invoice")[0]?.filter.branch_id, undefined);
  assert.equal(forCollection("sales_invoice")[0]?.filter.customer_code, undefined);
  assert.equal(forCollection("customer")[0]?.filter.classification, undefined);
});

test("the customer read is scoped by the selected classifications", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters({ classificationIds: [70, 71] }), options);
  assert.deepEqual(forCollection("customer")[0]?.filter.classification, { _in: [70, 71] });
});

test("child rows are fetched in id chunks of 500", async () => {
  const ids = Array.from({ length: 1200 }, (_, index) => index + 1);
  const { forCollection, options } = harness({
    sales_invoice: ids.map((invoiceId) =>
      invoice({ invoice_id: invoiceId, invoice_no: `SI-${invoiceId}` })
    ),
  });

  await fetchCustomerOrderConsumptionSources(filters(), options);
  const detailCalls = forCollection("sales_invoice_details");
  assert.equal(detailCalls.length, 3, "1200 ids is 500 + 500 + 200");
  assert.equal((detailCalls[0]?.filter.invoice_no as { _in: number[] })._in.length, 500);
  assert.equal((detailCalls[2]?.filter.invoice_no as { _in: number[] })._in.length, 200);
  assert.deepEqual(detailCalls[0]?.filter.invoice_no, { _in: ids.slice(0, 500) });
});

test("no child request is fired when the parent list is empty", async () => {
  const { captured, options } = harness();
  const source = await fetchCustomerOrderConsumptionSources(filters(), options);

  assert.equal(captured.filter((item) => item.collection === "sales_invoice_details").length, 0);
  assert.equal(captured.filter((item) => item.collection === "lpg_wiwo_details").length, 0);
  assert.deepEqual(source.invoiceDetails, []);
});

test("return details are keyed by return number and links by return id", async () => {
  const { forCollection, options } = harness({
    sales_return: [
      { return_id: 900, return_number: "SR-0001", customer_code: "C-001", branch_id: 10, salesman_id: 5, return_date: "2026-01-15", gross_amount: 1, order_id: null, invoice_no: "SI-0001", status: "posted", isPosted: 1, deleted_at: null },
    ],
  });

  await fetchCustomerOrderConsumptionSources(filters(), options);
  assert.deepEqual(forCollection("sales_return_details")[0]?.filter.return_no, { _in: ["SR-0001"] });
  assert.deepEqual(forCollection("sales_invoice_sales_return")[0]?.filter.return_no, { _in: [900] });
});

test("an LPG transaction billed before the window recovers its branch", async () => {
  const outside = invoice({
    invoice_id: 777,
    invoice_no: "SI-0777",
    branch_id: 11,
    invoice_date: "2025-12-20",
  });
  const { forCollection, options } = harness({
    // The windowed read returns nothing, so 777 never reaches invoiceIds;
    // only the by-id recovery read is allowed to see the invoice.
    lpg_metered_wiwo_transactions: [unifiedLpg({ sales_invoice_id: 777, sales_invoice_no: "SI-0777" })],
    sales_invoice: (filter) => (filter.invoice_id ? [outside] : []),
  });

  const source = await fetchCustomerOrderConsumptionSources(filters(), options);

  const recoveryCalls = forCollection("sales_invoice").filter((item) => item.filter.invoice_id);
  assert.equal(recoveryCalls.length, 1, "one extra read buys the branch back");
  assert.deepEqual(recoveryCalls[0]?.filter.invoice_id, { _in: [777] });
  assert.equal(source.invoices.length, 1);
  assert.equal(source.invoices[0]?.branch_id, 11);
});

test("already-windowed invoice ids are not re-fetched", async () => {
  const { captured, options } = harness({
    sales_invoice: [invoice({ invoice_id: 1 })],
    lpg_metered_wiwo_transactions: [unifiedLpg({ sales_invoice_id: 1 })],
  });

  await fetchCustomerOrderConsumptionSources(filters(), options);
  assert.equal(captured.filter((item) => item.collection === "sales_invoice").length, 1);
});

test("the whole collection set needed by both channels is returned", async () => {
  const { options } = harness();
  const source = await fetchCustomerOrderConsumptionSources(filters(), options);

  assert.deepEqual(Object.keys(source).sort(), [
    "branches",
    "categories",
    "classifications",
    "customers",
    "invoiceDetails",
    "invoices",
    "lpgSites",
    "meterReadings",
    "postDispatch",
    "products",
    "returnDetails",
    "returnLinks",
    "returns",
    "salesmen",
    "unifiedLpg",
    "units",
    "weightUnits",
    "wiwoDetails",
    "wiwoHeaders",
  ]);
});

test("masters are read once each, in parallel", async () => {
  const { captured, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  for (const collection of ["branches", "units", "weight_unit", "categories", "customer_classification", "salesman", "products", "lpg_customer_lpg_sites"]) {
    assert.equal(captured.filter((item) => item.collection === collection).length, 1, collection);
  }
});

test("a projection is requested for every collection instead of SELECT *", async () => {
  const { captured, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  for (const item of captured) {
    assert.ok(item.fields.length > 0 && item.fields !== "*", `${item.collection} projects explicitly`);
  }
});

test("the product read carries the serialization flag and category", async () => {
  const { forCollection, options } = harness();
  await fetchCustomerOrderConsumptionSources(filters(), options);

  const fields = forCollection("products")[0]?.fields.split(",") ?? [];
  assert.ok(fields.includes("is_serialized"), "the cylinder scope needs is_serialized");
  assert.ok(fields.includes("product_category"), "the cylinder size is read from the category");

  const categoryFields = forCollection("categories")[0]?.fields.split(",") ?? [];
  assert.ok(
    categoryFields.includes("is_industrial"),
    "the cylinder scope also needs the category eligibility flag"
  );
});
