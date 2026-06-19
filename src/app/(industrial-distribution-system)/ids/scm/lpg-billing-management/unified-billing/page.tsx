import UnifiedBillingModule from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/unified-billing/UnifiedBillingModule";

export const metadata = {
  title: "Unified LPG Billing | IDS",
  description:
    "Single billing engine supporting Metered+Physical (BOTH) and Physical-Only (KILO) billing tracks.",
};

export default function UnifiedBillingPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
      <UnifiedBillingModule />
    </main>
  );
}
