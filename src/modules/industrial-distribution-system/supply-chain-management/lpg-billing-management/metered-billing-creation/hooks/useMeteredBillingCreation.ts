"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  MeteredWiwoTransaction,
  TransactionType,
  BillableSource,
  TransactionStatus,
  WiwoHeaderRef,
  MeterReading,
  CustomerSite,
} from "../../metered-billing-common/types";
import {
  computeArbitration,
  calcGrossAmount,
  calcVatAmount,
  calcNetAmount,
  generateTxNo,
  generateTxNoPlaceholder,
  generateReadingNo,
} from "../../metered-billing-common/utils/calc";
import { createMeteredTransaction } from "../providers/create.provider";
import { mapMeteredTransaction } from "../../metered-wiwo-billing/hooks/useMeteredWiwoBilling";
import { lpgSiteService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-site-management/services/lpgSiteService";

export interface MeteredBillingFormState {
  transactionNo: string;
  readingNo: string;
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
  configLpgVapor: number;
  configPsi: number;
  configCorrectionFactor: number;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  meteredReadingImageId: string;
  psiReadingImageId: string;
  transaction_header_id: number | null;
  salesInvoiceId: number | null;
  salesInvoiceNo: string | null;
  salesOrderId: number | null;
  salesOrderNo: string | null;
}

function defaultFormState(
  type: TransactionType = "REGULAR_BILLING",
  siteId?: number | null,
  date?: string
): MeteredBillingFormState {
  const today = date || new Date().toISOString().slice(0, 10);
  return {
    transactionNo:
      type === "ONBOARDING_BASELINE"
        ? ""
        : generateTxNoPlaceholder(type, siteId ?? null, today),
    readingNo: generateReadingNo(),
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
    status: type === "ONBOARDING_BASELINE" ? "POSTED" : "DRAFT",
    configLpgVapor: 2.0183,
    configPsi: 10.0,
    configCorrectionFactor: 14.7,
    billingPeriodFrom: "",
    billingPeriodTo: "",
    meteredReadingImageId: "",
    psiReadingImageId: "",
    transaction_header_id: null,
    salesInvoiceId: null,
    salesInvoiceNo: null,
    salesOrderId: null,
    salesOrderNo: null,
  };
}

import type { LpgTransactionHeader } from "../../metered-billing-common/types";

export interface InvoiceInfo {
  invoice_id: number;
  invoice_no: string;
  sales_invoice_no?: string;
  total_amount: number;
  invoice_date: string;
  sales_order_id?: number | null;
  sales_order_no?: string | null;
}

export interface CreationCustomerSite extends CustomerSite {
  default_pressure_line?: number | null;
  default_psi?: number | null;
  default_atmospheric_pressure?: number | null;
  meter_direction?: string | null;
  conversion_factor?: number | null;
  meter_unit?: string | null;
  price_per_kg?: number;
  vat_rate?: number;
}

export function useMeteredBillingCreation(
  transactionHeader?: LpgTransactionHeader | null,
  initialFlowType?: "ROUTINE" | "ONBOARDING" | null,
  salesInvoice?: InvoiceInfo | null
) {
  const initialType = initialFlowType === "ONBOARDING" ? "ONBOARDING_BASELINE" : "REGULAR_BILLING";
  const [form, setForm] = useState<MeteredBillingFormState>(() => defaultFormState(initialType));
  const [txId, setTxId] = useState<number | null>(null);
  const [onboardingDrafts, setOnboardingDrafts] = useState<MeteredWiwoTransaction[]>([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [wiwoKg, setWiwoKg] = useState(0);
  const [linkedWiwo] = useState<WiwoHeaderRef | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Selector states
  const [sites, setSites] = useState<CreationCustomerSite[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
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

  // Load customers on mount
  useEffect(() => {
    window
      .fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.data ?? []))
      .catch(console.error);
  }, []);

  // Map header and invoice inputs to form state
  useEffect(() => {
    if (!transactionHeader) return;
    const siteId = transactionHeader.customer_site_id;
    const site = sites.find((s) => s.id === siteId);

    // Resolve configurations
    let lpgVapor = site ? Number(site.default_pressure_line ?? 2.0183) : 2.0183;
    let psi = site ? Number(site.default_psi ?? 10.0) : 10.0;
    let cf = site ? Number(site.default_atmospheric_pressure ?? 14.7) : 14.7;

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

    const txType = initialFlowType === "ONBOARDING" ? "ONBOARDING_BASELINE" : "REGULAR_BILLING";

    let resolvedSiteName = `Site #${siteId}`;
    if (site && typeof site.site_name === "string") {
      resolvedSiteName = site.site_name;
    } else if (transactionHeader.site && typeof transactionHeader.site.site_name === "string") {
      resolvedSiteName = transactionHeader.site.site_name;
    }

    setForm((f) => ({
      ...f,
      siteId,
      siteName: resolvedSiteName,
      customerCode: transactionHeader.customer_id,
      pricePerKg: site ? Number(site.default_price_per_kg ?? 0) : Number(transactionHeader.site?.default_price_per_kg ?? 0),
      configLpgVapor: lpgVapor,
      configPsi: psi,
      configCorrectionFactor: cf,

      // billingPeriodFrom: transactionHeader.period_from,
      // billingPeriodTo: transactionHeader.period_to,
      // previousReading: site ? Number(site.last_meter_reading ?? 0) : Number(transactionHeader.site?.last_meter_reading ?? 0), uncomment because  this one is taking the last transaction previous not current 

      currentReading: 0,
      transaction_header_id: transactionHeader.header_id ?? null,
      transactionType: txType,
      status: txType === "ONBOARDING_BASELINE" ? "POSTED" : "DRAFT",
      salesInvoiceId: salesInvoice?.invoice_id ?? null,
      salesInvoiceNo: salesInvoice?.sales_invoice_no || salesInvoice?.invoice_no || null,
      salesOrderId: salesInvoice?.sales_order_id ?? transactionHeader.sales_order_id ?? null,
      salesOrderNo: salesInvoice?.sales_order_no ?? transactionHeader.sales_order_no ?? null,
    }));
  }, [transactionHeader, sites, initialFlowType, salesInvoice]);

  // Fetch and auto-load the onboarding baseline draft when site or type is ONBOARDING_BASELINE
  useEffect(() => {
    if (form.transactionType !== "ONBOARDING_BASELINE" || !form.siteId) {
      setOnboardingDrafts([]);
      setTxId(null);
      return;
    }

    let active = true;
    setOnboardingLoading(true);
    const fetchOnboardingDrafts = async () => {
      try {
        const url = `/api/ids/scm/lpg-billing-management/metered-billing?status=DRAFT&transactionType=ONBOARDING_BASELINE&siteId=${form.siteId}&limit=50`;
        const res = await window.fetch(url);
        const data = await res.json();
        if (!active) return;

        const list = (data.data ?? []).map(mapMeteredTransaction).filter(
          (t: MeteredWiwoTransaction) => t.meter_reading_id === null
        );

        setOnboardingDrafts(list);

        if (list.length > 0) {
          const draft = list[0];
          setTxId(draft.id ?? null);

          let lpgVapor = Number(draft.site?.default_pressure_line ?? 2.0183);
          let psi = Number(draft.site?.default_psi ?? 10.0);
          let cf = Number(draft.site?.default_atmospheric_pressure ?? 14.7);

          if (typeof window !== "undefined" && draft.lpg_site_id) {
            const cached = localStorage.getItem(`lpg_site_config_${draft.lpg_site_id}`);
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

          const meteredReadingImage = draft.attachments?.find(
            (a: { attachment_type: string; directus_file_id?: string }) => a.attachment_type === "SERIAL_IMAGE"
          );
          const psiReadingImage = draft.attachments?.find(
            (a: { attachment_type: string; directus_file_id?: string }) => a.attachment_type === "WEIGHT_IMAGE"
          );

          setForm((prev) => ({
            ...prev,
            transactionNo: draft.transaction_no ?? "",
            readingNo: draft.reading_no ?? prev.readingNo,
            transactionType: draft.transaction_type ?? "ONBOARDING_BASELINE",
            transactionDate: draft.transaction_date || prev.transactionDate,
            customerCode: draft.customer_code || prev.customerCode,
            siteId: draft.lpg_site_id,
            siteName: draft.site?.site_name ?? prev.siteName,
            meterReadingId: draft.meter_reading_id,
            wiwoHeaderId: draft.wiwo_header_id,
            previousReading: draft.meter_reading?.previous_reading ?? prev.previousReading,
            currentReading: draft.meter_reading?.current_reading ?? prev.currentReading,
            pricePerKg: draft.price_per_kg,
            remarks: draft.remarks ?? "",
            status: draft.status,
            configLpgVapor: lpgVapor,
            configPsi: psi,
            configCorrectionFactor: cf,
            billingPeriodFrom: draft.billing_period_from ?? prev.billingPeriodFrom,
            billingPeriodTo: draft.billing_period_to ?? prev.billingPeriodTo,
            meteredReadingImageId: meteredReadingImage?.directus_file_id || "",
            psiReadingImageId: psiReadingImage?.directus_file_id || "",
            transaction_header_id: draft.transaction_header_id ?? prev.transaction_header_id,
            salesInvoiceId: draft.sales_invoice_id ?? prev.salesInvoiceId,
            salesInvoiceNo: draft.sales_invoice_no ?? prev.salesInvoiceNo,
            salesOrderId: draft.sales_order_id ?? prev.salesOrderId,
            salesOrderNo: draft.sales_order_no ?? prev.salesOrderNo,
          }));
          setWiwoKg(draft.wiwo_kg);
        } else {
          setTxId(null);
        }
      } catch (err) {
        console.error("Failed to fetch onboarding drafts:", err);
      } finally {
        if (active) setOnboardingLoading(false);
      }
    };

    fetchOnboardingDrafts();
    return () => {
      active = false;
    };
  }, [form.siteId, form.transactionType]);

  const handleOnboardingDraftChange = useCallback(
    (id: number) => {
      const tx = onboardingDrafts.find((t) => t.id === id);
      if (!tx) return;

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

      const meteredReadingImage = tx.attachments?.find(
        (a: { attachment_type: string; directus_file_id?: string }) => a.attachment_type === "SERIAL_IMAGE"
      );
      const psiReadingImage = tx.attachments?.find(
        (a: { attachment_type: string; directus_file_id?: string }) => a.attachment_type === "WEIGHT_IMAGE"
      );

      setTxId(tx.id ?? null);
      setForm((prev) => ({
        ...prev,
        transactionNo: tx.transaction_no ?? "",
        readingNo: tx.reading_no ?? "",
        transactionType: tx.transaction_type ?? "ONBOARDING_BASELINE",
        transactionDate: tx.transaction_date || prev.transactionDate,
        customerCode: tx.customer_code || prev.customerCode,
        siteId: tx.lpg_site_id,
        siteName: tx.site?.site_name ?? null,
        meterReadingId: tx.meter_reading_id,
        wiwoHeaderId: tx.wiwo_header_id,
        previousReading: tx.meter_reading?.previous_reading ?? 0,
        currentReading: tx.meter_reading?.current_reading ?? 0,
        pricePerKg: tx.price_per_kg,
        remarks: tx.remarks ?? "",
        status: tx.status,
        configLpgVapor: lpgVapor,
        configPsi: psi,
        configCorrectionFactor: cf,
        billingPeriodFrom: tx.billing_period_from ?? "",
        billingPeriodTo: tx.billing_period_to ?? "",
        meteredReadingImageId: meteredReadingImage?.directus_file_id || "",
        psiReadingImageId: psiReadingImage?.directus_file_id || "",
        transaction_header_id: tx.transaction_header_id ?? null,
        salesInvoiceId: tx.sales_invoice_id ?? prev.salesInvoiceId,
        salesInvoiceNo: tx.sales_invoice_no ?? prev.salesInvoiceNo,
        salesOrderId: tx.sales_order_id ?? prev.salesOrderId,
        salesOrderNo: tx.sales_order_no ?? prev.salesOrderNo,
      }));
      setWiwoKg(tx.wiwo_kg);
    },
    [onboardingDrafts]
  );

  // Chaining logic: New From = Previous To, New Previous Reading = Previous Current Reading
  useEffect(() => {
    if (!form.siteId || form.transactionType === "ONBOARDING_BASELINE") return;

    let active = true;
    const fetchLastTransaction = async () => {
      try {
        const res = await window.fetch(
          `/api/ids/scm/lpg-billing-management/metered-billing?type=last-transaction&siteId=${form.siteId}`
        );
        const d = await res.json();
        if (!active) return;

        const lastTx = d.data;
        const today = new Date().toISOString().split("T")[0];

        setForm((prev) => ({
          ...prev,
          billingPeriodFrom: lastTx?.billing_period_to || prev.billingPeriodFrom || today,
          billingPeriodTo: today,
          previousReading: lastTx?.current_reading !== undefined ? Number(lastTx.current_reading) : prev.previousReading,
        }));
      } catch (error) {
        console.error("Failed to fetch last transaction chaining data:", error);
      }
    };

    fetchLastTransaction();
    return () => {
      active = false;
    };
  }, [form.siteId, form.transactionType]);

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

  // Fetch sequential transaction number
  useEffect(() => {
    if (form.transactionType === "ONBOARDING_BASELINE") {
      setForm((f) => {
        if (f.transactionNo === "") return f;
        return { ...f, transactionNo: "" };
      });
      return;
    }
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
  }, [
    form.customerCode,
    form.transactionDate,
    form.siteId,
    form.transactionType,
  ]);

  // Site change handler
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
        readingNo: generateReadingNo(),
        meteredReadingImageId: "",
        psiReadingImageId: "",
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

  // Derived computed values
  const selectedSite = sites.find((s) => s.id === form.siteId);
  const meterDirection = (selectedSite?.meter_direction ?? "INCREASING") as string;
  const conversionFactor = Number(selectedSite?.conversion_factor ?? 1);

  const siteLpgVapor = Number(selectedSite?.default_pressure_line ?? 2.0183);
  const sitePsi = Number(selectedSite?.default_psi ?? 10.0);
  const siteCorrectionFactor = Number(selectedSite?.default_atmospheric_pressure ?? 14.7);

  const activeLpgVapor = form.configLpgVapor;
  const activePsi = form.configPsi;
  const activeCorrectionFactor = form.configCorrectionFactor;

  const pressureLine =
    activePsi > 0
      ? (activePsi + activeCorrectionFactor) / activeCorrectionFactor
      : 1;
  const isOnboarding = form.transactionType === "ONBOARDING_BASELINE";

  const isValidReading =
    meterDirection === "DECREASING"
      ? form.currentReading <= form.previousReading
      : form.currentReading >= form.previousReading;

  const rawConsumption =
    meterDirection === "DECREASING"
      ? Math.max(0, form.previousReading - form.currentReading)
      : Math.max(0, form.currentReading - form.previousReading);

  const meteredKg = Number((rawConsumption * activeLpgVapor * pressureLine).toFixed(4));

  const arbitration = useMemo(() => {
    if (isOnboarding) {
      return {
        metered_kg: 0,
        wiwo_kg: 0,
        variance_kg: 0,
        billable_kg: 0,
        billable_source: "NONE" as BillableSource,
      };
    }
    return computeArbitration(meteredKg, wiwoKg);
  }, [isOnboarding, meteredKg, wiwoKg]);

  const grossAmount = isOnboarding
    ? 0
    : calcGrossAmount(arbitration.billable_kg, form.pricePerKg);
  const vatAmount = isOnboarding ? 0 : calcVatAmount(grossAmount, form.vatRate);
  const netAmount = isOnboarding ? 0 : calcNetAmount(grossAmount, vatAmount);

  const hasVariance = !isOnboarding && Number(arbitration.variance_kg) > 0;

  const canPost = isOnboarding
    ? !!form.siteId && isValidReading && !!form.meteredReadingImageId && !!form.psiReadingImageId
    : arbitration.billable_kg > 0 &&
    netAmount > 0 &&
    !!form.customerCode &&
    !!form.siteId &&
    isValidReading &&
    (!hasVariance || !!form.remarks.trim()) &&
    !!form.meteredReadingImageId &&
    !!form.psiReadingImageId;

  const meterUnit = (selectedSite?.meter_unit ?? "KG") as "M3" | "LITER" | "KG" | "UNIT";

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
          sales_invoice_id?: number | null;
          sales_invoice_no?: string | null;
          sales_order_id?: number | null;
          sales_order_no?: string | null;
        } = {
          reading_no: form.readingNo || form.transactionNo,
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
          sales_invoice_id: form.salesInvoiceId,
          sales_invoice_no: form.salesInvoiceNo,
          sales_order_id: form.salesOrderId,
          sales_order_no: form.salesOrderNo,
          previous_reading: form.previousReading,
          current_reading: form.currentReading,
          pressure_line: form.configLpgVapor,
          psi: form.configPsi,
          atmospheric_pressure: form.configCorrectionFactor,
          lpg_vapor_factor: pressureLine,
          meter_unit: meterUnit,
          meter_direction: meterDirection as "INCREASING" | "DECREASING",
          conversion_factor: conversionFactor,
          billing_period_from: form.billingPeriodFrom || null,
          billing_period_to: form.billingPeriodTo || null,
          transaction_header_id: form.transaction_header_id,
          attachments: [
            ...(form.meteredReadingImageId
              ? [
                {
                  attachment_type: "SERIAL_IMAGE" as const,
                  directus_file_id: form.meteredReadingImageId,
                },
              ]
              : []),
            ...(form.psiReadingImageId
              ? [
                {
                  attachment_type: "WEIGHT_IMAGE" as const,
                  directus_file_id: form.psiReadingImageId,
                },
              ]
              : []),
          ],
        };

        let result;
        if (txId) {
          const res = await window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing/${txId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Request failed with status ${res.status}`);
          }
          const json = await res.json();
          result = json.data || json;
        } else {
          result = await createMeteredTransaction(payload);
        }
        if (!result) return false;

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

        // Persist PSI constants back to lpg_customer_lpg_sites so the site
        // record always reflects the values used in the most recent billing.
        if (form.siteId) {
          try {
            await lpgSiteService.updateSite(form.siteId, {
              default_pressure_line: form.configLpgVapor,
              default_psi: form.configPsi,
              default_atmospheric_pressure: form.configCorrectionFactor,
            });
          } catch (siteErr) {
            // Non-fatal: transaction already saved; log but don't block.
            console.warn("[useMeteredBillingCreation] Failed to sync PSI constants back to site:", siteErr);
          }
        }

        return true;
      } catch (e) {
        console.error("[useMeteredBillingCreation.submit]", e);
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
      pressureLine,
      meterUnit,
      meterDirection,
      conversionFactor,
      txId,
    ]
  );

  const customerName = useMemo(() => {
    if (transactionHeader?.customer_name) return transactionHeader.customer_name;
    const match = customers.find((c) => c.customer_code === form.customerCode);
    return match?.customer_name || form.customerCode || "";
  }, [customers, form.customerCode, transactionHeader]);

  return {
    form,
    setForm,
    customerName,
    isOnboarding,
    wiwoKg,
    setWiwoKg,
    meteredKg,
    arbitration,
    grossAmount,
    vatAmount,
    netAmount,
    canPost,
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
    txId,
    onboardingDrafts,
    onboardingLoading,
    handleOnboardingDraftChange,
  };
}