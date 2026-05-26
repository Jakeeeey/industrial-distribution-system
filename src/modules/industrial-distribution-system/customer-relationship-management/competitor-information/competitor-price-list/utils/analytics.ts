import type {
	CompetitorPriceEntry,
	LocationOption,
	PriceIntelligenceSnapshot,
	PriceListFilters,
	ProvinceStat,
	SourceStat,
	SourceType,
	MarketIntelligenceKPIs,
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

export function computeMarketSnapshot(entries: CompetitorPriceEntry[]): PriceIntelligenceSnapshot {
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

// ─── Compute KPIs ────────────────────────────────────────────────────────────

export function computeKPIs(entries: CompetitorPriceEntry[]): MarketIntelligenceKPIs {
	if (!entries || entries.length === 0) {
		return {
			latestEntryDate: "N/A",
			activeDays: 0,
			avgDailyCaptures: 0,
			peakCaptureDay: "N/A",
			mostActiveCompetitorName: "N/A",
			mostActiveCompetitorCount: 0,
			mostActiveCompetitorShare: 0,
			productsTracked: 0,
			provincesCovered: 0,
			municipalitiesCovered: 0,
			barangaysCovered: 0,
			undercuttingRate: 0,
			parityRate: 0,
			premiumRate: 0,
			volatilityLevel: "Low",
			priceStability: "Stable",
			spreadConsistency: "High",
			outlierAmount: 0,
			outlierProduct: "N/A",
			outlierCompetitor: "N/A",
			recentPeriodDays: 7,
			recentAvgChange: 0,
			recentHigherChange: 0,
			recentLowerChange: 0,
		};
	}

	// ─── 1. Market Activity ───
	let latestDateObj: Date | null = null;
	const dateCountMap = new Map<string, number>();
	const parsedDates: { dateStr: string; dateObj: Date; entry: CompetitorPriceEntry }[] = [];

	for (const entry of entries) {
		const dObj = parseEntryDate(entry.created_at);
		if (dObj) {
			const ymd = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
			dateCountMap.set(ymd, (dateCountMap.get(ymd) ?? 0) + 1);
			parsedDates.push({ dateStr: ymd, dateObj: dObj, entry });

			if (!latestDateObj || dObj > latestDateObj) {
				latestDateObj = dObj;
			}
		}
	}

	const latestEntryDate = latestDateObj ? formatEntryDate(latestDateObj.toISOString()) : "N/A";
	const activeDays = dateCountMap.size;
	const avgDailyCaptures = activeDays > 0 ? entries.length / activeDays : 0;

	let peakDayYmd = "N/A";
	let peakCount = 0;
	dateCountMap.forEach((count, ymd) => {
		if (count > peakCount) {
			peakCount = count;
			peakDayYmd = ymd;
		}
	});
	const peakCaptureDay = peakDayYmd !== "N/A" ? formatEntryDate(peakDayYmd) : "N/A";

	// ─── 2. Most Active Competitor ───
	const compCountMap = new Map<string, number>();
	for (const entry of entries) {
		const name = resolveCompetitorName(entry);
		compCountMap.set(name, (compCountMap.get(name) ?? 0) + 1);
	}

	let mostActiveCompetitorName = "N/A";
	let mostActiveCompetitorCount = 0;
	compCountMap.forEach((count, name) => {
		if (count > mostActiveCompetitorCount) {
			mostActiveCompetitorCount = count;
			mostActiveCompetitorName = name;
		}
	});
	const mostActiveCompetitorShare = entries.length > 0 ? (mostActiveCompetitorCount / entries.length) * 100 : 0;

	// ─── 3. Market Coverage ───
	const productsSet = new Set<string>();
	const provincesSet = new Set<string>();
	const municipalitiesSet = new Set<string>();
	const barangaysSet = new Set<string>();

	for (const entry of entries) {
		if (entry.product_name) productsSet.add(entry.product_name);
		else if (entry.product_id) productsSet.add(String(entry.product_id));

		if (entry.province) provincesSet.add(entry.province);
		if (entry.municipality) municipalitiesSet.add(entry.municipality);
		if (entry.barangay) barangaysSet.add(entry.barangay);
	}

	// ─── 4. Competitive Pressure ───
	let lower = 0;
	let match = 0;
	let higher = 0;
	for (const entry of entries) {
		if (entry.price_vs_us === "lower") lower++;
		else if (entry.price_vs_us === "match") match++;
		else if (entry.price_vs_us === "higher") higher++;
	}
	const totalPositioning = lower + match + higher;
	const undercuttingRate = totalPositioning > 0 ? (lower / totalPositioning) * 100 : 0;
	const parityRate = totalPositioning > 0 ? (match / totalPositioning) * 100 : 0;
	const premiumRate = totalPositioning > 0 ? (higher / totalPositioning) * 100 : 0;

	// ─── 5. Market Volatility ───
	const prices = entries.map(e => Number(e.price)).filter(Number.isFinite);
	const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
	const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
	const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
	const spread = maxPrice - minPrice;
	const spreadRatio = avgPrice > 0 ? spread / avgPrice : 0;

	const variance = prices.length > 0 ? prices.reduce((acc, p) => acc + Math.pow(p - avgPrice, 2), 0) / prices.length : 0;
	const stdDev = Math.sqrt(variance);
	const cv = avgPrice > 0 ? stdDev / avgPrice : 0;

	let volatilityLevel: "Low" | "Medium" | "High" = "Low";
	if (spreadRatio >= 0.35) volatilityLevel = "High";
	else if (spreadRatio >= 0.12) volatilityLevel = "Medium";

	let priceStability: "Very Stable" | "Stable" | "Moderate" | "Volatile" = "Stable";
	if (spreadRatio < 0.05) priceStability = "Very Stable";
	else if (spreadRatio < 0.15) priceStability = "Stable";
	else if (spreadRatio < 0.3) priceStability = "Moderate";
	else priceStability = "Volatile";

	let spreadConsistency: "High" | "Moderate" | "Low" = "High";
	if (cv < 0.06) spreadConsistency = "High";
	else if (cv < 0.18) spreadConsistency = "Moderate";
	else spreadConsistency = "Low";

	// ─── 6. Price Outlier ───
	let largestDev = 0;
	let outlierEntry: CompetitorPriceEntry | null = null;

	for (const entry of entries) {
		const price = Number(entry.price);
		const ourPrice = Number(entry.our_price);
		const baseline = Number.isFinite(ourPrice) ? ourPrice : avgPrice;
		const dev = Math.abs(price - baseline);
		if (dev > largestDev) {
			largestDev = dev;
			outlierEntry = entry;
		}
	}

	const outlierAmount = largestDev;
	const outlierProduct = outlierEntry?.product_name || "N/A";
	const outlierCompetitor = outlierEntry ? resolveCompetitorName(outlierEntry) : "N/A";

	// ─── 7. Recent Trend ───
	let recentAvgChange = 0;
	let recentHigherChange = 0;
	let recentLowerChange = 0;

	if (parsedDates.length > 0 && latestDateObj) {
		const latestMs = latestDateObj.getTime();
		const dayMs = 24 * 60 * 60 * 1000;
		const sevenDaysAgoMs = latestMs - 7 * dayMs;
		const fourteenDaysAgoMs = latestMs - 14 * dayMs;

		const period1Entries = parsedDates.filter(pd => pd.dateObj.getTime() >= sevenDaysAgoMs);
		const period2Entries = parsedDates.filter(pd => pd.dateObj.getTime() >= fourteenDaysAgoMs && pd.dateObj.getTime() < sevenDaysAgoMs);

		if (period1Entries.length > 0 && period2Entries.length > 0) {
			const p1Prices = period1Entries.map(pd => Number(pd.entry.price)).filter(Number.isFinite);
			const p2Prices = period2Entries.map(pd => Number(pd.entry.price)).filter(Number.isFinite);

			const p1Avg = p1Prices.reduce((a, b) => a + b, 0) / p1Prices.length;
			const p2Avg = p2Prices.reduce((a, b) => a + b, 0) / p2Prices.length;
			recentAvgChange = p2Avg > 0 ? ((p1Avg - p2Avg) / p2Avg) * 100 : 0;

			const p1HigherCount = period1Entries.filter(pd => pd.entry.price_vs_us === "higher").length;
			const p2HigherCount = period2Entries.filter(pd => pd.entry.price_vs_us === "higher").length;
			const p1HigherRatio = p1HigherCount / period1Entries.length;
			const p2HigherRatio = p2HigherCount / period2Entries.length;
			recentHigherChange = (p1HigherRatio - p2HigherRatio) * 100;

			const p1LowerCount = period1Entries.filter(pd => pd.entry.price_vs_us === "lower").length;
			const p2LowerCount = period2Entries.filter(pd => pd.entry.price_vs_us === "lower").length;
			const p1LowerRatio = p1LowerCount / period1Entries.length;
			const p2LowerRatio = p2LowerCount / period2Entries.length;
			recentLowerChange = (p1LowerRatio - p2LowerRatio) * 100;
		}
	}

	return {
		latestEntryDate,
		activeDays,
		avgDailyCaptures,
		peakCaptureDay,
		mostActiveCompetitorName,
		mostActiveCompetitorCount,
		mostActiveCompetitorShare,
		productsTracked: productsSet.size,
		provincesCovered: provincesSet.size,
		municipalitiesCovered: municipalitiesSet.size,
		barangaysCovered: barangaysSet.size,
		undercuttingRate,
		parityRate,
		premiumRate,
		volatilityLevel,
		priceStability,
		spreadConsistency,
		outlierAmount,
		outlierProduct,
		outlierCompetitor,
		recentPeriodDays: 7,
		recentAvgChange,
		recentHigherChange,
		recentLowerChange,
	};
}

