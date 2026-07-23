import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./cylinder-purchase-report.errors.ts";

interface RouteErrorClassification {
  body: {
    ok: false;
    code: string;
    message: string;
  };
  status: number;
}

test("classifies upstream failures into sanitized route responses", async () => {
  const errorsModule = (await import(
    "./cylinder-purchase-report.errors.ts"
  )) as Record<string, unknown>;
  const classify = errorsModule.classifyCylinderPurchaseReportRouteError as
    | ((error: unknown) => RouteErrorClassification)
    | undefined;

  assert.equal(typeof classify, "function");
  if (!classify) return;

  assert.deepEqual(classify(new UpstreamHttpError(null)), {
    status: 502,
    body: {
      ok: false,
      code: "UPSTREAM_UNAVAILABLE",
      message: "The report service is unavailable.",
    },
  });
  assert.deepEqual(
    classify(new DOMException("private timeout detail", "AbortError")),
    {
      status: 504,
      body: {
        ok: false,
        code: "UPSTREAM_TIMEOUT",
        message: "The report service timed out.",
      },
    },
  );
  assert.deepEqual(classify(new UpstreamContractError("private row detail")), {
    status: 502,
    body: {
      ok: false,
      code: "UPSTREAM_CONTRACT_ERROR",
      message: "The report service returned invalid quantity data.",
    },
  });
});

test("the report route delegates error mapping to the tested classifier", () => {
  const routeSource = readFileSync(
    new URL(
      "../../../../../app/api/ids/bia/cylinder-purchase-report/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    routeSource,
    /classifyCylinderPurchaseReportRouteError\(error\)/,
  );
});
