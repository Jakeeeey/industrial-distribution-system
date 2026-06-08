"use client";

import { useState } from "react";
import { Scale, ArrowLeft } from "lucide-react";
import { WiwoList } from "./components/WiwoList";
import { WiwoForm } from "./components/WiwoForm";
import { Button } from "@/components/ui/button";

export default function WiwoBillingModule() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);
  const [listKey, setListKey] = useState(0);

  const handleNew = () => {
    setSelectedId(null);
    setIsNewMode(true);
  };

  const handleSelect = (id: number | null) => {
    setSelectedId(id);
    setIsNewMode(false);
  };

  const handleSuccess = () => {
    setSelectedId(null);
    setIsNewMode(false);
    setListKey((k) => k + 1); // refresh list
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsNewMode(false);
  };

  // On mobile: show form panel when a transaction is selected or new mode is active
  const showFormOnMobile = isNewMode || selectedId !== null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-950 shadow-lg m-1 sm:m-4">
      {/* Page Header */}
      <div className="space-y-1 p-3 sm:p-5 border-b border-zinc-150 dark:border-zinc-800/60 bg-gradient-to-r from-zinc-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950 shrink-0">
        <div className="text-base sm:text-xl font-black flex items-center gap-3">
          {/* Mobile back button when form is active */}
          {showFormOnMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 shrink-0 -ml-1"
              onClick={handleCancel}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <span className="truncate">
            {showFormOnMobile
              ? selectedId
                ? "Transaction Detail"
                : "New Transaction"
              : "WIWO LPG Billing & Validation"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground ml-[44px] hidden sm:block">
          Weigh-In / Weigh-Out validation logic with Meter-Sync dual check.
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Sidebar List — hidden on mobile when form is shown */}
        <div className={`${showFormOnMobile ? "hidden lg:flex" : "flex"} w-full lg:w-auto`}>
          <WiwoList
            selectedId={selectedId}
            onSelect={handleSelect}
            onNew={handleNew}
            key={listKey}
          />
        </div>

        {/* Right Side: Detail Form Panel — full-screen on mobile, panel on desktop */}
        <div
          className={`${
            showFormOnMobile ? "flex" : "hidden lg:flex"
          } flex-1 h-full overflow-y-auto p-3 sm:p-6 bg-zinc-50/10 dark:bg-zinc-900/5`}
        >
          {!isNewMode && !selectedId ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-8 sm:p-12 text-center text-sm text-muted-foreground bg-zinc-50/20 dark:bg-zinc-900/5 flex flex-col items-center justify-center gap-3 w-full">
              <Scale className="h-10 w-10 text-muted-foreground opacity-20 animate-pulse" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Transaction Selected</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Select a transaction from the list to view details/perform rollbacks, or tap <strong>New Transaction</strong> to record a baseline or routine check.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-6 rounded-2xl shadow-sm w-full">
              <WiwoForm
                txId={selectedId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
