// components/RTOKPICards.tsx
// ──────────────────────────────────────────────────────────────────────────────
// KPI summary cards for the BIA RTO Operation module.
// Shows aggregated dealer metrics: totals, risk counts, financial exposure.
// Style mirrors: CylinderAgingKPICards.tsx dark-card aesthetic.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  PackageX,
  ShieldAlert,
  Banknote,
  CircleDollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRTOOperation } from "../hooks/useRTOOperation";
import { formatCurrency } from "../utils/rto-operation.utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Individual card ───────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  accentColor: string;   // e.g. "text-amber-400"
  bgColor: string;       // e.g. "bg-[#232360]"
  isLoading?: boolean;
}

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    } as const,
  },
};

function KPICard({
  label,
  value,
  subLabel,
  icon: Icon,
  accentColor,
  bgColor,
  isLoading,
}: KPICardProps) {
  // Prevent value truncation by dynamically scaling text size for longer strings
  const isLongText = typeof value === "string" && value.length > 11;
  const valueFontSize = isLongText
    ? "text-lg sm:text-xl md:text-lg lg:text-xl xl:text-lg 2xl:text-xl font-black mt-1.5 leading-tight truncate"
    : "text-2xl sm:text-3xl font-black mt-1.5 leading-tight truncate";

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, scale: 1.015 }}
      className={`${bgColor} border-none text-white p-5 rounded-xl relative overflow-hidden shadow-lg min-h-[120px] flex flex-col justify-between cursor-default`}
    >
      <div>
        {/* Label row */}
        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </div>

        {/* Value */}
        {isLoading ? (
          <Skeleton className="h-8 w-24 mt-2 bg-white/10" />
        ) : (
          <div className={valueFontSize} title={String(value)}>
            {value}
          </div>
        )}
      </div>

      {/* Sub-label */}
      <div className="text-[10px] text-indigo-300/80 font-medium tracking-wide mt-1">
        {subLabel ?? "\u00A0"}
      </div>

      {/* Background watermark icon */}
      <Icon className="h-28 w-28 absolute right-[-15px] top-[-10px] opacity-5 text-white pointer-events-none scale-125" />
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export function RTOKPICards() {
  const { kpis, isLoading } = useRTOOperation();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5"
    >
      {/* Total Dealers */}
      <KPICard
        label="Total Dealers"
        value={isLoading ? "—" : kpis.totalDealers}
        subLabel="City Dealers registered"
        icon={Building2}
        accentColor="text-sky-400"
        bgColor="bg-[#1e2060]"
        isLoading={isLoading}
      />

      {/* Critical Risk */}
      <KPICard
        label="Critical"
        value={isLoading ? "—" : kpis.criticalDealers}
        subLabel="> 100 unreturned cylinders"
        icon={ShieldAlert}
        accentColor="text-red-400"
        bgColor="bg-[#3d1515]"
        isLoading={isLoading}
      />

      {/* Warning */}
      <KPICard
        label="Warning"
        value={isLoading ? "—" : kpis.warningDealers}
        subLabel="51–100 unreturned cylinders"
        icon={AlertTriangle}
        accentColor="text-amber-400"
        bgColor="bg-[#3d2b00]"
        isLoading={isLoading}
      />

      {/* Total Unreturned Cylinders */}
      <KPICard
        label="Unreturned Cylinders"
        value={isLoading ? "—" : kpis.totalMissingTanks.toLocaleString()}
        subLabel="Across all dealers"
        icon={PackageX}
        accentColor="text-orange-400"
        bgColor="bg-[#232360]"
        isLoading={isLoading}
      />

      {/* Financial Exposure */}
      <KPICard
        label="Fin. Exposure"
        value={isLoading ? "—" : formatCurrency(kpis.totalFinancialExposure)}
        subLabel="Unreturned cylinders × unit cost"
        icon={CircleDollarSign}
        accentColor="text-purple-400"
        bgColor="bg-[#2a1a50]"
        isLoading={isLoading}
      />

      {/* Unpaid Balance */}
      <KPICard
        label="Unpaid Balance"
        value={isLoading ? "—" : formatCurrency(kpis.totalUnpaidBalance)}
        subLabel="Outstanding receivables"
        icon={Banknote}
        accentColor="text-emerald-400"
        bgColor="bg-[#0f3025]"
        isLoading={isLoading}
      />
    </motion.div>
  );
}

