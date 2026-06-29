// src/modules/industrial-distribution-system/dashboard/components/widgets/LowStockAlertWidget.tsx

"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowDown } from "lucide-react";

export const LowStockAlertWidget: React.FC = () => {
  const lowStockItems = useMemo(() => {
    return [
      {
        productCode: "LPG-IND-50",
        productName: "Industrial LPG Cylinder 50kg",
        category: "LPG",
        stockOnHand: 12,
        reorderPoint: 35,
        status: "Critical",
      },
      {
        productCode: "VAL-REG-A1",
        productName: "High-Pressure Gas Regulator",
        category: "Accessories",
        stockOnHand: 4,
        reorderPoint: 15,
        status: "Critical",
      },
      {
        productCode: "VLV-CO2-B2",
        productName: "Cylinder Replacement Valve Brass",
        category: "Spare Parts",
        stockOnHand: 7,
        reorderPoint: 20,
        status: "Warning",
      },
      {
        productCode: "LPG-COM-11",
        productName: "Commercial LPG Cylinder 11kg",
        category: "LPG",
        stockOnHand: 22,
        reorderPoint: 40,
        status: "Warning",
      },
    ];
  }, []);

  return (
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Inventory Threshold Warnings
      </span>

      <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar">
        {lowStockItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between border border-border/40 rounded-xl p-3 bg-muted/5 transition-all"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5
                ${item.status === "Critical" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}
              >
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-foreground block truncate">
                  {item.productName}
                </span>
                <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                  {item.productCode} • {item.category}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 pl-3">
              <div className="flex items-center gap-1.5 justify-end">
                <span className={`text-xs font-black font-mono flex items-center ${item.status === "Critical" ? "text-red-500" : "text-amber-500"}`}>
                  <ArrowDown className="h-3 w-3 mr-0.5 animate-bounce" />
                  {item.stockOnHand}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  / {item.reorderPoint} Limit
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-[8px] font-bold py-0 px-1.5 mt-1
                  ${item.status === "Critical" ? "border-red-500/25 bg-red-500/10 text-red-500" : "border-amber-500/25 bg-amber-500/10 text-amber-500"}`}
              >
                {item.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
