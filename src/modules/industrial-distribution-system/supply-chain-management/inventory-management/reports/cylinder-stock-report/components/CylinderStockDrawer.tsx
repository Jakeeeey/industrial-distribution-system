// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockDrawer.tsx
// ==============================================================================
// Cylinder Stock Drawer
// Spacious slide-over sheet displaying physical dossier and audit movements timeline (v_serial_movements).
// Organized into clean tabs with progressive movements pagination and no clipped borders.
// ==============================================================================

"use client";

import React, { useEffect, useState } from "react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  History,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  MapPin,
  FileText,
  ChevronDown,
} from "lucide-react";
import type { SerialMovementItem } from "../types/cylinder-stock-report.types";

const INITIAL_PAGE_SIZE = 50;

export function CylinderStockDrawer() {
  const { selectedRecord, isDrawerOpen, closeDrawer } = useCylinderStockReport();
  const [movements, setMovements] = useState<SerialMovementItem[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_PAGE_SIZE);

  useEffect(() => {
    if (!selectedRecord?.serialNumber || !isDrawerOpen) {
      setMovements([]);
      setDisplayLimit(INITIAL_PAGE_SIZE);
      return;
    }

    async function loadMovements() {
      setIsLoadingMovements(true);
      try {
        const res = await fetch(
          `/api/ids/scm/inventory-management/reports/cylinder-stock-report/movements?serialNumber=${encodeURIComponent(
            selectedRecord!.serialNumber
          )}`
        );
        if (res.ok) {
          const json = await res.json();
          setMovements(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load serial movements:", err);
      } finally {
        setIsLoadingMovements(false);
      }
    }

    loadMovements();
  }, [selectedRecord, isDrawerOpen]);

  if (!selectedRecord) return null;

  const displayedMovements = movements.slice(0, displayLimit);
  const hasMore = displayLimit < movements.length;

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      {/* AG-COMMENT: pb-16 gives safe spacing at the bottom of the drawer to prevent cards being cut off */}
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto p-6 pb-16 space-y-5">
        <SheetHeader className="pb-4 border-b pr-8">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-muted text-foreground font-semibold border">
              {selectedRecord.serialNumber}
            </span>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5">
              {selectedRecord.cylinderStatus}
            </Badge>
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5 font-mono uppercase">
              {selectedRecord.variantState}
            </Badge>
            <Badge
              className={`text-xs px-2.5 py-0.5 ${
                selectedRecord.cylinderCondition === "GOOD"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                  : selectedRecord.cylinderCondition === "FOR_REPAIR"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
              }`}
            >
              Condition: {selectedRecord.cylinderCondition}
            </Badge>
          </div>

          <SheetTitle className="text-lg font-bold text-left text-foreground">
            {selectedRecord.productName}
          </SheetTitle>
          <SheetDescription className="text-xs text-left text-muted-foreground">
            SKU: {selectedRecord.productCode} • Location: {selectedRecord.branchName}
          </SheetDescription>
        </SheetHeader>

        {/* Tabbed View for Spacious Layout */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/50 rounded-lg">
            <TabsTrigger value="overview" className="text-xs flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              Overview & Dossier
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Audit Movements ({movements.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Asset Identity Card */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
                  <Box className="w-4 h-4 text-primary" />
                  Asset Specifications
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Gas Product:</span>
                    <span className="font-semibold text-foreground text-right">{selectedRecord.productName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Product Code:</span>
                    <span className="font-mono text-foreground font-medium">{selectedRecord.productCode}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Variant State:</span>
                    <span className="font-mono font-semibold text-foreground">{selectedRecord.variantState}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Tare Weight:</span>
                    <span className="font-semibold text-foreground">
                      {selectedRecord.tareWeight ? `${selectedRecord.tareWeight} kg` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Acquisition Date:</span>
                    <span className="font-semibold text-foreground">
                      {selectedRecord.acquisitionDate || "Not recorded"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Hydrotest / Expiration:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      {selectedRecord.expirationDate || "N/A"}
                      {selectedRecord.isExpired && (
                        <span title="Expired" className="inline-flex">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operational Availability:</span>
                    <span className="font-semibold text-foreground">
                      {selectedRecord.isAvailableUsable ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Usable Available</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Unavailable for Issue</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody Card */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
                  <MapPin className="w-4 h-4 text-primary" />
                  Custody & Location
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Current Branch:</span>
                    <span className="font-semibold text-foreground">{selectedRecord.branchName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Branch Code:</span>
                    <span className="font-mono text-foreground font-medium">{selectedRecord.branchCode}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Custodian Type:</span>
                    <span className="font-semibold text-foreground">{selectedRecord.custodianType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Custodian:</span>
                    <span className="font-semibold text-foreground truncate max-w-[160px]">
                      {selectedRecord.custodianName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            {selectedRecord.remarks && (
              <div className="p-4 rounded-xl border bg-muted/10 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  Asset Remarks & Registration Notes
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                  {selectedRecord.remarks}
                </p>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: AUDIT MOVEMENTS */}
          <TabsContent value="movements" className="space-y-3 pt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
              <span>
                Chronological trace from database view{" "}
                <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
                  v_serial_movements
                </code>
              </span>
              <span>
                Showing {displayedMovements.length} of {movements.length} events
              </span>
            </div>

            {isLoadingMovements ? (
              <div className="space-y-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-xl border" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <div className="p-8 rounded-xl border text-center text-xs text-muted-foreground bg-muted/10">
                No verified movement events recorded in view table for this serial.
              </div>
            ) : (
              // AG-COMMENT: Removed restrictive max-h-[500px]; cards flow naturally with full borders
              <div className="space-y-2.5 pb-4">
                {displayedMovements.map((m, idx) => {
                  const isIn = m.in_qty > 0;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/10 transition-colors space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-md ${
                              isIn
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <span className="font-semibold text-xs text-foreground">
                            {m.doc_type}
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-foreground font-medium">
                            {m.doc_no}
                          </span>
                        </div>

                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {m.ts ? m.ts.replace("T", " ").substring(0, 19) : "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pl-8">
                        <span>
                          {m.branch_name ? `Branch: ${m.branch_name}` : ""}
                          {m.customer_name ? ` • Customer: ${m.customer_name}` : ""}
                          {m.supplier_name ? ` • Supplier: ${m.supplier_name}` : ""}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {isIn ? `+${m.in_qty} IN` : `-${m.out_qty} OUT`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {/* Progressive load more controls */}
                {hasMore && (
                  <div className="pt-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayLimit((prev) => prev + 50)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Load Next 50 Movements ({movements.length - displayLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
