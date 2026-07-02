"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import type {
	CompetitorRef,
	LocationOption,
	PriceListFilters,
	ProductRef,
} from "../types";
import { SearchableSelect } from "./SearchableSelect";

interface PriceListFiltersProps {
	filters: PriceListFilters;
	activeProductId: string;
	setFilter: <K extends keyof PriceListFilters>(key: K, value: PriceListFilters[K]) => void;
	resetFilters: () => void;
	applyFilters: () => void;
	hasActiveFilters: boolean;
	competitors: CompetitorRef[];
	products: ProductRef[];
	provinces: LocationOption[];
	municipalities: LocationOption[];
	barangays: LocationOption[];
}

const SOURCE_TYPES = ["Household", "Sari-Sari", "Eatery"] as const;

export function PriceListFilters({
	filters,
	activeProductId,
	setFilter,
	resetFilters,
	applyFilters,
	hasActiveFilters,
	competitors,
	products,
	provinces,
	municipalities,
	barangays,
}: PriceListFiltersProps) {
	const dateFromVal = filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : "";
	const dateToVal = filters.dateTo ? format(filters.dateTo, "yyyy-MM-dd") : "";

	const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		if (!val) {
			setFilter("dateFrom", undefined);
			return;
		}
		const [year, month, day] = val.split("-").map(Number);
		setFilter("dateFrom", new Date(year, month - 1, day));
	};

	const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		if (!val) {
			setFilter("dateTo", undefined);
			return;
		}
		const [year, month, day] = val.split("-").map(Number);
		setFilter("dateTo", new Date(year, month - 1, day));
	};

	return (
		<Card className="border shadow-sm">
			<CardContent className="pt-4 pb-4 space-y-4">
				{/* Row 1: Search + Date Range + Actions */}
				<div className="flex flex-wrap items-end gap-3">
					{/* Search */}
					<div className="flex-1 min-w-[220px] flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Search
						</label>
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search competitor, location, product..."
								value={filters.search}
								onChange={(e) => setFilter("search", e.target.value)}
								className="pl-8 h-9"
							/>
						</div>
					</div>

					{/* Date From */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Date From
						</label>
						<Input
							type="date"
							className="h-9 w-40 text-sm shadow-sm px-2 bg-background border-input"
							value={dateFromVal}
							onChange={handleDateFromChange}
						/>
					</div>

					{/* Date To */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Date To
						</label>
						<Input
							type="date"
							className="h-9 w-40 text-sm shadow-sm px-2 bg-background border-input"
							value={dateToVal}
							onChange={handleDateToChange}
						/>
					</div>

					{/* Reset & Apply Actions */}
					<div className="flex items-center gap-2 h-9 pb-[1px]">
						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								onClick={resetFilters}
								className="h-9 px-3 text-muted-foreground hover:text-foreground"
							>
								<X className="mr-1.5 h-3.5 w-3.5" />
								Reset
							</Button>
						)}
						<Button
							variant="default"
							size="sm"
							onClick={applyFilters}
							className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
						>
							Apply
						</Button>
					</div>
				</div>

				{/* Row 2: Product + Competitors + Sources */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					{/* Product */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Product
						</label>
						<SearchableSelect
							placeholder="Select Product"
							value={activeProductId || "all"}
							onValueChange={(v) => setFilter("productId", v === "all" ? "" : v)}
							options={[
								{ value: "all", label: "All Products" },
								...products.map((p) => ({ value: p.product_name, label: p.product_name })),
							]}
						/>
					</div>

					{/* Competitor */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Competitor
						</label>
						<SearchableSelect
							placeholder="All Competitors"
							value={filters.competitorId || "all"}
							onValueChange={(v) => setFilter("competitorId", v === "all" ? "" : v)}
							options={[
								{ value: "all", label: "All Competitors" },
								...competitors.map((c) => ({ value: String(c.id), label: c.name })),
							]}
						/>
					</div>

					{/* Source Type */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Source Type
						</label>
						<SearchableSelect
							placeholder="All Sources"
							value={filters.sourceType || "all"}
							onValueChange={(v) => setFilter("sourceType", v === "all" ? "" : v)}
							options={[
								{ value: "all", label: "All Sources" },
								...SOURCE_TYPES.map((s) => ({ value: s, label: s })),
							]}
						/>
					</div>
				</div>

				{/* Row 3: Address Cascade (Province, Municipality, Barangay) */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					{/* Province */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Province
						</label>
						<SearchableSelect
							placeholder="All Provinces"
							value={filters.province || "all"}
							onValueChange={(v) => setFilter("province", v === "all" ? "" : v)}
							options={provinces.map((p) => ({
								value: p.value || "all",
								label: p.label,
							}))}
						/>
					</div>

					{/* Municipality */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Municipality
						</label>
						<SearchableSelect
							placeholder={filters.province ? "All Municipalities" : "Select province first"}
							value={filters.municipality || "all"}
							onValueChange={(v) => setFilter("municipality", v === "all" ? "" : v)}
							disabled={!filters.province}
							options={municipalities.map((m) => ({
								value: m.value || "all",
								label: m.label,
							}))}
						/>
					</div>

					{/* Barangay */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted-foreground px-0.5">
							Barangay
						</label>
						<SearchableSelect
							placeholder={filters.municipality ? "All Barangays" : "Select municipality first"}
							value={filters.barangay || "all"}
							onValueChange={(v) => setFilter("barangay", v === "all" ? "" : v)}
							disabled={!filters.municipality}
							options={barangays.map((b) => ({
								value: b.value || "all",
								label: b.label,
							}))}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

