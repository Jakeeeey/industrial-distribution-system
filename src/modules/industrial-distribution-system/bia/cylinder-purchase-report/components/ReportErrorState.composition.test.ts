import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(
  new URL("../CylinderPurchaseReportModule.tsx", import.meta.url),
  "utf8",
);
const errorStateSource = readFileSync(
  new URL("./ReportErrorState.tsx", import.meta.url),
  "utf8",
);

test("refresh failures render an accessible inline Retry state without hiding stale report content", () => {
  assert.doesNotMatch(moduleSource, /error\s*&&\s*!report/);
  assert.match(moduleSource, /variant=\{report\s*\?\s*"inline"\s*:\s*"full"\}/);
  assert.match(errorStateSource, /role="alert"/);
  assert.match(errorStateSource, /aria-live="assertive"/);
  assert.match(errorStateSource, /Unable to refresh the report/);
  assert.match(errorStateSource, />\s*Retry\s*</);
});
