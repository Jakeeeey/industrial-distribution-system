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
	List,
	Package,
	Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { CompetitorPriceEntry } from "../types";
import { priceListColumns } from "./columns";
import { formatPeso, formatEntryDate, resolveCompetitorName } from "../utils/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupMode = "raw" | "product" | "competitor";

interface PriceListTableProps {
	data: CompetitorPriceEntry[];
	isLoading?: boolean;
	onRowClick?: (competitorId: string, productName: string, groupMode?: GroupMode) => void;
}

interface GroupRow {
	key: string;
	label: string;
	entries: CompetitorPriceEntry[];
	competitorId: string;
	productName: string;
}

// ─── Price Badge ──────────────────────────────────────────────────────────────

function PriceVsBadge({ value }: { value: string | null }) {
	if (!value) return <span className="text-muted-foreground text-xs">—</span>;
	return (
		<Badge
			variant="outline"
			className={cn(
				"text-[10px] font-bold px-1.5 py-0 rounded-full border",
				value === "higher" && "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800",
				value === "match" && "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-700",
				value === "lower" && "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800"
			)}
		>
			{value === "higher" ? "↑ Higher" : value === "lower" ? "↓ Lower" : "= Match"}
		</Badge>
	);
}

// ─── Row Detail Panel (raw mode) ──────────────────────────────────────────────

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
							entry.price_vs_us === "higher" && "bg-rose-500/10 text-rose-600 border-rose-200",
							entry.price_vs_us === "match" && "bg-slate-500/10 text-slate-600 border-slate-200",
							entry.price_vs_us === "lower" && "bg-emerald-500/10 text-emerald-600 border-emerald-200"
						)}
					>
						{entry.price_vs_us === "higher" ? "↑ Higher" : entry.price_vs_us === "lower" ? "↓ Lower" : "= Match"}
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

// ─── Group Mode Toggle ────────────────────────────────────────────────────────

function GroupModeToggle({ mode, onChange }: { mode: GroupMode; onChange: (m: GroupMode) => void }) {
	const modes: { value: GroupMode; label: string; icon: React.ReactNode }[] = [
		{ value: "raw", label: "Rows", icon: <List className="h-3.5 w-3.5" /> },
		{ value: "product", label: "Product", icon: <Package className="h-3.5 w-3.5" /> },
		{ value: "competitor", label: "Competitor", icon: <Building2 className="h-3.5 w-3.5" /> },
	];
	return (
		<div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
			{modes.map((m) => (
				<button
					key={m.value}
					onClick={() => onChange(m.value)}
					className={cn(
						"flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
						mode === m.value
							? "bg-background shadow-sm text-foreground"
							: "text-muted-foreground hover:text-foreground"
					)}
				>
					{m.icon}
					{m.label}
				</button>
			))}
		</div>
	);
}

// ─── Compute Groups ───────────────────────────────────────────────────────────

function computeGroups(data: CompetitorPriceEntry[], mode: "product" | "competitor"): GroupRow[] {
	const map = new Map<string, GroupRow>();

	for (const entry of data) {
		if (mode === "product") {
			const key = entry.product_name || `Product #${entry.product_id}`;
			if (!map.has(key)) {
				map.set(key, {
					key,
					label: key,
					entries: [],
					competitorId: "",
					productName: entry.product_name || key,
				});
			}
			map.get(key)!.entries.push(entry);
		} else {
			const name = resolveCompetitorName(entry);
			const compId =
				typeof entry.competitor_id === "object" && entry.competitor_id !== null
					? String(entry.competitor_id.id)
					: String(entry.competitor_id);
			if (!map.has(name)) {
				map.set(name, {
					key: name,
					label: name,
					entries: [],
					competitorId: compId,
					productName: "",
				});
			}
			map.get(name)!.entries.push(entry);
		}
	}

	return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length);
}

// ─── Grouped Table View ───────────────────────────────────────────────────────

function GroupedTable({
	groups,
	mode,
	onRowClick,
}: {
	groups: GroupRow[];
	mode: "product" | "competitor";
	onRowClick?: (competitorId: string, productName: string, groupMode?: GroupMode) => void;
}) {
	// Accordion: only one group open at a time
	const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
	const [activeKey, setActiveKey] = React.useState<string | null>(null);

	const toggleGroup = (group: GroupRow) => {
		const isExpanded = expandedKey === group.key;

		// Accordion: collapse any open group when a new one is clicked
		setExpandedKey(isExpanded ? null : group.key);

		if (onRowClick) {
			if (isExpanded) {
				// Collapse → clear chart focus
				setActiveKey(null);
				onRowClick("", "", mode);
			} else {
				setActiveKey(group.key);
				if (mode === "competitor") {
					onRowClick(group.competitorId, "", "competitor");
				} else {
					onRowClick("", group.productName, "product");
				}
			}
		}
	};

	const handleSubRowClick = (entry: CompetitorPriceEntry, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!onRowClick) return;
		const compId =
			typeof entry.competitor_id === "object" && entry.competitor_id !== null
				? String(entry.competitor_id.id)
				: String(entry.competitor_id);
		// Pass mode so the parent knows which group context the sub-row belongs to
		onRowClick(compId, entry.product_name || "", mode);
	};

	if (groups.length === 0) {
		return (
			<div className="rounded-md border shadow-sm h-32 flex items-center justify-center text-muted-foreground text-sm">
				No price entries match the current filters.
			</div>
		);
	}

	return (
		<div className="rounded-md border shadow-sm overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="bg-muted/40 hover:bg-muted/40">
						<TableHead className="h-10 w-8" />
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide">
							{mode === "product" ? "Product" : "Competitor"}
						</TableHead>
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide text-right">Entries</TableHead>
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide text-right">Avg Price</TableHead>
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide text-right">Min</TableHead>
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide text-right">Max</TableHead>
						<TableHead className="h-10 text-xs font-bold uppercase tracking-wide text-right">
							{mode === "product" ? "Competitors" : "Products"}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{groups.map((group) => {
						const isExpanded = expandedKey === group.key;
						const isActive = activeKey === group.key;
						const prices = group.entries.map((e) => Number(e.price)).filter(Number.isFinite);
						const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
						const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
						const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
						const uniqueCount =
							mode === "product"
								? new Set(group.entries.map((e) => resolveCompetitorName(e))).size
								: new Set(group.entries.map((e) => e.product_name || String(e.product_id))).size;

						return (
							<React.Fragment key={group.key}>
								{/* ── Group Header Row ── */}
								<TableRow
									className={cn(
										"cursor-pointer transition-colors font-medium",
										isActive
											? "bg-primary/8 border-l-2 border-l-primary"
											: isExpanded
												? "bg-muted/20 border-l-2 border-l-muted-foreground/30"
												: "hover:bg-muted/40"
									)}
									onClick={() => toggleGroup(group)}
								>
									<TableCell className="py-2.5 w-8">
										<ChevronExpand
											className={cn(
												"h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
												isExpanded && "rotate-90"
											)}
										/>
									</TableCell>
									<TableCell className="py-2.5 text-sm font-semibold">
										<span className={cn(isActive && "text-primary")}>{group.label}</span>
									</TableCell>
									<TableCell className="py-2.5 text-sm text-right">
										<Badge variant="secondary" className="text-xs font-bold">
											{group.entries.length}
										</Badge>
									</TableCell>
									<TableCell className="py-2.5 text-sm font-bold text-primary text-right tabular-nums">
										{formatPeso(avgPrice)}
									</TableCell>
									<TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
										{formatPeso(minPrice)}
									</TableCell>
									<TableCell className="py-2.5 text-sm text-rose-600 dark:text-rose-400 text-right tabular-nums">
										{formatPeso(maxPrice)}
									</TableCell>
									<TableCell className="py-2.5 text-sm text-muted-foreground text-right">
										{uniqueCount}
									</TableCell>
								</TableRow>

								{/* ── Expanded Sub-rows ── */}
								{isExpanded &&
									group.entries.map((entry, idx) => {
										const competitorName = resolveCompetitorName(entry);
										return (
											<TableRow
												key={`${group.key}-${entry.id}-${idx}`}
												className="bg-muted/10 hover:bg-muted/30 cursor-pointer border-l-2 border-l-primary/20 animate-in fade-in duration-150"
												onClick={(e) => handleSubRowClick(entry, e)}
											>
												<TableCell className="py-2 w-8">
													<div className="w-3.5 h-3.5 ml-0.5 border-l border-b border-muted-foreground/20 rounded-bl-sm" />
												</TableCell>
												<TableCell className="py-2 text-xs pl-5 text-foreground font-medium">
													{mode === "product"
														? competitorName
														: entry.product_name || `Product #${entry.product_id}`}
												</TableCell>
												<TableCell className="py-2 text-right">
													<PriceVsBadge value={entry.price_vs_us} />
												</TableCell>
												<TableCell className="py-2 text-xs font-bold text-right tabular-nums">
													{formatPeso(entry.price)}
												</TableCell>
												<TableCell className="py-2 text-xs text-muted-foreground text-right">
													{entry.province || "—"}
												</TableCell>
												<TableCell className="py-2 text-xs text-muted-foreground text-right">
													{entry.source_type}
												</TableCell>
												<TableCell className="py-2 text-xs text-muted-foreground text-right">
													{formatEntryDate(entry.created_at)}
												</TableCell>
											</TableRow>
										);
									})}
							</React.Fragment>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

// ─── Raw Table View (TanStack) ────────────────────────────────────────────────

function RawTable({
	data,
	onRowClick,
}: {
	data: CompetitorPriceEntry[];
	onRowClick?: (competitorId: string, productName: string, groupMode?: GroupMode) => void;
}) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: "created_at", desc: true }]);
	const [expanded, setExpanded] = React.useState<ExpandedState>({});

	const columnsWithExpand = React.useMemo(
		() => [
			{
				id: "expander",
				header: "",
				cell: ({
					row,
				}: {
					row: {
						getIsExpanded: () => boolean;
						toggleExpanded: () => void;
						original: CompetitorPriceEntry;
					};
				}) => (
					<button
						onClick={(e) => {
							e.stopPropagation();
							const wasExpanded = row.getIsExpanded();
							row.toggleExpanded();
							if (onRowClick) {
								if (wasExpanded) {
									onRowClick("", "");
								} else {
									const entry = row.original;
									const compId =
										typeof entry.competitor_id === "object" && entry.competitor_id !== null
											? String(entry.competitor_id.id)
											: String(entry.competitor_id);
									onRowClick(compId, entry.product_name || "");
								}
							}
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
		[onRowClick]
	);

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data,
		columns: columnsWithExpand,
		state: { sorting, expanded },
		onSortingChange: setSorting,
		onExpandedChange: (updater) => {
			setExpanded((prev) => {
				const next = (typeof updater === "function" ? updater(prev) : updater) as Record<string, boolean>;
				const prevRecord = prev as Record<string, boolean>;
				const keys = Object.keys(next);
				const activeKeys = keys.filter((k) => next[k]);
				if (activeKeys.length <= 1) return next;
				const newKey = activeKeys.find((k) => !prevRecord[k]);
				return newKey ? { [newKey]: true } : {};
			});
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getRowCanExpand: () => true,
		getRowId: (row) => String(row.id),
		autoResetExpanded: false,
		initialState: { pagination: { pageSize: 20 } },
	});

	return (
		<div className="space-y-3">
			<div className="rounded-md border shadow-sm overflow-hidden">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className="h-10 text-xs font-bold uppercase tracking-wide">
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
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
										onClick={() => {
											const wasExpanded = row.getIsExpanded();
											row.toggleExpanded();
											if (onRowClick) {
												if (wasExpanded) {
													onRowClick("", "");
												} else {
													const entry = row.original;
													const compId =
														typeof entry.competitor_id === "object" && entry.competitor_id !== null
															? String(entry.competitor_id.id)
															: String(entry.competitor_id);
													onRowClick(compId, entry.product_name || "");
												}
											}
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="py-2.5 text-sm">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
									{row.getIsExpanded() && (
										<TableRow className="hover:bg-transparent">
											<TableCell colSpan={columnsWithExpand.length} className="p-0">
												<RowDetailPanel entry={row.original} />
											</TableCell>
										</TableRow>
									)}
								</React.Fragment>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columnsWithExpand.length} className="h-32 text-center text-muted-foreground">
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
					<span className="font-semibold text-foreground">{table.getRowModel().rows.length}</span>{" "}
					of{" "}
					<span className="font-semibold text-foreground">{table.getFilteredRowModel().rows.length}</span>{" "}
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
							{table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function PriceListTable({ data, isLoading = false, onRowClick }: PriceListTableProps) {
	const [groupMode, setGroupMode] = React.useState<GroupMode>("raw");

	const groups = React.useMemo(() => {
		if (groupMode === "raw") return [];
		return computeGroups(data, groupMode);
	}, [data, groupMode]);

	if (isLoading) return <TableSkeleton />;

	return (
		<div className="space-y-3">
			{/* ── Toolbar ── */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground font-medium">Group by</span>
					<GroupModeToggle mode={groupMode} onChange={setGroupMode} />
				</div>
				<span className="text-xs text-muted-foreground tabular-nums">
					{data.length} {data.length === 1 ? "entry" : "entries"}
					{groupMode !== "raw" && ` · ${groups.length} ${groupMode === "product" ? "products" : "competitors"}`}
				</span>
			</div>

			{/* ── Table View ── */}
			{groupMode === "raw" ? (
				<RawTable data={data} onRowClick={onRowClick} />
			) : (
				<GroupedTable
					groups={groups}
					mode={groupMode}
					onRowClick={onRowClick}
				/>
			)}
		</div>
	);
}
