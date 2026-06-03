import type { ProductTierKey } from "../types";

export const TIERS: ProductTierKey[] = ["LIST", "A", "B", "C", "D", "E"];

export function isTierName(v: string): v is ProductTierKey {
    return TIERS.includes(v as ProductTierKey);
}

export function mapPriceTypeName(name: string | null | undefined): string {
    if (!name) return "";
    const clean = name.trim();
    const upper = clean.toUpperCase();
    if (upper === "A" || upper === "PRICE A" || upper === "TIER A") {
        return "A - Dealer";
    }
    if (upper === "B" || upper === "PRICE B" || upper === "TIER B") {
        return "B - Sub-Dealer";
    }
    if (upper === "C" || upper === "PRICE C" || upper === "TIER C") {
        return "C - RTO";
    }
    if (upper === "D" || upper === "PRICE D" || upper === "TIER D") {
        return "D - Commercial";
    }
    if (upper === "E" || upper === "PRICE E" || upper === "TIER E") {
        return "E - Walk-in";
    }
    return clean;
}

