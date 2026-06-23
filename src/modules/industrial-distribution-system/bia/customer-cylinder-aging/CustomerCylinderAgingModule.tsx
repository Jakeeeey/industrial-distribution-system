// CustomerCylinderAgingModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main entry point for the Customer Cylinder Aging BIA module.
// Thin orchestrator — mounts the Provider and composes the UI sections.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Timer } from "lucide-react";
import { CustomerCylinderAgingProvider } from "./providers/CustomerCylinderAgingProvider";
import { CylinderAgingKPICards } from "./components/CylinderAgingKPICards";
import { CylinderAgingFilterBar } from "./components/CylinderAgingFilterBar";
import { CylinderAgingTable } from "./components/CylinderAgingTable";

export default function CustomerCylinderAgingModule() {
  return (
    <CustomerCylinderAgingProvider>
      <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-500">
        {/* ── Module Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">
              Customer Cylinder Aging
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
              Business Intelligence & Analytics · Cylinder Asset Management
            </p>
          </div>
        </div>

        {/* ── KPI Summary Cards ─────────────────────────────────────────── */}
        <CylinderAgingKPICards />

        {/* ── Filter Bar ───────────────────────────────────────────────── */}
        <CylinderAgingFilterBar />

        {/* ── Masterlist Table ─────────────────────────────────────────── */}
        <CylinderAgingTable />
      </div>
    </CustomerCylinderAgingProvider>
  );
}
