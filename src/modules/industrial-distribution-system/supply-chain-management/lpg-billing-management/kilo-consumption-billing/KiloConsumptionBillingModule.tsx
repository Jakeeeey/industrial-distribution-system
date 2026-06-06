"use client";

import { useState, useEffect } from "react";
import { Flame, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KiloConsumptionList } from "./components/KiloConsumptionList";
import { KiloConsumptionBillingForm } from "./components/KiloConsumptionBillingForm";
import { KiloConsumptionDetail } from "./components/KiloConsumptionDetail";
import { mapWiwoHeader } from "./hooks/useKiloConsumption";
import type { WiwoHeader } from "./types";

export default function KiloConsumptionBillingModule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedWiwo, setSelectedWiwo] = useState<WiwoHeader | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setLoadingDetail(true);
    }, 0);

    window
      .fetch(`/api/ids/scm/lpg-billing-management/kilo-consumption-billing/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setSelectedWiwo(mapWiwoHeader(d.data));
      })
      .catch((err) => {
        console.error("Failed to load WIWO detail", err);
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedId]);

  const handleSuccess = () => {
    setSelectedId(null);
    setSelectedWiwo(null);
    setListKey((k) => k + 1); // force list refresh
  };

  const handleCancel = () => {
    setSelectedId(null);
    setSelectedWiwo(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-950 shadow-lg">
      {/* Page Header */}
      <div className="space-y-1 p-4 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-900/10 shrink-0">
        <div className="text-xl font-black flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
            <Flame className="h-5 w-5 animate-pulse" />
          </div>
          Kilo Consumption Billing
        </div>
        <div className="text-xs text-muted-foreground ml-[44px]">
          Bill LPG consumption based on WIWO cylinder returns.
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Sidebar List */}
        <KiloConsumptionList
          selectedId={selectedId}
          onSelect={setSelectedId}
          key={listKey}
        />

        {/* Right Side: Detail / Form Panel */}
        <div className="flex-1 h-full overflow-y-auto p-6 bg-zinc-50/10 dark:bg-zinc-900/5">
          {loadingDetail ? (
            <div className="border border-zinc-150 dark:border-zinc-800/60 rounded-2xl p-12 text-center text-sm text-muted-foreground bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-3 h-[450px]">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p>Loading transaction details...</p>
            </div>
          ) : !selectedId || !selectedWiwo ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-12 text-center text-sm text-muted-foreground bg-zinc-50/20 dark:bg-zinc-900/5 flex flex-col items-center justify-center gap-3 h-[450px]">
              <Flame className="h-10 w-10 text-muted-foreground opacity-20 animate-pulse" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Transaction Selected</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Select a WIWO transaction from the sidebar list on the left to generate its invoice or view billed details.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* If pending, show generating invoice form */}
              {selectedWiwo.status === "PENDING" ? (
                <KiloConsumptionBillingForm
                  wiwoId={selectedId}
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              ) : (
                /* Else show read-only details */
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div>
                      <h3 className="font-bold text-lg">
                        Transaction {selectedWiwo.transaction_no}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Customer: {selectedWiwo.customer?.customer_name ?? selectedWiwo.customer_code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Site: {selectedWiwo.site?.site_name ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] font-bold uppercase tracking-wider">
                        {selectedWiwo.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={handleCancel}>Close</Button>
                    </div>
                  </div>
                  
                  {/* Cylinder returns details */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Cylinder Returns (WIWO)
                    </p>
                    <KiloConsumptionDetail details={selectedWiwo.details ?? []} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
