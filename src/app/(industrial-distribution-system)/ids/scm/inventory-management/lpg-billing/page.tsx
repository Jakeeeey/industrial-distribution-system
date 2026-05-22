import LpgBillingModule from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-billing/LpgBillingModule";

export const metadata = {
  title: "LPG Consumption Billing | Seagas Industrial Dealership System",
  description: "Manage LPG consumption billing for kilos and metered units.",
};

export default function LpgBillingPage() {
  return <LpgBillingModule />;
}
