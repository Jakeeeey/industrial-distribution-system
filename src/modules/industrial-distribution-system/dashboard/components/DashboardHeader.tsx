"use client";

import React, { useState, useRef, useMemo } from "react";
import { useDashboard } from "../providers/DashboardProvider";
import { PresetId, WidgetLayout, CriticalAlert } from "../types";
import { PRESETS } from "../utils/presets";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


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
  Layers,
  Bell,
  Upload,
} from "lucide-react";

interface DashboardHeaderProps {
  activePreset: PresetId;
  onChangePreset: (id: PresetId) => void;
  onToggleCustomize: () => void;
  onToggleNotifications: () => void;
  onResetLayout: () => void;
  onExportDashboard: () => void;
  onImportLayouts?: (layouts: WidgetLayout[] | Record<PresetId, WidgetLayout[]>) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activePreset,
  onChangePreset,
  onToggleCustomize,
  onToggleNotifications,
  onResetLayout,
  onExportDashboard,
  onImportLayouts,
}) => {
  const { filters, loading, refreshAll, rtoData, lowStock, activeDispatches } = useDashboard();
  const [refreshSpin, setRefreshSpin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Parse CSV with proper RFC 4180 quoted-field support
        // Splits a single CSV line respecting double-quoted fields (which may contain commas)
        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci];
            if (ch === '"') {
              if (inQuotes && line[ci + 1] === '"') {
                // Escaped quote inside quoted field
                current += '"';
                ci++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        };

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          toast.error("The imported file is empty or has no data rows.");
          return;
        }

        const headers = parseCsvLine(lines[0]);
        const presetIdIdx   = headers.indexOf("PresetID");
        const idIdx         = headers.indexOf("WidgetID");
        const statusIdx     = headers.indexOf("Status");
        const xIdx          = headers.indexOf("GridX");
        const yIdx          = headers.indexOf("GridY");
        const wIdx          = headers.indexOf("GridW");
        const hIdx          = headers.indexOf("GridH");
        const customSizeIdx = headers.indexOf("CustomSize");
        const collapsedIdx  = headers.indexOf("Collapsed");

        if (idIdx === -1 || statusIdx === -1 || wIdx === -1 || hIdx === -1) {
          toast.error(`Invalid CSV. Found headers: [${headers.join(", ")}]. Expected columns: WidgetID, Status, GridW, GridH.`);
          return;
        }

        const isMultiPreset = presetIdIdx !== -1;

        if (isMultiPreset) {
          // Parse as multi-preset layouts grouped by PresetID
          const presetGroups: Record<string, WidgetLayout[]> = {};
          
          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const presetId = values[presetIdIdx];
            const id       = values[idIdx];
            const status   = values[statusIdx];
            const xVal     = xIdx !== -1 ? parseInt(values[xIdx], 10) : 0;
            const yVal     = yIdx !== -1 ? parseInt(values[yIdx], 10) : 0;
            const w        = parseInt(values[wIdx], 10);
            const h        = parseInt(values[hIdx], 10);
            const isCustom = customSizeIdx !== -1 ? values[customSizeIdx].toLowerCase() === "yes" : true;
            const isCol    = collapsedIdx !== -1 ? values[collapsedIdx].toLowerCase() === "yes" : false;

            if (presetId && id && status && !isNaN(w) && !isNaN(h)) {
              if (!presetGroups[presetId]) {
                presetGroups[presetId] = [];
              }
              presetGroups[presetId].push({
                id: id as WidgetLayout["id"],
                w,
                h,
                visible: status.toLowerCase() === "visible",
                x: isNaN(xVal) ? 0 : xVal,
                y: isNaN(yVal) ? 0 : yVal,
                customSize: isCustom,
                collapsed: isCol,
              });
            }
          }

          const groupKeys = Object.keys(presetGroups);
          if (groupKeys.length === 0) {
            toast.error("No valid multi-preset widget rows found in the CSV.");
            return;
          }

          onImportLayouts?.(presetGroups as Record<PresetId, WidgetLayout[]>);
          toast.success(`Imported layout configuration for ${groupKeys.length} preset(s) successfully.`);
        } else {
          // Fallback: parse as single active preset layout
          const importedLayouts: WidgetLayout[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const id     = values[idIdx];
            const status = values[statusIdx];
            const xVal   = xIdx !== -1 ? parseInt(values[xIdx], 10) : 0;
            const yVal   = yIdx !== -1 ? parseInt(values[yIdx], 10) : 0;
            const w      = parseInt(values[wIdx], 10);
            const h      = parseInt(values[hIdx], 10);
            const isCustom = customSizeIdx !== -1 ? values[customSizeIdx].toLowerCase() === "yes" : true;
            const isCol    = collapsedIdx !== -1 ? values[collapsedIdx].toLowerCase() === "yes" : false;

            if (id && status && !isNaN(w) && !isNaN(h)) {
              importedLayouts.push({
                id: id as WidgetLayout["id"],
                w,
                h,
                visible: status.toLowerCase() === "visible",
                x: isNaN(xVal) ? 0 : xVal,
                y: isNaN(yVal) ? 0 : yVal,
                customSize: isCustom,
                collapsed: isCol,
              });
            }
          }

          if (importedLayouts.length === 0) {
            toast.error("No valid widget layouts found in the CSV.");
            return;
          }

          onImportLayouts?.(importedLayouts);
          toast.success(`Imported ${importedLayouts.length} widget layout(s) successfully.`);
        }
      } catch (err) {
        console.error("Failed to parse imported CSV:", err);
        toast.error("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported if needed
    e.target.value = "";
  };

  const alerts = useMemo((): CriticalAlert[] => {
    const list: CriticalAlert[] = [];
    const branchIdStr = String(filters.branchId);

    // ── 1. RTO high-risk customer alerts ────────────────────────────────────
    const filteredRto = branchIdStr === "all"
      ? rtoData
      : rtoData.filter((r) => String(r.branchId) === branchIdStr);

    filteredRto.forEach((r) => {
      if (r.missingStatus === "critical" && r.financialExposure > 500000) {
        list.push({
          id: `rto-exp-${r.customerCode}`,
          severity: "critical",
          message: `HIGH EXPOSURE: ${r.customerName} holds ${r.missingTanks} overdue cylinders. Net exposure: ₱${(r.financialExposure / 1000).toFixed(0)}K.`,
          timestamp: "Live",
          category: "rto",
        });
      }
      if (r.unpaidBalance > 200000) {
        list.push({
          id: `fin-bal-${r.customerCode}`,
          severity: "warning",
          message: `OVER CREDIT LIMIT: ${r.customerName} has ₱${(r.unpaidBalance / 1000).toFixed(0)}K unpaid balances. Delivery on hold.`,
          timestamp: "Live",
          category: "finance",
        });
      }
    });

    // ── 2. Low stock threshold alerts ───────────────────────────────────────
    lowStock
      .filter((item) => item.status === "Critical")
      .slice(0, 3)
      .forEach((item) => {
        list.push({
          id: `inv-low-${item.productCode}`,
          severity: "critical",
          message: `LOW STOCK ALERT: ${item.productName} has only ${item.stockOnHand} units remaining, well below the maintaining quantity of ${item.reorderPoint} units.`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    lowStock
      .filter((item) => item.status === "Warning")
      .slice(0, 2)
      .forEach((item) => {
        list.push({
          id: `inv-warn-${item.productCode}`,
          severity: "warning",
          message: `STOCK WARNING: ${item.productName} is below the maintaining quantity. Current stock: ${item.stockOnHand} units (Maintaining quantity: ${item.reorderPoint} units).`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    // ── 3. Late / pending dispatch alerts ───────────────────────────────────
    const filteredDispatches = branchIdStr === "all"
      ? activeDispatches
      : activeDispatches.filter((d) => d.route?.includes(branchIdStr));

    filteredDispatches
      .filter((d) => d.status === "Pending" || d.priority === "Critical")
      .slice(0, 2)
      .forEach((d) => {
        list.push({
          id: `dispatch-pending-${d.dispatchNo}`,
          severity: d.priority === "Critical" ? "critical" : "warning",
          message: `DISPATCH PENDING: Trip ${d.dispatchNo} (Driver: ${d.driverName}, ${d.vehiclePlate}) awaiting clearance.`,
          timestamp: d.time || "Live",
          category: "operations",
        });
      });

    // Sort: critical → warning → info
    const priority: Record<string, number> = { critical: 3, warning: 2, info: 1 };
    return list.sort((a, b) => priority[b.severity] - priority[a.severity]);
  }, [rtoData, lowStock, activeDispatches, filters.branchId]);

  const handleRefresh = async () => {

    setRefreshSpin(true);
    await refreshAll();
    setTimeout(() => setRefreshSpin(false), 800);
  };

  // const handleDateRangeChange = (value: string) => {
  //   const today = new Date();
  //   let fromDate: Date | null = null;

  //   switch (value) {
  //     case "7d":
  //       fromDate = new Date(today.setDate(today.getDate() - 7));
  //       break;
  //     case "30d":
  //       fromDate = new Date(today.setDate(today.getDate() - 30));
  //       break;
  //     case "90d":
  //       fromDate = new Date(today.setDate(today.getDate() - 90));
  //       break;
  //     case "ytd":
  //       fromDate = new Date(today.getFullYear(), 0, 1);
  //       break;
  //     case "all":
  //     default:
  //       fromDate = null;
  //   }

  //   setDateRange({
  //     from: fromDate ? fromDate.toISOString().split("T")[0] : null,
  //     to: fromDate ? new Date().toISOString().split("T")[0] : null,
  //   });
  // };

  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-card/65 backdrop-blur-md px-4 py-3 shadow-xs">
      {/* Row 1: Title + Action Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-5 w-5 text-primary shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h1 className="text-base font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100 leading-none truncate">
              IDS Command Dashboards
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
            <span className="hidden lg:inline">Export Layout</span>
          </Button>

          {/* Import button — file input lives outside Button to avoid nested interactive element */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden lg:inline">Import Layout</span>
          </Button>
          {/* Hidden file input – must be OUTSIDE <Button> to avoid nested interactive element violation */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            className="sr-only"
            onChange={handleFileChange}
          />
          {/* Notifications sidebar button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg border border-border/50 hover:bg-muted relative"
            onClick={onToggleNotifications}
          >
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden xs:inline">Alerts</span>
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-background animate-pulse">
                {alerts.length}
              </span>
            )}
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
        </div>
      </div>

      {/* Row 2: Filters — scrollable on very small screens */}
      <div className="flex items-center justify-end  gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
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
