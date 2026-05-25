import type {
	CompetitorPriceEntry,
	LocationOption,
	MarketSnapshot,
	PriceListFilters,
	ProvinceStat,
	SourceStat,
	SourceType,
} from "../types";

// ─── Date Parsing ─────────────────────────────────────────────────────────────

export function parseEntryDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	const match = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?(?:[zZ]|[+-]\d{2}:?\d{2})?$/
	);
	if (!match) {
		const d = new Date(trimmed);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const [, year, month, day, hour = "0", minute = "0", second = "0", ms = "0"] = match;
	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
		Number(ms.padEnd(3, "0"))
	);
}

// ─── Price Formatting ─────────────────────────────────────────────────────────

export function formatPeso(value: number): string {
	return `₱${value.toLocaleString("en-PH", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

// ─── Competitor Name Resolution ───────────────────────────────────────────────

export function resolveCompetitorName(entry: CompetitorPriceEntry): string {
	const c = entry.competitor_id;
	if (typeof c === "object" && c !== null && "name" in c) return c.name;
	return `ID #${String(c)}`;
}
function getCompetitorId(entry: CompetitorPriceEntry): number {
	return typeof entry.competitor_id === "object" && entry.competitor_id !== null
		? entry.competitor_id.id
		: entry.competitor_id;
}
// ─── Market Snapshot ──────────────────────────────────────────────────────────

export function computeMarketSnapshot(entries: CompetitorPriceEntry[]): MarketSnapshot {
	if (entries.length === 0) {
		return {
			avgPrice: 0,
			minPrice: 0,
			maxPrice: 0,
			spread: 0,
			competitorCount: 0,
			totalEntries: 0,
			higherCount: 0,
			matchCount: 0,
			lowerCount: 0,
		};
	}

	let sum = 0;
	let min = Infinity;
	let max = -Infinity;
	let higherCount = 0;
	let matchCount = 0;
	let lowerCount = 0;

	for (const entry of entries) {
		const p = Number(entry.price);
		sum += p;
		if (p < min) min = p;
		if (p > max) max = p;

		if (entry.price_vs_us === "higher") higherCount++;
		else if (entry.price_vs_us === "match") matchCount++;
		else if (entry.price_vs_us === "lower") lowerCount++;
	}

	return {
		avgPrice: sum / entries.length,
		minPrice: min,
		maxPrice: max,
		spread: max - min,
		competitorCount: new Set(entries.map(getCompetitorId)).size,
		totalEntries: entries.length,
		higherCount,
		matchCount,
		lowerCount,
	};
}

// ─── Location Options ─────────────────────────────────────────────────────────

function toSortedOptions(values: Set<string>, allLabel: string): LocationOption[] {
	return [
		{ value: "", label: allLabel },
		...Array.from(values)
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b))
			.map((v) => ({ value: v, label: v })),
	];
}

export function buildLocationOptions(
	entries: CompetitorPriceEntry[],
	filters: Pick<PriceListFilters, "province" | "municipality">
): {
	provinces: LocationOption[];
	municipalities: LocationOption[];
	barangays: LocationOption[];
} {
	const provinces = new Set<string>();
	const municipalities = new Set<string>();
	const barangays = new Set<string>();

	for (const entry of entries) {
		if (entry.province) provinces.add(entry.province);

		if (!filters.province || entry.province === filters.province) {
			if (entry.municipality) municipalities.add(entry.municipality);
		}

		if (
			(!filters.province || entry.province === filters.province) &&
			(!filters.municipality || entry.municipality === filters.municipality)
		) {
			if (entry.barangay) barangays.add(entry.barangay);
		}
	}

	return {
		provinces: toSortedOptions(provinces, "All Provinces"),
		municipalities: toSortedOptions(municipalities, "All Municipalities"),
		barangays: toSortedOptions(barangays, "All Barangays"),
	};
}

// ─── Province Stats ───────────────────────────────────────────────────────────

export function computeProvinceStats(entries: CompetitorPriceEntry[]): ProvinceStat[] {
	const map = new Map<string, number>();
	for (const entry of entries) {
		const key = entry.province || "Unknown";
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return Array.from(map.entries())
		.map(([province, count]) => ({ province, count }))
		.sort((a, b) => b.count - a.count);
}

// ─── Source Stats ─────────────────────────────────────────────────────────────

export function computeSourceStats(entries: CompetitorPriceEntry[]): SourceStat[] {
	const SOURCE_TYPES: SourceType[] = ["Household", "Sari-Sari", "Eatery"];
	const map = new Map<SourceType, number>();
	for (const entry of entries) {
		const key = entry.source_type;
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return SOURCE_TYPES.map((sourceType) => ({
		sourceType,
		count: map.get(sourceType) ?? 0,
	}));
}

// ─── Date Range Filter ────────────────────────────────────────────────────────

export function isWithinDateRange(
	entry: CompetitorPriceEntry,
	dateFrom: Date | undefined,
	dateTo: Date | undefined
): boolean {
	if (!dateFrom && !dateTo) return true;
	const created = parseEntryDate(entry.created_at);
	if (!created) return false;
	if (dateFrom) {
		const from = new Date(dateFrom);
		from.setHours(0, 0, 0, 0);
		if (created < from) return false;
	}
	if (dateTo) {
		const to = new Date(dateTo);
		to.setHours(23, 59, 59, 999);
		if (created > to) return false;
	}
	return true;
}

// ─── Format Date ─────────────────────────────────────────────────────────────

export function formatEntryDate(value: string | null | undefined): string {
	const d = parseEntryDate(value);
	if (!d) return "N/A";
	return d.toLocaleString("en-PH", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
