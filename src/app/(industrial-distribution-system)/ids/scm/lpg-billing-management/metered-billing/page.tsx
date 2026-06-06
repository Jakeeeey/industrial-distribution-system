import MeteredWiwoBillingModule from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-wiwo-billing/MeteredWiwoBillingModule";

export const metadata = {
  title: "Metered Billing | IDS",
  description: "Large commercial LPG billing — billable KG = MAX(Metered KG).",
};

export default function MeteredBillingPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
      <MeteredWiwoBillingModule />
    </main>
  );
}
