"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Gauge, Weight, ChevronDown, CheckCircle, XCircle,
  Loader2, AlertTriangle, Info, RefreshCw
} from "lucide-react";
import type {
  LpgSite, WiwoHeader, UnifiedBillingTransaction,
  BillingMode, VarianceReasonCode
} from "../types";

interface Props {
  txId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const VAT_RATE = 0.12;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const VARIANCE_REASONS: { value: VarianceReasonCode; label: string }[] = [
  { value: "NONE", label: "None / Acceptable" },
  { value: "METER_DRIFT", label: "Meter Drift" },
  { value: "PHYSICAL_LEAK", label: "Physical Leak" },
  { value: "METER_MALFUNCTION", label: "Meter Malfunction" },
  { value: "TEMPERATURE_VARIATION", label: "Temperature Variation" },
];

export function UnifiedBillingForm({ txId, onSuccess, onCancel }: Props) {
  const isNew = !txId;

  // ── Site ──
  const [sites, setSites] = useState<LpgSite[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [selectedSite, setSelectedSite] = useState<LpgSite | null>(null);

  // ── Transaction ──
  const [tx, setTx] = useState<UnifiedBillingTransaction | null>(null);
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  // ── Billing mode (auto from site) ──
  const billingMode: BillingMode = selectedSite?.billing_mode ?? "KILO";

  // ── Meter (Track A: BOTH) ──
  const [prevReading, setPrevReading] = useState(0);
  const [currReading, setCurrReading] = useState(0);
  const [convFactor, setConvFactor] = useState(1);
  const meteredKg = round2(Math.max(0, currReading - prevReading) * convFactor);

  // ── WIWO link ──
  const [wiwoHeaders, setWiwoHeaders] = useState<WiwoHeader[]>([]);
  const [wiwoHeaderId, setWiwoHeaderId] = useState<number | null>(null);
  const [wiwoKg, setWiwoKg] = useState(0);

  // ── Billing ──
  const [pricePerKg, setPricePerKg] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [varianceReasonCode, setVarianceReasonCode] = useState<VarianceReasonCode>("NONE");

  // ── Computed ──
  const effectiveMeteredKg = billingMode === "BOTH" ? meteredKg : 0;
  const varianceKg = round2(Math.abs(effectiveMeteredKg - wiwoKg));
  const billableKg = billingMode === "BOTH" ? round2(Math.max(effectiveMeteredKg, wiwoKg)) : round2(wiwoKg);
  const billableSource = billingMode === "BOTH"
    ? (effectiveMeteredKg >= wiwoKg ? "METERED" : "WIWO")
    : "WIWO";
  const grossAmount = round2(billableKg * pricePerKg);
  const vatAmount = round2(grossAmount * VAT_RATE);
  const netAmount = round2(grossAmount + vatAmount);

  const hasVariance = billingMode === "BOTH" && varianceKg > 0.5;

  // ── Status ──
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ─── Load sites ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/ids/scm/lpg-billing-management/unified-billing?type=sites")
      .then((r) => r.json())
      .then((j) => setSites(j.data ?? []));
  }, []);

  // ─── Load existing transaction ────────────────────────────────────────────
  useEffect(() => {
    if (!txId) {
      setTx(null);
      setSiteId(null);
      setSelectedSite(null);
      setTxDate(new Date().toISOString().split("T")[0]);
      setPrevReading(0);
      setCurrReading(0);
      setWiwoHeaderId(null);
      setWiwoKg(0);
      setPricePerKg(0);
      setRemarks("");
      setVarianceReasonCode("NONE");
      return;
    }
    setLoading(true);
    fetch(`/api/ids/scm/lpg-billing-management/unified-billing/${txId}`)
      .then((r) => r.json())
      .then((j) => {
        const data = j.data as UnifiedBillingTransaction;
        setTx(data);
        setTxDate(data.transaction_date);
        setSiteId(data.lpg_site_id);
        setPricePerKg(data.price_per_kg ?? 0);
        setRemarks(data.remarks ?? "");
        setVarianceReasonCode((data.variance_reason_code as VarianceReasonCode) ?? "NONE");
        setWiwoHeaderId(data.wiwo_header_id);
        setWiwoKg(data.wiwo_kg ?? 0);
        const mr = data.meter_reading as unknown as Record<string, number> | undefined;
        if (mr) {
          setPrevReading(mr["previous_reading"] ?? 0);
          setCurrReading(mr["current_reading"] ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [txId]);

  // ─── When siteId changes, load site details ───────────────────────────────
  const loadSite = useCallback(async (id: number) => {
    const found = sites.find((s) => s.id === id) ?? null;
    if (found) {
      setSelectedSite(found);
      setPricePerKg(found.default_price_per_kg ?? 0);
      setPrevReading(found.last_meter_reading ?? 0);
      setCurrReading(found.last_meter_reading ?? 0);
      setConvFactor(found.conversion_factor ?? 1);
      // Load WIWO headers for this site
      const res = await fetch(
        `/api/ids/scm/lpg-billing-management/unified-billing?type=wiwo-headers&customerCode=${encodeURIComponent(found.customer_code)}&siteId=${id}`
      );
      const j = await res.json();
      setWiwoHeaders(j.data ?? []);
    }
  }, [sites]);

  useEffect(() => {
    if (siteId && sites.length > 0 && !tx) {
      loadSite(siteId);
    }
    if (tx && siteId && sites.length > 0) {
      const found = sites.find((s) => s.id === siteId) ?? null;
      setSelectedSite(found);
    }
  }, [siteId, sites, tx, loadSite]);

  // ─── Save / Post / Cancel ─────────────────────────────────────────────────
  const handleSave = async (postAfter = false) => {
    if (!siteId || !selectedSite) {
      setErrorMsg("Please select an LPG site.");
      return;
    }
    if (hasVariance && varianceReasonCode === "NONE") {
      setErrorMsg("Variance detected — please select a variance reason.");
      return;
    }
    setSaving(true);
    setErrorMsg("");

    try {
      const payload = {
        transactionDate: txDate,
        customerCode: selectedSite.customer_code,
        siteId,
        billingMode,
        pricePerKg,
        wiwoHeaderId: wiwoHeaderId ?? null,
        wiwoKg,
        remarks,
        varianceReasonCode,
        ...(billingMode === "BOTH"
          ? { previousReading: prevReading, currentReading: currReading, meteredKg: effectiveMeteredKg, conversionFactor: convFactor }
          : {}),
      };

      let res: Response;
      if (isNew) {
        res = await fetch("/api/ids/scm/lpg-billing-management/unified-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/ids/scm/lpg-billing-management/unified-billing/${txId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", ...payload }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error ?? "Save failed");
      }

      const saved = await res.json();
      const savedId = saved.data?.id ?? txId;

      if (postAfter && savedId) {
        const postRes = await fetch(`/api/ids/scm/lpg-billing-management/unified-billing/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "post" }),
        });
        if (!postRes.ok) {
          const err = await postRes.json();
          throw new Error(err?.error ?? "Post failed");
        }
      }

      onSuccess();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!txId || !tx) return;
    const reason = window.prompt("Cancellation reason:");
    if (!reason) return;
    setSaving(true);
    try {
      await fetch(`/api/ids/scm/lpg-billing-management/unified-billing/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      });
      onSuccess();
    } catch {
      setErrorMsg("Cancel failed.");
    } finally {
      setSaving(false);
    }
  };

  const isPosted = tx?.status === "POSTED";
  const isCancelled = tx?.status === "CANCELLED";
  const isReadOnly = isPosted || isCancelled;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading transaction…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">
            {isNew ? "New Billing Transaction" : `Transaction: ${tx?.transaction_no ?? `#${txId}`}`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isNew ? "Fill in the details below to create a billing record." : `Status: ${tx?.status}`}
          </p>
        </div>
        {selectedSite && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ${
              billingMode === "BOTH"
                ? "text-violet-700 bg-violet-50 dark:bg-violet-900/20 border-violet-200"
                : "text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200"
            }`}
          >
            {billingMode === "BOTH" ? <Gauge className="h-3 w-3" /> : <Weight className="h-3 w-3" />}
            {billingMode === "BOTH" ? "Metered + Physical" : "Physical Weights Only"}
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ── Card A: Transaction Details ── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 p-4 space-y-3 bg-white dark:bg-zinc-900/30">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Transaction Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Date</label>
            <input
              id="unified-tx-date"
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              disabled={isReadOnly}
              className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">LPG Site</label>
            <div className="relative mt-1">
              <select
                id="unified-site-select"
                value={siteId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSiteId(id || null);
                  setWiwoHeaderId(null);
                  setWiwoKg(0);
                  if (id) loadSite(id);
                }}
                disabled={isReadOnly || !isNew}
                className="w-full text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pr-8 appearance-none disabled:opacity-50"
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site_name} ({s.customer_code}) — {s.billing_mode}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Price per kg (₱)</label>
            <input
              id="unified-price-per-kg"
              type="number"
              min={0}
              step={0.01}
              value={pricePerKg}
              onChange={(e) => setPricePerKg(Number(e.target.value))}
              disabled={isReadOnly}
              className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Remarks</label>
            <input
              id="unified-remarks"
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isReadOnly}
              placeholder="Optional…"
              className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* ── Card B: Meter Sync (BOTH track only) ── */}
      {billingMode === "BOTH" && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 p-4 space-y-3 bg-violet-50/30 dark:bg-violet-900/10">
          <h3 className="text-xs font-semibold text-violet-600 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Meter Reading (Track A)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Previous Reading</label>
              <input
                id="unified-prev-reading"
                type="number"
                min={0}
                step={0.001}
                value={prevReading}
                onChange={(e) => setPrevReading(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current Reading</label>
              <input
                id="unified-curr-reading"
                type="number"
                min={0}
                step={0.001}
                value={currReading}
                onChange={(e) => setCurrReading(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Conv. Factor</label>
              <input
                id="unified-conv-factor"
                type="number"
                min={0.001}
                step={0.001}
                value={convFactor}
                onChange={(e) => setConvFactor(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="text-xs text-violet-700 dark:text-violet-300 bg-violet-100/50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
            Metered consumption: <strong>{effectiveMeteredKg.toFixed(3)} kg</strong>
          </div>
        </div>
      )}

      {/* ── Card C: WIWO Physical Weights ── */}
      <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 p-4 space-y-3 bg-orange-50/30 dark:bg-orange-900/10">
        <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5" />
          Physical Weigh-In / Weigh-Out
        </h3>

        {/* WIWO header link */}
        <div>
          <label className="text-xs text-muted-foreground">Link WIWO Transaction</label>
          <div className="flex gap-2 mt-1">
            <select
              id="unified-wiwo-header-select"
              value={wiwoHeaderId ?? ""}
              onChange={async (e) => {
                const id = Number(e.target.value) || null;
                setWiwoHeaderId(id);
                if (id) {
                  // Lookup the total_billable_kg from the selected header
                  const found = wiwoHeaders.find((h) => h.id === id);
                  setWiwoKg(found?.total_billable_kg ?? 0);
                } else {
                  setWiwoKg(0);
                }
              }}
              disabled={isReadOnly || !selectedSite}
              className="flex-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 appearance-none disabled:opacity-50"
            >
              <option value="">-- Manual entry / no link --</option>
              {wiwoHeaders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.wiwo_no ?? `WIWO-${h.id}`} | {h.transaction_date} | {h.total_billable_kg?.toFixed(2)} kg
                </option>
              ))}
            </select>
            {selectedSite && (
              <button
                id="unified-refresh-wiwo-headers"
                onClick={async () => {
                  const res = await fetch(
                    `/api/ids/scm/lpg-billing-management/unified-billing?type=wiwo-headers&customerCode=${encodeURIComponent(selectedSite.customer_code)}&siteId=${siteId}`
                  );
                  const j = await res.json();
                  setWiwoHeaders(j.data ?? []);
                }}
                title="Refresh WIWO list"
                className="p-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Manual wiwoKg override when no header linked */}
        {!wiwoHeaderId && (
          <div>
            <label className="text-xs text-muted-foreground">WIWO Total Consumed KG (manual)</label>
            <input
              id="unified-wiwo-kg-manual"
              type="number"
              min={0}
              step={0.001}
              value={wiwoKg}
              onChange={(e) => setWiwoKg(Number(e.target.value))}
              disabled={isReadOnly}
              className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
            />
          </div>
        )}

        <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100/50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
          Physical consumed: <strong>{wiwoKg.toFixed(3)} kg</strong>
        </div>
      </div>

      {/* ── Variance Alert (BOTH only) ── */}
      {hasVariance && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700/50 p-4 space-y-3 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Variance Detected: {varianceKg.toFixed(3)} kg
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Billable: <strong>{billableSource}</strong> at <strong>{billableKg.toFixed(3)} kg</strong> (MAX rule applied).
          </p>
          <div>
            <label className="text-xs text-muted-foreground">Variance Reason <span className="text-red-500">*</span></label>
            <select
              id="unified-variance-reason"
              value={varianceReasonCode}
              onChange={(e) => setVarianceReasonCode(e.target.value as VarianceReasonCode)}
              disabled={isReadOnly}
              className="w-full mt-1 text-sm px-3 py-1.5 rounded-md border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-zinc-900 disabled:opacity-50"
            >
              {VARIANCE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Summary Card ── */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 p-4 bg-indigo-50/30 dark:bg-indigo-900/10 space-y-2">
        <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Billing Summary
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {billingMode === "BOTH" && (
            <>
              <div className="text-muted-foreground">Metered KG</div>
              <div className="font-medium text-right">{effectiveMeteredKg.toFixed(3)}</div>
              <div className="text-muted-foreground">WIWO KG</div>
              <div className="font-medium text-right">{wiwoKg.toFixed(3)}</div>
              <div className="text-muted-foreground">Variance KG</div>
              <div className={`font-medium text-right ${varianceKg > 0.5 ? "text-amber-600" : ""}`}>{varianceKg.toFixed(3)}</div>
            </>
          )}
          <div className="text-muted-foreground">Billable Source</div>
          <div className="font-medium text-right">{billableSource}</div>
          <div className="text-muted-foreground font-semibold text-zinc-700 dark:text-zinc-300">Billable KG</div>
          <div className="font-bold text-right text-indigo-700 dark:text-indigo-300">{billableKg.toFixed(3)}</div>
          <div className="text-muted-foreground">Price / kg</div>
          <div className="font-medium text-right">₱{pricePerKg.toFixed(2)}</div>
          <div className="border-t border-indigo-200 dark:border-indigo-800/30 col-span-2 my-1" />
          <div className="text-muted-foreground">Gross Amount</div>
          <div className="font-medium text-right">₱{grossAmount.toFixed(2)}</div>
          <div className="text-muted-foreground">VAT (12%)</div>
          <div className="font-medium text-right">₱{vatAmount.toFixed(2)}</div>
          <div className="text-muted-foreground font-bold text-zinc-800 dark:text-zinc-100">Net Amount</div>
          <div className="font-extrabold text-right text-indigo-700 dark:text-indigo-300 text-base">₱{netAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 pt-1">
          <button
            id="unified-billing-save-btn"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Draft
          </button>
          <button
            id="unified-billing-post-btn"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            Save & Post
          </button>
          {!isNew && (
            <button
              id="unified-billing-cancel-btn"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 dark:border-red-800/50 text-red-600 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors ml-auto"
            >
              <XCircle className="h-4 w-4" />
              Cancel Transaction
            </button>
          )}
          <button
            id="unified-billing-discard-btn"
            onClick={onCancel}
            disabled={saving}
            className="text-sm text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300 px-3 py-2 transition-colors"
          >
            Discard
          </button>
        </div>
      )}

      {isPosted && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg px-3 py-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          This transaction has been posted and is read-only.
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
          <XCircle className="h-4 w-4 shrink-0" />
          This transaction was cancelled.
        </div>
      )}
    </div>
  );
}
