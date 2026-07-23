import assert from "node:assert/strict";
import test from "node:test";

import { fetchReportLookups } from "./cylinder-purchase-report.lookups.ts";

test("requests bounded serialized product search results and normalizes them", async () => {
  let request: Request | null = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    request = new Request(input, init);
    return Response.json({
      data: [
        { product_id: 2, product_code: "LPG-50", product_name: "LPG 50KG" },
        { product_id: 1, product_code: "LPG-11", product_name: "LPG 11KG" },
        { product_id: null, product_code: "DISCARD", product_name: "Discard" },
        { product_id: 3, product_code: "NO-NAME", product_name: null },
      ],
    });
  };

  const options = await fetchReportLookups(
    { type: "products", q: "LPG & 11" },
    {
      directusBaseUrl: "https://directus.test/",
      directusToken: "test-token",
      fetchImpl,
    },
  );

  assert.ok(request);
  const completedRequest = request as Request;
  const url = new URL(completedRequest.url);
  assert.equal(url.origin, "https://directus.test");
  assert.equal(url.pathname, "/items/products");
  assert.equal(url.searchParams.get("fields"), "product_id,product_code,product_name");
  assert.equal(url.searchParams.get("sort"), "product_name");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("filter[is_serialized][_eq]"), "1");
  assert.equal(url.searchParams.get("filter[isActive][_eq]"), "1");
  assert.equal(url.searchParams.get("filter[_or][0][product_code][_icontains]"), "LPG & 11");
  assert.equal(url.searchParams.get("filter[_or][1][product_name][_icontains]"), "LPG & 11");
  assert.equal(completedRequest.headers.get("authorization"), "Bearer test-token");
  assert.equal(completedRequest.headers.get("accept"), "application/json");
  assert.deepEqual(options, [
    { value: "1", label: "LPG 11KG", code: "LPG-11" },
    { value: "2", label: "LPG 50KG", code: "LPG-50" },
    { value: "3", label: "NO-NAME", code: "NO-NAME" },
  ]);
});

test("uses bounded customer search and unbounded branch master lookups", async () => {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return Response.json({
      data: request.url.includes("/customer")
        ? [
            { customer_code: "C-2", customer_name: "Zulu" },
            { customer_code: "C-1", customer_name: null },
          ]
        : [
            { id: 2, branch_code: "B-2", branch_name: "Zulu" },
            { id: 1, branch_code: "B-1", branch_name: "Alpha" },
          ],
    });
  };
  const options = { directusBaseUrl: "https://directus.test", fetchImpl };

  assert.deepEqual(await fetchReportLookups({ type: "customers", q: "C & 1" }, options), [
    { value: "C-1", label: "C-1", code: "C-1" },
    { value: "C-2", label: "Zulu", code: "C-2" },
  ]);
  assert.deepEqual(await fetchReportLookups({ type: "branches", q: "ignored" }, options), [
    { value: "1", label: "Alpha", code: "B-1" },
    { value: "2", label: "Zulu", code: "B-2" },
  ]);

  const customerUrl = new URL(requests[0].url);
  assert.equal(customerUrl.searchParams.get("limit"), "50");
  assert.equal(customerUrl.searchParams.get("filter[_or][0][customer_code][_icontains]"), "C & 1");
  assert.equal(customerUrl.searchParams.get("filter[_or][1][customer_name][_icontains]"), "C & 1");

  const branchUrl = new URL(requests[1].url);
  assert.equal(branchUrl.searchParams.get("limit"), "-1");
  assert.equal(branchUrl.searchParams.has("filter[_or][0][branch_code][_icontains]"), false);
});

test("requests the salesperson master and normalizes salesperson labels", async () => {
  let request: Request | null = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    request = new Request(input, init);
    return Response.json({
      data: [
        { id: 8, salesman_code: "S08", salesman_name: "  Zoe  " },
        { id: 7, salesman_code: "S07", salesman_name: "Ana" },
        { id: 9, salesman_code: "S09", salesman_name: null },
        { id: null, salesman_code: "DISCARD", salesman_name: "Discard" },
      ],
    });
  };

  const options = await fetchReportLookups(
    { type: "salespeople", q: "ignored" },
    { directusBaseUrl: "https://directus.test", fetchImpl },
  );

  assert.ok(request);
  const url = new URL((request as Request).url);
  assert.equal(url.pathname, "/items/salesman");
  assert.equal(url.searchParams.get("fields"), "id,salesman_code,salesman_name");
  assert.equal(url.searchParams.get("sort"), "salesman_name");
  assert.equal(url.searchParams.get("limit"), "-1");
  assert.equal(
    url.searchParams.has(
      "filter[_or][0][salesman_name][_icontains]",
    ),
    false,
  );
  assert.deepEqual(options, [
    { value: "7", label: "Ana", code: "S07" },
    { value: "9", label: "S09", code: "S09" },
    { value: "8", label: "Zoe", code: "S08" },
  ]);
});
