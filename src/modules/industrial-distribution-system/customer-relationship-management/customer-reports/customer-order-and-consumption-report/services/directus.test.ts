import assert from "node:assert/strict";
import test from "node:test";

import {
  chunk,
  fetchDirectusRows,
  resolveDirectusConfig,
} from "./directus";
import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./customer-order-consumption.errors";

const config = { baseUrl: "http://directus.test", token: "opaque" };

/** Next types ProcessEnv as always carrying NODE_ENV, so tests build it here. */
const env = (values: Record<string, string>): NodeJS.ProcessEnv =>
  ({ NODE_ENV: "test", ...values }) as NodeJS.ProcessEnv;

interface FakeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

/** Records every URL so a test can assert the exact query Directus receives. */
function recorder(
  handler: (url: URL) => FakeResponse
): { fetch: typeof fetch; urls: URL[]; calls: { headers: Record<string, string> }[] } {
  const urls: URL[] = [];
  const calls: { headers: Record<string, string> }[] = [];
  const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    urls.push(url);
    calls.push({ headers: (init?.headers ?? {}) as Record<string, string> });
    return handler(url) as unknown as Response;
  }) as typeof fetch;
  return { fetch: fake, urls, calls };
}

const jsonRows = (rows: unknown[]): FakeResponse => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => ({ data: rows }),
});

test("resolveDirectusConfig normalises a bare host and drops the trailing slash", () => {
  assert.deepEqual(
    resolveDirectusConfig(env({ NEXT_PUBLIC_API_BASE_URL: "10.0.0.9:8055/", DIRECTUS_STATIC_TOKEN: "t" })),
    { baseUrl: "http://10.0.0.9:8055", token: "t" }
  );
  assert.equal(
    resolveDirectusConfig(env({ DIRECTUS_URL: "https://ids.example.com/" })).baseUrl,
    "https://ids.example.com"
  );
  // HTTPS is never downgraded by the bare-host rule.
  assert.equal(
    resolveDirectusConfig(env({ NEXT_PUBLIC_DIRECTUS_URL: "https://a.test" })).baseUrl,
    "https://a.test"
  );
});

test("resolveDirectusConfig prefers the first configured variable", () => {
  const resolved = resolveDirectusConfig(env({
    DIRECTUS_URL: "http://first.test",
    NEXT_PUBLIC_DIRECTUS_URL: "http://second.test",
    NEXT_PUBLIC_API_BASE_URL: "http://third.test",
    DIRECTUS_TOKEN: "fallback-token",
  }));
  assert.equal(resolved.baseUrl, "http://first.test");
  assert.equal(resolved.token, "fallback-token");
});

test("resolveDirectusConfig refuses to run without an endpoint", () => {
  assert.throws(
    () => resolveDirectusConfig(env({ NEXT_PUBLIC_API_BASE_URL: "   " })),
    /NEXT_PUBLIC_API_BASE_URL is not configured/
  );
});

test("fetchDirectusRows sends fields, filter, sort and an unpaged limit", async () => {
  const spy = recorder(() => jsonRows([{ id: 1 }]));
  const rows = await fetchDirectusRows<{ id: number }>(
    "branches",
    {
      fields: "id,branch_name",
      filter: { invoice_date: { _gte: "2026-01-01", _lte: "2026-01-31" } },
      sort: "-invoice_date",
      fetchImpl: spy.fetch,
    },
    config
  );

  assert.deepEqual(rows, [{ id: 1 }]);
  const url = spy.urls[0] as URL;
  assert.equal(url.pathname, "/items/branches");
  assert.equal(url.searchParams.get("fields"), "id,branch_name");
  assert.equal(url.searchParams.get("limit"), "-1", "the 100-row default would truncate a report");
  assert.equal(url.searchParams.get("sort"), "-invoice_date");
  assert.deepEqual(JSON.parse(url.searchParams.get("filter") ?? "{}"), {
    invoice_date: { _gte: "2026-01-01", _lte: "2026-01-31" },
  });
});

test("fetchDirectusRows sends the bearer token server-side only", async () => {
  const spy = recorder(() => jsonRows([]));
  await fetchDirectusRows("branches", { fields: "id", fetchImpl: spy.fetch }, config);
  assert.equal((spy.calls[0] as { headers: Record<string, string> }).headers.Authorization, "Bearer opaque");

  const anonymous = recorder(() => jsonRows([]));
  await fetchDirectusRows("branches", { fields: "id", fetchImpl: anonymous.fetch }, { ...config, token: "" });
  assert.equal(
    (anonymous.calls[0] as { headers: Record<string, string> }).headers.Authorization,
    undefined,
    "an unconfigured token must not become a bogus header"
  );
});

test("fetchDirectusRows omits an empty filter object", async () => {
  const spy = recorder(() => jsonRows([]));
  await fetchDirectusRows("units", { fields: "unit_id", filter: {}, fetchImpl: spy.fetch }, config);
  assert.equal((spy.urls[0] as URL).searchParams.get("filter"), null);
});

test("a non-2xx response becomes an UpstreamHttpError with the status", async () => {
  const spy = recorder(() => ({ ok: false, status: 503, statusText: "Service Unavailable", json: async () => ({}) }));
  await assert.rejects(
    fetchDirectusRows("branches", { fields: "id", fetchImpl: spy.fetch }, config),
    (error: unknown) => {
      assert.ok(error instanceof UpstreamHttpError);
      assert.equal(error.statusCode, 503);
      return true;
    }
  );
});

test("a network failure keeps its cause and reports a null status", async () => {
  const failing = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;

  await assert.rejects(
    fetchDirectusRows("branches", { fields: "id", fetchImpl: failing }, config),
    (error: unknown) => {
      assert.ok(error instanceof UpstreamHttpError);
      assert.equal(error.statusCode, null);
      assert.match(error.message, /Network error/);
      return true;
    }
  );
});

test("an abort is re-thrown instead of being reported as an outage", async () => {
  const abort = new Error("Aborted");
  abort.name = "AbortError";
  const rejecting = (async () => {
    throw abort;
  }) as unknown as typeof fetch;

  await assert.rejects(fetchDirectusRows("branches", { fields: "id", fetchImpl: rejecting }, config), abort);
});

test("a payload without a data array breaks the contract, not the totals", async () => {
  for (const payload of [{}, { data: null }, { data: { id: 1 } }]) {
    const spy = recorder(() => ({ ok: true, status: 200, statusText: "OK", json: async () => payload }));
    await assert.rejects(
      fetchDirectusRows("sales_invoice", { fields: "invoice_id", fetchImpl: spy.fetch }, config),
      (error: unknown) => {
        assert.ok(error instanceof UpstreamContractError, JSON.stringify(payload));
        assert.match(error.message, /sales_invoice/);
        return true;
      }
    );
  }
});

test("a non-JSON body is reported as a contract break", async () => {
  const spy = recorder(() => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  }));
  await assert.rejects(
    fetchDirectusRows("branches", { fields: "id", fetchImpl: spy.fetch }, config),
    UpstreamContractError
  );
});

test("chunk batches ids so an _in filter cannot outgrow the URL", () => {
  assert.deepEqual(chunk([]), [], "an empty id list must not fire a request");
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);

  const ids = Array.from({ length: 1201 }, (_, index) => index + 1);
  const batches = chunk(ids);
  assert.equal(batches.length, 3);
  assert.equal(batches[0]?.length, 500);
  assert.equal(batches[2]?.length, 201);
  assert.equal(batches.reduce((sum, batch) => sum + batch.length, 0), 1201);
  assert.deepEqual(batches.flat(), ids, "no id is duplicated or lost");
});
