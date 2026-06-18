"use client";

import { useState, useEffect } from "react";
import { Gauge } from "lucide-react";
import { SummaryList } from "./components/SummaryList";
import { SummaryDetail } from "./components/SummaryDetail";
import { useSidebar } from "@/components/ui/sidebar";

export default function MeteredBillingSummaryModule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { setOpen, isMobile } = useSidebar();

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
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
            <Gauge className="h-5 w-5" />
          </div>
          Metered Billing Summary
        </div>
        <div className="text-xs text-muted-foreground ml-[44px]">
          Trace all regular billing transactions, initial baselines, and invoice linkage history.
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Sidebar List */}
        <div
          className={`${
            selectedId ? "hidden lg:flex" : "flex w-full"
          } lg:w-[380px] lg:shrink-0 h-full`}
        >
          <SummaryList selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Right Side: Detail Form Panel */}
        <div
          className={`flex-1 h-full overflow-y-auto px-4 sm:px-6 bg-zinc-50/10 dark:bg-zinc-900/5 ${
            selectedId ? "block" : "hidden lg:block"
          }`}
        >
          {!selectedId ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-12 text-center text-sm text-muted-foreground bg-zinc-50/20 dark:bg-zinc-900/5 flex flex-col items-center justify-center gap-3 h-[450px]">
              <Gauge className="h-10 w-10 text-muted-foreground opacity-20" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 font-sans">No Record Selected</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1 font-sans">
                  Select a metered billing transaction from the sidebar list on the left to view its detailed audit trail, computations, and calibration details.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-white/10 p-4 sm:p-6 rounded-2xl">
              <SummaryDetail txId={selectedId} onClose={handleClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
