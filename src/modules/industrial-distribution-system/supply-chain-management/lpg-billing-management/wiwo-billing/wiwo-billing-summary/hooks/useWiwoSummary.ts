// RULE DEV: WiWO Billing Summary hooks
// Provides state management for the summary list and detail views.
// Mirrors the pattern from metered-billing-summary/hooks/useMeteredBillingSummary.ts

"use client";

import { useState, useCallback, useEffect } from "react";
import type { MeteredWiwoTransaction } from "../types";
import type { WiwoSummaryListParams } from "../types";
import { fetchWiwoSummaryList, fetchWiwoSummaryDetail } from "../providers/wiwo-summary.provider";

/** Normalize a raw API transaction record into a typed MeteredWiwoTransaction. */
export function mapWiwoTransaction(tx: unknown): MeteredWiwoTransaction {
  if (!tx) return tx as MeteredWiwoTransaction;
  const raw = tx as Record<string, unknown>;

  // Normalize meter_reading relation (can be an embedded object or raw ID)
  const meterReadingRaw =
    raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object"
      ? (raw["meter_reading_id"] as Record<string, unknown>)
      : (raw["meter_reading"] as Record<string, unknown> | undefined);

  // Normalize wiwo_header relation
  const wiwoHeaderRaw =
    raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object"
      ? (raw["wiwo_header_id"] as Record<string, unknown>)
      : (raw["wiwo_header"] as Record<string, unknown> | undefined);

  let siteId = raw["lpg_site_id"] ? Number(raw["lpg_site_id"]) : null;
  if (!siteId && raw["site"] && typeof raw["site"] === "object") {
    const rawSite = raw["site"] as Record<string, unknown>;
    if (rawSite.id) siteId = Number(rawSite.id);
  }

  return {
    ...raw,
    transaction_no: String(raw["transaction_no"] ?? ""),
    transaction_type: (raw["transaction_type"] as string) ?? "REGULAR_BILLING",
    lpg_site_id: siteId,
    meter_reading_id: meterReadingRaw
      ? Number(meterReadingRaw["id"])
      : raw["meter_reading_id"]
        ? Number(raw["meter_reading_id"])
        : null,
    wiwo_header_id: wiwoHeaderRaw
      ? Number(wiwoHeaderRaw["id"])
      : raw["wiwo_header_id"]
        ? Number(raw["wiwo_header_id"])
        : null,
    metered_kg: Number(raw["metered_kg"] ?? 0),
    wiwo_kg: Number(raw["wiwo_kg"] ?? 0),
    variance_kg: Number(raw["variance_kg"] ?? 0),
    billable_kg: Number(raw["billable_kg"] ?? 0),
    price_per_kg: Number(raw["price_per_kg"] ?? 0),
    gross_amount: Number(raw["gross_amount"] ?? 0),
    vat_amount: Number(raw["vat_amount"] ?? 0),
    net_amount: Number(raw["net_amount"] ?? 0),
    meter_reading: meterReadingRaw
      ? {
          ...meterReadingRaw,
          id: Number(meterReadingRaw["id"]),
          lpg_site_id: meterReadingRaw["lpg_site_id"]
            ? Number(meterReadingRaw["lpg_site_id"])
            : (siteId ?? 0),
          reading_date: meterReadingRaw["reading_date"] as string,
          previous_reading: Number(meterReadingRaw["previous_reading"] ?? 0),
          current_reading: Number(meterReadingRaw["current_reading"] ?? 0),
          kg_consumed: Number(meterReadingRaw["kg_consumed"] ?? 0),
          price_per_kg: Number(meterReadingRaw["price_per_kg"] ?? 0),
        }
      : undefined,
    wiwo_header: wiwoHeaderRaw
      ? {
          ...wiwoHeaderRaw,
          transaction_no: (wiwoHeaderRaw["wiwo_no"] ??
            wiwoHeaderRaw["transaction_no"]) as string,
          status: (wiwoHeaderRaw["wiwo_status"] ??
            wiwoHeaderRaw["status"]) as string,
        }
      : undefined,
  } as MeteredWiwoTransaction;
}

/** Hook: paginated list of WiWO transactions for summary */
export function useWiwoSummaryList(initialParams: WiwoSummaryListParams = {}) {
  const [rows, setRows] = useState<MeteredWiwoTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<WiwoSummaryListParams>({
    page: 1,
    limit: 10,
    transactionType: "ALL",
    ...initialParams,
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWiwoSummaryList(params);
      setRows((res.data ?? []).map(mapWiwoTransaction));
      setTotal(res.total ?? 0);
    } catch (e) {
      console.error("[useWiwoSummaryList] fetchList error:", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { rows, total, loading, params, setParams, refresh: fetchList };
}

/** Hook: single WiWO transaction detail */
export function useWiwoSummaryDetail(txId: number | null) {
  const [tx, setTx] = useState<MeteredWiwoTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!txId) {
      setTx(null);
      return;
    }
    let active = true;

    setLoading(true);
    fetchWiwoSummaryDetail(txId)
      .then((rawTx) => {
        if (!active || !rawTx) return;
        setTx(mapWiwoTransaction(rawTx));
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [txId]);

  return { tx, loading };
}
