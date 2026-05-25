"use client";

import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui/chart";

import type { CompetitorPriceEntry } from "../types";
import { parseEntryDate } from "../utils/analytics";

interface PriceTrendChartProps {
	data: CompetitorPriceEntry[];
	competitorName?: string;
}

export function PriceTrendChart({ data, competitorName }: PriceTrendChartProps) {
	const { chartData, chartConfig } = useMemo(() => {
		if (!data || data.length === 0) {
			return { chartData: [], chartConfig: {} };
		}

		const grouped = new Map<string, { ourPrices: number[]; competitorPrices: number[] }>();

		data.forEach((entry) => {
			const dateObj = parseEntryDate(entry.created_at);
			if (!dateObj) return;
			const dateKey = `${dateObj.getFullYear()}-${String(
				dateObj.getMonth() + 1
			).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

			if (!grouped.has(dateKey)) {
				grouped.set(dateKey, { ourPrices: [], competitorPrices: [] });
			}
			const dateMap = grouped.get(dateKey)!;

			// Collect competitor price
			dateMap.competitorPrices.push(Number(entry.price));

			// Collect our price if available
			if (entry.our_price != null) {
				dateMap.ourPrices.push(Number(entry.our_price));
			}
		});

		const sortedDates = Array.from(grouped.keys()).sort();

		const chartData = sortedDates.map((dateKey) => {
			const dateObj = new Date(dateKey);
			const row: Record<string, string | number> = {
				date: dateObj.toLocaleString("en-US", {
					month: "short",
					day: "numeric",
				}),
			};
			const { ourPrices, competitorPrices } = grouped.get(dateKey)!;

			if (ourPrices.length > 0) {
				const avgOur = ourPrices.reduce((a, b) => a + b, 0) / ourPrices.length;
				row["ourPrice"] = Number(avgOur.toFixed(2));
			}
			if (competitorPrices.length > 0) {
				const avgComp = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
				row["competitorPrice"] = Number(avgComp.toFixed(2));
			}

			return row;
		});

		const chartConfig: ChartConfig = {
			ourPrice: {
				label: "Our Price",
				color: "hsl(var(--primary))",
			},
			competitorPrice: {
				label: competitorName || "Market Average",
				color: "hsl(var(--muted-foreground))",
			},
		};

		return { chartData, chartConfig };
	}, [data, competitorName]);

	if (chartData.length === 0) {
		return null;
	}

	return (
		<Card className="shadow-sm">
			<CardHeader className="pb-4">
				<CardTitle className="text-lg font-bold">Market Position</CardTitle>
				<CardDescription>
					{competitorName
						? `Direct comparison: Our Price vs ${competitorName}`
						: "Our Price compared to aggregated competitor market average"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="h-[350px] w-full">
					<LineChart
						data={chartData}
						margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
					>
						<CartesianGrid strokeDasharray="3 3" vertical={false} />
						<XAxis
							dataKey="date"
							axisLine={false}
							tickLine={false}
							tickMargin={10}
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tickMargin={10}
							tickFormatter={(value) => `₱${value}`}
						/>
						<ChartTooltip
							cursor={{
								stroke: "hsl(var(--muted-foreground))",
								strokeWidth: 1,
								strokeDasharray: "3 3",
							}}
							content={<ChartTooltipContent indicator="line" />}
						/>
						<ChartLegend content={<ChartLegendContent />} className="flex-wrap mt-4" />
						
						{/* Competitor / Market Average Line (Secondary) */}
						<Line
							type="monotone"
							dataKey="competitorPrice"
							stroke="var(--color-competitorPrice)"
							strokeWidth={2}
							strokeDasharray="5 5"
							dot={{ r: 3, strokeWidth: 1 }}
							activeDot={{ r: 5 }}
							connectNulls
						/>

						{/* Our Price Line (Primary - rendered last so it's on top z-index) */}
						<Line
							type="monotone"
							dataKey="ourPrice"
							stroke="var(--color-ourPrice)"
							strokeWidth={3}
							dot={{ r: 4, strokeWidth: 2 }}
							activeDot={{ r: 6 }}
							connectNulls
						/>
					</LineChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
