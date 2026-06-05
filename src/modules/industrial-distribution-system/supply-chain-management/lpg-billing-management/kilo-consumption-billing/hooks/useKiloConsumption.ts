"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { WiwoHeader, KiloBillingInvoice, KiloListParams, KiloBillingFormState } from "../types";
import { computeKiloBillingSummary } from "../utils/kilo-consumption.calc";

// ─── Mappers for DB decimals ───────────────────────────────────────────────

interface RawWiwoDetail {
  opening_lpg_kg?: string | number;
  gross_weight?: string | number;
  tare_weight?: string | number;
  remaining_lpg_kg?: string | number;
  consumed_lpg_kg?: string | number;
  [key: string]: unknown;
}

interface RawWiwoHeader {
  total_wiwo_kg?: string | number;
  site?: {
    default_price_per_kg?: string | number;
    [key: string]: unknown;
  };
  details?: RawWiwoDetail[];
  [key: string]: unknown;
}

interface RawKiloInvoice {
  billable_kg?: string | number;
  price_per_kg?: string | number;
  gross_amount?: string | number;
  vat_amount?: string | number;
  net_amount?: string | number;
  wiwo_header?: unknown;
  [key: string]: unknown;
}

export function mapWiwoHeader(w: unknown): WiwoHeader {
  if (!w) return w as WiwoHeader;
  const raw = w as RawWiwoHeader;
  return {
    ...raw,
    total_wiwo_kg: raw.total_wiwo_kg != null ? Number(raw.total_wiwo_kg) : undefined,
    site: raw.site ? {
      ...raw.site,
      default_price_per_kg: Number(raw.site.default_price_per_kg ?? 0),
    } as WiwoHeader["site"] : undefined,
    details: raw.details ? raw.details.map((d) => ({
      ...d,
      opening_lpg_kg: Number(d.opening_lpg_kg ?? 0),
      gross_weight: Number(d.gross_weight ?? 0),
      tare_weight: Number(d.tare_weight ?? 0),
      remaining_lpg_kg: d.remaining_lpg_kg != null ? Number(d.remaining_lpg_kg) : undefined,
      consumed_lpg_kg: d.consumed_lpg_kg != null ? Number(d.consumed_lpg_kg) : undefined,
    })) as WiwoHeader["details"] : undefined,
  } as WiwoHeader;
}

export function mapKiloInvoice(inv: unknown): KiloBillingInvoice {
  if (!inv) return inv as KiloBillingInvoice;
  const raw = inv as RawKiloInvoice;
  return {
    ...raw,
    billable_kg: Number(raw.billable_kg ?? 0),
    price_per_kg: Number(raw.price_per_kg ?? 0),
    gross_amount: Number(raw.gross_amount ?? 0),
    vat_amount: Number(raw.vat_amount ?? 0),
    net_amount: Number(raw.net_amount ?? 0),
    wiwo_header: mapWiwoHeader(raw.wiwo_header),
  } as KiloBillingInvoice;
}

// ─── List hook ────────────────────────────────────────────────────────────────

export function useKiloWiwoList(initialParams: KiloListParams = {}) {
  const [rows, setRows] = useState<WiwoHeader[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<KiloListParams>({ page: 1, limit: 10, ...initialParams });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 10),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        type: "wiwo",
      });
      const res = await window.fetch(`/api/ids/scm/lpg-billing-management/kilo-consumption-billing?${qs}`);
      const d = await res.json();
      setRows((d.data ?? []).map(mapWiwoHeader));
      setTotal(d.total ?? 0);
    } catch (e) {
      console.error("[useKiloWiwoList]", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rows, total, loading, params, setParams, refresh: fetch };
}

// ─── Invoice list hook ────────────────────────────────────────────────────────

export function useKiloInvoiceList(initialParams: KiloListParams = {}) {
  const [rows, setRows] = useState<KiloBillingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<KiloListParams>({ page: 1, limit: 10, ...initialParams });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 10),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        type: "invoice",
      });
      const res = await window.fetch(`/api/ids/scm/lpg-billing-management/kilo-consumption-billing?${qs}`);
      const d = await res.json();
      setRows((d.data ?? []).map(mapKiloInvoice));
      setTotal(d.total ?? 0);
    } catch (e) {
      console.error("[useKiloInvoiceList]", e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rows, total, loading, params, setParams, refresh: fetch };
}

// ─── Detail / billing form hook ───────────────────────────────────────────────

export function useKiloBillingForm(wiwoId: number | null) {
  const [wiwo, setWiwo] = useState<WiwoHeader | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<KiloBillingFormState>({
    invoiceNo: `KILO-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().slice(0, 10),
    pricePerKg: 0,
    vatRate: 0.12,
    remarks: "",
    status: "DRAFT",
  });

  // Load selected transaction
  useEffect(() => {
    if (!wiwoId) return;
    setLoading(true);
    window
      .fetch(`/api/ids/scm/lpg-billing-management/kilo-consumption-billing/${wiwoId}`)
      .then((r) => r.json())
      .then((d) => {
        const data: WiwoHeader = mapWiwoHeader(d.data);
        setWiwo(data);
        if (data.site?.default_price_per_kg) {
          setForm((f) => ({
            ...f,
            pricePerKg: data.site!.default_price_per_kg,
            remarks: `Invoice for ${data.site?.site_name || "customer site"}`
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wiwoId]);

  const summary = useMemo(() => {
    return wiwo?.details
      ? computeKiloBillingSummary(wiwo.details, form.pricePerKg, form.vatRate)
      : { billableKg: 0, grossAmount: 0, vatAmount: 0, netAmount: 0 };
  }, [wiwo?.details, form.pricePerKg, form.vatRate]);

  const canPost = summary.billableKg > 0 && summary.netAmount > 0;

  const submit = useCallback(async (): Promise<boolean> => {
    if (!wiwo || !wiwoId) return false;
    setSubmitting(true);
    try {
      const payload = {
        invoice_no: form.invoiceNo,
        invoice_date: form.invoiceDate,
        wiwo_header_id: wiwoId,
        customer_code: wiwo.customer_code,
        lpg_site_id: wiwo.lpg_site_id,
        billable_kg: summary.billableKg,
        price_per_kg: form.pricePerKg,
        gross_amount: summary.grossAmount,
        vat_amount: summary.vatAmount,
        net_amount: summary.netAmount,
        status: form.status,
        remarks: form.remarks,
      };

      const res = await window.fetch("/api/ids/scm/lpg-billing-management/kilo-consumption-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to post Kilo Billing Invoice");
      }

      return true;
    } catch (e) {
      console.error("[useKiloBillingForm.submit]", e);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [wiwoId, wiwo, form, summary]);

  return {
    wiwo,
    setWiwo,
    loading,
    submitting,
    form,
    setForm,
    summary,
    canPost,
    submit,
  };
}


