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

const getInitialFilters = (): PriceListFilters => {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	return {
		...DEFAULT_FILTERS,
		dateFrom: startOfMonth,
		dateTo: now,
	};
};

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
	appliedFilters: PriceListFilters;
	activeProductId: string;
	setFilter: <K extends keyof PriceListFilters>(key: K, value: PriceListFilters[K]) => void;
	resetFilters: () => void;
	applyFilters: () => void;
	hasActiveFilters: boolean;

	// Computed
	filteredEntries: CompetitorPriceEntry[];
	chartFilteredEntries: CompetitorPriceEntry[];
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

	const [filters, setFilters] = useState<PriceListFilters>(getInitialFilters);
	const [appliedFilters, setAppliedFilters] = useState<PriceListFilters>(getInitialFilters);

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

	const applyFilters = () => {
		setAppliedFilters(filters);
	};

	const resetFilters = () => {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const defaults = {
			...DEFAULT_FILTERS,
			dateFrom: startOfMonth,
			dateTo: now,
		};
		setFilters(defaults);
		setAppliedFilters(defaults);
	};

	const hasActiveFilters = useMemo(() => {
		const hasNonDateFilters =
			!!appliedFilters.search ||
			!!appliedFilters.competitorId ||
			!!appliedFilters.province ||
			!!appliedFilters.municipality ||
			!!appliedFilters.barangay ||
			!!appliedFilters.sourceType;

		if (hasNonDateFilters) return true;

		// If no other filters, check if the dates are different from "this month" default
		if (!appliedFilters.dateFrom || !appliedFilters.dateTo) {
			return true;
		}

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		startOfMonth.setHours(0, 0, 0, 0);

		const from = new Date(appliedFilters.dateFrom);
		from.setHours(0, 0, 0, 0);

		if (from.getTime() !== startOfMonth.getTime()) return true;

		const to = new Date(appliedFilters.dateTo);
		const isToToday =
			to.getFullYear() === now.getFullYear() &&
			to.getMonth() === now.getMonth() &&
			to.getDate() === now.getDate();

		return !isToToday;
	}, [appliedFilters]);

	// ─── Filter Entries (client-side post-fetch) ──────────────────────────────

	const filteredEntries = useMemo<CompetitorPriceEntry[]>(() => {
		let result = entries;

		if (appliedFilters.productId) {
			result = result.filter((e) => e.product_name === appliedFilters.productId);
		}

		if (appliedFilters.search) {
			const s = appliedFilters.search.toLowerCase();
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

		if (appliedFilters.competitorId) {
			result = result.filter((entry) => {
				const id =
					typeof entry.competitor_id === "object" && entry.competitor_id !== null
						? String(entry.competitor_id.id)
						: String(entry.competitor_id);
				return id === appliedFilters.competitorId;
			});
		}

		if (appliedFilters.province) {
			result = result.filter((e) => e.province === appliedFilters.province);
		}
		if (appliedFilters.municipality) {
			result = result.filter((e) => e.municipality === appliedFilters.municipality);
		}
		if (appliedFilters.barangay) {
			result = result.filter((e) => e.barangay === appliedFilters.barangay);
		}
		if (appliedFilters.sourceType) {
			result = result.filter((e) => e.source_type === appliedFilters.sourceType);
		}

		result = result.filter((e) =>
			isWithinDateRange(e, appliedFilters.dateFrom, appliedFilters.dateTo)
		);

		return result;
	}, [entries, appliedFilters]);

	const chartFilteredEntries = useMemo<CompetitorPriceEntry[]>(() => {
		let result = entries;

		if (appliedFilters.productId) {
			result = result.filter((e) => e.product_name === appliedFilters.productId);
		}

		if (appliedFilters.search) {
			const s = appliedFilters.search.toLowerCase();
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

		if (appliedFilters.province) {
			result = result.filter((e) => e.province === appliedFilters.province);
		}
		if (appliedFilters.municipality) {
			result = result.filter((e) => e.municipality === appliedFilters.municipality);
		}
		if (appliedFilters.barangay) {
			result = result.filter((e) => e.barangay === appliedFilters.barangay);
		}
		if (appliedFilters.sourceType) {
			result = result.filter((e) => e.source_type === appliedFilters.sourceType);
		}

		result = result.filter((e) =>
			isWithinDateRange(e, appliedFilters.dateFrom, appliedFilters.dateTo)
		);

		return result;
	}, [entries, appliedFilters]);

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
		appliedFilters,
		activeProductId,
		setFilter,
		resetFilters,
		applyFilters,
		hasActiveFilters,
		filteredEntries,
		chartFilteredEntries,
		marketSnapshot,
		provinces,
		municipalities,
		barangays,
		provinceStats,
		sourceStats,
	};
}
