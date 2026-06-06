import KiloConsumptionBillingModule from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/kilo-consumption-billing/KiloConsumptionBillingModule";

export const metadata = {
  title: "Kilo Consumption Billing | IDS",
  description: "Bill LPG consumption based on WIWO (Weight-In Weight-Out) cylinder returns.",
};

export default function KiloConsumptionBillingPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
      <KiloConsumptionBillingModule />
    </main>
  );
}
