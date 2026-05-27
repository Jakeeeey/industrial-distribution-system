// ─── Enums ────────────────────────────────────────────────────────────────────

export type PriceVsUs = "higher" | "match" | "lower";
export type SourceType = "Household" | "Sari-Sari" | "Eatery";

// ─── Directus Entities ────────────────────────────────────────────────────────

/** Lightweight competitor reference (returned when fields=*,competitor_id.*) */
export interface CompetitorRef {
	id: number;
	name: string;
	province?: string | null;
	city?: string | null;
}

export interface ProductRef {
	product_id: number;
	product_name: string;
	priceA?: number | null;
	price_per_unit?: number | null;
}

/** A single competitor price list entry from Directus */
export interface CompetitorPriceEntry {
	id: number;
	/** Raw FK integer or an expanded CompetitorRef object */
	competitor_id: number | CompetitorRef;
	product_id: number;
	product_name?: string;
	our_price?: number;
	province: string | null;
	municipality: string | null;
	barangay: string | null;
	source_type: SourceType;
	size: string | null;
	/** Stored as string in Directus decimal, coerced to number in provider */
	price: number;
	price_vs_us: PriceVsUs | null;
	created_at: string | null;
}

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface PriceListFilters {
	search: string;
	productId: string;       // "" = all
	competitorId: string;    // "" = all
	province: string;
	municipality: string;
	barangay: string;
	sourceType: string;      // "" = all
	dateFrom: Date | undefined;
	dateTo: Date | undefined;
}

export const DEFAULT_FILTERS: PriceListFilters = {
	search: "",
	productId: "",
	competitorId: "",
	province: "",
	municipality: "",
	barangay: "",
	sourceType: "",
	dateFrom: undefined,
	dateTo: undefined,
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface PriceIntelligenceSnapshot {
	avgPrice: number;
	minPrice: number;
	maxPrice: number;
	spread: number;
	competitorCount: number;
	totalEntries: number;
	higherCount: number;
	matchCount: number;
	lowerCount: number;
}

export interface LocationOption {
	value: string;
	label: string;
}

export interface ProvinceStat {
	province: string;
	count: number;
}

export interface SourceStat {
	sourceType: SourceType;
	count: number;
}

export interface MarketIntelligenceKPIs {
	// 1. Market Activity
	latestEntryDate: string;
	activeDays: number;
	avgDailyCaptures: number;
	peakCaptureDay: string;

	// 2. Most Active Competitor
	mostActiveCompetitorName: string;
	mostActiveCompetitorCount: number;
	mostActiveCompetitorShare: number;

	// 3. Market Coverage
	productsTracked: number;
	provincesCovered: number;
	municipalitiesCovered: number;
	barangaysCovered: number;

	// 4. Competitive Pressure
	undercuttingRate: number;
	parityRate: number;
	premiumRate: number;

	// 5. Market Volatility
	volatilityLevel: "Low" | "Medium" | "High";
	priceStability: "Very Stable" | "Stable" | "Moderate" | "Volatile";
	spreadConsistency: "High" | "Moderate" | "Low";

	// 6. Price Outlier
	outlierAmount: number;
	outlierProduct: string;
	outlierCompetitor: string;

	// 7. Recent Trend
	recentPeriodDays: number;
	recentAvgChange: number;
	recentHigherChange: number;
	recentLowerChange: number;
}

