"use client";

import { Button } from "@/components/ui/button";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";

const views = [
  ["customers", "Customer Ranking"],
  ["products", "Product Performance"],
  ["returns", "Return Analysis"],
  ["branches", "Branch Performance"],
  ["salespeople", "Salesperson Performance"],
] as const;

export function CylinderPurchaseDashboardNav(): React.ReactElement {
  const { activeView, setActiveView } = useCylinderPurchaseReport();

  return (
    <nav
      aria-label="Cylinder purchase report view"
      className="overflow-x-auto pb-1"
    >
      <div
        role="group"
        className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
      >
        {views.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={activeView === value ? "secondary" : "ghost"}
            aria-pressed={activeView === value}
            className="px-3"
            onClick={() => setActiveView(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
