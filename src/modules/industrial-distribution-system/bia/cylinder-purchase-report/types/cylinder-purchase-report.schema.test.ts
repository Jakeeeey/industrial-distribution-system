import assert from "node:assert/strict";
import test from "node:test";

import { reportLookupQuerySchema } from "./cylinder-purchase-report.schema.ts";

test("defaults a valid lookup query search term to an empty string", () => {
  assert.deepEqual(reportLookupQuerySchema.parse({ type: "branches" }), {
    type: "branches",
    q: "",
  });
});

test("rejects unsupported lookup types and oversized search terms", () => {
  assert.equal(reportLookupQuerySchema.safeParse({ type: "unknown" }).success, false);
  assert.equal(reportLookupQuerySchema.safeParse({ type: "customers", q: "x".repeat(101) }).success, false);
});
