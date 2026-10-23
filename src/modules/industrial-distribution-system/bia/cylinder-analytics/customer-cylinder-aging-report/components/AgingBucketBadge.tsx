// components/AgingBucketBadge.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Vibrant, semantic pill badge for Aging Buckets and Action items.
// Fully adaptive to both Light and Dark theme modes.
// ──────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgingBucketType, CustomerAgingAction } from "../types/customer-cylinder-aging.types";

interface AgingBucketBadgeProps {
  bucket: AgingBucketType;
  className?: string;
}

export function AgingBucketBadge({ bucket, className }: AgingBucketBadgeProps) {
  switch (bucket) {
    case "0_15_DAYS":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium px-2 py-0.5 text-xs",
            className
          )}
        >
          0 – 15 Days
        </Badge>
      );
    case "16_30_DAYS":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 font-medium px-2 py-0.5 text-xs",
            className
          )}
        >
          16 – 30 Days
        </Badge>
      );
    case "31_60_DAYS":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium px-2 py-0.5 text-xs",
            className
          )}
        >
          31 – 60 Days
        </Badge>
      );
    case "61_90_DAYS":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-medium px-2 py-0.5 text-xs",
            className
          )}
        >
          61 – 90 Days
        </Badge>
      );
    case "90_PLUS_DAYS":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-medium px-2 py-0.5 text-xs animate-pulse",
            className
          )}
        >
          90+ Days (Overdue)
        </Badge>
      );
  }
}

interface CustomerAgingActionBadgeProps {
  action: CustomerAgingAction;
  className?: string;
}

export function CustomerAgingActionBadge({ action, className }: CustomerAgingActionBadgeProps) {
  switch (action) {
    case "NO_ACTION_REQUIRED":
      return (
        <Badge
          variant="secondary"
          className={cn("bg-muted text-muted-foreground border-transparent text-xs", className)}
        >
          Normal (Compliant)
        </Badge>
      );
    case "MONITOR_CUSTOMER":
      return (
        <Badge
          variant="outline"
          className={cn("bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-xs", className)}
        >
          Monitor Usage
        </Badge>
      );
    case "FOLLOW_UP_CUSTOMER":
      return (
        <Badge
          variant="outline"
          className={cn("bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold text-xs", className)}
        >
          Follow Up
        </Badge>
      );
    case "PRIORITIZE_COLLECTION":
      return (
        <Badge
          variant="outline"
          className={cn("bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-semibold text-xs", className)}
        >
          Prioritize Collection
        </Badge>
      );
    case "FOR_PULL_OUT_REVIEW":
    default:
      return (
        <Badge
          variant="destructive"
          className={cn("bg-rose-600 text-white dark:bg-rose-700 font-bold text-xs shadow-xs", className)}
        >
          For Pull-Out Review
        </Badge>
      );
  }
}
