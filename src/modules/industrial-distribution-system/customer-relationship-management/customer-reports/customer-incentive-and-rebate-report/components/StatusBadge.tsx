"use client";

// ============================================================
// StatusBadge.tsx
// One badge for the §6 claim lifecycle. "No claim" is shown as an outline
// rather than muted on purpose: a customer with eligible volume and no memo
// is the single most actionable row in this report.
// ============================================================

import * as React from "react";

import { Badge } from "@/components/ui/badge";

import { claimStatusLabel } from "../services/customer-incentive.helpers";
import type { ClaimStatus } from "../types/customer-incentive.types";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<ClaimStatus | "NO_CLAIM", BadgeVariant> = {
  NO_CLAIM: "outline",
  FOR_REVIEW: "secondary",
  APPROVED: "default",
  PARTIALLY_RELEASED: "default",
  RELEASED: "secondary",
  REJECTED: "destructive",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ClaimStatus | "NO_CLAIM";
  label?: string;
}): React.ReactElement {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className="whitespace-nowrap text-[11px] font-medium"
    >
      {label ?? claimStatusLabel(status)}
    </Badge>
  );
}

/**
 * Every distinct status on one customer's claims. The roll-up alone would
 * hide a customer whose second memo was rejected.
 */
export function StatusBadgeGroup({
  statuses,
  primary,
}: {
  statuses: ClaimStatus[];
  primary: ClaimStatus | "NO_CLAIM";
}): React.ReactElement {
  const extra = statuses.filter((status) => status !== primary);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge status={primary} />
      {extra.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}
