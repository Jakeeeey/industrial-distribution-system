// RULE DEV: WiWO Billing Summary Module
// Root layout for the WiWO billing summary page.
// Implements a left/right master-detail layout:
//   - Left panel: Filterable list of WiWO billing transactions (WiwoSummaryList)
//   - Right panel: Detailed audit view of a selected transaction (WiwoSummaryDetail)
// Mirrors the pattern from metered-billing-summary/MeteredBillingSummaryModule.tsx

"use client";

import { useState, useEffect } from "react";
import { Scale } from "lucide-react";
import { WiwoSummaryList } from "./components/WiwoSummaryList";
import { WiwoSummaryDetail } from "./components/WiwoSummaryDetail";
import { useSidebar } from "@/components/ui/sidebar";

export default function WiwoBillingSummaryModule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { setOpen, isMobile } = useSidebar();

  // Collapse sidebar on smaller screens for more real estate
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && !isMobile) {
        setOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setOpen, isMobile]);

  const handleSelect = (id: number | null) => {
    setSelectedId(id);
  };

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-950 shadow-lg animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="space-y-1 p-4 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-900/10 shrink-0">
        <div className="text-xl font-black flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
            <Scale className="h-5 w-5" />
          </div>
          WiWO Billing Summary
        </div>
        <div className="text-xs text-muted-foreground ml-[44px]">
          View all Weigh-In / Weigh-Out cylinder swap billing records, consumption details, and invoice linkage history.
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Sidebar List */}
        <div
          className={`${
            selectedId ? "hidden lg:flex" : "flex w-full"
          } lg:w-[380px] lg:shrink-0 h-full`}
        >
          <WiwoSummaryList selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Right: Detail Panel */}
        <div
          className={`flex-1 h-full overflow-y-auto p-4 sm:p-6 bg-zinc-50/10 dark:bg-zinc-900/5 ${
            selectedId ? "block" : "hidden lg:block"
          }`}
        >
          {!selectedId ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-12 text-center text-sm text-muted-foreground bg-zinc-50/20 dark:bg-zinc-900/5 flex flex-col items-center justify-center gap-3 h-[450px]">
              <Scale className="h-10 w-10 text-muted-foreground opacity-20" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  No Record Selected
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1 font-sans">
                  Select a WiWO billing transaction from the list on the left to view its cylinder weighing records, consumption details, and billing summary.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-white/10 p-4 sm:p-6 rounded-2xl">
              <WiwoSummaryDetail txId={selectedId} onClose={handleClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}