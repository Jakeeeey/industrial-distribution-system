import React from "react";
import { X, Search, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MissingStatusFilter, BalanceStatusFilter } from "../hooks/useRetailTradeOutletOperation";

interface FiltersProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  missingStatusFilter: MissingStatusFilter;
  setMissingStatusFilter: (v: MissingStatusFilter) => void;
  balanceStatusFilter: BalanceStatusFilter;
  setBalanceStatusFilter: (v: BalanceStatusFilter) => void;
  resetFilters: () => void;
  isFiltered: boolean;
  totalCount: number;
  filteredCount: number;
}

function FilterButton({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        className="h-11 rounded-xl shadow-sm font-bold text-xs uppercase tracking-widest border-border/60 bg-background"
      >
        <ChevronsUpDown className="mr-2 h-4 w-4 opacity-50" />
        {label}
        {active && (
          <Badge variant="secondary" className="ml-2 px-1 h-4">
            1
          </Badge>
        )}
      </Button>
    </DropdownMenuTrigger>
  );
}

export function Filters({
  searchQuery,
  setSearchQuery,
  missingStatusFilter,
  setMissingStatusFilter,
  balanceStatusFilter,
  setBalanceStatusFilter,
  resetFilters,
  isFiltered,
  totalCount,
  filteredCount,
}: FiltersProps) {
  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 w-full">
      {/* Search */}
      <div className="relative w-full flex items-center xl:max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-dealers"
            placeholder="Search dealers, personnel, or barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-background shadow-sm border-border/60"
          />
        </div>
        <div className="px-4 shrink-0">
          <div className="text-sm text-muted-foreground">
            {isFiltered
              ? `Showing ${filteredCount} of ${totalCount} filtered results`
              : `Total ${totalCount} dealer${totalCount !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
        {/* Missing Status filter */}
        <DropdownMenu>
          <FilterButton
            label="Missing Status"
            active={missingStatusFilter !== "all"}
          />
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuRadioGroup
              value={missingStatusFilter}
              onValueChange={(v) =>
                setMissingStatusFilter(v as MissingStatusFilter)
              }
            >
              <DropdownMenuRadioItem value="all">
                All Status
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="normal">
                Normal
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="warning">
                Warning
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="critical">
                Critical
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

        {/* Balance Status filter */}
        <DropdownMenu>
          <FilterButton
            label="Balance"
            active={balanceStatusFilter !== "all"}
          />
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuRadioGroup
              value={balanceStatusFilter}
              onValueChange={(v) =>
                setBalanceStatusFilter(v as BalanceStatusFilter)
              }
            >
              <DropdownMenuRadioItem value="all">
                All Balances
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="paid">
                Paid (₱0)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="low">
                Low (&lt;₱60k)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high">
                High (≥₱60k)
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

        {/* Clear filters shortcut */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-11 rounded-xl text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="mr-1 h-3 w-3" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}