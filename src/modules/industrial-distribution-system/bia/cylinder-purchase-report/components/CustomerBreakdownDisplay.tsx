import type * as React from "react";

import type { QuantityMetrics } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import { formatQuantity, formatReturnRate } from "./analytical-view.utils";

export function CustomerBreakdownIdentity({
  name,
  code,
}: {
  name: string;
  code: string;
}): React.ReactElement {
  return (
    <div className="min-w-48">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">{code}</p>
    </div>
  );
}

interface CustomerBreakdownMobileCardProps extends QuantityMetrics {
  name: string;
  code: string;
  returnRate: number;
}

export function CustomerBreakdownMobileCard({
  name,
  code,
  grossPurchasedQty,
  returnedQty,
  netPurchasedQty,
  returnRate,
}: CustomerBreakdownMobileCardProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <p className="truncate font-semibold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">{code}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Gross</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(grossPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Returned</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(returnedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-semibold tabular-nums">
            {formatQuantity(netPurchasedQty)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Return Rate</dt>
          <dd className="font-semibold tabular-nums">
            {formatReturnRate(returnRate, grossPurchasedQty)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
