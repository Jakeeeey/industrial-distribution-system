"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User2,
  Phone,
  Mail,
  TrendingUp,
  Package,
  Wallet,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CustomerHistoryData } from "../types";
import {
  calculateFulfillmentScore,
  calculateMissingEmpties,
  formatPHP,
} from "../utils/calculations";
import { cn } from "@/lib/utils";

interface CustomerKpiCardsProps {
  customer: CustomerHistoryData;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
  Commercial: "bg-blue-500/10 text-blue-600 border-blue-200",
  "Walk-in": "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "Retail Trade Outlet": "bg-violet-500/10 text-violet-600 border-violet-200",
  RTO: "bg-violet-500/10 text-violet-600 border-violet-200",
  Retail: "bg-violet-500/10 text-violet-600 border-violet-200",
  Residential: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  Dealer: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  "Sub-Dealer": "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  Unclassified: "bg-muted text-muted-foreground border-border",
};

function scoreVariant(score: number) {
  if (score >= 90)
    return {
      ring: "text-emerald-500",
      bar: "bg-emerald-500",
      text: "text-emerald-600",
      label: "Excellent",
    };
  if (score >= 70)
    return {
      ring: "text-yellow-500",
      bar: "bg-yellow-500",
      text: "text-yellow-600",
      label: "Good",
    };
  return {
    ring: "text-red-500",
    bar: "bg-red-500",
    text: "text-red-600",
    label: "Poor",
  };
}

function balanceVariant(balance: number) {
  if (balance === 0)
    return {
      text: "text-emerald-600",
      label: "Fully Settled",
      icon: CheckCircle2,
      iconCls: "text-emerald-500",
    };
  if (balance < 50_000)
    return {
      text: "text-yellow-600",
      label: "Has Outstanding",
      icon: AlertCircle,
      iconCls: "text-yellow-500",
    };
  return {
    text: "text-red-600",
    label: "High Exposure",
    icon: AlertCircle,
    iconCls: "text-red-500",
  };
}

/** SVG circular gauge */
function CircularGauge({
  value,
  variant,
}: {
  value: number;
  variant: ReturnType<typeof scoreVariant>;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
      <svg className="-rotate-90 w-20 h-20" viewBox="0 0 64 64">
        {/* track */}
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-muted/20"
        />
        {/* fill */}
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-700", variant.ring)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-base font-black tabular-nums leading-none",
            variant.text,
          )}
        >
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerKpiCards({ customer }: CustomerKpiCardsProps) {
  const score = calculateFulfillmentScore(customer.metrics);
  const empties = calculateMissingEmpties(customer.metrics);
  const { outstandingBalance, avgVisitDays, timeGap, volumeGap, currentUsage } =
    customer.metrics;

  const sv = scoreVariant(score);
  const bv = balanceVariant(outstandingBalance);
  const BalIcon = bv.icon;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {/* ── Card 1: Account Identity ───────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-0 fill-mode-both">
        <CardContent className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <User2 className="h-5 w-5 text-primary" />
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest",
                TIER_STYLES[customer.tier] ?? "bg-muted text-muted-foreground",
              )}
            >
              {customer.tier}
            </Badge>
          </div>

          {/* Name */}
          <div>
            <p className="text-base font-black text-foreground leading-tight line-clamp-1">
              {customer.name}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {customer.id}
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            {customer.phone && customer.phone !== "—" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{customer.phone}</span>
              </div>
            )}
            {customer.contact && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{customer.contact}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-primary font-semibold">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Avg Visit: Every {avgVisitDays} Days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Fulfillment Rate ───────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Fulfillment Rate
              </p>
              <p className={cn("text-xs font-bold mt-0.5", sv.text)}>
                {sv.label}
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground/40" />
          </div>

          <div className="flex items-center gap-4">
            <CircularGauge value={score} variant={sv} />
            <div className="space-y-2 flex-1 min-w-0">
              <div>
                <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                  Time Gap
                </p>
                <p className="text-xs font-black flex items-center gap-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full inline-block",
                      timeGap === 0 ? "bg-emerald-500" : "bg-yellow-500",
                    )}
                  />
                  {timeGap} Days
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                  Volume Gap
                </p>
                <p
                  className={cn(
                    "text-xs font-black truncate",
                    score >= 90 ? "text-emerald-600" : "text-yellow-600",
                  )}
                >
                  {volumeGap}
                </p>
              </div>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                sv.bar,
              )}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Missing Empties ────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Missing Empties
            </p>
            <Package className="h-4 w-4 text-muted-foreground/40" />
          </div>

          <div className="flex items-end gap-2">
            <span
              className={cn(
                "text-4xl font-black tabular-nums leading-none",
                empties === 0
                  ? "text-foreground"
                  : empties < 10
                    ? "text-yellow-600"
                    : "text-red-600",
              )}
            >
              {empties}
            </span>
            <span className="text-sm text-muted-foreground font-bold pb-0.5">
              cylinders
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            <div className="text-center p-2 rounded-lg bg-blue-500/5 border border-blue-100/50">
              <p className="text-[9px] font-bold uppercase text-blue-500/70 tracking-widest">
                Deployed
              </p>
              <p className="text-sm font-black text-blue-600 tabular-nums">
                {customer.metrics.cumulativeDeployed}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-100/50">
              <p className="text-[9px] font-bold uppercase text-emerald-500/70 tracking-widest">
                Returned
              </p>
              <p className="text-sm font-black text-emerald-600 tabular-nums">
                {customer.metrics.cumulativeReturned}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-2.5 py-1.5">
            <Info className="h-3 w-3 text-primary shrink-0" />
            Total physical assets owed.
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Outstanding Balance ────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-450 fill-mode-both">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Outstanding Balance
            </p>
            <Wallet className="h-4 w-4 text-muted-foreground/40" />
          </div>

          <div>
            <p
              className={cn(
                "text-2xl font-black tabular-nums leading-tight",
                bv.text,
              )}
            >
              {formatPHP(outstandingBalance)}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <BalIcon className={cn("h-3.5 w-3.5 shrink-0", bv.iconCls)} />
              <span className={cn("text-xs font-bold", bv.text)}>
                {bv.label}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Current Usage
            </span>
            <span className="text-[11px] font-black text-foreground">
              {currentUsage}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
