// RULE DEV: WiWO Billing Summary Detail
// Full detail view for a single WiWO billing transaction.
// Mirrors the design of metered-billing-summary/components/SummaryDetail.tsx

"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Loader2,
  Scale,
  Settings2,
  CheckCircle2,
  Link2,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { useWiwoSummaryDetail } from "../hooks/useWiwoSummary";
import { WiwoBillingSummaryCard } from "./WiwoBillingSummaryCard";
import { WiwoCylinderPanel } from "./WiwoCylinderPanel";
import type { WiwoHeader } from "../types";

interface Props {
  txId: number;
  onClose: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  POSTED:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-800/30",
  CANCELLED:
    "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-800/30",
};

const TX_TYPE_META: Record<string, { label: string; short: string; color: string }> = {
  ONBOARDING_BASELINE: {
    label: "Onboarding / Baseline",
    short: "Onboarding",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200",
  },
  REGULAR_BILLING: {
    label: "Regular Billing",
    short: "Regular",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200",
  },
};

type MobileTab = "details" | "cylinders" | "review";

export function WiwoSummaryDetail({ txId, onClose }: Props) {
  const { tx, loading } = useWiwoSummaryDetail(txId);
  const [activeTab, setActiveTab] = useState<MobileTab>("details");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-orange-500">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-medium animate-pulse text-zinc-500">
            Loading WiWO billing record...
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

  const txTypeMeta = TX_TYPE_META[tx.transaction_type ?? ""] || TX_TYPE_META.REGULAR_BILLING;
  const isOnboarding = tx.transaction_type === "ONBOARDING_BASELINE";

  // Resolve the wiwo_header — can be embedded in wiwo_header field or via wiwo_header_id as object
  // The provider may return it as tx.wiwo_header (mapped) or tx.wiwo_header_id (raw Directus embed)
  const wiwoHeader: WiwoHeader | null =
    (tx.wiwo_header as WiwoHeader | undefined) ??
    (tx.wiwo_header_id && typeof tx.wiwo_header_id === "object"
      ? (tx.wiwo_header_id as unknown as WiwoHeader)
      : null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-30 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 pt-2 sm:pt-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {tx.transaction_no || `TX #${tx.id}`}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${STATUS_STYLE[tx.status] ?? ""}`}
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
          id="wiwo-summary-back-to-list"
          variant="outline"
          onClick={onClose}
          className="h-10 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Back to List
        </Button>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center overflow-x-auto hide-scrollbar gap-2 pb-2">
        {[
          { id: "details", label: "1. Info", icon: Settings2 },
          { id: "cylinders", label: "2. Cylinders", icon: Package },
          { id: "review", label: "3. Review", icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`wiwo-summary-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as MobileTab)}
              className={`flex flex-1 justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-orange-500 text-white shadow-sm"
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
        {/* ── Left Panel: Details + Cylinders ── */}
        <div className="lg:col-span-8 space-y-8">
          {/* TAB 1: Identity Info */}
          <div
            className={`space-y-8 lg:block ${
              activeTab === "details"
                ? "animate-in fade-in slide-in-from-left-4 duration-300 block"
                : "hidden"
            }`}
          >
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

              {/* Core identity grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    Customer
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {tx.customer?.customer_name || tx.customer_code}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">({tx.customer_code})</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    LPG Site
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {tx.site?.site_name || "—"}
                  </span>
                  <span className="text-[11px] text-zinc-400">ID: {tx.lpg_site_id}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    Transaction Date
                  </span>
                  <span className="font-medium">
                    {tx.transaction_date
                      ? format(new Date(tx.transaction_date), "MMMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    Billing Invoice
                  </span>
                  {tx.sales_invoice_no ? (
                    <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-none font-bold">
                      {tx.sales_invoice_no}
                    </Badge>
                  ) : (
                    <span className="text-zinc-400 italic">Unbilled</span>
                  )}
                </div>
              </div>

              {/* Period + billing rate */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50/50 dark:bg-zinc-800/20 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800/50 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    Prev. Transaction Date
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                    {tx.billing_period_from
                      ? format(new Date(tx.billing_period_from), "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                    Curr. Transaction Date
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                    {tx.billing_period_to
                      ? format(new Date(tx.billing_period_to), "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
                {!isOnboarding && (
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                      Price / KG
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      ₱{Number(tx.price_per_kg).toFixed(2)} / kg
                    </span>
                  </div>
                )}
              </div>

              {/* Linked WiWO reference banner */}
              {!isOnboarding && (
                <div className="bg-orange-50/50 dark:bg-orange-500/5 p-4 rounded-xl border border-orange-100 dark:border-orange-500/20 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span className="font-semibold text-orange-900 dark:text-orange-300">
                      Linked WiWO Reference:
                    </span>
                  </div>
                  <span className="font-mono text-orange-950 dark:text-orange-300 font-bold bg-orange-100/50 dark:bg-orange-900/30 px-3 py-1 rounded-lg">
                    {wiwoHeader
                      ? wiwoHeader.wiwo_no || wiwoHeader.transaction_no || `WiWO #${wiwoHeader.id}`
                      : "Standalone (No WiWO linkage)"}
                  </span>
                </div>
              )}

              {/* KG overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/30 p-4 text-center border border-zinc-100 dark:border-zinc-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Metered KG
                  </p>
                  <p className="font-mono font-black text-lg text-zinc-800 dark:text-zinc-200">
                    {Number(tx.metered_kg).toFixed(4)}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/30 p-4 text-center border border-zinc-100 dark:border-zinc-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    WiWO KG
                  </p>
                  <p className="font-mono font-black text-lg text-zinc-800 dark:text-zinc-200">
                    {Number(tx.wiwo_kg).toFixed(4)}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/30 p-4 text-center border border-zinc-100 dark:border-zinc-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Variance KG
                  </p>
                  <p
                    className={`font-mono font-black text-lg ${
                      Number(tx.variance_kg) > 10
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {Number(tx.variance_kg).toFixed(4)}
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-4 text-center border border-orange-200 dark:border-orange-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1">
                    Billable KG
                  </p>
                  <p className="font-mono font-black text-lg text-orange-700 dark:text-orange-400">
                    {Number(tx.billable_kg).toFixed(4)}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* TAB 2: Cylinder Details */}
          <div
            className={`space-y-8 lg:block ${
              activeTab === "cylinders"
                ? "animate-in fade-in slide-in-from-right-4 duration-300 block"
                : "hidden"
            }`}
          >
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    WiWO Cylinder Weighing Records
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Individual cylinder consumption and swap records.
                  </p>
                </div>
              </div>
              <WiwoCylinderPanel wiwoHeader={wiwoHeader ?? null} />
            </section>
          </div>
        </div>

        {/* ── Right Panel: Summary + Remarks ── */}
        <div
          className={`lg:col-span-4 space-y-6 lg:block ${
            activeTab === "review"
              ? "animate-in fade-in slide-in-from-right-4 duration-300 block"
              : "hidden"
          }`}
        >
          {/* Billing summary card */}
          <WiwoBillingSummaryCard
            meteredKg={tx.metered_kg}
            wiwoKg={tx.wiwo_kg}
            varianceKg={tx.variance_kg}
            billableKg={tx.billable_kg}
            billableSource={tx.billable_source}
            grossAmount={tx.gross_amount}
            vatAmount={tx.vat_amount}
            netAmount={tx.net_amount}
            pricePerKg={tx.price_per_kg}
            isOnboarding={isOnboarding}
          />

          {/* Remarks */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4 text-sm">
            <h4 className="font-bold text-zinc-500 text-xs uppercase tracking-wider">
              Remarks / Notes
            </h4>
            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl text-zinc-700 dark:text-zinc-300 min-h-[100px] whitespace-pre-wrap leading-relaxed">
              {tx.remarks || <span className="italic text-zinc-400">No remarks provided.</span>}
            </div>
          </div>

          {/* Variance reason (for regular billing) */}
          {!isOnboarding && tx.variance_reason_code && tx.variance_reason_code !== "NONE" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 space-y-2 text-sm">
              <h4 className="font-bold text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider">
                Variance Reason
              </h4>
              <Badge className="bg-amber-100 text-amber-700 border-none font-bold">
                {tx.variance_reason_code.replace(/_/g, " ")}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
