import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyCylinderPurchaseReportRouteError,
  UpstreamContractError,
  UpstreamHttpError,
} from "./cylinder-purchase-report.errors";
import { getCylinderPurchaseDashboard } from "./cylinder-purchase-report.service";
import type { CylinderPurchaseReportFilters } from "../types/cylinder-purchase-report.types";

interface RouteErrorClassification {
  body: {
    ok: false;
    code: string;
    message: string;
  };
  status: number;
}

const filters: CylinderPurchaseReportFilters = {
  startDate: "2026-06-23",
  endDate: "2026-07-22",
};

async function captureDashboardError(fetchImpl: typeof fetch): Promise<unknown> {
  try {
    await getCylinderPurchaseDashboard(filters, {
      fetchImpl,
      now: () => new Date("2026-07-22T10:00:00.000Z"),
      springBaseUrl: "http://spring.test",
    });
  } catch (error) {
    return error;
  }
  assert.fail("Expected the dashboard request to reject.");
}

test("classifies upstream failures into sanitized route responses", async () => {
  const errorsModule = (await import(
    "./cylinder-purchase-report.errors"
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

test("classifies malformed Spring JSON as a sanitized upstream contract response", async () => {
  const error = await captureDashboardError(async () =>
    new Response("{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  assert.deepEqual(classifyCylinderPurchaseReportRouteError(error), {
    status: 502,
    body: {
      ok: false,
      code: "UPSTREAM_CONTRACT_ERROR",
      message: "The report service returned invalid quantity data.",
    },
  });
});

test("classifies a rejected Spring body stream as sanitized upstream unavailability", async () => {
  const bodyError = new TypeError("private response stream failure");
  const error = await captureDashboardError(async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(bodyError);
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  assert.deepEqual(classifyCylinderPurchaseReportRouteError(error), {
    status: 502,
    body: {
      ok: false,
      code: "UPSTREAM_UNAVAILABLE",
      message: "The report service is unavailable.",
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
