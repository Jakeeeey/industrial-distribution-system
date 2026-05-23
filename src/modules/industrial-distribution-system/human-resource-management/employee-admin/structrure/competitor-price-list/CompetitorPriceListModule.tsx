"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { CompetitorPriceListFetchProvider } from "./providers/fetchproviders";
import { useCompetitorPriceList } from "./hooks/useCompetitorPriceList";
import { PriceListFilters } from "./components/PriceListFilters";
import { PriceListTable } from "./components/PriceListTable";
import { MarketSnapshotPanel } from "./components/MarketSnapshotPanel";
import { PriceTrendChart } from "./components/PriceTrendChart";

// src/app/api/ids/hrm/employee-admin/structure/competitor
// src/app/api/ids/hrm/employee-admin/structure/competitor-price-list

// ─── Inner Content (inside provider) ─────────────────────────────────────────

function CompetitorPriceListContent() {
	const {
		competitors,
		isLoading,
		isError,
		error,
		refetch,
		filters,
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
	} = useCompetitorPriceList();

	const selectedCompetitorName = React.useMemo(() => {
		if (!filters.competitorId) return undefined;
		return competitors.find((c) => String(c.id) === filters.competitorId)?.name;
	}, [filters.competitorId, competitors]);

	if (isError) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription className="flex items-center justify-between">
					<span>
						Failed to load competitor price data:{" "}
						{error?.message || "Unknown error"}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						className="ml-4 shrink-0"
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-5">
			{/* ─── Header ───────────────────────────────────────────────────── */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Competitor Price Intelligence
					</h1>
					<p className="text-muted-foreground mt-0.5">
						Market pricing data by competitor, location, and source type.
					</p>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isLoading}
				>
					<RefreshCw
						className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			{/* ─── Main Layout: Table + Analytics ──────────────────────────── */}
			<div className="flex gap-5 items-start">
				{/* Left: Filters + Table */}
				<div className="flex-1 min-w-0 space-y-4">
					<PriceListFilters
						filters={filters}
						setFilter={setFilter}
						resetFilters={resetFilters}
						hasActiveFilters={hasActiveFilters}
						competitors={competitors}
						provinces={provinces}
						municipalities={municipalities}
						barangays={barangays}
					/>

					<PriceTrendChart
						data={filteredEntries}
						competitorName={selectedCompetitorName}
					/>

					<PriceListTable data={filteredEntries} isLoading={isLoading} />
				</div>

				{/* Right: Analytics Panel */}
				<div className="w-72 shrink-0">
					<MarketSnapshotPanel
						snapshot={marketSnapshot}
						provinceStats={provinceStats}
						sourceStats={sourceStats}
					/>
				</div>
			</div>
		</div>
	);
}

// ─── Module Root (with Provider) ─────────────────────────────────────────────

export default function CompetitorPriceListModule() {
	return (
		<CompetitorPriceListFetchProvider>
			<CompetitorPriceListContent />
		</CompetitorPriceListFetchProvider>
	);
}