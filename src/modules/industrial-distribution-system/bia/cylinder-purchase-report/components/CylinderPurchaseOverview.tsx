import type { LucideIcon } from "lucide-react";
import { Cylinder, PackagePlus, Scale, Undo2, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CylinderPurchaseDashboardResponse } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export interface CylinderPurchaseOverviewProps {
  report: CylinderPurchaseDashboardResponse | null;
  isLoading: boolean;
}
const quantityFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});

export function CylinderPurchaseOverview({
  report,
  isLoading,
}: CylinderPurchaseOverviewProps): React.ReactElement {
  const overview = report?.overview;
  const cards: ReadonlyArray<readonly [string, number | undefined, LucideIcon]> = [
    ["Gross Purchased", overview?.grossPurchasedQty, PackagePlus],
    ["Returned Cylinders", overview?.returnedQty, Undo2],
    ["Net Purchased", overview?.netPurchasedQty, Scale],
    ["Unique Customers", overview?.uniqueCustomers, Users],
    ["Serialized Products", overview?.serializedProducts, Cylinder],
  ];

  return (
    <section aria-label="Cylinder purchase overview">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, Icon]) => (
          <Card key={label} className="gap-3 border-border/80 py-4">
            <CardContent className="flex items-center justify-between gap-3 px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                    {quantityFormatter.format(value ?? 0)}
                  </p>
                )}
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
