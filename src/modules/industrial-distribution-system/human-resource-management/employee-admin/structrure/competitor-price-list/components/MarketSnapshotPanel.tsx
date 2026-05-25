"use client";

import React from "react";
import {
	BarChart3,
	MapPin,
	ShoppingBag,
	TrendingDown,
	TrendingUp,
	Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MarketSnapshot, ProvinceStat, SourceStat } from "../types";
import { formatPeso } from "../utils/analytics";
import { cn } from "@/lib/utils";

interface MarketSnapshotPanelProps {
	snapshot: MarketSnapshot;
	provinceStats: ProvinceStat[];
	sourceStats: SourceStat[];
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className?: string;
}) {
	return (
		<div className="flex items-center justify-between py-1.5">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className={cn("text-sm font-bold tabular-nums", className)}>{value}</span>
		</div>
	);
}

// ─── Positioning Bar ──────────────────────────────────────────────────────────

function PositioningBar({
	higher,
	match,
	lower,
	total,
}: {
	higher: number;
	match: number;
	lower: number;
	total: number;
}) {
	if (total === 0) {
		return (
			<div className="h-2 rounded-full bg-muted w-full" />
		);
	}

	const higherPct = (higher / total) * 100;
	const matchPct = (match / total) * 100;
	const lowerPct = (lower / total) * 100;

	return (
		<div className="w-full h-2.5 rounded-full overflow-hidden flex">
			{higherPct > 0 && (
				<div
					className="bg-rose-500 transition-all"
					style={{ width: `${higherPct}%` }}
					title={`Higher: ${higher}`}
				/>
			)}
			{matchPct > 0 && (
				<div
					className="bg-slate-400 transition-all"
					style={{ width: `${matchPct}%` }}
					title={`Match: ${match}`}
				/>
			)}
			{lowerPct > 0 && (
				<div
					className="bg-emerald-500 transition-all"
					style={{ width: `${lowerPct}%` }}
					title={`Lower: ${lower}`}
				/>
			)}
		</div>
	);
}

// ─── Source Bar ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
	Household: "bg-blue-500",
	"Sari-Sari": "bg-amber-500",
	Eatery: "bg-purple-500",
};

const SOURCE_TEXT_COLORS: Record<string, string> = {
	Household: "text-blue-600 dark:text-blue-400",
	"Sari-Sari": "text-amber-600 dark:text-amber-400",
	Eatery: "text-purple-600 dark:text-purple-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketSnapshotPanel({
	snapshot,
	provinceStats,
	sourceStats,
}: MarketSnapshotPanelProps) {
	const totalPositioning =
		snapshot.higherCount + snapshot.matchCount + snapshot.lowerCount;

	const pct = (count: number) =>
		totalPositioning > 0
			? `${((count / totalPositioning) * 100).toFixed(0)}%`
			: "0%";

	const topProvinces = provinceStats.slice(0, 5);
	const maxProvinceCount = topProvinces[0]?.count ?? 1;

	return (
		<div className="flex flex-col gap-4">
			{/* ─── Market Snapshot ──────────────────────────────────────────── */}
			<Card className="border shadow-sm">
				<CardHeader className="pb-2 pt-4 px-4">
					<CardTitle className="text-sm font-bold flex items-center gap-2">
						<BarChart3 className="h-4 w-4 text-primary" />
						Market Snapshot
					</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pb-4">
					{snapshot.totalEntries === 0 ? (
						<p className="text-xs text-muted-foreground text-center py-4">
							No data matching current filters.
						</p>
					) : (
						<>
							<StatRow
								label="Total Competitors"
								value={snapshot.competitorCount.toLocaleString()}
							/>
							<StatRow
								label="Total Entries"
								value={snapshot.totalEntries.toLocaleString()}
							/>
							
							<Separator className="my-1" />
							<StatRow
								label="Avg Price"
								value={formatPeso(snapshot.avgPrice)}
								className="text-primary"
							/>
							<StatRow
								label="Lowest Observed"
								value={formatPeso(snapshot.minPrice)}
								className="text-emerald-600 dark:text-emerald-400"
							/>
							<StatRow
								label="Highest Observed"
								value={formatPeso(snapshot.maxPrice)}
								className="text-rose-600 dark:text-rose-400"
							/>
							<StatRow
								label="Price Spread"
								value={formatPeso(snapshot.spread)}
							/>
						</>
					)}
				</CardContent>
			</Card>

			{/* ─── Competitive Positioning ──────────────────────────────────── */}
			<Card className="border shadow-sm">
				<CardHeader className="pb-2 pt-4 px-4">
					<CardTitle className="text-sm font-bold flex items-center gap-2">
						<TrendingUp className="h-4 w-4 text-primary" />
						Competitive Positioning
					</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pb-4">
					<PositioningBar
						higher={snapshot.higherCount}
						match={snapshot.matchCount}
						lower={snapshot.lowerCount}
						total={totalPositioning}
					/>
					<div className="flex flex-col gap-1.5 mt-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<TrendingUp className="h-3.5 w-3.5 text-rose-500" />
								<span className="text-xs text-muted-foreground">Higher than us</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-xs font-bold text-rose-600 dark:text-rose-400">
									{snapshot.higherCount}
								</span>
								<span className="text-xs text-muted-foreground">
									({pct(snapshot.higherCount)})
								</span>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<Minus className="h-3.5 w-3.5 text-slate-400" />
								<span className="text-xs text-muted-foreground">At parity</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-xs font-bold text-slate-600 dark:text-slate-400">
									{snapshot.matchCount}
								</span>
								<span className="text-xs text-muted-foreground">
									({pct(snapshot.matchCount)})
								</span>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
								<span className="text-xs text-muted-foreground">Lower than us</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
									{snapshot.lowerCount}
								</span>
								<span className="text-xs text-muted-foreground">
									({pct(snapshot.lowerCount)})
								</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ─── Geographic Distribution ──────────────────────────────────── */}
			{topProvinces.length > 0 && (
				<Card className="border shadow-sm">
					<CardHeader className="pb-2 pt-4 px-4">
						<CardTitle className="text-sm font-bold flex items-center gap-2">
							<MapPin className="h-4 w-4 text-primary" />
							Top Provinces
						</CardTitle>
					</CardHeader>
					<CardContent className="px-4 pb-4">
						<div className="flex flex-col gap-2">
							{topProvinces.map(({ province, count }) => (
								<div key={province}>
									<div className="flex items-center justify-between mb-1">
										<span className="text-xs font-medium truncate max-w-[160px]">
											{province}
										</span>
										<span className="text-xs text-muted-foreground font-mono ml-2 shrink-0">
											{count}
										</span>
									</div>
									<div className="h-1.5 rounded-full bg-muted overflow-hidden">
										<div
											className="h-full bg-primary/60 rounded-full transition-all"
											style={{
												width: `${(count / maxProvinceCount) * 100}%`,
											}}
										/>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* ─── Source Breakdown ─────────────────────────────────────────── */}
			<Card className="border shadow-sm">
				<CardHeader className="pb-2 pt-4 px-4">
					<CardTitle className="text-sm font-bold flex items-center gap-2">
						<ShoppingBag className="h-4 w-4 text-primary" />
						Source Breakdown
					</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pb-4">
					<div className="flex flex-col gap-2">
						{sourceStats.map(({ sourceType, count }) => (
							<div key={sourceType} className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div
										className={cn(
											"h-2 w-2 rounded-full shrink-0",
											SOURCE_COLORS[sourceType] ?? "bg-muted"
										)}
									/>
									<span className="text-xs text-muted-foreground">{sourceType}</span>
								</div>
								<span
									className={cn(
										"text-xs font-bold",
										SOURCE_TEXT_COLORS[sourceType] ?? "text-foreground"
									)}
								>
									{count}
								</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
