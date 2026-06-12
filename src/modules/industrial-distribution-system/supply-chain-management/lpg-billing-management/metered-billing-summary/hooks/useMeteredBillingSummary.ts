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
import { mapMeteredTransaction } from "../../metered-wiwo-billing/hooks/useMeteredWiwoBilling";

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
