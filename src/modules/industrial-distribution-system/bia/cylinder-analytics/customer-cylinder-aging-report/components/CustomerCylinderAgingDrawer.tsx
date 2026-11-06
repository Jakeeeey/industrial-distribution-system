// components/CustomerCylinderAgingDrawer.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Slide-over Drawer for Customer Cylinder Aging Report.
// Displays customer contact and route address for logistics collection,
// asset specifications, and historical supporting records (dispatches, returns, reversals).
// Configured with fixed vertical flex constraints and overflow scrolling for long histories.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Phone,
  Mail,
  Store,
  History,
  AlertCircle,
  FileCheck2,
  Calendar,
} from "lucide-react";
import { AgingBucketBadge, CustomerAgingActionBadge } from "./AgingBucketBadge";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";

export function CustomerCylinderAgingDrawer() {
  const { selectedItem, setSelectedItem } = useCustomerCylinderAging();

  const isOpen = Boolean(selectedItem);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full max-h-screen overflow-hidden bg-background"
      >
        {selectedItem && (
          <>
            {/* ── Fixed Header ── */}
            <SheetHeader className="shrink-0 p-5 border-b bg-card/60 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  {selectedItem.serialNumber}
                </Badge>
                <AgingBucketBadge bucket={selectedItem.agingBucket} />
              </div>
              <SheetTitle className="text-base sm:text-lg font-bold">
                {selectedItem.productName}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Held by <span className="font-semibold text-foreground">{selectedItem.customerName}</span> ({selectedItem.customerCode})
              </SheetDescription>
            </SheetHeader>

            {/* ── Scrollable Body Area ── */}
            <ScrollArea className="flex-1 min-h-0 h-full w-full">
              <div className="p-5 space-y-5 text-xs pb-12">
                {/* ── Collection & Logistics Contact Card ── */}
                <div className="space-y-2.5 p-3.5 rounded-lg border bg-card/60 shadow-2xs">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Store className="h-3.5 w-3.5 text-primary" />
                    Customer & Collection Logistics Profile
                  </h4>
                  <div className="space-y-1.5 text-muted-foreground">
                    {selectedItem.storeName && (
                      <div className="flex items-start gap-2">
                        <Store className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
                        <span>Store / Site: <strong className="text-foreground">{selectedItem.storeName}</strong></span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
                      <span>Address: <strong className="text-foreground">{selectedItem.customerAddress}</strong></span>
                    </div>
                    {selectedItem.contactNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>Contact: <strong className="text-foreground">{selectedItem.contactNumber}</strong></span>
                      </div>
                    )}
                    {selectedItem.customerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>Email: <strong className="text-foreground">{selectedItem.customerEmail}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Dwell & Aging Breakdown ── */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Aging & Dwell Assessment
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-md border bg-muted/30">
                      <span className="text-muted-foreground block text-[11px]">Total Age</span>
                      <span className="text-base font-bold text-foreground">
                        {selectedItem.ageDays} Days
                      </span>
                    </div>
                    <div className="p-2.5 rounded-md border bg-muted/30">
                      <span className="text-muted-foreground block text-[11px]">Overdue Delta</span>
                      <span className={`text-base font-bold ${selectedItem.isOverdue ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {selectedItem.isOverdue ? `+${selectedItem.overdueDays} Days` : "Compliant"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-md border bg-muted/30">
                      <span className="text-muted-foreground block text-[11px]">Issue Date</span>
                      <span className="font-medium text-foreground">{selectedItem.issueDate}</span>
                    </div>
                    <div className="p-2.5 rounded-md border bg-muted/30">
                      <span className="text-muted-foreground block text-[11px]">Issue Document</span>
                      <span className="font-mono font-medium text-foreground truncate block">
                        {selectedItem.issueDocNo}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                    <span className="text-muted-foreground">Recommended Action</span>
                    <CustomerAgingActionBadge action={selectedItem.recommendedAction} />
                  </div>

                  {selectedItem.isEstimated && (
                    <div className="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Estimated FIFO Calculation:</strong> This cylinder&apos;s holding age is derived from aggregate quantity records or asset baseline timestamps because individual serial matching was not recorded during the initial issuance.
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Supporting Movement Audit Trail ── */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <History className="h-3.5 w-3.5 text-primary" />
                      Supporting Movement Trail
                    </h4>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {selectedItem.supportingDocuments.length} events recorded
                    </span>
                  </div>

                  {selectedItem.supportingDocuments.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs py-2">
                      No additional movement transactions logged in audit ledger.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedItem.supportingDocuments.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-md border bg-card/60 flex items-start justify-between gap-2 shadow-2xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <FileCheck2 className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-semibold text-foreground truncate">
                                {doc.docType}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                                {doc.docNo}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {doc.ts ? new Date(doc.ts).toLocaleString() : "Date unrecorded"}
                            </p>
                          </div>
                          <div className="text-right text-[11px] font-mono shrink-0">
                            {doc.outQty > 0 && (
                              <span className="text-rose-500 font-semibold block">
                                Out: {doc.outQty}
                              </span>
                            )}
                            {doc.inQty > 0 && (
                              <span className="text-emerald-500 font-semibold block">
                                In: {doc.inQty}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
