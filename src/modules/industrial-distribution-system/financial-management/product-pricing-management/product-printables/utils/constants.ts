// src/modules/financial-management/product-pricing-management/product-printables/utils/constants.ts

export type ProductTierKey = "A" | "B" | "C" | "D" | "E" | "ListPrice";

export const TIER_LABELS: Record<string, string> = {
    ListPrice: "List Price",
    A: "Dealer",
    B: "Sub-Dealer",
    C: "RTO",
    D: "Commercial",
    E: "Walk in",
};

export function getTierLabel(tier: string): string {
    return TIER_LABELS[tier] ?? tier;
}
