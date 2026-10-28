// components/CTRGradeBadge.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Visual indicator badge for Customer Cylinder Turnaround Ratio (CTR) grades.
// Styled for high contrast in both dark and light modes.
// ──────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, Gauge, Award, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CTRGrade } from "../types/customer-cylinder-turnaround.types";

interface CTRGradeBadgeProps {
  grade: CTRGrade;
  className?: string;
  showIcon?: boolean;
}

export function CTRGradeBadge({ grade, className, showIcon = true }: CTRGradeBadgeProps) {
  switch (grade) {
    case "CTR_4":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold gap-1.5 px-2.5 py-0.5 shadow-sm",
            className
          )}
        >
          {showIcon && <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-500/20" />}
          <span>CTR 4 (Fastest)</span>
        </Badge>
      );
    case "CTR_6":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold gap-1.5 px-2.5 py-0.5 shadow-sm",
            className
          )}
        >
          {showIcon && <Gauge className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          <span>CTR 6 (Standard)</span>
        </Badge>
      );
    case "CTR_8":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold gap-1.5 px-2.5 py-0.5 shadow-sm",
            className
          )}
        >
          {showIcon && <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
          <span>CTR 8 (Moderate)</span>
        </Badge>
      );
    case "SUB_STANDARD":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-medium gap-1.5 px-2 py-0.5",
            className
          )}
        >
          {showIcon && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
          <span>Sub-standard (&gt;8 mos)</span>
        </Badge>
      );
    case "BASE_ZERO":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30 font-medium gap-1.5 px-2 py-0.5",
            className
          )}
        >
          {showIcon && <HelpCircle className="h-3.5 w-3.5 text-slate-500" />}
          <span>Unrated (Base = 0)</span>
        </Badge>
      );
  }
}
