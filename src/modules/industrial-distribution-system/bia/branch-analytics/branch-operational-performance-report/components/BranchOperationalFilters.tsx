// components/BranchOperationalFilters.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar with SearchableSelect components, date pickers, and apply/clear controls.
// Reorganized into an ergonomic 2-row layout with generous column widths & truncation.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";
import { useBranchOperationalPerformanceFilterOptions } from "../hooks/useBranchOperationalPerformanceFilterOptions";
import type { IncidentType, RecoveryStatus, ChargeStatus } from "../types/branch-operational-performance.types";

const INCIDENT_TYPES: { value: IncidentType | "all"; label: string }[] = [
  { value: "all", label: "All Incident Types" },
  { value: "CYLINDER_LOST", label: "Lost Cylinder" },
  { value: "CYLINDER_DAMAGED", label: "Damaged / Scrap" },
  { value: "UNRETURNED_AGING", label: "Unreturned Aging" },
  { value: "DELIVERY_VARIANCE", label: "Delivery Variance" },
];

const RECOVERY_STATUSES: { value: RecoveryStatus | "all"; label: string }[] = [
  { value: "all", label: "All Recovery Statuses" },
  { value: "IN_CUSTODY", label: "In Custody" },
  { value: "PENDING_RECOVERY", label: "Pending Recovery" },
  { value: "RECOVERED", label: "Recovered" },
  { value: "WRITTEN_OFF", label: "Written Off" },
];

const CHARGE_STATUSES: { value: ChargeStatus | "all"; label: string }[] = [
  { value: "all", label: "All Charge Statuses" },
  { value: "UNCHARGED", label: "Uncharged" },
  { value: "ASSESSED", label: "Assessed" },
  { value: "CHARGED", label: "Charged" },
  { value: "WAIVED", label: "Waived" },
];

export function BranchOperationalFilters() {
  const {
    draftFilters,
    setDraftFilters,
    applyFilters,
    clearFilters,
    isLoading,
  } = useBranchOperationalPerformanceReport();

  const { branches, custodians, isLoading: isLookupsLoading } =
    useBranchOperationalPerformanceFilterOptions();

  const handleBranchChange = (value: string) => {
    setDraftFilters((prev) => ({
      ...prev,
      branchId: value === "all" ? "" : Number(value),
    }));
  };

  const handleCustodianChange = (value: string) => {
    setDraftFilters((prev) => ({
      ...prev,
      custodianCode: value === "all" ? "" : value,
    }));
  };

  const isInvalidDate =
    !draftFilters.startDate ||
    !draftFilters.endDate ||
    draftFilters.startDate > draftFilters.endDate;

  return (
    <Card className="border shadow-xs bg-card">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
            <Filter className="h-4 w-4 text-primary" />
            <span>Operational Filters</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Searchable branch, custodian, and cutoff parameters
          </div>
        </div>

        {/* Tier 1: Branch Scope & Custodian Selection (Wide columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Branch Scope</Label>
            <div className="min-w-0">
              <SearchableSelect
                options={branches}
                value={draftFilters.branchId ? String(draftFilters.branchId) : "all"}
                onValueChange={handleBranchChange}
                placeholder="Search branch..."
                disabled={isLookupsLoading || isLoading}
                className="w-full text-xs font-normal"
              />
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Custodian / Customer</Label>
            <div className="min-w-0">
              <SearchableSelect
                options={custodians}
                value={draftFilters.custodianCode || "all"}
                onValueChange={handleCustodianChange}
                placeholder="Search custodian or customer..."
                disabled={isLookupsLoading || isLoading}
                className="w-full text-xs font-normal"
              />
            </div>
          </div>
        </div>

        {/* Tier 2: Statuses & Date Pickers (4 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
          {/* Incident Type */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Incident Type</Label>
            <SearchableSelect
              options={INCIDENT_TYPES}
              value={draftFilters.incidentType || "all"}
              onValueChange={(val) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  incidentType: val as IncidentType | "all",
                }))
              }
              placeholder="Select type..."
              disabled={isLoading}
              className="w-full text-xs"
            />
          </div>

          {/* Recovery Status */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Recovery Status</Label>
            <SearchableSelect
              options={RECOVERY_STATUSES}
              value={draftFilters.recoveryStatus || "all"}
              onValueChange={(val) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  recoveryStatus: val as RecoveryStatus | "all",
                }))
              }
              placeholder="Select recovery..."
              disabled={isLoading}
              className="w-full text-xs"
            />
          </div>

          {/* Charge Status */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Charge Status</Label>
            <SearchableSelect
              options={CHARGE_STATUSES}
              value={draftFilters.chargeStatus || "all"}
              onValueChange={(val) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  chargeStatus: val as ChargeStatus | "all",
                }))
              }
              placeholder="Select charge..."
              disabled={isLoading}
              className="w-full text-xs"
            />
          </div>

          {/* Date Range Group (Reporting Start & Cutoff) */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">Reporting Window (Start — Cutoff)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="start-date"
                type="date"
                value={draftFilters.startDate}
                max={draftFilters.endDate}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="h-9 text-xs px-2"
                disabled={isLoading}
                title="Start Date"
              />
              <Input
                id="end-date"
                type="date"
                value={draftFilters.endDate}
                min={draftFilters.startDate}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="h-9 text-xs px-2"
                disabled={isLoading}
                title="Reporting Cutoff Date"
              />
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2 border-t">
          {isInvalidDate ? (
            <span className="text-xs text-destructive">
              * Start date must precede or equal end date.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Applied filters apply consistently across all operational metrics.
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void clearFilters()}
              disabled={isLoading}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void applyFilters()}
              disabled={isLoading || isInvalidDate}
              className="h-8 gap-1.5 text-xs"
            >
              <Search className="h-3.5 w-3.5" />
              Apply Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
