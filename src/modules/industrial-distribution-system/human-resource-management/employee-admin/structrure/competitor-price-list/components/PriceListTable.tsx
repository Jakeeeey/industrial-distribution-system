"use client";

import React from "react";
import {
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
	type ExpandedState,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronRight as ChevronExpand,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { CompetitorPriceEntry } from "../types";
import { priceListColumns } from "./columns";
import { formatPeso, formatEntryDate, resolveCompetitorName } from "../utils/analytics";

interface PriceListTableProps {
	data: CompetitorPriceEntry[];
	isLoading?: boolean;
}

// ─── Row Detail Panel ─────────────────────────────────────────────────────────

function RowDetailPanel({ entry }: { entry: CompetitorPriceEntry }) {
	const competitorName = resolveCompetitorName(entry);

	return (
		<div className="bg-muted/30 border-t px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Competitor</p>
				<p className="text-sm font-semibold">{competitorName}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Product</p>
				<p className="text-sm font-semibold">{entry.product_name || `Product #${entry.product_id}`}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Price</p>
				<p className="text-sm font-bold text-primary">{formatPeso(entry.price)}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Size</p>
				<p className="text-sm font-semibold">{entry.size || "—"}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Province</p>
				<p className="text-sm font-semibold">{entry.province || "—"}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Municipality</p>
				<p className="text-sm font-semibold">{entry.municipality || "—"}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Barangay</p>
				<p className="text-sm font-semibold">{entry.barangay || "—"}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Source Type</p>
				<p className="text-sm font-semibold">{entry.source_type}</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">vs Our Price</p>
				{entry.price_vs_us ? (
					<Badge
						variant="outline"
						className={cn(
							"text-xs font-bold px-2 py-0.5 rounded-full border",
							entry.price_vs_us === "higher" &&
							"bg-rose-500/10 text-rose-600 border-rose-200",
							entry.price_vs_us === "match" &&
							"bg-slate-500/10 text-slate-600 border-slate-200",
							entry.price_vs_us === "lower" &&
							"bg-emerald-500/10 text-emerald-600 border-emerald-200"
						)}
					>
						{entry.price_vs_us === "higher"
							? "↑ Higher"
							: entry.price_vs_us === "lower"
								? "↓ Lower"
								: "= Match"}
					</Badge>
				) : (
					<span className="text-sm text-muted-foreground">—</span>
				)}
			</div>
			<div>
				<p className="text-xs text-muted-foreground mb-0.5">Captured On</p>
				<p className="text-sm font-semibold">{formatEntryDate(entry.created_at)}</p>
			</div>
		</div>
	);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="rounded-md border shadow-sm">
				<div className="h-10 bg-muted/60 rounded-t-md animate-pulse border-b" />
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						key={i}
						className="h-12 bg-muted/30 animate-pulse border-b last:border-0"
						style={{ animationDelay: `${i * 50}ms` }}
					/>
				))}
			</div>
		</div>
	);
}

// ─── Table Component ──────────────────────────────────────────────────────────

export function PriceListTable({ data, isLoading = false }: PriceListTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "created_at", desc: true },
	]);
	const [expanded, setExpanded] = React.useState<ExpandedState>({});

	// Prepend expand toggle column
	const columnsWithExpand = React.useMemo(
		() => [
			{
				id: "expander",
				header: "",
				cell: ({ row }: { row: { getIsExpanded: () => boolean; toggleExpanded: () => void; original: CompetitorPriceEntry } }) => (
					<button
						onClick={(e) => {
							e.stopPropagation();
							row.toggleExpanded();
						}}
						className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors"
						aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
					>
						<ChevronExpand
							className={cn(
								"h-3.5 w-3.5 text-muted-foreground transition-transform",
								row.getIsExpanded() && "rotate-90"
							)}
						/>
					</button>
				),
				enableSorting: false,
				size: 40,
			},
			...priceListColumns,
		],
		[]
	);

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data,
		columns: columnsWithExpand,
		state: { sorting, expanded },
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getRowCanExpand: () => true,
		initialState: { pagination: { pageSize: 20 } },
	});

	if (isLoading) return <TableSkeleton />;

	return (
		<div className="space-y-3">
			{/* Table */}
			<div className="rounded-md border shadow-sm overflow-hidden">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className="h-10 text-xs font-bold uppercase tracking-wide">
										{header.isPlaceholder
											? null
											: flexRender(
												header.column.columnDef.header,
												header.getContext()
											)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row) => (
								<React.Fragment key={row.id}>
									<TableRow
										className={cn(
											"cursor-pointer transition-colors hover:bg-muted/40",
											row.getIsExpanded() && "bg-muted/20"
										)}
										onClick={() => row.toggleExpanded()}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="py-2.5 text-sm">
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext()
												)}
											</TableCell>
										))}
									</TableRow>
									{row.getIsExpanded() && (
										<TableRow className="hover:bg-transparent">
											<TableCell
												colSpan={columnsWithExpand.length}
												className="p-0"
											>
												<RowDetailPanel entry={row.original} />
											</TableCell>
										</TableRow>
									)}
								</React.Fragment>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columnsWithExpand.length}
									className="h-32 text-center text-muted-foreground"
								>
									No price entries match the current filters.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between px-1">
				<div className="flex-1 text-sm text-muted-foreground">
					Showing{" "}
					<span className="font-semibold text-foreground">
						{table.getRowModel().rows.length}
					</span>{" "}
					of{" "}
					<span className="font-semibold text-foreground">
						{table.getFilteredRowModel().rows.length}
					</span>{" "}
					entries
				</div>

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium">Rows</p>
						<Select
							value={`${table.getState().pagination.pageSize}`}
							onValueChange={(v) => table.setPageSize(Number(v))}
						>
							<SelectTrigger className="h-8 w-20 rounded-md">
								<SelectValue />
							</SelectTrigger>
							<SelectContent side="top">
								{[10, 20, 30, 50, 100].map((s) => (
									<SelectItem key={s} value={`${s}`}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>



					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							className="h-8 w-8 p-0 rounded-md hidden lg:flex"
							onClick={() => table.setPageIndex(0)}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronsLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0 rounded-md"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<div className="text-sm font-medium text-muted-foreground">
							{table.getState().pagination.pageIndex + 1} /{" "}
							{table.getPageCount() || 1}
						</div>
						<Button
							variant="outline"
							className="h-8 w-8 p-0 rounded-md"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0 rounded-md hidden lg:flex"
							onClick={() => table.setPageIndex(table.getPageCount() - 1)}
							disabled={!table.getCanNextPage()}
						>
							<ChevronsRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
