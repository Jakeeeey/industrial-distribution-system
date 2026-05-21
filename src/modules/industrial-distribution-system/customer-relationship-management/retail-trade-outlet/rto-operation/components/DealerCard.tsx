import React from "react";
import { Building2, UserPlus, User, AlertCircle } from "lucide-react";
import { CityDealer } from "../types";

import { Button } from "@/components/ui/button";

interface DealerCardProps {
  dealer: CityDealer;
}

export function DealerCard({ dealer }: DealerCardProps) {
  const MissingStatus = {
    NORMAL: "NORMAL",
    WARNING: "WARNING",
    CRITICAL: "CRITICAL",
  };

  const getStatus = (missing: number) => {
    if (missing > 100) return MissingStatus.CRITICAL;
    if (missing > 50) return MissingStatus.WARNING;
    return MissingStatus.NORMAL;
  };

  const missingStatus = getStatus(dealer.missingTanks);

  // Subtle background control for the missing tank monitor section
  const bgClass =
    missingStatus === MissingStatus.CRITICAL
      ? "bg-red-50"
      : missingStatus === MissingStatus.WARNING
      ? "bg-yellow-50"
      : "bg-emerald-50/10";

  const textClass =
    missingStatus === MissingStatus.CRITICAL
      ? "text-red-600"
      : missingStatus === MissingStatus.WARNING
      ? "text-yellow-600"
      : "text-slate-700";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-x md:divide-x-0 border rounded-md m-2 hover:bg-slate-50/50 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:scale-[1.002] active:scale-[0.998] cursor-default">
      {/* 1. Address Book Section */}
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
          <Building2 className="w-5 h-5 shrink-0" />
          <span>{dealer.name}</span>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Assigned RTO Personnel
          </h4>
          <div className="space-y-2">
            {dealer.assignedPersonnel.map((person) => (
              <div key={person.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-blue-500 font-medium">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{person.name}</span>
                </div>
                <span className="text-slate-400 text-xs">{person.barangay}</span>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            className="mt-1 text-blue-600 h-auto p-0 hover:bg-transparent hover:text-blue-700 text-xs font-semibold flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add RTO Agent
          </Button>
        </div>
      </div>

      {/* 2. Missing Tank Monitor Section */}
      <div className={`p-6 flex flex-col gap-5 ${bgClass} transition-colors`}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center text-slate-500">
            <span className="font-medium">Total Full Tanks Given Ever:</span>
            <span className="font-bold text-slate-800 text-base">
              {dealer.totalFullTanksGivenEver.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span className="font-medium">Total Empty Tanks Returned Ever:</span>
            <span className="font-bold text-slate-800 text-base">
              {dealer.totalEmptyTanksReturnedEver.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="relative mt-auto">
          <div className={`p-4 rounded-xl border ${
            missingStatus === MissingStatus.CRITICAL 
              ? "bg-red-100/50 border-red-200" 
              : "bg-white/60 border-slate-200"
          }`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${textClass}`}>
                MISSING TANKS:
              </span>
              <span className={`text-2xl font-black ${textClass}`}>
                {dealer.missingTanks.toLocaleString()}
              </span>
            </div>

            {missingStatus === MissingStatus.CRITICAL && (
              <div className="flex items-start gap-2 text-red-700 bg-white/80 p-2 rounded-lg border border-red-100 shadow-sm mt-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-[10px] leading-tight font-bold uppercase">
                  CRITICAL: MISSING &gt; 100.<br />
                  STOP DELIVERIES UNTIL EMPTIES RETURN.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Automatic Billing Section */}
      <div className="p-6 flex flex-col justify-between relative overflow-hidden">
        {/* Visual indicator bar if critical */}
        {missingStatus === MissingStatus.CRITICAL && (
          <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-red-600" />
        )}
        
        <div className="flex justify-between items-start gap-4">
          <div className="text-[11px] font-bold text-slate-800 uppercase leading-tight">
            UNPAID<br />BALANCE:
          </div>
          <div className="text-2xl font-black text-rose-600 tabular-nums">
            ₱{dealer.unpaidBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="mt-8 text-[11px] text-slate-400 font-medium max-w-50">
          Automatically billed upon delivery at<br />₱750/tank.
        </div>
      </div>
    </div>
  );
}