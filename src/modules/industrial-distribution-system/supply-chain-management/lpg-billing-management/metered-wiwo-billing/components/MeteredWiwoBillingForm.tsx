"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Hash,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import { MeteredReadingPanel } from "./MeteredReadingPanel";
import { WiwoValidationPanel } from "./WiwoValidationPanel";
import { VariancePanel } from "./VariancePanel";
import { MeteredBillingSummaryCard } from "./MeteredBillingSummaryCard";
import { useMeteredWiwoBillingForm } from "../hooks/useMeteredWiwoBilling";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Props {
  txId?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MeteredWiwoBillingForm({ txId, onSuccess, onCancel }: Props) {
  const {
    form,
    setForm,
    originalStatus,
    wiwoKg,
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
    siteLpgVapor,
    sitePsi,
    siteCorrectionFactor,
    pressureLine,
  } = useMeteredWiwoBillingForm(txId);

  const selectedSite = sites.find((s) => s.id === form.siteId);
  const isMeteredOnly = selectedSite?.billing_mode === "METERED";
  const isReadOnly = originalStatus === "POSTED" || originalStatus === "CANCELLED";

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) onSuccess();
  };

  const handleCancelBilling = async () => {
    if (!window.confirm("Are you sure you want to cancel this billing transaction? This will mark it as CANCELLED and lock the readings.")) {
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isReadOnly && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-250 dark:border-yellow-900/50 rounded-2xl p-4 text-xs text-yellow-800 dark:text-yellow-400 flex items-center gap-3 shadow-md">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="font-bold">Transaction Locked: </span>
            This metered billing transaction has been <span className="font-bold text-violet-600 dark:text-violet-400">{originalStatus}</span> and cannot be modified.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            {txId ? (isMeteredOnly ? "Edit Metered Billing" : "Edit Metered+WIWO Billing") : (isMeteredOnly ? "New Metered Billing" : "New Metered+WIWO Billing")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMeteredOnly ? "Billing source: Metered KG Only" : "Billing source: MAX(Metered KG, WIWO KG)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 hover:bg-red-50 hover:text-red-600"
          >
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!isReadOnly && txId && originalStatus === "DRAFT" && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={handleCancelBilling}
              className="h-9 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all active:scale-95"
            >
              Cancel Billing
            </Button>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canPost}
              className="h-9 px-6 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20 transition-all active:scale-95"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : form.status === "POSTED" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {form.status === "POSTED" ? "Post Billing" : "Save Draft"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Header */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                <Gauge className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Transaction Details</h2>
            </div>

            {/* Site / Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LPG Site</Label>
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
                      <SelectValue placeholder={sitesLoading ? "Loading sites..." : "Select LPG Site..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={String(site.id)} value={String(site.id)}>
                          {site.site_name ? `${site.site_name} (${site.customer_code})` : `Site #${site.id} (${site.customer_code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Code</Label>
                <Input
                  value={form.customerCode || "—"}
                  readOnly
                  className="bg-zinc-50 dark:bg-zinc-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction No</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-tx-no"
                    value={form.transactionNo}
                    onChange={(e) => setForm((f) => ({ ...f, transactionNo: e.target.value }))}
                    className="pl-10 font-mono"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="metered-tx-date"
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
                    className="pl-10"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price / KG</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₱</span>
                  <Input
                    id="metered-price-per-kg"
                    type="number"
                    step="0.01"
                    value={form.pricePerKg}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerKg: Number(e.target.value) }))}
                    className="pl-8"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Meter Input */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meter Readings</p>
                {/* {!txId && form.siteId && (
                  <div className="w-64">
                    <Select
                      value={form.meterReadingId?.toString() || ""}
                      onValueChange={(v) => handleReadingChange(Number(v))}
                      disabled={readingsLoading || meterReadings.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={
                          readingsLoading 
                            ? "Loading readings..." 
                            : meterReadings.length === 0 
                            ? "No recent readings found" 
                            : "Load from recent reading..."
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {meterReadings.map((reading) => (
                          <SelectItem key={reading.id} value={reading.id.toString()}>
                            {format(new Date(reading.reading_date), "MMM dd, yyyy")} ({reading.current_reading})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )} */}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Previous Reading</Label>
                  <Input
                    id="metered-prev-reading"
                    type="number"
                    step="0.001"
                    value={form.previousReading}
                    onChange={(e) => setForm((f) => ({ ...f, previousReading: Number(e.target.value) }))}
                    className="font-mono"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current Reading</Label>
                  <Input
                    id="metered-curr-reading"
                    type="number"
                    step="0.001"
                    value={form.currentReading}
                    onChange={(e) => setForm((f) => ({ ...f, currentReading: Number(e.target.value) }))}
                    className="font-mono"
                    readOnly={isReadOnly}
                  />
                </div>
                {!isMeteredOnly && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">WIWO KG (from header)</Label>
                    <Input
                      id="metered-wiwo-kg"
                      type="number"
                      step="0.001"
                      value={wiwoKg}
                      onChange={() => undefined}
                      readOnly={!!form.wiwoHeaderId}
                      className="font-mono bg-zinc-50 dark:bg-zinc-800"
                      title="Auto-filled from linked WIWO header"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Metered KG (computed)</Label>
                  <Input
                    value={Number(meteredKg).toFixed(4)}
                    readOnly
                    className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold"
                  />
                </div>
              </div>
              {!isValidReading && (
                <p className="text-xs text-red-500 mt-3 font-semibold animate-pulse">
                  ⚠️ Invalid reading: Current reading must be {meterDirection === "DECREASING" ? "less than or equal to" : "greater than or equal to"} the previous reading ({form.previousReading}) for a {meterDirection} meter.
                </p>
              )}
            </div>

            {/* WIWO Header Selection */}
            {!txId && form.siteId && !isMeteredOnly && (
              <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4 space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link WIWO Transaction</Label>
                <Select
                  value={form.wiwoHeaderId?.toString() || "none"}
                  onValueChange={(v) => setForm(f => ({ ...f, wiwoHeaderId: v === "none" ? null : Number(v) }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={wiwoLoading ? "Loading WIWO headers..." : "Select pending WIWO header..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No WIWO link (Metered only)</SelectItem>
                    {wiwoHeaders.map((header) => (
                      <SelectItem key={header.id} value={header.id.toString()}>
                        {header.transaction_no} ({format(new Date(header.transaction_date), "MMM dd, yyyy")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Meter Reading Panel */}
          <MeteredReadingPanel
            readingDate={form.transactionDate}
            previousReading={form.previousReading}
            currentReading={form.currentReading}
            meteredKg={meteredKg}
            meterUnit={(selectedSite?.meter_unit as string) || "KG"}
            meterDirection={meterDirection}
            lpgVapor={siteLpgVapor}
            psi={sitePsi}
            correctionFactor={siteCorrectionFactor}
            pressureLine={pressureLine}
          />

          {/* Variance & Arbitration */}
          {!isMeteredOnly && <VariancePanel result={arbitration} />}

          {/* WIWO detail (only if linked) */}
          {!isMeteredOnly && <WiwoValidationPanel details={linkedWiwo?.details ?? []} totalWiwoKg={wiwoKg} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
            isMeteredOnly={isMeteredOnly}
          />

          {/* Status + Remarks */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {([ "DRAFT", "POSTED", ...(form.status === "CANCELLED" ? ["CANCELLED"] as const : []) ] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.status === s
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

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Internal notes..."
                className="resize-none h-24"
                readOnly={isReadOnly}
              />
              {Number(arbitration.variance_kg) > 0 && !isMeteredOnly && !form.remarks.trim() && (
                <p className="text-[10px] text-red-500 font-semibold mt-1">
                  ⚠️ Remarks are required because there is a variance between Metered and WIWO readings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
