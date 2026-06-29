// components/RTODealerDetailView.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Modal detail view for a selected City Dealer.
// Opens as a Dialog when user clicks a row in RTODealerTable.
// Shows: dealer header, KPI mini-cards, assigned agent list, accountability metrics.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Users,
  PackageX,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRTOOperation } from "../hooks/useRTOOperation";
import {
  formatCurrency,
  resolveMissingStatusBadgeClass,
  formatMissingStatus,
} from "../utils/rto-operation.utils";
import type { MissingStatus } from "../types";

// ── Status icon ───────────────────────────────────────────────────────────────

function MissingStatusIcon({ status }: { status: MissingStatus }) {
  switch (status) {
    case "critical":
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "normal":
    default:
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
}

// ── Cylinder Serials Section Component ────────────────────────────────────────

interface CylinderSerialsSectionProps {
  title: string;
  serials: string[];
  type: "in" | "out";
  customerName: string;
}

function CylinderSerialsSection({
  title,
  serials,
  type,
  customerName,
}: CylinderSerialsSectionProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const limit = 15;
  const hasMore = serials.length > limit;
  const visibleSerials = hasMore ? serials.slice(0, limit - 1) : serials;

  const filteredSerials = React.useMemo(() => {
    if (!search.trim()) return serials;
    const s = search.trim().toLowerCase();
    return serials.filter((x) => x.toLowerCase().includes(s));
  }, [serials, search]);

  const badgeStyles =
    type === "out"
      ? "bg-orange-50/50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-100 dark:border-orange-900/30 hover:bg-orange-100/50 cursor-default"
      : "bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100/50 cursor-default";

  const triggerColor =
    type === "out"
      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 cursor-pointer font-bold hover:bg-orange-200"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 cursor-pointer font-bold hover:bg-emerald-200";

  const headerIconColor =
    type === "out" ? "text-orange-500" : "text-emerald-500";

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <ClipboardList className={`h-3.5 w-3.5 ${headerIconColor}`} />
        {title} ({serials.length})
      </h3>
      {serials.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No cylinders recorded.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 p-2 border border-border/40 rounded-lg">
          {visibleSerials.map((serial) => (
            <Badge
              key={serial}
              variant="secondary"
              className={`text-[10px] font-mono py-1 px-2.5 ${badgeStyles}`}
            >
              {serial}
            </Badge>
          ))}
          {hasMore && (
            <Badge
              variant="secondary"
              className={`text-[10px] font-mono py-1 px-2.5 border ${triggerColor}`}
              onClick={() => setIsOpen(true)}
            >
              + View More ({serials.length - (limit - 1)})
            </Badge>
          )}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-5 bg-background">
          <DialogTitle className="text-sm font-black uppercase tracking-wider text-foreground">
            {title} — {customerName}
          </DialogTitle>

          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search serial number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs rounded-lg bg-background w-full"
            />
          </div>

          <ScrollArea className="flex-1 mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {filteredSerials.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                No serial numbers match your search.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-1">
                {filteredSerials.map((serial) => (
                  <Badge
                    key={serial}
                    variant="secondary"
                    className={`text-[10px] font-mono py-1 px-2.5 ${badgeStyles}`}
                  >
                    {serial}
                  </Badge>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-3 border-t border-border/40 mt-3 font-semibold">
            <span>Total: {serials.length} serials</span>
            {search && <span>Filtered: {filteredSerials.length}</span>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



// ── Main component ────────────────────────────────────────────────────────────

export function RTODealerDetailView() {
  const { selectedDealer } = useRTOOperation();

  if (!selectedDealer) return null;

  const d = selectedDealer;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-border/50 shrink-0">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar icon */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${d.missingStatus === "critical"
              ? "bg-red-100 text-red-600"
              : d.missingStatus === "warning"
                ? "bg-amber-100 text-amber-600"
                : "bg-emerald-100 text-emerald-600"
              }`}
          >
            <Building2 className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight truncate">
              {d.customerName || d.customerCode}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {/* Customer code */}
              <span className="text-[10px] font-mono text-muted-foreground">
                {d.customerCode}  -  
              </span>
              {d.storeName && (
                <span className="text-[10px] text-muted-foreground">{d.storeName}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {/* Risk badge */}
              <Badge
                variant="outline"
                className={`text-[9px] py-0 px-1.5 font-semibold gap-1 ${resolveMissingStatusBadgeClass(d.missingStatus)}`}
              >
                <MissingStatusIcon status={d.missingStatus} />
                {formatMissingStatus(d.missingStatus)} Risk
              </Badge>
              {/* Classification badge */}
              {d.classification && (
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1.5 font-bold bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900"
                >
                  {d.classification}
                </Badge>
              )}

              {/* Branch */}
              {d.branchName && (
                <span className="text-[10px] text-muted-foreground">
                  · {d.branchName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-6">
          {/* ── Contact info ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {d.contactNumber && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.contactNumber}</span>
              </div>
            )}
            {d.customerEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.customerEmail}</span>
              </div>
            )}
            {d.customerAddress && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.customerAddress}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Accountability & Missing Tank Monitor ───────────────────────── */}
          <div>
            {(() => {
              const isMissingCritical = d.missingTanks > 100;
              const isBalanceCritical = d.unpaidBalance >= 100000;
              const isOverallCritical = isMissingCritical || isBalanceCritical;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* COLUMN 1: MISSING TANK MONITOR */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                      <ShieldAlert className="h-4 w-4 text-sky-600 shrink-0" />
                      Missing Tank Monitor
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-semibold">Total Full Tanks Given Ever:</span>
                        <span className="font-extrabold text-foreground text-sm">{d.fullsDelivered.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-semibold">Total Empty Tanks Returned Ever:</span>
                        <span className="font-extrabold text-foreground text-sm">{d.emptiesReturned.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className={`rounded-xl p-4 border space-y-3 ${isOverallCritical
                      ? "bg-red-50/50 dark:bg-red-950/15 border-red-100 dark:border-red-900/30"
                      : d.missingStatus === "warning"
                        ? "bg-amber-50/50 dark:bg-amber-950/15 border-amber-100 dark:border-amber-900/30"
                        : "bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30"
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] font-black uppercase tracking-wider ${isOverallCritical
                          ? "text-red-800 dark:text-red-400"
                          : d.missingStatus === "warning"
                            ? "text-amber-800 dark:text-amber-400"
                            : "text-emerald-800 dark:text-emerald-400"
                          }`}>
                          Missing Tanks:
                        </span>
                        <span className={`text-3xl font-black ${isOverallCritical
                          ? "text-red-600 dark:text-red-400"
                          : d.missingStatus === "warning"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                          {d.missingTanks.toLocaleString()}
                        </span>
                      </div>

                      {/* Banner / Alert inside */}
                      <div className={`flex items-start gap-2.5 rounded-lg border bg-background dark:bg-muted/40 p-3 shadow-sm ${isOverallCritical
                        ? "border-red-100 dark:bg-red-950/10 dark:border-red-900/40"
                        : d.missingStatus === "warning"
                          ? "border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/40"
                          : "border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/40"
                        }`}>
                        {isOverallCritical ? (
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        ) : d.missingStatus === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        <span className={`text-[10px] font-extrabold uppercase tracking-tight leading-normal ${isOverallCritical
                          ? "text-red-600 dark:text-red-400"
                          : d.missingStatus === "warning"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                          {isOverallCritical ? (
                            isMissingCritical && isBalanceCritical ? (
                              "CRITICAL: STOP DELIVERIES. MISSING > 100 AND UNPAID BALANCE CRITICAL"
                            ) : isMissingCritical ? (
                              "CRITICAL: MISSING > 100. STOP DELIVERIES UNTIL EMPTIES RETURN"
                            ) : (
                              `CRITICAL: UNPAID BALANCE CRITICAL (>= ₱100,000). STOP DELIVERIES`
                            )
                          ) : d.missingStatus === "warning" ? (
                            d.missingTanks > 50 && d.unpaidBalance > 0 ? (  
                              "WARNING: MISSING TANKS BETWEEN 51-100 AND OUTSTANDING UNPAID BALANCE DETECTED"
                            ) : d.missingTanks > 50 ? (
                              "WARNING: MISSING TANKS BETWEEN 51-100"
                            ) : (
                              "WARNING: OUTSTANDING UNPAID BALANCE DETECTED"
                            )
                          ) : (
                            "STATUS NORMAL: CYLINDER ACCOUNTABILITY & BALANCE IN GOOD STANDING"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* COLUMN 2: FINANCIAL & DEPLOYMENT METRICS */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                      <CircleDollarSign className="h-4 w-4 text-purple-600 shrink-0" />
                      Account Details & Financial Exposure
                    </div>
                    <div className="grid grid-cols-1 gap-3 flex-1 justify-center py-2">
                      <div className="flex justify-between items-center rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
                        <div className="flex items-center gap-2 text-sky-600 font-semibold uppercase tracking-wider text-[10px]">
                          <PackageX className="h-4 w-4 shrink-0" />
                          Cyls. with Dealer
                        </div>
                        <span className="font-extrabold text-foreground text-sm">{d.activeCylindersWithDealer.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
                        <div className="flex items-center gap-2 text-purple-600 font-semibold uppercase tracking-wider text-[10px]">
                          <CircleDollarSign className="h-4 w-4 shrink-0" />
                          Financial Exposure
                        </div>
                        <span className="font-extrabold text-foreground text-sm">{formatCurrency(d.financialExposure)}</span>
                      </div>

                      <div className="flex justify-between items-center rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
                        <div className={`flex items-center gap-2 font-semibold uppercase tracking-wider text-[10px] ${isBalanceCritical ? "text-red-600" : "text-emerald-600"
                          }`}>
                          <Banknote className="h-4 w-4 shrink-0" />
                          Unpaid Balance
                        </div>
                        <span className={`font-extrabold text-sm ${isBalanceCritical ? "text-red-600" : "text-foreground"
                          }`}>
                          {formatCurrency(d.unpaidBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <Separator />

          {/* ── Assigned agent network ────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Assigned Network ({d.assignedAgents.length} agent
              {d.assignedAgents.length !== 1 ? "s" : ""})
            </h3>

            {d.assignedAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No agents assigned to this dealer.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {d.assignedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/10 p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {agent.name}
                      </div>
                      {agent.code && (
                        <div className="text-[9px] font-mono text-muted-foreground">
                          {agent.code}
                        </div>
                      )}
                      {agent.barangay && (
                        <div className="text-[9px] text-muted-foreground truncate">
                          {agent.barangay}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Cylinder Serial Numbers ──────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CylinderSerialsSection
              title="Delivered Cylinder Serials (OUT)"
              serials={d.outCylinderSerials || []}
              type="out"
              customerName={d.customerName || d.customerCode}
            />
            <CylinderSerialsSection
              title="Returned Cylinder Serials (IN)"
              serials={d.inCylinderSerials || []}
              type="in"
              customerName={d.customerName || d.customerCode}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
