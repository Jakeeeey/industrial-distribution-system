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

  let siteId = raw["lpg_site_id"] ? Number(raw["lpg_site_id"]) : null;
  if (!siteId && raw["site"] && typeof raw["site"] === "object") {
    const rawSite = raw["site"] as Record<string, unknown>;
    if (rawSite.id) siteId = Number(rawSite.id);
  }

  return {
    ...raw,
    lpg_site_id: siteId,
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
      lpg_site_id: meterReadingRaw["lpg_site_id"] ? Number(meterReadingRaw["lpg_site_id"]) : (siteId ?? 0),
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
  readingNo: string;
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
  /** User-editable Meter Configuration overrides */
  configLpgVapor: number;
  configPsi: number;
  configCorrectionFactor: number;
}

function generateMtrNo(siteId?: number | null, date?: string): string {
  const d = date || new Date().toISOString().slice(0, 10);
  const dateStr = d.replace(/-/g, "").slice(0, 8);
  const sId = siteId ?? 0;
  const seq = Date.now().toString().slice(-3);
  return `MTR-${dateStr}${sId}${seq}`;
}

export function useMeteredWiwoBillingForm(txId?: number | null) {
  const [form, setForm] = useState<MeteredBillingFormState>({
    readingNo: generateMtrNo(),
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
    configLpgVapor: 2.0183,
    configPsi: 10.0,
    configCorrectionFactor: 14.7,
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
        readingNo: generateMtrNo(),
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
        configLpgVapor: 2.0183,
        configPsi: 10.0,
        configCorrectionFactor: 14.7,
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
        // const rawMr = tx.meter_reading as unknown as Record<string, unknown> | undefined;

        let lpgVapor = Number(tx.site?.default_pressure_line ?? 2.0183);
        let psi = Number(tx.site?.default_psi ?? 10.0);
        let cf = Number(tx.site?.default_atmospheric_pressure ?? 14.7);

        if (typeof window !== "undefined" && tx.lpg_site_id) {
          const cached = localStorage.getItem(`lpg_site_config_${tx.lpg_site_id}`);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              lpgVapor = Number(parsed.configLpgVapor ?? lpgVapor);
              psi = Number(parsed.configPsi ?? psi);
              cf = Number(parsed.configCorrectionFactor ?? cf);
            } catch (e) {
              console.error(e);
            }
          }
        }

        setForm({
          readingNo: tx.reading_no,
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
          configLpgVapor: lpgVapor,
          configPsi: psi,
          configCorrectionFactor: cf,
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

  // Fetch sequential transaction number for new transactions
  useEffect(() => {
    if (txId) return; // Do not fetch/overwrite transaction number for existing records
    if (!form.customerCode || !form.siteId) {
      // If no site is selected, show default placeholder with 001
      const d = form.transactionDate || new Date().toISOString().slice(0, 10);
      const dateStr = d.replace(/-/g, "").slice(0, 8);
      setForm((f) => {
        const placeholder = `MTR-${dateStr}${form.siteId ? "" : "0"}001`; // format as non-hyphenated MTR-{dateStr}{siteId}{seq}
        if (f.readingNo === placeholder) return f;
        return {
          ...f,
          readingNo: placeholder,
        };
      });
      return;
    }

    let active = true;
    const fetchSeq = async () => {
      try {
        const url = `/api/ids/scm/lpg-billing-management/metered-billing?type=next-seq&customerCode=${encodeURIComponent(form.customerCode)}&date=${form.transactionDate}`;
        const res = await window.fetch(url);
        const data = await res.json();
        if (!active) return;
        const seq = data.seq ?? 1;
        const seqStr = String(seq).padStart(3, "0");
        const dateStr = form.transactionDate.replace(/-/g, "").slice(0, 8);
        const newTxNo = `MTR-${dateStr}${form.siteId}${seqStr}`;
        setForm((f) => {
          if (f.readingNo === newTxNo) return f;
          return {
            ...f,
            readingNo: newTxNo,
          };
        });
      } catch (err) {
        console.error("Failed to fetch next seq number:", err);
      }
    };

    fetchSeq();
    return () => {
      active = false;
    };
  }, [txId, form.customerCode, form.transactionDate, form.siteId]);

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

    let lpgVapor = Number(site.default_pressure_line ?? 2.0183);
    let psi = Number(site.default_psi ?? 10.0);
    let cf = Number(site.default_atmospheric_pressure ?? 14.7);

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`lpg_site_config_${siteId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          lpgVapor = Number(parsed.configLpgVapor ?? lpgVapor);
          psi = Number(parsed.configPsi ?? psi);
          cf = Number(parsed.configCorrectionFactor ?? cf);
        } catch (e) {
          console.error(e);
        }
      }
    }

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
      configLpgVapor: lpgVapor,
      configPsi: psi,
      configCorrectionFactor: cf,
      readingNo: generateMtrNo(siteId, f.transactionDate),
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

  // ── Pressure / PSI constants from site (matching physical bill terminology) ──
  /** LPG VAPOR — constant from pressure tables (e.g. 2.0183) — site default */
  const siteLpgVapor = Number(selectedSite?.default_pressure_line ?? 2.0183);
  /** PSI — gauge operating pressure (e.g. 10.0000) — site default */
  const sitePsi = Number(selectedSite?.default_psi ?? 10.0);
  /** CORRECTION FACTOR — atmospheric pressure constant (default 14.7) — site default */
  const siteCorrectionFactor = Number(selectedSite?.default_atmospheric_pressure ?? 14.7);

  // ── User-editable config (form overrides site defaults) ──
  const activeLpgVapor = form.configLpgVapor;
  const activePsi = form.configPsi;
  const activeCorrectionFactor = form.configCorrectionFactor;

  /** PRESSURE LINE — computed: (PSI + CF) / CF (e.g. 1.6803) */
  const pressureLine = activePsi > 0
    ? (activePsi + activeCorrectionFactor) / activeCorrectionFactor
    : 1;

  const isMeteredOnly = true; // WIWO commented out for now: selectedSite?.billing_mode === "METERED";

  // Meter Reading Validation & Calculation
  const isValidReading =
    meterDirection === "DECREASING"
      ? form.currentReading <= form.previousReading
      : form.currentReading >= form.previousReading;

  const rawConsumption =
    meterDirection === "DECREASING"
      ? Math.max(0, form.previousReading - form.currentReading)
      : Math.max(0, form.currentReading - form.previousReading);

  // KG = Usage × LPG Vapor × Pressure Line (uses active/user-edited config)
  const meteredKg = Number((rawConsumption * activeLpgVapor * pressureLine).toFixed(4));
  
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

  const meterUnit = (selectedSite?.meter_unit ?? "KG") as "M3" | "LITER" | "KG" | "UNIT";

  const submit = useCallback(async (statusOverride?: TransactionStatus): Promise<boolean> => {
    setSubmitting(true);
    try {
      const targetStatus = statusOverride || form.status;
      const payload: Partial<MeteredWiwoTransaction> & {
        previous_reading?: number;
        current_reading?: number;
        transaction_type?: string;
        pressure_line?: number;
        psi?: number;
        atmospheric_pressure?: number;
        lpg_vapor_factor?: number;
      } = {
        reading_no: form.readingNo,
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
        // Pressure fields — stored as snapshot on meter reading row
        // pressure_line = LPG Vapor constant (DB column name), psi = gauge PSI,
        // atmospheric_pressure = Correction Factor, lpg_vapor_factor = computed Pressure Line
        pressure_line: form.configLpgVapor,
        psi: form.configPsi,
        atmospheric_pressure: form.configCorrectionFactor,
        lpg_vapor_factor: pressureLine,
        // Meter settings snapshot
        meter_unit: meterUnit,
        meter_direction: meterDirection as "INCREASING" | "DECREASING",
        conversion_factor: conversionFactor,
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

      // Persist configuration overrides locally
      if (typeof window !== "undefined" && form.siteId) {
        localStorage.setItem(
          `lpg_site_config_${form.siteId}`,
          JSON.stringify({
            configLpgVapor: form.configLpgVapor,
            configPsi: form.configPsi,
            configCorrectionFactor: form.configCorrectionFactor,
          })
        );
      }

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
  }, [form, arbitration, grossAmount, vatAmount, netAmount, txId, pressureLine, meterUnit, meterDirection, conversionFactor]);

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
    /** LPG VAPOR constant from site (e.g. 2.0183) — site default only */
    siteLpgVapor,
    /** Gauge PSI from site (e.g. 10.0000) — site default only */
    sitePsi,
    /** Correction Factor / atmospheric pressure from site (e.g. 14.7) — site default only */
    siteCorrectionFactor,
    /** Computed Pressure Line = (PSI + CF) / CF (e.g. 1.6803) — uses active config */
    pressureLine,
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
