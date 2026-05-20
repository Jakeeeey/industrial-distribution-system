"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  CustomerWithRelations,
  CustomersAPIResponse,
  ReferenceItem,
} from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CustomerRow } from "./CustomerRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// 🚀 NEW: Reusable Filter Combobox for Store Type & Classifications
function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedItem =
    value === "all" ? null : options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 rounded-xl shadow-sm border-border/60 w-50 justify-between font-bold text-xs uppercase tracking-widest bg-background"
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-62.5 p-0 shadow-lg rounded-xl border-border/60"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={`Search ${placeholder}...`}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-62.5 overflow-y-auto custom-scrollbar">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              No matches found.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
                className="text-xs font-bold uppercase text-muted-foreground cursor-pointer"
              >
                All {placeholder}s
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-primary",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CustomerTableProps {
  data: CustomerWithRelations[];
  isLoading: boolean;
  metadata: CustomersAPIResponse["metadata"];
  page: number;
  pageSize: number;
  searchQuery: string;
  statusFilter: string;
  storeTypeFilter?: string;
  classificationFilter?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: string) => void;
  onStoreTypeChange?: (status: string) => void;
  onClassificationChange?: (status: string) => void;
  onEdit: (customer: CustomerWithRelations) => void;
  onChangeStatus?: (customer: CustomerWithRelations, status: string) => void;
}

export function CustomerTable({
  data,
  isLoading,
  metadata,
  page,
  pageSize,
  searchQuery: parentSearchQuery,
  statusFilter,
  storeTypeFilter = "all",
  classificationFilter = "all",
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onStatusChange,
  onStoreTypeChange,
  onClassificationChange,
  onEdit,
  onChangeStatus,
}: CustomerTableProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(parentSearchQuery);

  const [storeTypeOptions, setStoreTypeOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [classificationOptions, setClassificationOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [storeRes, classRes] = await Promise.all([
          fetch("/api/ids/crm/customer/references?type=store_type"),
          fetch("/api/ids/crm/customer/references?type=classification"),
        ]);

        if (storeRes.ok) {
          const json = await storeRes.json();
          setStoreTypeOptions(
            json.data?.map((i: ReferenceItem) => ({
              id: String(i.id),
              name: i.store_type,
            })) || [],
          );
        }

        if (classRes.ok) {
          const json = await classRes.json();
          // Dev debug: log returned classification reference data to detect mapping issues
          console.debug(
            "[CustomerTable] fetched classification reference data:",
            json?.data,
          );
          setClassificationOptions(
            json.data?.map((i: ReferenceItem) => ({
              id: String(i.id),
              name: i.classification_name,
            })) || [],
          );
        }
      } catch (err) {
        console.error("Failed to fetch filter options", err);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearchQuery !== parentSearchQuery) {
        onSearchChange(localSearchQuery);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localSearchQuery, onSearchChange, parentSearchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setLocalSearchQuery(parentSearchQuery), 0);
    return () => clearTimeout(t);
  }, [parentSearchQuery]);

  const isFiltered =
    statusFilter !== "all" ||
    storeTypeFilter !== "all" ||
    classificationFilter !== "all" ||
    parentSearchQuery !== "";

  const resetFilters = () => {
    setLocalSearchQuery("");
    onSearchChange("");
    onStatusChange("all");
    if (onStoreTypeChange) onStoreTypeChange("all");
    if (onClassificationChange) onClassificationChange("all");
  };

  const totalPages =
    Math.ceil((metadata.filter_count ?? metadata.total_count) / pageSize) || 1;

  const classificationMap = useMemo(() => {
    return new Map(classificationOptions.map((opt) => [opt.id, opt.name]));
  }, [classificationOptions]);

  useEffect(() => {
    // Dev debug: show classification map to help diagnose mismatches between
    // customer.classification values and the fetched reference options.
    try {
      console.debug(
        "[CustomerTable] classificationOptions",
        classificationOptions,
        "classificationMap",
        Array.from(classificationMap.entries()),
      );
    } catch {
      /* ignore */
    }
  }, [classificationOptions, classificationMap]);

  useEffect(() => {
    if (
      page > totalPages &&
      totalPages > 0 &&
      !isLoading &&
      data.length === 0
    ) {
      onPageChange(totalPages);
    }
  }, [page, totalPages, isLoading, data.length, onPageChange]);

  return (
    <div className="space-y-4 animate-in fade-in duration-1000 delay-100 fill-mode-both">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="relative w-full xl:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search retail customers, outlets, or transactions..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-background shadow-sm border-border/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* 🚀 FIXED: Searchable Combo Box for Store Type */}
          <FilterCombobox
            value={storeTypeFilter}
            onChange={(val) => onStoreTypeChange && onStoreTypeChange(val)}
            options={storeTypeOptions}
            placeholder="Store Type"
            disabled={isLoadingFilters}
          />

          {/* 🚀 FIXED: Searchable Combo Box for Classification */}
          <FilterCombobox
            value={classificationFilter}
            onChange={(val) =>
              onClassificationChange && onClassificationChange(val)
            }
            options={classificationOptions}
            placeholder="Classification"
            disabled={isLoadingFilters}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-11 rounded-xl shadow-sm font-bold text-xs uppercase tracking-widest border-border/60 bg-background"
              >
                <Filter className="mr-2 h-4 w-4" /> Status
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="ml-2 px-1 h-4">
                    1
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={onStatusChange}
              >
                <DropdownMenuRadioItem value="all">
                  All Status
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Active">
                  Active
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Suspended">
                  Suspended
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Archive">
                  Archive
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Draft">
                  Draft
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              {isFiltered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={resetFilters}
                    className="text-destructive font-bold"
                  >
                    <X className="mr-2 h-4 w-4" /> Clear All
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />
        </div>
      </div>

      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-70 h-10 px-4 text-xs font-semibold">
                Name / ID
              </TableHead>
              <TableHead className="w-40 h-10 px-4 text-xs font-semibold">
                Customer Tier
              </TableHead>
              <TableHead className="w-35 h-10 px-4 text-xs font-semibold">
                Profile Status
              </TableHead>
              <TableHead className="w-40 h-10 px-4 text-xs font-semibold">
                Contact
              </TableHead>
              <TableHead className="w-55 h-10 px-4 text-xs font-semibold">
                Address
              </TableHead>
              <TableHead className="w-35 h-10 px-4 text-xs font-semibold">
                Active Deposits
              </TableHead>
              <TableHead className="w-17.5 h-10 px-4 text-right text-xs font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-36 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-3 w-24 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-3 w-28" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <span className="text-sm font-medium">
                      No customers found.
                    </span>
                    <span className="text-xs">
                      Adjust your search or filters.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((customer) => {
                const label =
                  classificationMap.get(String(customer.classification)) ||
                  "Unclassified";
                // Dev debug: log per-customer classification resolution
                console.debug(
                  `[CustomerTable] customer=${customer.id} classification=${String(
                    customer.classification,
                  )} -> label=${label}`,
                );
                return (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    classificationLabel={label}
                    activeDepositsLabel={customer.otherDetails || ""}
                    onEdit={onEdit}
                    onChangeStatus={onChangeStatus}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
        <div className="text-sm text-muted-foreground">
          {metadata.filter_count !== metadata.total_count ? (
            <span>
              Showing {data.length} of {metadata.filter_count} filtered results
              (Total: {metadata.total_count})
            </span>
          ) : (
            <span>Total {metadata.total_count} records</span>
          )}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-17.5">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-25 items-center justify-center text-sm font-medium">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
