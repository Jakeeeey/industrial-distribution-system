"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CompetitorPriceEntry } from "../types";
import { formatPeso, formatEntryDate, resolveCompetitorName } from "../utils/analytics";
import { cn } from "@/lib/utils";

// ─── Sortable Header ──────────────────────────────────────────────────────────

function SortableHeader({
	column,
	label,
}: {
	column: Column<CompetitorPriceEntry, unknown>;
	label: string;
}) {
	const direction = column.getIsSorted();
	return (
		<Button
			variant="ghost"
			size="sm"
			className="-ml-2 h-8 px-2 font-bold"
			onClick={() => column.toggleSorting(direction === "asc")}
		>
			{label}
			<ArrowUpDown
				className={cn("ml-2 h-3.5 w-3.5", direction ? "opacity-100" : "opacity-40")}
			/>
		</Button>
	);
}

// ─── Price vs Us Badge ────────────────────────────────────────────────────────

function PriceVsBadge({ value }: { value: "higher" | "match" | "lower" | null }) {
	if (!value) return <span className="text-muted-foreground text-xs">—</span>;

	const config = {
		higher: {
			label: "↑ Higher",
			className: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800 dark:text-rose-400",
		},
		match: {
			label: "= Match",
			className: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-700 dark:text-slate-400",
		},
		lower: {
			label: "↓ Lower",
			className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
		},
	} as const;

	const c = config[value];
	return (
		<Badge
			variant="outline"
			className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full border", c.className)}
		>
			{c.label}
		</Badge>
	);
}

// ─── Source Type Badge ────────────────────────────────────────────────────────

function SourceBadge({ value }: { value: string }) {
	const config: Record<string, string> = {
		Household: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400",
		"Sari-Sari": "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400",
		Eatery: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800 dark:text-purple-400",
	};
	return (
		<Badge
			variant="outline"
			className={cn(
				"text-xs font-semibold px-2 py-0.5 rounded-full border",
				config[value] ??
					"bg-muted text-muted-foreground border-muted-foreground/20"
			)}
		>
			{value}
		</Badge>
	);
}

// ─── Column Definitions ───────────────────────────────────────────────────────

export const priceListColumns: ColumnDef<CompetitorPriceEntry>[] = [
	{
		id: "no",
		accessorKey: "id",
		header: "#",
		cell: ({ row }) => (
			<span className="text-muted-foreground text-xs font-mono">{row.index + 1}</span>
		),
		enableSorting: false,
	},
	{
		accessorKey: "competitor_id",
		id: "competitor",
		header: ({ column }) => <SortableHeader column={column} label="Competitor" />,
		cell: ({ row }) => (
			<span className="font-medium">{resolveCompetitorName(row.original)}</span>
		),
		sortingFn: (a, b) =>
			resolveCompetitorName(a.original).localeCompare(
				resolveCompetitorName(b.original)
			),
	},
	{
		accessorKey: "product_id",
		header: ({ column }) => <SortableHeader column={column} label="Product" />,
		cell: ({ row }) => (
			<span className="font-semibold text-sm">
				{row.original.product_name || `Product #${row.original.product_id}`}
			</span>
		),
	},
	{
		accessorKey: "province",
		header: ({ column }) => <SortableHeader column={column} label="Province" />,
		cell: ({ row }) => row.original.province || <span className="text-muted-foreground">—</span>,
	},
	{
		accessorKey: "municipality",
		header: ({ column }) => <SortableHeader column={column} label="Municipality" />,
		cell: ({ row }) =>
			row.original.municipality || <span className="text-muted-foreground">—</span>,
	},
	{
		accessorKey: "barangay",
		header: ({ column }) => <SortableHeader column={column} label="Barangay" />,
		cell: ({ row }) =>
			row.original.barangay || <span className="text-muted-foreground">—</span>,
	},
	{
		accessorKey: "source_type",
		header: ({ column }) => <SortableHeader column={column} label="Source" />,
		cell: ({ row }) => <SourceBadge value={row.original.source_type} />,
	},
	{
		accessorKey: "size",
		header: "Size",
		cell: ({ row }) =>
			row.original.size || <span className="text-muted-foreground">—</span>,
	},
	{
		accessorKey: "price",
		header: ({ column }) => <SortableHeader column={column} label="Price" />,
		cell: ({ row }) => (
			<span className="font-bold tabular-nums">{formatPeso(row.original.price)}</span>
		),
	},
	{
		accessorKey: "price_vs_us",
		header: "vs Us",
		cell: ({ row }) => <PriceVsBadge value={row.original.price_vs_us} />,
		enableSorting: false,
	},
	{
		accessorKey: "created_at",
		header: ({ column }) => <SortableHeader column={column} label="Date" />,
		cell: ({ row }) => (
			<span className="text-xs text-muted-foreground">
				{formatEntryDate(row.original.created_at)}
			</span>
		),
	},
];
