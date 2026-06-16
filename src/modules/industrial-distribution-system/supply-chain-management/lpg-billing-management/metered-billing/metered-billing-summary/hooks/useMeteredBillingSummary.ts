"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
} from "../../metered-billing-common/types";
import {
  calcTotalWiwoKg,
  calcWiwoDetail,
} from "../../metered-billing-common/utils/calc";
import { fetchSummaryList, fetchSummaryDetail } from "../providers/summary.provider";
import { TransactionType } from "../../metered-billing-common/types";

export function mapMeteredTransaction(tx: unknown): MeteredWiwoTransaction {
  if (!tx) return tx as MeteredWiwoTransaction;
  const raw = tx as Record<string, unknown>;

  const meterReadingRaw =
    raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object"
      ? (raw["meter_reading_id"] as Record<string, unknown>)
      : (raw["meter_reading"] as Record<string, unknown> | undefined);

  const wiwoHeaderRaw =
    raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object"
      ? (raw["wiwo_header_id"] as Record<string, unknown>)
      : (raw["wiwo_header"] as Record<string, unknown> | undefined);

  let siteId = raw["lpg_site_id"] ? Number(raw["lpg_site_id"]) : null;
  if (!siteId && raw["site"] && typeof raw["site"] === "object") {
    const rawSite = raw["site"] as Record<string, unknown>;
    if (rawSite.id) siteId = Number(rawSite.id);
  }

  const txNo = String(raw["transaction_no"] ?? "");
  const readingNo = meterReadingRaw?.reading_no
    ? String(meterReadingRaw.reading_no)
    : String(raw["reading_no"] ?? "");

  return {
    ...raw,
    transaction_no: txNo,
    reading_no: readingNo,
    transaction_type:
      (raw["transaction_type"] as TransactionType) ?? "REGULAR_BILLING",
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
          raw_consumption: Number(meterReadingRaw["raw_consumption"] ?? 0),
          created_by: meterReadingRaw["created_by"]
            ? Number(meterReadingRaw["created_by"])
            : null,
          created_date: meterReadingRaw["created_date"] as string | null,
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
export function useMeteredBillingSummaryList(initialParams: MeteredListParams = {}) {
  const [rows, setRows] = useState<MeteredWiwoTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<MeteredListParams>({
    page: 1,
    limit: 10,
    transactionType: "ALL",
    ...initialParams,
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSummaryList(params);
      setRows((res.data ?? []).map(mapMeteredTransaction));
      setTotal(res.total ?? 0);
    } catch (e) {
      console.error("[useMeteredBillingSummaryList] fetchList error:", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { rows, total, loading, params, setParams, refresh: fetchList };
}

export function useMeteredBillingSummaryDetail(txId: number | null) {
  const [tx, setTx] = useState<MeteredWiwoTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!txId) return;
    let active = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchSummaryDetail(txId)
      .then((rawTx) => {
        if (!active || !rawTx) return;
        const data: MeteredWiwoTransaction = mapMeteredTransaction(rawTx);
        if (data?.wiwo_header?.details) {
          data.wiwo_header.details = data.wiwo_header.details.map(calcWiwoDetail);
          data.wiwo_header.total_wiwo_kg = calcTotalWiwoKg(data.wiwo_header.details);
        }
        setTx(data ?? null);
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
