import {
  cylinderPurchaseRowsSchema,
} from "../types/cylinder-purchase-report.schema";
import type {
  AppliedFilterContext,
  CylinderPurchaseDashboardResponse,
} from "../types/cylinder-purchase-report.types";
import { UpstreamContractError } from "./cylinder-purchase-report.errors";
import { aggregateCylinderPurchases } from "./cylinder-purchase-report.helpers";
import { fetchCylinderPurchaseRows } from "./cylinder-purchase-report.repo";

const QUANTITY_EPSILON = 1e-9;

export interface ReportServiceDependencies {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  springBaseUrl?: string;
  timeoutMs?: number;
}

export async function getCylinderPurchaseDashboard(
  filters: AppliedFilterContext,
  dependencies: ReportServiceDependencies = {},
): Promise<CylinderPurchaseDashboardResponse> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? 20_000,
  );

  try {
    const raw = await fetchCylinderPurchaseRows(filters, {
      fetchImpl: dependencies.fetchImpl,
      springBaseUrl: dependencies.springBaseUrl,
      signal: controller.signal,
    });
    const parsed = cylinderPurchaseRowsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new UpstreamContractError(parsed.error.message);
    }

    for (const row of parsed.data) {
      const expected = row.grossPurchasedQty - row.returnedQty;
      if (Math.abs(expected - row.netPurchasedQty) > QUANTITY_EPSILON) {
        throw new UpstreamContractError(
          `Quantity mismatch for ${row.invoiceDate}/${row.productId}`,
        );
      }
    }

    const now = dependencies.now?.() ?? new Date();
    return aggregateCylinderPurchases(parsed.data, filters, now.toISOString());
  } finally {
    clearTimeout(timer);
  }
}
