import type { ProductTierKey } from "../types";

export const TIERS: ProductTierKey[] = ["LIST", "A", "B", "C", "D", "E"];

export const TIER_LABELS: Record<ProductTierKey, string> = {
    LIST: "List Price",
    A: "Dealer",
    B: "Sub-Dealer",
    C: "RTO",
    D: "Commercial",
    E: "Walk in",
};

export function getTierLabel(tier: ProductTierKey): string {
    return TIER_LABELS[tier] ?? tier;
}

export function isTierName(v: string): v is ProductTierKey {
    return TIERS.includes(v as ProductTierKey);
}
