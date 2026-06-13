"use client";

import React, {useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  // Hash,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  Gauge,
  Info,
  Link2,
  X,
  ImagePlus,
  AlertTriangle,
  Camera,
  Settings2,
  Lock,
  // Activity,
} from "lucide-react";
import { MeteredReadingPanel } from "../../metered-wiwo-billing/components/MeteredReadingPanel";
import { VariancePanel } from "../../metered-wiwo-billing/components/VariancePanel";
import { MeteredBillingSummaryCard } from "../../metered-wiwo-billing/components/MeteredBillingSummaryCard";
import { useMeteredBillingCreation } from "../hooks/useMeteredBillingCreation";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TransactionType } from "../../metered-billing-common/types";

import type { LpgTransactionHeader } from "../../metered-billing-common/types";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  transactionHeader?: LpgTransactionHeader | null;
  initialFlowType?: "ROUTINE" | "ONBOARDING" | null;
  /**
   * PER_INVOICE mode (default: true)
   *   true  — resolve previous reading by site + customer + sales invoice
   *   false — resolve previous reading by site + customer only (any invoice)
   */
  perInvoice?: boolean;
  /**
   * AUTO_PERIOD_FROM mode (default: true, hidden from UI)
   *   true  — set billingPeriodFrom from the last reading's billing_period_to
   *   false — leave billingPeriodFrom as initialised (from transaction header)
   */
  autoPeriodFrom?: boolean;

  


  salesInvoice?: {
    invoice_id: number;
    invoice_no: string;
    sales_invoice_no?: string;
    total_amount: number;
    invoice_date: string;
    sales_order_id?: number | null;
    sales_order_no?: string | null;
  } | null;
  /** Authenticated user id decoded server-side — used as linked_by on header-invoice link */
  currentUserId?: number | null;
}

const TX_TYPE_LABELS: Record<
  TransactionType,
  { label: string; short: string; color: string }
> = {

  ONBOARDING_BASELINE: {
    label: "Onboarding / Baseline",
    short: "Onboarding",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  },
  REGULAR_BILLING: {
    label: "Regular Billing",
    short: "Regular",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-500/30",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    short: "Adjustment",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  },
};

type MobileTab = "details" | "readings" | "review";

export function CreationForm({ onSuccess, onCancel, transactionHeader, initialFlowType, salesInvoice, perInvoice = true, autoPeriodFrom = true, currentUserId = null }: Props) {
  const [activeTab, setActiveTab] = useState<MobileTab>("details");

  const {
    form,
    setForm,
    customerName,
    isOnboarding,
    // wiwoKg,
    // setWiwoKg,
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
    // meterReadings,
    // readingsLoading,
    // handleReadingChange,
    wiwoHeaders,
    wiwoLoading,
    linkedWiwo,
    isValidReading,
    meterDirection,
    pressureLine,
  } = useMeteredBillingCreation(transactionHeader, initialFlowType, salesInvoice, currentUserId);




  // ─── AUTO-FETCH PREVIOUS READING ──────────────────────────────────────────
  // Fetches the current_reading from the most recent matching transaction
  // and uses it as the new previousReading.
  //   perInvoice=true  → filter by site + customer + invoice (per-invoice chaining)
  //   perInvoice=false → filter by site + customer only (last reading for site)
  useEffect(() => {
    let isMounted = true;

    const fetchLastReading = async () => {
      // Always require siteId + customerCode; skip for onboarding baselines
      if (!form.siteId || !form.customerCode || isOnboarding) return;
      // In per-invoice mode, salesInvoiceNo must also be available
      if (perInvoice && !form.salesInvoiceNo) return;

      try {
        const params = new URLSearchParams({
          siteId: form.siteId.toString(),
          customerCode: form.customerCode,
        });
        // Attach invoice filter only when perInvoice is enabled
        if (perInvoice && form.salesInvoiceNo) {
          params.set("salesInvoiceNo", form.salesInvoiceNo);
        }

        const res = await fetch(
          `/api/ids/scm/lpg-billing-management/metered-billing/last-reading?${params}`
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch previous reading context (${res.status}).`);
        }

        const data = await res.json();

        // Only update if the API actually found a prior transaction (not null)
        if (isMounted && data !== null && data?.last_current_reading !== undefined) {
          setForm((f) => ({
            ...f,
            previousReading: Number(data.last_current_reading),
            // AUTO_PERIOD_FROM: use billing_period_to of last reading as new period start
            // When false: lock period from/to to the transaction header values
            ...(autoPeriodFrom && data.billing_period_to
              ? { billingPeriodFrom: String(data.billing_period_to) }
              : transactionHeader
                ? {
                    billingPeriodFrom: transactionHeader.period_from,
                    billingPeriodTo: transactionHeader.period_to,
                  }
                : {}),
          }));

          toast.info(
            perInvoice
              ? "Previous reading auto-resolved from the last invoice transaction."
              : "Previous reading auto-resolved from the last site transaction.",
            { icon: <Gauge className="h-4 w-4 text-blue-500" /> }
          );
        }
      } catch (error) {
        console.error("[fetchLastReading]", error);
      }
    };

    fetchLastReading();

    return () => {
      isMounted = false;
    };
  }, [
    form.siteId,
    form.customerCode,
    form.salesInvoiceNo,
    isOnboarding,
    perInvoice,
    autoPeriodFrom,
    transactionHeader,
    setForm,
  ]);
  // ──────────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const ok = await submit("DRAFT");
    if (ok) {
      toast.success(isOnboarding ? "Baseline recorded successfully" : "Billing saved successfully");
      onSuccess();
    } else {
      toast.error("Failed to submit transaction");
    }

    console.log("form", form);
    console.log("Sales Invoice", salesInvoice   )

  };

  const txTypeMeta = TX_TYPE_LABELS[form.transactionType] || TX_TYPE_LABELS.REGULAR_BILLING;

  const getValidationErrors = () => {
    const errors: string[] = [];
    if (!form.siteId) {
      errors.push("LPG Site must be selected.");
    }
    if (!isValidReading) {
      errors.push(
        `Meter reading sequence is invalid (Current reading must be ${
          meterDirection === "DECREASING"
            ? "less than or equal to"
            : "greater than or equal to"
        } the previous reading ${form.previousReading}).`
      );
    }
    if (!form.meteredReadingImageId) {
      errors.push("Meter Visual Evidence image upload is required.");
    }
    if (!form.psiReadingImageId) {
      errors.push("PSI Evidence image upload is required.");
    }
    if (!isOnboarding) {
      if (!form.customerCode) {
        errors.push("Customer Code must be resolved.");
      }
      if (arbitration.billable_kg <= 0) {
        errors.push("Billable consumption (KG) must be greater than 0.");
      }
      if (netAmount <= 0) {
        errors.push("Net amount must be greater than 0.");
      }
      const hasVariance = Number(arbitration.variance_kg) > 0;
      if (hasVariance && !form.remarks.trim()) {
        errors.push(
          "Internal Remarks are required due to variance between metered and WIWO weight."
        );
      }
    }
    return errors;
  };

  const validationErrors = getValidationErrors();

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Alert Banners */}
      <div className="space-y-3">
        {isOnboarding && (
          <div className="bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3 shadow-sm backdrop-blur-sm">
            <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">
                Onboarding / Baseline Mode
              </span>
              <span className="opacity-90">
                Recording the initial meter baseline reading after WIWO cylinder
                deployment.{" "}
                <strong className="text-amber-900 dark:text-amber-100">
                  No invoice will be generated.
                </strong>{" "}
                Prefix:{" "}
                <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-xs">
                  TXORB-
                </code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="sticky top-0 sm:relative sm:top-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-30 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 pt-2 sm:pt-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isOnboarding ? "Complete Baseline Setup" : "New Metered Billing"}
            </h1>
            <Badge
              variant="outline"
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 ${txTypeMeta.color}`}
            >
              {txTypeMeta.short}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isOnboarding
              ? "Establish initial cylinder deployment configuration and starting numbers."
              : "Compute billing based on MAX(Metered KG, WIWO KG)."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!canPost && (
            <span className="hidden md:inline-flex items-center text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/30">
              Required inputs incomplete
            </span>
          )}
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 sm:flex-none h-10 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !canPost}
            className={`hidden sm:flex flex-1 sm:flex-none h-10 px-6 font-medium shadow-sm transition-all ${isOnboarding
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white"
              }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isOnboarding ? (
              <Save className="h-4 w-4 mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {isOnboarding ? "Record Baseline" : "Post Billing"}
          </Button>
        </div>
      </div>

      {/* Mobile Steps Tabs */}
      <div className="lg:hidden flex items-center overflow-x-auto hide-scrollbar gap-2 pb-2">
        {[
          { id: "details", label: "1. Info", icon: Settings2 },
          { id: "readings", label: "2. Meter", icon: Gauge },
          { id: "review", label: "3. Review", icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MobileTab)}
              className={`flex flex-1 justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${isActive
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* TAB 1: DETAILS */}
          <div
            className={`space-y-8 lg:block ${activeTab === "details"
              ? "animate-in fade-in slide-in-from-left-4 duration-300 block"
              : "hidden"
              }`}
          >
            {/* Card: Identity & Core Details */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
                <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Transaction Basic Info
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Site, type, references, and timeline details.
                  </p>
                </div>
              </div>

              {/* Transaction Type and Site Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Customer Name
                  </Label>
                  <Input
                    value={customerName}
                    readOnly
                    className="bg-zinc-50 dark:bg-zinc-950/50 border-dashed text-zinc-600 dark:text-zinc-400 font-semibold"
                    placeholder="Auto-resolved customer name..."
                  />
                </div>

                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    LPG Site
                  </Label>
                  <Select
                    value={form.siteId ? String(form.siteId) : undefined}
                    disabled={!!transactionHeader}
                    onValueChange={(v) => handleSiteChange(Number(v))}
                  >
                    <SelectTrigger className="w-full h-10">
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
                            : `No Custome Site Name`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Transaction No
                  </Label>
                  <Input
                    value={form.transactionNo}
                    readOnly
                    className="bg-zinc-50 dark:bg-zinc-950/50 border-dashed text-zinc-600 dark:text-zinc-400 font-mono"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Transaction Date
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      type="date"
                      value={form.transactionDate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          transactionDate: e.target.value,
                        }))
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {form.salesInvoiceNo && (
                <div className="space-y-2.5 bg-violet-50/30 dark:bg-violet-900/10 p-3.5 rounded-xl border border-violet-100 dark:border-violet-800/30">
                  <Label className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Linked Sales Invoice (Locked)
                  </Label>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      {form.salesInvoiceNo}
                    </span>
                    <span className="text-[10px] bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      System-Resolved
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50/50 dark:bg-zinc-800/20 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Period From
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      type="date"
                      value={form.billingPeriodFrom || ""}
                      readOnly={!!transactionHeader}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billingPeriodFrom: e.target.value,
                        }))
                      }
                      className="pl-9 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Period To
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      type="date"
                      value={form.billingPeriodTo || ""}
                      readOnly={!!transactionHeader}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billingPeriodTo: e.target.value,
                        }))
                      }
                      className="pl-9 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>
                {!isOnboarding && (
                  <div className="space-y-2.5">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Price / KG
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-sm">
                        ₱
                      </span>
                      <Input
                        type="number"
                        value={form.pricePerKg}
                        readOnly={!!transactionHeader}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            pricePerKg: Number(e.target.value),
                          }))
                        }
                        className="pl-8 bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* TAB 2: READINGS */}
          <div
            className={`space-y-8 lg:block ${activeTab === "readings"
              ? "animate-in fade-in slide-in-from-right-4 duration-300 block"
              : "hidden"
              }`}
          >
            {/* Card: Meter Data & Validation */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Meter Readings
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Input starting and current physical meter states.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8 bg-zinc-50/50 dark:bg-zinc-800/20 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <div className="flex-1 space-y-5 max-w-sm">
                    <div className="space-y-2.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Previous Reading
                      </Label>
                      <Input
                        type="number"
                        value={form.previousReading}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            previousReading: Number(e.target.value),
                          }))
                        }
                        disabled
                        className="font-mono bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Current Reading
                      </Label>
                      <Input
                        type="number"
                        value={form.currentReading}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            currentReading: Number(e.target.value),
                          }))
                        }
                        className="font-mono bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div className="space-y-2.5 pt-2">
                      <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Metered KG (Computed)
                      </Label>
                      <Input
                        value={Number(meteredKg).toFixed(4)}
                        readOnly
                        className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold border-blue-200 dark:border-blue-800 h-11 text-lg shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-center md:items-start shrink-0">
                    <ImageUploadField
                      label="Meter Visual Evidence"
                      imageId={form.meteredReadingImageId}
                      onChange={(id) =>
                        setForm((f) => ({ ...f, meteredReadingImageId: id }))
                      }
                      isReadOnly={false}
                      required={true}
                      uploadEndpoint="/api/ids/scm/lpg-billing-management/metered-billing/upload"
                      previewClassName="aspect-square w-[220px] rounded-xl shadow-sm"
                    />
                  </div>
                </div>

                {!isValidReading && (
                  <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>
                      <strong>Invalid reading sequence:</strong> Current reading
                      must be{" "}
                      {meterDirection === "DECREASING"
                        ? "less than or equal to"
                        : "greater than or equal to"}{" "}
                      the previous reading ({form.previousReading}) based on a{" "}
                      <strong>{meterDirection}</strong> meter configuration.
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800" />

              {/* Meter Configuration */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Meter Configurations
                    </h2>
                    <p className="text-xs text-zinc-500">
                      System calibration and gas computation parameters.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8 bg-zinc-50/50 dark:bg-zinc-800/20 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <div className="flex-1 space-y-5 max-w-sm">
                    <div className="space-y-2.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        LPG Vapor
                      </Label>
                      <Input
                        type="number"
                        value={form.configLpgVapor}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            configLpgVapor: Number(e.target.value),
                          }))
                        }
                        className="font-mono bg-white dark:bg-zinc-900 text-muted-foreground"
                        readOnly
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        PSI
                      </Label>
                      <Input
                        type="number"
                        value={form.configPsi}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            configPsi: Number(e.target.value),
                          }))
                        }
                        className="font-mono bg-white dark:bg-zinc-900"
                   
                      />
                    </div>
                    <div className="space-y-2.5 pt-2">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider text-nowrap">
                        Correction Factor
                      </Label>
                      <Input
                        type="number"
                        value={form.configCorrectionFactor}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            configCorrectionFactor: Number(e.target.value),
                          }))
                        }
                        className="font-mono bg-white dark:bg-zinc-900 text-muted-foreground"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-center md:items-start shrink-0">
                    <ImageUploadField
                      label="PSI Evidence"
                      imageId={form.psiReadingImageId}
                      onChange={(id) =>
                        setForm((f) => ({ ...f, psiReadingImageId: id }))
                      }
                      isReadOnly={false}
                      required={true}
                      uploadEndpoint="/api/ids/scm/lpg-billing-management/metered-billing/upload"
                      previewClassName="aspect-square w-[220px] rounded-xl shadow-sm"
                      compact
                    />
                  </div>
                </div>
              </div>

              {/* WIWO Linking */}
              {!isOnboarding && form.siteId && (
                <>
                  <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800" />
                  <div className="bg-violet-50/50 dark:bg-violet-500/5 p-5 rounded-xl border border-violet-100 dark:border-violet-500/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <Label className="text-sm font-semibold text-violet-900 dark:text-violet-300">
                        WIWO System Linkage (Arbitration)
                      </Label>
                    </div>

                    <Select
                      value={form.wiwoHeaderId?.toString() ?? "none"}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          wiwoHeaderId: v === "none" ? null : Number(v),
                        }))
                      }
                    >
                      <SelectTrigger className="w-full h-11 bg-white dark:bg-zinc-950">
                        <SelectValue
                          placeholder={
                            wiwoLoading
                              ? "Scanning for WIWO headers..."
                              : "Select WIWO Reference..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="font-medium text-zinc-500">
                          Standalone (No WIWO Link)
                        </SelectItem>
                        {wiwoHeaders.map((header) => (
                          <SelectItem key={header.id} value={header.id.toString()}>
                            {header.transaction_no} —{" "}
                            {format(new Date(header.transaction_date), "MMM dd, yyyy")}
                            {header.total_wiwo_kg !== undefined
                              ? ` (${Number(header.total_wiwo_kg).toFixed(4)} kg)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {linkedWiwo ? (
                      <p className="text-xs text-violet-700 dark:text-violet-400 font-medium flex items-center gap-1.5 pt-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active Arbitration Mode: Billed amount will utilize MAX(Metered, WIWO).
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 pt-1">
                        Operating in Standalone Mode. Billing will rely strictly on computed Metered KG.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>

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

            {!isOnboarding && <VariancePanel result={arbitration} />}
          </div>
        </div>

        {/* TAB 3: REVIEW / SUMMARY */}
        <div
          className={`lg:col-span-4 relative lg:block ${activeTab === "review"
            ? "animate-in fade-in slide-in-from-right-4 duration-300 block"
            : "hidden"
            }`}
        >
          <div className="sticky top-6 space-y-6">
            {isOnboarding ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Baseline Target
                  </h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                      Opening
                    </span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {form.previousReading.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                      Baseline
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {form.currentReading.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                      Initial KG
                    </span>
                    <span className="font-mono font-bold text-lg">
                      {Number(meteredKg).toFixed(4)}{" "}
                      <span className="text-xs text-zinc-400">kg</span>
                    </span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3.5 text-xs text-zinc-500 leading-relaxed">
                    This reading establishes the system baseline for the site.
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
                lpgVapor={form.configLpgVapor}
                psi={form.configPsi}
                pressureLine={pressureLine}
                previousReading={form.previousReading}
                currentReading={form.currentReading}
              />
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Internal Remarks
                  </Label>
                  {Number(arbitration.variance_kg) > 0 &&
                    !isOnboarding &&
                    !form.remarks.trim() && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded">
                        Required
                      </span>
                    )}
                </div>
                <Textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                  placeholder="Add notes regarding variances, adjustments, or context..."
                  className="resize-none h-32 bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-violet-500"
                />
              </div>
            </div>

            {!canPost && (
              <div className="bg-rose-50/80 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-5 space-y-3 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span className="font-bold text-sm">Posting Requirements</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-rose-700/95 dark:text-rose-400/90">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Actions Footer */}
      <div className="lg:hidden flex items-center justify-between mt-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (activeTab === "review") setActiveTab("readings");
            else if (activeTab === "readings") setActiveTab("details");
          }}
          disabled={activeTab === "details"}
          className="w-1/3 border-zinc-200 dark:border-zinc-800"
        >
          Previous
        </Button>

        {activeTab !== "review" ? (
          <Button
            type="button"
            onClick={() => {
              if (activeTab === "details") setActiveTab("readings");
              else if (activeTab === "readings") setActiveTab("review");
            }}
            className="w-1/3 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Next Step
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || !canPost}
            className={`w-1/3 ${isOnboarding
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white"
              }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOnboarding ? (
              "Record"
            ) : (
              "Post"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}


// ─── Image Upload Field Component ───────────────────────────────────────────

interface ImageUploadFieldProps {
  label: string;
  imageId: string;
  onChange: (id: string) => void;
  isReadOnly: boolean;
  required?: boolean;
  folderName?: string;
  uploadEndpoint: string;
  previewClassName?: string;
  compact?: boolean;
}

export function ImageUploadField({
  label,
  imageId,
  onChange,
  isReadOnly,
  required = false,
  folderName = "metered_billing_attachments",
  uploadEndpoint,
  previewClassName,
  compact = false,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const hasError = required && !imageId;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File limit exceeded", {
        description: "Maximum image size is 10MB.",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder_name", folderName);

      const res = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await res.json();

      onChange(result.data.id);

      toast.success(`${label} attached successfully`);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Could not process image";

      toast.error("Upload error", {
        description: msg,
      });
    } finally {
      setUploading(false);
    }
  };

  const previewUrl = imageId
    ? `/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(
        imageId
      )}`
    : null;

  return (
    <div className="space-y-2.5 w-full">
      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {previewUrl ? (
        <>
          <div
            className={`relative group overflow-hidden border ${
              hasError
                ? "border-red-400"
                : "border-zinc-200 dark:border-zinc-800"
            } bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center rounded-xl shadow-sm transition-all hover:ring-2 hover:ring-violet-500/50 ${
              previewClassName ?? "h-32 w-full"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={label}
              onClick={() => setIsPreviewOpen(true)}
              className="object-cover h-full w-full cursor-zoom-in"
            />

            {!isReadOnly && (
              <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] pointer-events-none">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 rounded-full shadow-lg pointer-events-auto"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Dialog
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
          >
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              className="sm:max-w-4xl w-full rounded-2xl p-0 overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
            >
              <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
                <DialogTitle className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                  {label}
                </DialogTitle>

                <DialogClose asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>

              <div className="p-6 bg-zinc-100/50 dark:bg-black/20 flex justify-center items-center min-h-[50vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={label}
                  className="w-full max-h-[75vh] object-contain rounded-lg shadow-sm"
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={isReadOnly || uploading}
          />

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={isReadOnly || uploading}
          />

          <div
            onClick={() =>
              !isReadOnly &&
              !uploading &&
              fileInputRef.current?.click()
            }
            className={`relative group transition-all duration-200 rounded-xl overflow-hidden border-2 border-dashed ${
              hasError
                ? "border-red-400 bg-red-50/30 dark:bg-red-950/10"
                : isReadOnly
                ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 cursor-not-allowed"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-500/5 cursor-pointer"
            } flex items-center justify-center ${
              previewClassName ?? "h-32 w-full"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              ) : (
                <>
                  <ImagePlus
                    className={`h-6 w-6 mb-1 ${
                      hasError
                        ? "text-red-500"
                        : isReadOnly
                        ? "text-zinc-300 dark:text-zinc-700"
                        : "text-zinc-400 group-hover:text-violet-500 transition-colors"
                    }`}
                  />

                  {!compact && (
                    <div className="space-y-1">
                      <span
                        className={`text-sm font-medium ${
                          hasError
                            ? "text-red-600"
                            : isReadOnly
                            ? "text-zinc-400"
                            : "text-zinc-600 dark:text-zinc-300 group-hover:text-violet-700 dark:group-hover:text-violet-400"
                        }`}
                      >
                        Click to upload
                      </span>

                      <p className="text-[10px] text-zinc-400">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isReadOnly && !uploading && (
              <div className="absolute bottom-2 right-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-violet-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  title="Take Photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {hasError && (
            <p className="mt-2 text-xs text-red-500">
              {label} is required.
            </p>
          )}
        </div>
      )}
    </div>
  );
}