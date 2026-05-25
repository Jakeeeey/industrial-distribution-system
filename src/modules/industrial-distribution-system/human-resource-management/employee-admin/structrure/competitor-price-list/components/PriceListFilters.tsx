"use client";

import React from "react";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type {
	CompetitorRef,
	LocationOption,
	PriceListFilters,
	ProductRef,
} from "../types";

interface PriceListFiltersProps {
	filters: PriceListFilters;
	activeProductId: string;
	setFilter: <K extends keyof PriceListFilters>(key: K, value: PriceListFilters[K]) => void;
	resetFilters: () => void;
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
	hasActiveFilters,
	competitors,
	products,
	provinces,
	municipalities,
	barangays,
}: PriceListFiltersProps) {
	return (
		<Card className="border shadow-sm">
			<CardContent className="pt-4 pb-4 space-y-4">
				{/* Row 1: Search + Date Range*/}
				<div className="flex flex-wrap items-center gap-2">
					{/* Search */}
					<div className="relative flex-1 min-w-[220px]">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search competitor, location, product..."
							value={filters.search}
							onChange={(e) => setFilter("search", e.target.value)}
							className="pl-8 h-9"
						/>
					</div>

					{/* Date From */}
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={cn(
									"h-9 w-36 justify-start text-left font-normal",
									!filters.dateFrom && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="mr-2 h-3.5 w-3.5" />
								{filters.dateFrom
									? format(filters.dateFrom, "MMM dd, yyyy")
									: "From date"}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={filters.dateFrom}
								onSelect={(d) => setFilter("dateFrom", d ?? undefined)}
								initialFocus
							/>
						</PopoverContent>
					</Popover>

					{/* Date To */}
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={cn(
									"h-9 w-36 justify-start text-left font-normal",
									!filters.dateTo && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="mr-2 h-3.5 w-3.5" />
								{filters.dateTo
									? format(filters.dateTo, "MMM dd, yyyy")
									: "To date"}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={filters.dateTo}
								onSelect={(d) => setFilter("dateTo", d ?? undefined)}
								initialFocus
							/>
						</PopoverContent>
					</Popover>

					{/* Reset */}
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
				</div>

				{/* Row 2: Product + Competitors + Sources */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
					{/* Product */}
					<Select
						value={activeProductId || "all"}
						onValueChange={(v) => setFilter("productId", v === "all" ? "" : v)}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue placeholder="Select Product" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Products</SelectItem>
							{products.map((p) => (
								<SelectItem key={p.product_name} value={p.product_name}>
									{p.product_name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Competitor */}
					<Select
						value={filters.competitorId || "all"}
						onValueChange={(v) => setFilter("competitorId", v === "all" ? "" : v)}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue placeholder="All Competitors" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Competitors</SelectItem>
							{competitors.map((c) => (
								<SelectItem key={c.id} value={String(c.id)}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Source Type */}
					<Select
						value={filters.sourceType || "all"}
						onValueChange={(v) => setFilter("sourceType", v === "all" ? "" : v)}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue placeholder="All Sources" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Sources</SelectItem>
							{SOURCE_TYPES.map((s) => (
								<SelectItem key={s} value={s}>
									{s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Row 3: Address Cascade (Province, Municipality, Barangay) */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
					{/* Province */}
					<Select
						value={filters.province || "all"}
						onValueChange={(v) => setFilter("province", v === "all" ? "" : v)}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue placeholder="All Provinces" />
						</SelectTrigger>
						<SelectContent>
							{provinces.map((p) => (
								<SelectItem key={p.value || "__all"} value={p.value || "all"}>
									{p.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Municipality */}
					<Select
						value={filters.municipality || "all"}
						onValueChange={(v) => setFilter("municipality", v === "all" ? "" : v)}
						disabled={!filters.province}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue
								placeholder={
									filters.province ? "All Municipalities" : "Select province first"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{municipalities.map((m) => (
								<SelectItem key={m.value || "__all"} value={m.value || "all"}>
									{m.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Barangay */}
					<Select
						value={filters.barangay || "all"}
						onValueChange={(v) => setFilter("barangay", v === "all" ? "" : v)}
						disabled={!filters.municipality}
					>
						<SelectTrigger className="h-9 w-full">
							<SelectValue
								placeholder={
									filters.municipality ? "All Barangays" : "Select municipality first"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{barangays.map((b) => (
								<SelectItem key={b.value || "__all"} value={b.value || "all"}>
									{b.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	);
}
