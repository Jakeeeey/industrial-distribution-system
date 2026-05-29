"use client";

import React from "react";
import {
	Activity,
	Award,
	Globe,
	Gauge,
	Zap,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarketIntelligenceKPIs } from "../types";
import { formatPeso } from "../utils/analytics";

interface PriceIntelligenceKPIsProps {
	kpis: MarketIntelligenceKPIs;
	className?: string;
}

export function PriceIntelligenceKPIs({ kpis, className }: PriceIntelligenceKPIsProps) {
	const volColors: Record<"Low" | "Medium" | "High", string> = {
		Low: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
		Medium: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
		High: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
	};

	const renderTrendChange = (val: number) => {
		const isPositive = val > 0;
		const isZero = val === 0;
		const color = isPositive
			? "text-rose-600 dark:text-rose-400"
			: isZero
				? "text-muted-foreground"
				: "text-emerald-600 dark:text-emerald-400";
		const sign = isPositive ? "+" : "";
		return (
			<span className={cn("font-bold tabular-nums text-xs", color)}>
				{sign}
				{val.toFixed(1)}%
			</span>
		);
	};

	return (
		<div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 w-full", className)}>
			{/* Card 1: Market Activity */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Market Activity
						<Activity className="h-4 w-4 text-blue-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-end">
					<div className="flex flex-col gap-1.5 mt-1.5 w-full">
						<div className="flex justify-between text-[11px] border-b pb-0.5 border-muted">
							<span className="text-muted-foreground">Latest Entry</span>
							<span className="font-semibold text-foreground truncate max-w-[85px]" title={kpis.latestEntryDate}>
								{kpis.latestEntryDate}
							</span>
						</div>
						<div className="flex justify-between text-[11px] border-b pb-0.5 border-muted">
							<span className="text-muted-foreground">Active Days</span>
							<span className="font-semibold text-foreground">{kpis.activeDays}</span>
						</div>
						<div className="flex justify-between text-[11px] border-b pb-0.5 border-muted">
							<span className="text-muted-foreground">Avg Daily Captures</span>
							<span className="font-semibold text-foreground">{kpis.avgDailyCaptures.toFixed(1)}</span>
						</div>
						<div className="flex justify-between text-[11px]">
							<span className="text-muted-foreground">Peak Day</span>
							<span className="font-semibold text-foreground truncate max-w-[95px]" title={kpis.peakCaptureDay}>
								{kpis.peakCaptureDay}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 2: Most Active Competitor */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Most Active
						<Award className="h-4 w-4 text-amber-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-between">
					<div className="min-h-[36px] flex items-center">
						<p className="text-xs font-bold text-foreground line-clamp-2 leading-tight" title={kpis.mostActiveCompetitorName}>
							{kpis.mostActiveCompetitorName}
						</p>
					</div>
					<div className="flex flex-col gap-1.5 mt-2 w-full">
						<div className="flex justify-between text-[11px] border-b pb-0.5 border-muted">
							<span className="text-muted-foreground">Entries</span>
							<span className="font-semibold text-foreground">{kpis.mostActiveCompetitorCount}</span>
						</div>
						<div className="flex justify-between text-[11px]">
							<span className="text-muted-foreground">Share</span>
							<span className="font-bold text-amber-600 dark:text-amber-400">
								{kpis.mostActiveCompetitorShare.toFixed(1)}%
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 3: Market Coverage */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Market Coverage
						<Globe className="h-4 w-4 text-teal-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-end">
					<div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-1.5 text-[11px]">
						<div className="flex flex-col border-r border-b pb-1 border-muted pr-1">
							<span className="text-muted-foreground text-[9px] uppercase tracking-wider">Products</span>
							<span className="font-bold text-foreground text-xs leading-none mt-0.5">{kpis.productsTracked}</span>
						</div>
						<div className="flex flex-col border-b pb-1 border-muted pl-1">
							<span className="text-muted-foreground text-[9px] uppercase tracking-wider">Provinces</span>
							<span className="font-bold text-foreground text-xs leading-none mt-0.5">{kpis.provincesCovered}</span>
						</div>
						<div className="flex flex-col border-r pt-1 border-muted pr-1">
							<span className="text-muted-foreground text-[9px] uppercase tracking-wider">Mun.</span>
							<span className="font-bold text-foreground text-xs leading-none mt-0.5">{kpis.municipalitiesCovered}</span>
						</div>
						<div className="flex flex-col pt-1 pl-1">
							<span className="text-muted-foreground text-[9px] uppercase tracking-wider">Brgys.</span>
							<span className="font-bold text-foreground text-xs leading-none mt-0.5">{kpis.barangaysCovered}</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 4: Competitive Pressure */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Pressure
						<Gauge className="h-4 w-4 text-purple-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-end">
					<div className="flex flex-col gap-1 w-full">
						<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex mb-1">
							<div
								className="bg-emerald-500 h-full transition-all"
								style={{ width: `${kpis.undercuttingRate}%` }}
								title={`Undercutting: ${kpis.undercuttingRate.toFixed(0)}%`}
							/>
							<div
								className="bg-slate-400 h-full transition-all"
								style={{ width: `${kpis.parityRate}%` }}
								title={`Parity: ${kpis.parityRate.toFixed(0)}%`}
							/>
							<div
								className="bg-rose-500 h-full transition-all"
								style={{ width: `${kpis.premiumRate}%` }}
								title={`Premium: ${kpis.premiumRate.toFixed(0)}%`}
							/>
						</div>
						<div className="flex justify-between text-[10px] items-center border-b pb-0.5 border-muted">
							<span className="text-emerald-600 dark:text-emerald-400 font-medium">Undercut</span>
							<span className="font-bold text-foreground">{kpis.undercuttingRate.toFixed(0)}%</span>
						</div>
						<div className="flex justify-between text-[10px] items-center border-b pb-0.5 border-muted">
							<span className="text-slate-500 font-medium">Parity</span>
							<span className="font-bold text-foreground">{kpis.parityRate.toFixed(0)}%</span>
						</div>
						<div className="flex justify-between text-[10px] items-center">
							<span className="text-rose-600 dark:text-rose-400 font-medium">Premium</span>
							<span className="font-bold text-foreground">{kpis.premiumRate.toFixed(0)}%</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 5: Market Volatility */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Volatility
						<Zap className="h-4 w-4 text-orange-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-between">
					<div className="min-h-[28px] flex items-center justify-center">
						<span
							className={cn(
								"text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
								volColors[kpis.volatilityLevel]
							)}
						>
							{kpis.volatilityLevel} Volatility
						</span>
					</div>
					<div className="flex flex-col gap-1.5 mt-2.5 w-full">
						<div className="flex justify-between text-[11px] border-b pb-0.5 border-muted">
							<span className="text-muted-foreground">Price Stability</span>
							<span className="font-semibold text-foreground">{kpis.priceStability}</span>
						</div>
						<div className="flex justify-between text-[11px]">
							<span className="text-muted-foreground">Spread Cons.</span>
							<span className="font-semibold text-foreground">{kpis.spreadConsistency}</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 6: Price Outlier */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Price Outlier
						<AlertTriangle className="h-4 w-4 text-rose-500" />
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-between">
					<div className="min-h-[28px] flex flex-col justify-center">
						<span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
							{kpis.outlierAmount > 0 ? formatPeso(kpis.outlierAmount) : "None"}
						</span>
					</div>
					<div className="flex flex-col gap-1 mt-2.5 text-[11px] w-full">
						<div className="truncate text-muted-foreground border-b pb-0.5 border-muted" title={kpis.outlierProduct}>
							<span className="font-medium text-foreground">Prod: </span>
							{kpis.outlierProduct}
						</div>
						<div className="truncate text-muted-foreground" title={kpis.outlierCompetitor}>
							<span className="font-medium text-foreground">Comp: </span>
							{kpis.outlierCompetitor}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Card 7: Recent Trend */}
			<Card className="border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
				<CardHeader className="pb-1.5 pt-3.5 px-3.5">
					<CardTitle className="text-[11px] font-bold tracking-wider uppercase flex items-center justify-between text-muted-foreground">
						Recent Trend
						<div className="flex items-center gap-0.5">
							<TrendingUp className="h-3 w-3 text-emerald-500" />
							<TrendingDown className="h-3 w-3 text-rose-500" />
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent className="px-3.5 pb-3.5 pt-0 flex-1 flex flex-col justify-end">
					<div className="flex flex-col gap-1.5 mt-1.5 w-full">
						<div className="text-[9px] text-muted-foreground font-medium pb-0.5 border-b border-muted uppercase tracking-wider">
							Last 7 Days vs Prior
						</div>
						<div className="flex justify-between text-[11px] items-center pt-0.5 border-b pb-0.5 border-muted">
							<div className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium">
								<TrendingUp className="h-3 w-3" />
								<span>Higher</span>
							</div>
							{renderTrendChange(kpis.recentHigherChange)}
						</div>
						<div className="flex justify-between text-[11px] items-center">
							<div className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
								<TrendingDown className="h-3 w-3" />
								<span>Lower</span>
							</div>
							{renderTrendChange(kpis.recentLowerChange)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
