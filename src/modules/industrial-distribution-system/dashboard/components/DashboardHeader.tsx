// src/modules/industrial-distribution-system/dashboard/components/DashboardHeader.tsx

"use client";

import React, { useState } from "react";
import { useDashboard } from "../providers/DashboardProvider";
import { PresetId } from "../types";
import { PRESETS } from "../utils/presets";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
  Download,
  Calendar,
  Layers,
  MapPin,
  Bell,
} from "lucide-react";

interface DashboardHeaderProps {
  activePreset: PresetId;
  onChangePreset: (id: PresetId) => void;
  onToggleCustomize: () => void;
  onToggleNotifications: () => void;
  onResetLayout: () => void;
  onExportDashboard: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activePreset,
  onChangePreset,
  onToggleCustomize,
  onToggleNotifications,
  onResetLayout,
  onExportDashboard,
}) => {
  const { filters, setBranchId, setDateRange, branches, loading, refreshAll, rtoData } = useDashboard();
  const [refreshSpin, setRefreshSpin] = useState(false);

  const alertCount = React.useMemo(() => {
    let count = 3; // 3 default stock/ops/sys alerts
    const branchIdStr = String(filters.branchId);
    const filteredRto = branchIdStr === "all"
      ? rtoData
      : rtoData.filter((r) => String(r.branchId) === branchIdStr);

    filteredRto.forEach((r) => {
      if (r.missingStatus === "critical" && r.financialExposure > 500000) count++;
      if (r.unpaidBalance > 200000) count++;
    });
    return count;
  }, [rtoData, filters.branchId]);

  const handleRefresh = async () => {

    setRefreshSpin(true);
    await refreshAll();
    setTimeout(() => setRefreshSpin(false), 800);
  };

  const handleDateRangeChange = (value: string) => {
    const today = new Date();
    let fromDate: Date | null = null;
    
    switch (value) {
      case "7d":
        fromDate = new Date(today.setDate(today.getDate() - 7));
        break;
      case "30d":
        fromDate = new Date(today.setDate(today.getDate() - 30));
        break;
      case "90d":
        fromDate = new Date(today.setDate(today.getDate() - 90));
        break;
      case "ytd":
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      case "all":
      default:
        fromDate = null;
    }

    setDateRange({
      from: fromDate ? fromDate.toISOString().split("T")[0] : null,
      to: fromDate ? new Date().toISOString().split("T")[0] : null,
    });
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-card/65 backdrop-blur-md px-4 py-3 shadow-xs">
      {/* Row 1: Title + Action Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-5 w-5 text-primary shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h1 className="text-base font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100 leading-none truncate">
              IDS Command Dashboard
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mt-0.5 hidden sm:block">
              Customizable Operational Workspace
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshSpin || loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Customize sidebar button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted"
            onClick={onToggleCustomize}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden xs:inline">Customize</span>
          </Button>

          {/* Notifications sidebar button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted relative"
            onClick={onToggleNotifications}
          >
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden xs:inline">Alerts</span>
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-background animate-pulse">
                {alertCount}
              </span>
            )}
          </Button>

          {/* Reset layout button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted"
            onClick={onResetLayout}
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden lg:inline">Reset Layout</span>
          </Button>

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted"
            onClick={onExportDashboard}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden lg:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Row 2: Filters — scrollable on very small screens */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
        {/* Branch Filter */}
        <div className="flex items-center gap-1 bg-muted/40 hover:bg-muted/65 transition-colors px-2 py-1 rounded-lg border border-border/50 shrink-0">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <Select value={filters.branchId} onValueChange={setBranchId}>
            <SelectTrigger className="border-0 bg-transparent h-7 w-[130px] text-xs font-semibold focus:ring-0 focus:ring-offset-0 p-0.5">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  {b.name || b.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1 bg-muted/40 hover:bg-muted/65 transition-colors px-2 py-1 rounded-lg border border-border/50 shrink-0">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <Select defaultValue="all" onValueChange={handleDateRangeChange}>
            <SelectTrigger className="border-0 bg-transparent h-7 w-[110px] text-xs font-semibold focus:ring-0 focus:ring-offset-0 p-0.5">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Time</SelectItem>
              <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
              <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
              <SelectItem value="90d" className="text-xs">Last 90 Days</SelectItem>
              <SelectItem value="ytd" className="text-xs">Year to Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Presets Selector */}
        <div className="flex items-center gap-1 bg-muted/40 hover:bg-muted/65 transition-colors px-2 py-1 rounded-lg border border-border/50 shrink-0">
          <Layers className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <Select value={activePreset} onValueChange={(v) => onChangePreset(v as PresetId)}>
            <SelectTrigger className="border-0 bg-transparent h-7 w-[150px] text-xs font-semibold focus:ring-0 focus:ring-offset-0 p-0.5">
              <SelectValue placeholder="Choose Preset" />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

};
