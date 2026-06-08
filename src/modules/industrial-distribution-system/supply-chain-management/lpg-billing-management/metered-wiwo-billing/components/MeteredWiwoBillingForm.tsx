"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Hash,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  Gauge,
  Info,
  Link2,
} from "lucide-react";
import { MeteredReadingPanel } from "./MeteredReadingPanel";
import { VariancePanel } from "./VariancePanel";
import { MeteredBillingSummaryCard } from "./MeteredBillingSummaryCard";
import { useMeteredWiwoBillingForm } from "../hooks/useMeteredWiwoBilling";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import type { TransactionType } from "../types";

interface Props {
  txId?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TX_TYPE_LABELS: Record<TransactionType, { label: string; short: string; color: string }> = {
  ONBOARDING_BASELINE: {
    label: "Onboarding / Baseline",
    short: "Onboarding",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  REGULAR_BILLING: {
    label: "Regular Billing",
    short: "Regular",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
};

export function MeteredWiwoBillingForm({ txId, onSuccess, onCancel }: Props) {
  const {
    form,
    setForm,
    originalStatus,
    isOnboarding,
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
    wiwoHeaders,
    wiwoLoading,
    linkedWiwo,
    isValidReading,
    meterDirection,
    pressureLine,
  } = useMeteredWiwoBillingForm(txId);

  const isReadOnly = originalStatus === "POSTED" || originalStatus === "CANCELLED";

  const handleSubmit = async () => {
    const ok = await submit(isOnboarding ? "POSTED" : undefined);
    if (ok) onSuccess();
  };

  const handleCancelBilling = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this billing transaction? This will mark it as CANCELLED and lock the readings."
      )
    ) {
      return;
    }
    const ok = await submit("CANCELLED");
    if (ok) onSuccess();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const txTypeMeta = TX_TYPE_LABELS[form.transactionType];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Locked banner */}
      {isReadOnly && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl p-4 text-xs text-yellow-800 dark:text-yellow-400 flex items-center gap-3 shadow-md">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="font-bold">Transaction Locked: </span>
            This metered billing transaction has been{" "}
            <span className="font-bold text-violet-600 dark:text-violet-400">
              {originalStatus}
            </span>{" "}
            and cannot be modified.
          </div>
        </div>
      )}

      {/* Onboarding info banner */}
      {isOnboarding && !isReadOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-400 flex items-start gap-3 shadow-md">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Onboarding / Baseline Mode — </span>
            This records the <span className="font-bold">initial meter baseline reading</span> after
            WIWO cylinder deployment.{" "}
            <span className="font-bold text-amber-700 dark:text-amber-300">
              No invoice will be generated.
            </span>{" "}
            Transaction number prefix: <code className="font-mono">TXORB-</code>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent truncate max-w-full sm:max-w-xs md:max-w-none">
              {txId
                ? isOnboarding
                  ? "Edit Baseline Record"
                  : "Edit Metered Billing"
                : isOnboarding
                  ? "New Baseline Record"
                  : "New Metered Billing"}
            </h2>
            <Badge className={`text-[10px] font-bold uppercase tracking-wider border-none shrink-0 ${txTypeMeta.color}`}>
              {txTypeMeta.short}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isOnboarding
              ? "Records initial cylinder deployment meter baseline — no invoice"
              : "Billing source: MAX(Metered KG, WIWO KG)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end w-full sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 hover:bg-red-50 hover:text-red-600 text-xs sm:text-sm flex-1 sm:flex-none"
          >
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!isReadOnly && txId && originalStatus === "DRAFT" && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={handleCancelBilling}
              className="h-9 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              Cancel Billing
            </Button>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canPost}
              className={`h-9 px-4 sm:px-6 shadow-lg transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-none ${isOnboarding
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/20"
                }`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isOnboarding ? (
                <Save className="h-4 w-4 mr-2" />
              ) : form.status === "POSTED" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isOnboarding
                ? "Record Baseline"
                : form.status === "POSTED"
                  ? "Post Billing"
                  : "Save Draft"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Header Card */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                <Gauge className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Transaction Details</h2>
            </div>

            {/* Transaction Type Selector — only for new records */}
            {!txId && (
              <div className="pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Transaction Type
                </Label>
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
                  {(["REGULAR_BILLING", "ONBOARDING_BASELINE"] as TransactionType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            transactionType: t,
                            wiwoHeaderId: null,
                          }))
                        }
                        className={`py-2 px-4 text-xs font-bold rounded-lg transition-all ${form.transactionType === t
                            ? t === "ONBOARDING_BASELINE"
                              ? "bg-white dark:bg-zinc-700 shadow-sm text-amber-600"
                              : "bg-white dark:bg-zinc-700 shadow-sm text-violet-600"
                            : "text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                      >
                        {TX_TYPE_LABELS[t].label}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Site / Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  LPG Site
                </Label>
                {txId ? (
                  <Input
                    value={
                      form.siteName
                        ? `${form.siteName} (${form.customerCode})`
                        : form.customerCode
                          ? `${form.customerCode} - Site ID ${form.siteId}`
                          : "—"
                    }
                    readOnly
                    className="bg-zinc-50 dark:bg-zinc-800"
                  />
                ) : (
                  <Select
                    value={form.siteId ? String(form.siteId) : undefined}
                    onValueChange={(v) => handleSiteChange(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          sitesLoading ? "Loading sites..." : "Select LPG Site..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={String(site.id)} value={String(site.id)}>
                          {site.site_name
                            ? `${site.site_name} (${site.customer_code})`
                            : `Site #${site.id} (${site.customer_code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Customer Code
                </Label>
                <Input
                  value={form.customerCode || "—"}
                  readOnly
                  className="bg-zinc-50 dark:bg-zinc-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Transaction No */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Transaction No
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-tx-no"
                    value={form.transactionNo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, transactionNo: e.target.value }))
                    }
                    className="pl-10 font-mono"
                    readOnly={isReadOnly || isOnboarding}
                  />
                </div>
              </div>
              {/* Reading No */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Reading No
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-reading-no"
                    value={form.readingNo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, readingNo: e.target.value }))
                    }
                    className="pl-10 font-mono"
                    readOnly={isReadOnly}
                    placeholder="MTR-XXXXXXXXX"
                  />
                </div>
              </div>
              {/* Transaction Date */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Transaction Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-tx-date"
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, transactionDate: e.target.value }))
                    }
                    className="pl-10"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Billing Period From */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Billing Period From
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-billing-from"
                    type="date"
                    value={form.billingPeriodFrom}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, billingPeriodFrom: e.target.value }))
                    }
                    className="pl-10"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              {/* Billing Period To */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Billing Period To
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-billing-to"
                    type="date"
                    value={form.billingPeriodTo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, billingPeriodTo: e.target.value }))
                    }
                    className="pl-10"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              {/* Price / KG — hidden for onboarding */}
              {!isOnboarding ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Price / KG
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                      ₱
                    </span>
                    <Input
                      id="metered-price-per-kg"
                      type="number"
                      step="0.01"
                      value={form.pricePerKg}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pricePerKg: Number(e.target.value),
                        }))
                      }
                      className="pl-8"
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Meter Readings */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Meter Readings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Previous Reading
                  </Label>
                  <Input
                    id="metered-prev-reading"
                    type="number"
                    step="0.001"
                    value={form.previousReading}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        previousReading: Number(e.target.value),
                      }))
                    }
                    className="font-mono"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Current Reading
                  </Label>
                  <Input
                    id="metered-curr-reading"
                    type="number"
                    step="0.001"
                    value={form.currentReading}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currentReading: Number(e.target.value),
                      }))
                    }
                    className="font-mono"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Metered KG (computed)
                  </Label>
                  <Input
                    value={Number(meteredKg).toFixed(4)}
                    readOnly
                    className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold"
                  />
                </div>
              </div>
              {!isValidReading && (
                <p className="text-xs text-red-500 mt-3 font-semibold animate-pulse">
                  ⚠️ Invalid reading: Current reading must be{" "}
                  {meterDirection === "DECREASING"
                    ? "less than or equal to"
                    : "greater than or equal to"}{" "}
                  the previous reading ({form.previousReading}) for a{" "}
                  {meterDirection} meter.
                </p>
              )}
            </div>

            {/* Meter Configuration */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Meter Configuration
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">LPG VAPOR</Label>
                  <Input
                    id="metered-config-lpg-vapor"
                    type="number"
                    step="0.0001"
                    value={form.configLpgVapor}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        configLpgVapor: Number(e.target.value),
                      }))
                    }
                    className="font-mono"
                    readOnly={isReadOnly}
                    placeholder="e.g. 2.0183"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">PSI</Label>
                  <Input
                    id="metered-config-psi"
                    type="number"
                    step="0.0001"
                    value={form.configPsi}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, configPsi: Number(e.target.value) }))
                    }
                    className="font-mono"
                    readOnly={isReadOnly}
                    placeholder="e.g. 10.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    CORRECTION FACTOR
                  </Label>
                  <Input
                    id="metered-config-correction-factor"
                    type="number"
                    step="0.1"
                    value={form.configCorrectionFactor}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        configCorrectionFactor: Number(e.target.value),
                      }))
                    }
                    className="font-mono"
                    readOnly={isReadOnly}
                    placeholder="e.g. 14.7"
                  />
                </div>
              </div>
            </div>

            {/* WIWO Header Linking — Regular Billing only */}
            {!isOnboarding && form.siteId && (
              <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    WIWO Validation (optional)
                  </Label>
                </div>
                {txId ? (
                  <Input
                    value={
                      linkedWiwo
                        ? `${linkedWiwo.transaction_no} — ${Number(linkedWiwo.total_wiwo_kg ?? 0).toFixed(4)} kg`
                        : form.wiwoHeaderId
                          ? `WIWO #${form.wiwoHeaderId}`
                          : "No WIWO linked"
                    }
                    readOnly
                    className="bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                  />
                ) : (
                  <Select
                    value={form.wiwoHeaderId?.toString() ?? "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        wiwoHeaderId: v === "none" ? null : Number(v),
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          wiwoLoading
                            ? "Loading WIWO headers..."
                            : wiwoHeaders.length === 0
                              ? "No pending WIWO headers found"
                              : "Select WIWO header (optional)..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        No WIWO link (Metered only)
                      </SelectItem>
                      {wiwoHeaders.map((header) => (
                        <SelectItem
                          key={header.id}
                          value={header.id.toString()}
                        >
                          {header.transaction_no} —{" "}
                          {format(new Date(header.transaction_date), "MMM dd, yyyy")}
                          {header.total_wiwo_kg !== undefined
                            ? ` (${Number(header.total_wiwo_kg).toFixed(4)} kg)`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {linkedWiwo && (
                  <p className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold">
                    ✓ WIWO KG: {Number(linkedWiwo.total_wiwo_kg ?? 0).toFixed(4)} kg —
                    Arbitration will use MAX(Metered, WIWO)
                  </p>
                )}
                {!form.wiwoHeaderId && !isReadOnly && (
                  <p className="text-[11px] text-muted-foreground">
                    No WIWO selected — billing will use Metered KG only.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Meter Reading Panel */}
          <MeteredReadingPanel
            readingDate={form.transactionDate}
            previousReading={form.previousReading}
            currentReading={form.currentReading}
            meteredKg={meteredKg}
            meterUnit="m3"
            meterDirection={meterDirection}
            lpgVapor={form.configLpgVapor}
            psi={form.configPsi}
            correctionFactor={form.configCorrectionFactor}
            pressureLine={pressureLine}
          />

          {/* Variance & Arbitration — Regular Billing only */}
          {!isOnboarding && <VariancePanel result={arbitration} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {isOnboarding ? (
            /* Onboarding sidebar — just a summary of what was recorded */
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                  <Gauge className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm">Baseline Summary</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Opening Reading
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {form.previousReading.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Baseline Reading
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                    {form.currentReading.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Initial KG
                  </span>
                  <span className="font-mono font-bold">
                    {Number(meteredKg).toFixed(4)} kg
                  </span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 mt-2">
                  <span className="font-bold">No invoice generated.</span> This baseline
                  reading will be used as the starting point for future Regular Billing
                  cycles.
                </div>
              </div>
            </div>
          ) : (
            <MeteredBillingSummaryCard
              meteredKg={arbitration.metered_kg}
              wiwoKg={arbitration.wiwo_kg}
              varianceKg={arbitration.variance_kg}
              billableKg={arbitration.billable_kg}
              billableSource={arbitration.billable_source}
              grossAmount={grossAmount}
              vatAmount={vatAmount}
              netAmount={netAmount}
              pricePerKg={form.pricePerKg}
              isMeteredOnly={!form.wiwoHeaderId}
            />
          )}

          {/* Status + Remarks */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            {/* Status toggle — only for regular billing */}
            {!isOnboarding && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </Label>
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  {(
                    [
                      "DRAFT",
                      "POSTED",
                      ...(form.status === "CANCELLED" ? (["CANCELLED"] as const) : []),
                    ] as const
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.status === s
                          ? s === "POSTED"
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-green-600"
                            : s === "CANCELLED"
                              ? "bg-white dark:bg-zinc-700 shadow-sm text-red-600"
                              : "bg-white dark:bg-zinc-700 shadow-sm text-violet-600"
                          : "text-muted-foreground hover:text-zinc-900"
                        } ${isReadOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Remarks
              </Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Internal notes..."
                className="resize-none h-24"
                readOnly={isReadOnly}
              />
              {Number(arbitration.variance_kg) > 0 &&
                !isOnboarding &&
                !form.remarks.trim() && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    ⚠️ Remarks are required because there is a variance between Metered
                    and WIWO readings.
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
