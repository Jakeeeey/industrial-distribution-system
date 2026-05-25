"use client";

import { useMemo, useState } from "react";
import {
	DEFAULT_FILTERS,
	type CompetitorPriceEntry,
	type PriceIntelligenceSnapshot,
	type PriceListFilters,
	type ProductRef,
} from "../types";
import { useCompetitorPriceListContext } from "../providers/fetchproviders";
import {
	buildLocationOptions,
	computeMarketSnapshot,
	computeProvinceStats,
	computeSourceStats,
	isWithinDateRange,
} from "../utils/analytics";
import type { CompetitorRef, LocationOption, ProvinceStat, SourceStat } from "../types";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCompetitorPriceListReturn {
	// Raw data
	entries: CompetitorPriceEntry[];
	competitors: CompetitorRef[];
	products: ProductRef[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => Promise<void>;

	// Filter state
	filters: PriceListFilters;
	activeProductId: string;
	setFilter: <K extends keyof PriceListFilters>(key: K, value: PriceListFilters[K]) => void;
	resetFilters: () => void;
	hasActiveFilters: boolean;

	// Computed
	filteredEntries: CompetitorPriceEntry[];
	marketSnapshot: PriceIntelligenceSnapshot;
	provinces: LocationOption[];
	municipalities: LocationOption[];
	barangays: LocationOption[];
	provinceStats: ProvinceStat[];
	sourceStats: SourceStat[];
}

export function useCompetitorPriceList(): UseCompetitorPriceListReturn {
	const { entries, competitors, products, isLoading, isError, error, refetch } =
		useCompetitorPriceListContext();

	const [filters, setFilters] = useState<PriceListFilters>(DEFAULT_FILTERS);

	const activeProductId = filters.productId;

	const setFilter = <K extends keyof PriceListFilters>(
		key: K,
		value: PriceListFilters[K]
	) => {
		setFilters((prev) => {
			const next = { ...prev, [key]: value };
			// Cascade reset: changing province resets municipality + barangay
			if (key === "province") {
				next.municipality = "";
				next.barangay = "";
			}
			// Cascade reset: changing municipality resets barangay
			if (key === "municipality") {
				next.barangay = "";
			}
			return next;
		});
	};

	const resetFilters = () => setFilters(DEFAULT_FILTERS);

	const hasActiveFilters = useMemo(() => {
		return (
			!!filters.search ||
			!!filters.competitorId ||
			!!filters.province ||
			!!filters.municipality ||
			!!filters.barangay ||
			!!filters.sourceType ||
			!!filters.dateFrom ||
			!!filters.dateTo
		);
	}, [filters]);

	// ─── Filter Entries (client-side post-fetch) ──────────────────────────────

	const filteredEntries = useMemo<CompetitorPriceEntry[]>(() => {
		let result = entries;

		if (activeProductId) {
			result = result.filter((e) => e.product_name === activeProductId);
		}

		if (filters.search) {
			const s = filters.search.toLowerCase();
			result = result.filter((entry) => {
				const competitorName =
					typeof entry.competitor_id === "object" && entry.competitor_id !== null
						? entry.competitor_id.name
						: String(entry.competitor_id);
				return [
					competitorName,
					entry.province,
					entry.municipality,
					entry.barangay,
					entry.source_type,
					entry.size,
					String(entry.product_id),
				]
					.filter(Boolean)
					.some((v) => String(v).toLowerCase().includes(s));
			});
		}

		if (filters.competitorId) {
			result = result.filter((entry) => {
				const id =
					typeof entry.competitor_id === "object" && entry.competitor_id !== null
						? String(entry.competitor_id.id)
						: String(entry.competitor_id);
				return id === filters.competitorId;
			});
		}

		if (filters.province) {
			result = result.filter((e) => e.province === filters.province);
		}
		if (filters.municipality) {
			result = result.filter((e) => e.municipality === filters.municipality);
		}
		if (filters.barangay) {
			result = result.filter((e) => e.barangay === filters.barangay);
		}
		if (filters.sourceType) {
			result = result.filter((e) => e.source_type === filters.sourceType);
		}

		result = result.filter((e) =>
			isWithinDateRange(e, filters.dateFrom, filters.dateTo)
		);

		return result;
	}, [entries, filters, activeProductId]);

	// ─── Analytics (derived from filtered data) ───────────────────────────────

	const marketSnapshot = useMemo<PriceIntelligenceSnapshot>(
		() => computeMarketSnapshot(filteredEntries),
		[filteredEntries]
	);

	const { provinces, municipalities, barangays } = useMemo(
		() => buildLocationOptions(entries, { province: filters.province, municipality: filters.municipality }),
		[entries, filters.province, filters.municipality]
	);

	const provinceStats = useMemo(
		() => computeProvinceStats(filteredEntries),
		[filteredEntries]
	);

	const sourceStats = useMemo(
		() => computeSourceStats(filteredEntries),
		[filteredEntries]
	);

	return {
		entries,
		competitors,
		products,
		isLoading,
		isError,
		error,
		refetch,
		filters,
		activeProductId,
		setFilter,
		resetFilters,
		hasActiveFilters,
		filteredEntries,
		marketSnapshot,
		provinces,
		municipalities,
		barangays,
		provinceStats,
		sourceStats,
	};
}
