"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Loader2,
  CheckCircle2,
  Gauge,
  Link2,
  X,
  Settings2,
} from "lucide-react";
// RULE DEV: Using locally copied components to avoid cross-module imports
import { MeteredReadingPanel } from "./MeteredReadingPanel";
import { VariancePanel } from "./VariancePanel";
import { MeteredBillingSummaryCard } from "./MeteredBillingSummaryCard";
import { useMeteredBillingSummaryDetail } from "../hooks/useMeteredBillingSummary";
import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import type { TransactionType } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-billing/metered-billing-common/types";

interface Props {
  txId: number;
  onClose: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  POSTED: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-800/30",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-800/30",
};

const TX_TYPE_LABELS: Record<
  TransactionType,
  { label: string; short: string; color: string }
> = {
  ONBOARDING_BASELINE: {
    label: "Onboarding / Baseline",
    short: "Onboarding",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200",
  },
  REGULAR_BILLING: {
    label: "Regular Billing",
    short: "Regular",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    short: "Adjustment",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200",
  },
};

type MobileTab = "details" | "readings" | "review";

export function SummaryDetail({ txId, onClose }: Props) {
  const { tx, loading } = useMeteredBillingSummaryDetail(txId);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [activeTab, setActiveTab] = useState<MobileTab>("details");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-violet-500">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-medium animate-pulse text-zinc-500">
            Loading billing summary...
          </p>
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="text-center p-8 border border-dashed rounded-2xl text-zinc-500">
        Transaction record not found.
      </div>
    );
  }

  const txTypeMeta = TX_TYPE_LABELS[tx.transaction_type] || TX_TYPE_LABELS.REGULAR_BILLING;
  const isOnboarding = tx.transaction_type === "ONBOARDING_BASELINE";

  // IDS-CHANGE: Resolve metered reading and PSI images using the new MTRD_READING_IMAGE and PSI_IMAGE types, with fallback to GENERAL_PHOTO
  const prevImg = tx.attachments?.find((a) => a.attachment_type === "MTRD_READING_IMAGE" || a.attachment_type === "GENERAL_PHOTO")?.directus_file_id;
  const psiImg = tx.attachments?.find((a) => a.attachment_type === "PSI_IMAGE" || a.attachment_type === "GENERAL_PHOTO")?.directus_file_id;

  const handleZoom = (fileId: string, label: string) => {
    setActivePreviewUrl(`/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(fileId)}`);
    setPreviewTitle(label);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-30 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 pt-2 sm:pt-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {tx.transaction_no || tx.reading_no}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${STATUS_STYLE[tx.status]}`}
            >
              {tx.status}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${txTypeMeta.color}`}
            >
              {txTypeMeta.short}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Recorded by User ID {tx.created_by || "—"} on{" "}
            {tx.created_date ? format(new Date(tx.created_date), "MMM dd, yyyy hh:mm a") : "—"}.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={onClose}
          className="h-10 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Back to List
        </Button>
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
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* TAB 1: DETAILS */}
          <div
            className={`space-y-8 lg:block ${activeTab === "details"
              ? "animate-in fade-in slide-in-from-left-4 duration-300 block"
              : "hidden"
              }`}
          >
            {/* Card: Identity Info */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-500/10 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Transaction Properties
                  </h2>
                  <p className="text-xs text-zinc-500">Timeline and operational parameters.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Customer</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {tx.customer?.customer_name || tx.customer_code}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">({tx.customer_code})</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">LPG Site</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {tx.site?.site_name || "—"}
                  </span>
                  <span className="text-[11px] text-zinc-400">ID: {tx.lpg_site_id}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Transaction Date</span>
                  <span className="font-medium">
                    {tx.transaction_date ? format(new Date(tx.transaction_date), "MMMM dd, yyyy") : "—"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Billing Invoice</span>
                  {tx.sales_invoice_no ? (
                    <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-none font-bold">
                      {tx.sales_invoice_no}
                    </Badge>
                  ) : (
                    <span className="text-zinc-400 italic">Unbilled</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50/50 dark:bg-zinc-800/20 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800/50 text-sm">
                <div className="space-y-1">
                  {/* RULE DEV: Renamed from Period From to Previous Transaction Date per UX improvement */}
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Prev. Transaction Date</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                    {tx.billing_period_from ? format(new Date(tx.billing_period_from), "MMM dd, yyyy") : "—"}
                  </span>
                </div>
                <div className="space-y-1">
                  {/* RULE DEV: Renamed from Period To to Current Transaction Date per UX improvement */}
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Curr. Transaction Date</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                    {tx.billing_period_to ? format(new Date(tx.billing_period_to), "MMM dd, yyyy") : "—"}
                  </span>
                </div>
                {!isOnboarding && (
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Billed Rate</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      ₱{tx.price_per_kg.toFixed(2)} / kg
                    </span>
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
            {/* Readings and Configurations */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Readings & Visual Proof
                  </h2>
                  <p className="text-xs text-zinc-500">Physical states captured at the site location.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 bg-zinc-50/50 dark:bg-zinc-800/20 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex-1 space-y-4 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Previous Reading</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-base">
                      {tx.meter_reading?.previous_reading.toFixed(3) || "0.000"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Current Reading</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-base">
                      {tx.meter_reading?.current_reading.toFixed(3) || "0.000"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider text-xs">Metered Consumption</span>
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-lg">
                      {tx.metered_kg.toFixed(4)} kg
                    </span>
                  </div>
                </div>

                {/* Meter Image Preview */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                    Meter Screenshot
                  </span>
                  {prevImg ? (
                    <div className="relative group overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center rounded-xl shadow-sm aspect-square w-[180px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(prevImg)}`}
                        alt="Meter Screenshot"
                        onClick={() => handleZoom(prevImg, "Meter Evidence")}
                        className="object-cover h-full w-full cursor-zoom-in"
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl aspect-square w-[180px] flex items-center justify-center text-zinc-400 text-xs bg-zinc-50/50">
                      No image uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Pressure Config & PSI Image */}
              <div className="flex flex-col md:flex-row gap-8 bg-zinc-50/50 dark:bg-zinc-800/20 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex-1 space-y-4 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">LPG Vapor</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                      {tx.pressure_line || "2.0183"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">PSI</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                      {tx.psi || "10.0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Atmospheric Pressure</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                      {tx.atmospheric_pressure || "14.7"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Vapor Factor</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-bold">
                      {tx.lpg_vapor_factor ? tx.lpg_vapor_factor.toFixed(4) : "1.0000"}
                    </span>
                  </div>
                </div>

                {/* PSI Image Preview */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                    PSI Screenshot
                  </span>
                  {psiImg ? (
                    <div className="relative group overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center rounded-xl shadow-sm aspect-square w-[180px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(psiImg)}`}
                        alt="PSI Screenshot"
                        onClick={() => handleZoom(psiImg, "PSI Evidence")}
                        className="object-cover h-full w-full cursor-zoom-in"
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl aspect-square w-[180px] flex items-center justify-center text-zinc-400 text-xs bg-zinc-50/50">
                      No image uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* WIWO linked reference */}
              {!isOnboarding && (
                <div className="bg-violet-50/50 dark:bg-violet-500/5 p-4 rounded-xl border border-violet-100 dark:border-violet-500/20 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span className="font-semibold text-violet-900 dark:text-violet-300">
                      Linked WIWO Reference:
                    </span>
                  </div>
                  <span className="font-mono text-violet-950 dark:text-violet-300 font-bold bg-violet-100/50 dark:bg-violet-900/30 px-3 py-1 rounded-lg">
                    {tx.wiwo_header?.transaction_no || "Standalone (No WIWO linkage)"}
                  </span>
                </div>
              )}
            </section>

            <MeteredReadingPanel
              readingDate={tx.transaction_date}
              previousReading={tx.meter_reading?.previous_reading ?? 0}
              currentReading={tx.meter_reading?.current_reading ?? 0}
              meteredKg={tx.metered_kg}
              meterUnit={tx.meter_unit || "m3"}
              meterDirection={tx.meter_direction || "INCREASING"}
              lpgVapor={tx.pressure_line ?? 2.0183}
              psi={tx.psi ?? 10.0}
              correctionFactor={tx.atmospheric_pressure ?? 14.7}
              pressureLine={tx.lpg_vapor_factor ?? 1.0}
            />

            {!isOnboarding && (
              <VariancePanel
                result={{
                  metered_kg: tx.metered_kg,
                  wiwo_kg: tx.wiwo_kg,
                  variance_kg: tx.variance_kg,
                  billable_kg: tx.billable_kg,
                  billable_source: tx.billable_source,
                }}
              />
            )}
          </div>
        </div>

        {/* Right Side summary area */}
        <div
          className={`lg:col-span-4 space-y-6 lg:block ${activeTab === "review"
            ? "animate-in fade-in slide-in-from-right-4 duration-300 block"
            : "hidden"
            }`}
        >
          {isOnboarding ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5 text-sm">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Gauge className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Baseline Summary
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Opening</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {tx.meter_reading?.previous_reading.toFixed(3) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Baseline Reading</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {tx.meter_reading?.current_reading.toFixed(3) || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2 font-bold text-base">
                  <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Initial KG</span>
                  <span>
                    {tx.metered_kg.toFixed(4)} <span className="text-xs font-normal text-zinc-400">kg</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <MeteredBillingSummaryCard
              meteredKg={tx.metered_kg}
              wiwoKg={tx.wiwo_kg}
              varianceKg={tx.variance_kg}
              billableKg={tx.billable_kg}
              billableSource={tx.billable_source}
              grossAmount={tx.gross_amount}
              vatAmount={tx.vat_amount}
              netAmount={tx.net_amount}
              pricePerKg={tx.price_per_kg}
              isMeteredOnly={!tx.wiwo_header_id}
              lpgVapor={tx.pressure_line}
              psi={tx.psi}
              pressureLine={tx.lpg_vapor_factor}
              previousReading={tx.meter_reading?.previous_reading}
              currentReading={tx.meter_reading?.current_reading}
            />
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4 text-sm">
            <h4 className="font-bold text-zinc-500 text-xs uppercase tracking-wider">Remarks / Notes</h4>
            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl text-zinc-700 dark:text-zinc-300 min-h-[100px] whitespace-pre-wrap leading-relaxed">
              {tx.remarks || <span className="italic text-zinc-400">No remarks provided.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog for zoomed-in images */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="sm:max-w-4xl w-full rounded-2xl p-0 overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
        >
          <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
            <DialogTitle className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              {previewTitle}
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
          {activePreviewUrl && (
            <div className="p-6 bg-zinc-100/50 dark:bg-black/20 flex justify-center items-center min-h-[50vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewUrl}
                alt={previewTitle}
                className="w-full max-h-[75vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
