"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { MeteredWiwoList } from "./components/MeteredWiwoList";
import { MeteredWiwoBillingForm } from "./components/MeteredWiwoBillingForm";

export default function MeteredWiwoBillingModule() {
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
    setListKey((k) => k + 1); // force list refresh
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsNewMode(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-950 shadow-lg">
      {/* Page Header */}
      <div className="space-y-1 p-4 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-900/10 shrink-0">
        <div className="text-xl font-black flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
            <Gauge className="h-5 w-5" />
          </div>
          Metered Billing Management
        </div>
        <div className="text-xs text-muted-foreground ml-[44px]">
          Bill commercial LPG customers using trusted meter readings.
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Sidebar List */}
        <MeteredWiwoList
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
          key={listKey}
        />

        {/* Right Side: Detail Form Panel */}
        <div className="flex-1 h-full overflow-y-auto p-6 bg-zinc-50/10 dark:bg-zinc-900/5">
          {!isNewMode && !selectedId ? (
            <div className="border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-12 text-center text-sm text-muted-foreground bg-zinc-50/20 dark:bg-zinc-900/5 flex flex-col items-center justify-center gap-3 h-[450px]">
              <Gauge className="h-10 w-10 text-muted-foreground opacity-20 animate-pulse" />
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Transaction Selected</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Select a metered billing transaction from the sidebar list on the left to view/edit it, or click the **New** button to record a new transaction.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-white/10 p-6 rounded-2xl">
              <MeteredWiwoBillingForm
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
