"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { WiwoForm } from "./components/WiwoForm";

export default function WiwoBillingModule() {
  const [activeTab, setActiveTab] = useState<"ROUTINE" | "ONBOARDING">("ROUTINE");
  const [formKey, setFormKey] = useState(0);

  const handleSuccess = () => {
    setFormKey((k) => k + 1); // refresh form to reset inputs on success
  };

  const handleCancel = () => {
    setFormKey((k) => k + 1); // refresh form to reset inputs on cancel
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-955 shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="space-y-4 p-5 sm:p-6 border-b border-zinc-150 dark:border-zinc-800/60 bg-gradient-to-r from-zinc-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                WIWO LPG Billing & Validation
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Weigh-In / Weigh-Out validation logic with Meter-Sync dual check.
              </p>
            </div>
          </div>

          {/* Premium Tab Selector */}
          <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/50 p-1 border border-zinc-200/50 dark:border-zinc-850 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab("ROUTINE");
                setFormKey((k) => k + 1);
              }}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === "ROUTINE"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Regular Routine Check & Swap
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("ONBOARDING");
                setFormKey((k) => k + 1);
              }}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === "ONBOARDING"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Onboarding Baseline Setup
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/10 dark:bg-zinc-900/5 h-full">
        <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-6 rounded-3xl shadow-md w-full max-w-6xl mx-auto">
          <WiwoForm
            key={`${activeTab}-${formKey}`}
            txId={null}
            initialFlowType={activeTab}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
