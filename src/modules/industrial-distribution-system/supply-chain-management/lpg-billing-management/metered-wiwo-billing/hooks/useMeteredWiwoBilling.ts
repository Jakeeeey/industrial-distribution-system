"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
  TransactionType,
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
  generateTxNo,
  generateTxNoPlaceholder,
} from "../utils/metered-wiwo.calc";
import { updateSiteReading } from "../providers/metered-wiwo.provider";

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

  const txNo = String(raw["transaction_no"] ?? raw["reading_no"] ?? "-");

  return {
    ...raw,
    transaction_no: txNo,
    reading_no: txNo,
    transaction_type: (raw["transaction_type"] as TransactionType) ?? "REGULAR_BILLING",
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

// ─── List hook ────────────────────────────────────────────────────────────────

export function useMeteredWiwoList(initialParams: MeteredListParams = {}) {
  const [rows, setRows] = useState<MeteredWiwoTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<MeteredListParams>({
    page: 1,
    limit: 10,
    transactionType: "ALL",
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 10),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.transactionType && params.transactionType !== "ALL"
          ? { transactionType: params.transactionType }
          : {}),
      });
      const res = await window.fetch(
        `/api/ids/scm/lpg-billing-management/metered-billing?${qs}`
      );
      const d = await res.json();
      setRows((d.data ?? []).map(mapMeteredTransaction));
      setTotal(d.total ?? 0);
    } catch (e) {
      console.error("[useMeteredWiwoList]", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, total, loading, params, setParams, refresh: fetch };
}

// ─── Form state ───────────────────────────────────────────────────────────────

export interface MeteredBillingFormState {
  transactionNo: string;
  transactionType: TransactionType;
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

function defaultFormState(
  type: TransactionType = "REGULAR_BILLING",
  siteId?: number | null,
  date?: string
): MeteredBillingFormState {
  const today = date || new Date().toISOString().slice(0, 10);
  return {
    transactionNo: generateTxNoPlaceholder(type, siteId ?? null, today),
    transactionType: type,
    transactionDate: today,
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
  };
}

// ─── Form / billing computation hook ─────────────────────────────────────────

export function useMeteredWiwoBillingForm(txId?: number | null) {
  const [form, setForm] = useState<MeteredBillingFormState>(defaultFormState());
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
    window
      .fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=sites")
      .then((r) => r.json())
      .then((d) => setSites(d.data ?? []))
      .catch(console.error)
      .finally(() => setSitesLoading(false));
  }, []);

  // Load existing transaction
  useEffect(() => {
    if (!txId) {
      setForm(defaultFormState());
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

        let lpgVapor = Number(tx.site?.default_pressure_line ?? 2.0183);
        let psi = Number(tx.site?.default_psi ?? 10.0);
        let cf = Number(tx.site?.default_atmospheric_pressure ?? 14.7);

        if (typeof window !== "undefined" && tx.lpg_site_id) {
          const cached = localStorage.getItem(
            `lpg_site_config_${tx.lpg_site_id}`
          );
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
          transactionNo: tx.transaction_no ?? tx.reading_no,
          transactionType: tx.transaction_type ?? "REGULAR_BILLING",
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
    window
      .fetch(
        `/api/ids/scm/lpg-billing-management/metered-billing?type=readings&siteId=${form.siteId}`
      )
      .then((r) => r.json())
      .then((d) => setMeterReadings(d.data ?? []))
      .catch(console.error)
      .finally(() => setReadingsLoading(false));

    setWiwoLoading(true);
    window
      .fetch(
        `/api/ids/scm/lpg-billing-management/metered-billing?type=wiwo-headers&siteId=${form.siteId}&customerCode=${form.customerCode}`
      )
      .then((r) => r.json())
      .then((d) => setWiwoHeaders(d.data ?? []))
      .catch(console.error)
      .finally(() => setWiwoLoading(false));
  }, [form.siteId, form.customerCode]);

  // Fetch sequential transaction number for new transactions
  useEffect(() => {
    if (txId) return;
    if (!form.customerCode || !form.siteId) {
      setForm((f) => {
        const placeholder = generateTxNoPlaceholder(
          f.transactionType,
          f.siteId,
          f.transactionDate
        );
        if (f.transactionNo === placeholder) return f;
        return { ...f, transactionNo: placeholder };
      });
      return;
    }

    let active = true;
    const fetchSeq = async () => {
      try {
        const url = `/api/ids/scm/lpg-billing-management/metered-billing?type=next-tx-seq&txType=${form.transactionType}&siteId=${form.siteId}&date=${form.transactionDate}`;
        const res = await window.fetch(url);
        const data = await res.json();
        if (!active) return;
        const seq = data.seq ?? 1;
        const newTxNo = generateTxNo(
          form.transactionType,
          form.siteId,
          form.transactionDate,
          seq
        );
        setForm((f) => {
          if (f.transactionNo === newTxNo) return f;
          return { ...f, transactionNo: newTxNo };
        });
      } catch (err) {
        console.error("Failed to fetch next tx seq:", err);
      }
    };

    fetchSeq();
    return () => {
      active = false;
    };
  }, [txId, form.customerCode, form.transactionDate, form.siteId, form.transactionType]);

  // Load WIWO KG when a header is linked
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
      setLinkedWiwo(null);
      setWiwoKg(0);
      return;
    }
    loadWiwoKg(form.wiwoHeaderId);
  }, [form.wiwoHeaderId, loadWiwoKg]);

  // ── Site change handler ────────────────────────────────────────────────────
  const handleSiteChange = useCallback(
    (siteId: number) => {
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
      }));
    },
    [sites]
  );

  const handleReadingChange = useCallback(
    (readingId: number) => {
      const reading = meterReadings.find((r) => r.id === readingId);
      if (!reading) return;
      setForm((f) => ({
        ...f,
        meterReadingId: readingId,
        previousReading: Number(reading.previous_reading ?? 0),
        currentReading: Number(reading.current_reading ?? 0),
      }));
    },
    [meterReadings]
  );

  // ── Derived computed values ────────────────────────────────────────────────
  const selectedSite = sites.find((s) => s.id === form.siteId);
  const meterDirection = (selectedSite?.meter_direction ?? "INCREASING") as string;
  const conversionFactor = Number(selectedSite?.conversion_factor ?? 1);

  const siteLpgVapor = Number(selectedSite?.default_pressure_line ?? 2.0183);
  const sitePsi = Number(selectedSite?.default_psi ?? 10.0);
  const siteCorrectionFactor = Number(selectedSite?.default_atmospheric_pressure ?? 14.7);

  const activeLpgVapor = form.configLpgVapor;
  const activePsi = form.configPsi;
  const activeCorrectionFactor = form.configCorrectionFactor;

  /** PRESSURE LINE = (PSI + CF) / CF */
  const pressureLine =
    activePsi > 0 ? (activePsi + activeCorrectionFactor) / activeCorrectionFactor : 1;

  const isOnboarding = form.transactionType === "ONBOARDING_BASELINE";

  const isValidReading =
    meterDirection === "DECREASING"
      ? form.currentReading <= form.previousReading
      : form.currentReading >= form.previousReading;

  const rawConsumption =
    meterDirection === "DECREASING"
      ? Math.max(0, form.previousReading - form.currentReading)
      : Math.max(0, form.currentReading - form.previousReading);

  /** KG = Usage × LPG Vapor × Pressure Line */
  const meteredKg = Number(
    (rawConsumption * activeLpgVapor * pressureLine).toFixed(4)
  );

  const arbitration = useMemo(() => {
    // Onboarding: no billing arbitration — no WIWO, no billable kg
    if (isOnboarding) {
      return {
        metered_kg: 0,
        wiwo_kg: 0,
        variance_kg: 0,
        billable_kg: 0,
        billable_source: "NONE" as BillableSource,
      };
    }
    // Regular Billing: arbitration (WIWO optional — if 0, metered wins)
    return computeArbitration(meteredKg, wiwoKg);
  }, [isOnboarding, meteredKg, wiwoKg]);

  const grossAmount = isOnboarding
    ? 0
    : calcGrossAmount(arbitration.billable_kg, form.pricePerKg);
  const vatAmount = isOnboarding ? 0 : calcVatAmount(grossAmount, form.vatRate);
  const netAmount = isOnboarding ? 0 : calcNetAmount(grossAmount, vatAmount);

  const hasVariance = !isOnboarding && Number(arbitration.variance_kg) > 0;

  const canPost = isOnboarding
    ? // Onboarding: just needs site + valid reading
      !!form.siteId && isValidReading
    : // Regular: needs billing amounts + valid reading + remarks if variance
      arbitration.billable_kg > 0 &&
      netAmount > 0 &&
      !!form.customerCode &&
      !!form.siteId &&
      isValidReading &&
      (!hasVariance || !!form.remarks.trim());

  const meterUnit = (selectedSite?.meter_unit ?? "KG") as
    | "M3"
    | "LITER"
    | "KG"
    | "UNIT";

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(
    async (statusOverride?: TransactionStatus): Promise<boolean> => {
      setSubmitting(true);
      try {
        const targetStatus = statusOverride || form.status;
        const payload: Partial<MeteredWiwoTransaction> & {
          previous_reading?: number;
          current_reading?: number;
          pressure_line?: number;
          psi?: number;
          atmospheric_pressure?: number;
          lpg_vapor_factor?: number;
        } = {
          reading_no: form.transactionNo,
          transaction_no: form.transactionNo,
          transaction_type: form.transactionType,
          transaction_date: form.transactionDate,
          customer_code: form.customerCode,
          lpg_site_id: form.siteId,
          meter_reading_id: form.meterReadingId,
          wiwo_header_id: isOnboarding ? null : form.wiwoHeaderId,
          metered_kg: arbitration.metered_kg,
          wiwo_kg: arbitration.wiwo_kg,
          variance_kg: arbitration.variance_kg,
          billable_source: arbitration.billable_source,
          billable_kg: arbitration.billable_kg,
          price_per_kg: isOnboarding ? 0 : form.pricePerKg,
          gross_amount: grossAmount,
          vat_amount: vatAmount,
          net_amount: netAmount,
          status: targetStatus,
          remarks: form.remarks || null,
          sales_invoice_id: null,
          previous_reading: form.previousReading,
          current_reading: form.currentReading,
          // Snapshot pressure fields
          pressure_line: form.configLpgVapor,
          psi: form.configPsi,
          atmospheric_pressure: form.configCorrectionFactor,
          lpg_vapor_factor: pressureLine,
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

        // Update site last_meter_reading when POSTED
        if (
          targetStatus === "POSTED" &&
          form.siteId &&
          form.currentReading !== undefined
        ) {
          try {
            await updateSiteReading(
              form.siteId,
              form.currentReading,
              form.transactionDate
            );
          } catch (err) {
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
    },
    [
      form,
      isOnboarding,
      arbitration,
      grossAmount,
      vatAmount,
      netAmount,
      txId,
      pressureLine,
      meterUnit,
      meterDirection,
      conversionFactor,
    ]
  );

  return {
    form,
    setForm,
    originalStatus,
    isOnboarding,
    wiwoKg,
    setWiwoKg,
    loadWiwoKg,
    meteredKg,
    arbitration,
    grossAmount,
    vatAmount,
    netAmount,
    canPost,
    loading,
    submitting,
    submit,
    sites,
    sitesLoading,
    handleSiteChange,
    meterReadings,
    readingsLoading,
    handleReadingChange,
    wiwoHeaders,
    wiwoLoading,
    linkedWiwo,
    isValidReading,
    meterDirection,
    conversionFactor,
    siteLpgVapor,
    sitePsi,
    siteCorrectionFactor,
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
          data.wiwo_header.total_wiwo_kg = calcTotalWiwoKg(
            data.wiwo_header.details
          );
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
