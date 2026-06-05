"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
  BillableSource,
  TransactionStatus,
  WiwoHeaderRef,
  MeterReading,
} from "../types";
import {
  calcTotalWiwoKg,
  computeArbitration,
  calcGrossAmount,
  calcVatAmount,
  calcNetAmount,
  calcWiwoDetail,
} from "../utils/metered-wiwo.calc";
import { updateSiteReading } from "../providers/metered-wiwo.provider";

export function mapMeteredTransaction(tx: unknown): MeteredWiwoTransaction {
  if (!tx) return tx as MeteredWiwoTransaction;
  const raw = tx as Record<string, unknown>;

  const meterReadingRaw = raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object"
    ? (raw["meter_reading_id"] as Record<string, unknown>)
    : (raw["meter_reading"] as Record<string, unknown> | undefined);

  const wiwoHeaderRaw = raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object"
    ? (raw["wiwo_header_id"] as Record<string, unknown>)
    : (raw["wiwo_header"] as Record<string, unknown> | undefined);

  return {
    ...raw,
    meter_reading_id: meterReadingRaw ? Number(meterReadingRaw["id"]) : (raw["meter_reading_id"] ? Number(raw["meter_reading_id"]) : null),
    wiwo_header_id: wiwoHeaderRaw ? Number(wiwoHeaderRaw["id"]) : (raw["wiwo_header_id"] ? Number(raw["wiwo_header_id"]) : null),
    metered_kg: Number(raw["metered_kg"] ?? 0),
    wiwo_kg: Number(raw["wiwo_kg"] ?? 0),
    variance_kg: Number(raw["variance_kg"] ?? 0),
    billable_kg: Number(raw["billable_kg"] ?? 0),
    price_per_kg: Number(raw["price_per_kg"] ?? 0),
    gross_amount: Number(raw["gross_amount"] ?? 0),
    vat_amount: Number(raw["vat_amount"] ?? 0),
    net_amount: Number(raw["net_amount"] ?? 0),
    meter_reading: meterReadingRaw ? {
      ...meterReadingRaw,
      id: Number(meterReadingRaw["id"]),
      lpg_site_id: Number(meterReadingRaw["lpg_site_id"]),
      reading_date: meterReadingRaw["reading_date"] as string,
      previous_reading: Number(meterReadingRaw["previous_reading"] ?? 0),
      current_reading: Number(meterReadingRaw["current_reading"] ?? 0),
      kg_consumed: Number(meterReadingRaw["kg_consumed"] ?? 0),
      price_per_kg: Number(meterReadingRaw["price_per_kg"] ?? 0),
      raw_consumption: Number(meterReadingRaw["raw_consumption"] ?? 0),
      created_by: meterReadingRaw["created_by"] ? Number(meterReadingRaw["created_by"]) : null,
      created_date: meterReadingRaw["created_date"] as string | null,
    } : undefined,
    wiwo_header: wiwoHeaderRaw ? {
      ...wiwoHeaderRaw,
      transaction_no: (wiwoHeaderRaw["wiwo_no"] ?? wiwoHeaderRaw["transaction_no"]) as string,
      status: (wiwoHeaderRaw["wiwo_status"] ?? wiwoHeaderRaw["status"]) as string,
    } : undefined,
  } as MeteredWiwoTransaction;
}

// ─── List hook ────────────────────────────────────────────────────────────────

export function useMeteredWiwoList(initialParams: MeteredListParams = {}) {
  const [rows, setRows] = useState<MeteredWiwoTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<MeteredListParams>({ page: 1, limit: 10, ...initialParams });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 10),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
      });
      const res = await window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing?${qs}`);
      const d = await res.json();
      setRows((d.data ?? []).map(mapMeteredTransaction));
      setTotal(d.total ?? 0);
    } catch (e) {
      console.error("[useMeteredWiwoList]", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rows, total, loading, params, setParams, refresh: fetch };
}

// ─── Form / billing computation hook ─────────────────────────────────────────

export interface MeteredBillingFormState {
  transactionNo: string;
  transactionDate: string;
  customerCode: string;
  siteId: number | null;
  siteName: string | null;
  meterReadingId: number | null;
  wiwoHeaderId: number | null;
  previousReading: number;
  currentReading: number;
  pricePerKg: number;
  vatRate: number;
  remarks: string;
  status: TransactionStatus;
}

export function useMeteredWiwoBillingForm(txId?: number | null) {
  const [form, setForm] = useState<MeteredBillingFormState>({
    transactionNo: `MTR-${Date.now().toString().slice(-6)}`,
    transactionDate: new Date().toISOString().slice(0, 10),
    customerCode: "",
    siteId: null,
    siteName: null,
    meterReadingId: null,
    wiwoHeaderId: null,
    previousReading: 0,
    currentReading: 0,
    pricePerKg: 0,
    vatRate: 0,
    remarks: "",
    status: "DRAFT",
  });

  const [wiwoKg, setWiwoKg] = useState(0);
  const [originalStatus, setOriginalStatus] = useState<TransactionStatus>("DRAFT");
  const [linkedWiwo, setLinkedWiwo] = useState<WiwoHeaderRef | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selector states
  const [sites, setSites] = useState<Record<string, unknown>[]>([]);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [wiwoHeaders, setWiwoHeaders] = useState<WiwoHeaderRef[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [wiwoLoading, setWiwoLoading] = useState(false);

  // Load sites on mount
  useEffect(() => {
    setSitesLoading(true);
    window.fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=sites")
      .then((r) => r.json())
      .then((d) => {
        setSites(d.data ?? []);
      })
      .catch(console.error)
      .finally(() => setSitesLoading(false));
  }, []);

  // Load existing transaction
  useEffect(() => {
    if (!txId) {
      setForm({
        transactionNo: `MTR-${Date.now().toString().slice(-6)}`,
        transactionDate: new Date().toISOString().slice(0, 10),
        customerCode: "",
        siteId: null,
        siteName: null,
        meterReadingId: null,
        wiwoHeaderId: null,
        previousReading: 0,
        currentReading: 0,
        pricePerKg: 0,
        vatRate: 0,
        remarks: "",
        status: "DRAFT",
      });
      setWiwoKg(0);
      setLinkedWiwo(null);
      setOriginalStatus("DRAFT");
      return;
    }
    setLoading(true);
    window
      .fetch(`/api/ids/scm/lpg-billing-management/metered-billing/${txId}`)
      .then((r) => r.json())
      .then((d) => {
        const tx: MeteredWiwoTransaction = mapMeteredTransaction(d.data);
        if (!tx) return;
        setForm({
          transactionNo: tx.transaction_no,
          transactionDate: tx.transaction_date,
          customerCode: tx.customer_code,
          siteId: tx.lpg_site_id,
          siteName: tx.site?.site_name ?? null,
          meterReadingId: tx.meter_reading_id,
          wiwoHeaderId: tx.wiwo_header_id,
          previousReading: tx.meter_reading?.previous_reading ?? 0,
          currentReading: tx.meter_reading?.current_reading ?? 0,
          pricePerKg: tx.price_per_kg,
          vatRate: 0,
          remarks: tx.remarks ?? "",
          status: tx.status,
        });
        setOriginalStatus(tx.status);
        setWiwoKg(tx.wiwo_kg);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [txId]);

  // Load readings and wiwo headers when site changes
  useEffect(() => {
    if (!form.siteId) {
      setMeterReadings([]);
      setWiwoHeaders([]);
      return;
    }

    setReadingsLoading(true);
    window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing?type=readings&siteId=${form.siteId}`)
      .then((r) => r.json())
      .then((d) => {
        setMeterReadings(d.data ?? []);
      })
      .catch(console.error)
      .finally(() => setReadingsLoading(false));

    setWiwoLoading(true);
    window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing?type=wiwo-headers&siteId=${form.siteId}&customerCode=${form.customerCode}`)
      .then((r) => r.json())
      .then((d) => {
        setWiwoHeaders(d.data ?? []);
      })
      .catch(console.error)
      .finally(() => setWiwoLoading(false));
  }, [form.siteId, form.customerCode]);

  // Compute from current wiwoHeaderId if selected
  const loadWiwoKg = useCallback(async (headerId: number) => {
    try {
      const res = await window.fetch(
        `/api/ids/scm/lpg-billing-management/kilo-consumption-billing/${headerId}`
      );
      const d = await res.json();
      const wiwo = d.data as WiwoHeaderRef | undefined;
      if (wiwo) {
        setLinkedWiwo(wiwo);
        setWiwoKg(Number(wiwo.total_wiwo_kg ?? 0));
      } else {
        setLinkedWiwo(null);
        setWiwoKg(0);
      }
    } catch (e) {
      console.error("[loadWiwoKg]", e);
      setLinkedWiwo(null);
      setWiwoKg(0);
    }
  }, []);

  useEffect(() => {
    if (!form.wiwoHeaderId) {
      setWiwoKg(0);
      return;
    }
    loadWiwoKg(form.wiwoHeaderId);
  }, [form.wiwoHeaderId, loadWiwoKg]);

  const handleSiteChange = useCallback((siteId: number) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
    setForm((f) => ({
      ...f,
      siteId,
      siteName: (site.site_name ?? null) as string | null,
      customerCode: (site.customer_code ?? "") as string,
      pricePerKg: Number(site.default_price_per_kg ?? 0),
      meterReadingId: null,
      wiwoHeaderId: null,
      previousReading: Number(site.last_meter_reading ?? 0),
      currentReading: 0,
    }));
  }, [sites]);

  const handleReadingChange = useCallback((readingId: number) => {
    const reading = meterReadings.find((r) => r.id === readingId);
    if (!reading) return;
    setForm((f) => ({
      ...f,
      meterReadingId: readingId,
      previousReading: Number(reading.previous_reading ?? 0),
      currentReading: Number(reading.current_reading ?? 0),
    }));
  }, [meterReadings]);

  // Computed arbitration
  const selectedSite = sites.find((s) => s.id === form.siteId);
  const meterDirection = (selectedSite?.meter_direction ?? "INCREASING") as string;
  const conversionFactor = Number(selectedSite?.conversion_factor ?? 1);
  const isMeteredOnly = selectedSite?.billing_mode === "METERED";

  // Meter Reading Validation & Calculation
  const isValidReading =
    meterDirection === "DECREASING"
      ? form.currentReading <= form.previousReading
      : form.currentReading >= form.previousReading;

  const rawConsumption =
    meterDirection === "DECREASING"
      ? Math.max(0, form.previousReading - form.currentReading)
      : Math.max(0, form.currentReading - form.previousReading);

  const meteredKg = Number((rawConsumption * conversionFactor).toFixed(3));
  
  const arbitration = useMemo(() => {
    return isMeteredOnly
      ? {
          metered_kg: meteredKg,
          wiwo_kg: 0,
          variance_kg: 0,
          billable_kg: meteredKg,
          billable_source: "METERED" as BillableSource,
        }
      : computeArbitration(meteredKg, wiwoKg);
  }, [isMeteredOnly, meteredKg, wiwoKg]);

  const grossAmount = calcGrossAmount(arbitration.billable_kg, form.pricePerKg);
  const vatAmount = calcVatAmount(grossAmount, form.vatRate);
  const netAmount = calcNetAmount(grossAmount, vatAmount);

  const hasVariance = !isMeteredOnly && Number(arbitration.variance_kg) > 0;
  const canPost =
    arbitration.billable_kg > 0 &&
    netAmount > 0 &&
    !!form.customerCode &&
    !!form.siteId &&
    isValidReading &&
    (!hasVariance || !!form.remarks.trim());

  const submit = useCallback(async (statusOverride?: TransactionStatus): Promise<boolean> => {
    setSubmitting(true);
    try {
      const targetStatus = statusOverride || form.status;
      const payload: Partial<MeteredWiwoTransaction> & { previous_reading?: number; current_reading?: number; transaction_type?: string } = {
        transaction_no: form.transactionNo,
        transaction_date: form.transactionDate,
        transaction_type: "REGULAR_BILLING",
        customer_code: form.customerCode,
        lpg_site_id: form.siteId,
        meter_reading_id: form.meterReadingId,
        wiwo_header_id: form.wiwoHeaderId,
        metered_kg: arbitration.metered_kg,
        wiwo_kg: arbitration.wiwo_kg,
        variance_kg: arbitration.variance_kg,
        billable_source: arbitration.billable_source,
        billable_kg: arbitration.billable_kg,
        price_per_kg: form.pricePerKg,
        gross_amount: grossAmount,
        vat_amount: vatAmount,
        net_amount: netAmount,
        status: targetStatus,
        remarks: form.remarks,
        sales_invoice_id: null,
        previous_reading: form.previousReading,
        current_reading: form.currentReading,
      };

      const url = txId
        ? `/api/ids/scm/lpg-billing-management/metered-billing/${txId}`
        : "/api/ids/scm/lpg-billing-management/metered-billing";
      const res = await window.fetch(url, {
        method: txId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return false;

      // ─── Critical: update site last_meter_reading after a POSTED transaction ───
      if (targetStatus === "POSTED" && form.siteId && form.currentReading !== undefined) {
        try {
          await updateSiteReading(
            form.siteId,
            form.currentReading,
            form.transactionDate
          );
        } catch (err) {
          // Log but don't fail the submit — transaction is already saved
          console.error("[useMeteredWiwoBillingForm] updateSiteReading failed:", err);
        }
      }

      return true;
    } catch (e) {
      console.error("[useMeteredWiwoBillingForm.submit]", e);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [form, arbitration, grossAmount, vatAmount, netAmount, txId]);

  return {
    form, setForm,
    originalStatus,
    wiwoKg, setWiwoKg, loadWiwoKg,
    meteredKg, arbitration,
    grossAmount, vatAmount, netAmount,
    canPost, loading, submitting, submit,
    sites, sitesLoading, handleSiteChange,
    meterReadings, readingsLoading, handleReadingChange,
    wiwoHeaders, wiwoLoading,
    linkedWiwo,
    isValidReading,
    meterDirection,
    conversionFactor,
  };
}

// ─── Detail view hook ─────────────────────────────────────────────────────────

export function useMeteredWiwoDetail(txId: number | null) {
  const [tx, setTx] = useState<MeteredWiwoTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!txId) return;
    let active = true;
    
    // Defer loading state to avoid synchronous state updates inside render phase
    const timer = setTimeout(() => {
      if (active) setLoading(true);
    }, 0);

    window
      .fetch(`/api/ids/scm/lpg-billing-management/metered-billing/${txId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const data: MeteredWiwoTransaction = mapMeteredTransaction(d.data);
        if (data?.wiwo_header?.details) {
          data.wiwo_header.details = data.wiwo_header.details.map(calcWiwoDetail);
          data.wiwo_header.total_wiwo_kg = calcTotalWiwoKg(data.wiwo_header.details);
        }
        setTx(data ?? null);
      })
      .catch(console.error)
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [txId]);

  return { tx, loading };
}
