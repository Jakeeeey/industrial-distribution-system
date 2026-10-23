// components/CirculationStatusBadge.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Semantic, theme-adaptive badge component for Circulation Break status.
// Displays intuitive colors and iconography in both light and dark modes.
// ──────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, MapPin, AlertCircle } from "lucide-react";
import type { CirculationBreakType } from "../types/cylinder-circulation.types";

interface CirculationStatusBadgeProps {
  status: CirculationBreakType;
  className?: string;
}

export function CirculationStatusBadge({ status, className }: CirculationStatusBadgeProps) {
  switch (status) {
    case "HEALTHY":
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Healthy Circulation</span>
        </Badge>
      );
    case "BREAK_MISSING_RETURN":
      return (
        <Badge
          variant="outline"
          className={`bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Missing Return Scan</span>
        </Badge>
      );
    case "BREAK_UNVERIFIED_TRANSIT":
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Stalled in Transit</span>
        </Badge>
      );
    case "BREAK_LOCATION_CONFLICT":
      return (
        <Badge
          variant="outline"
          className={`bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>Location Conflict</span>
        </Badge>
      );
    case "BREAK_ORPHAN_RETURN":
      return (
        <Badge
          variant="outline"
          className={`bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Orphan Return</span>
        </Badge>
      );
    case "BREAK_STATUS_MISMATCH":
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 flex items-center gap-1.5 font-medium ${className}`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Status Mismatch</span>
        </Badge>
      );
  }
}
