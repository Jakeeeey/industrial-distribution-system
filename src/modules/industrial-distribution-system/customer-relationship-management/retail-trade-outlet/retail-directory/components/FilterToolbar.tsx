import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { ChevronsUpDown } from "lucide-react";

interface FilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  provinceFilter: string;
  setProvinceFilter: (val: string) => void;
  cityFilter: string;
  setCityFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  storeTypeFilter: string;
  setStoreTypeFilter: (val: string) => void;
  classificationFilter: string;
  setClassificationFilter: (val: string) => void;
  provinces: string[];
  cities: string[];
  statuses: string[];
  storeTypes: (string | number)[];
  classifications: (string | number)[];
  classificationsMeta: Record<string, string>;
  storeTypesMeta: Record<string, string>;
  resetFilters: () => void;
  totalFilteredCount: number;
}

function FilterButton({ label, active }: { label: string; active: boolean }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        className="h-10 rounded-xl shadow-sm font-bold text-xs uppercase tracking-widest border-border/60 bg-background"
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

export function FilterToolbar({
  searchQuery,
  setSearchQuery,
  provinceFilter,
  setProvinceFilter,
  cityFilter,
  setCityFilter,
  statusFilter,
  setStatusFilter,
  storeTypeFilter,
  setStoreTypeFilter,
  classificationFilter,
  setClassificationFilter,
  provinces,
  cities,
  statuses,
  storeTypes,
  classifications,
  classificationsMeta,
  storeTypesMeta,
  resetFilters,
  totalFilteredCount,
}: FilterToolbarProps) {
  const isFiltered =
    searchQuery !== "" ||
    provinceFilter !== "all" ||
    cityFilter !== "all" ||
    statusFilter !== "all" ||
    storeTypeFilter !== "all" ||
    classificationFilter !== "all";

  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 w-full">
      <div className="relative w-full flex items-center xl:max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-background shadow-sm border-border/60"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
        <DropdownMenu>
          <FilterButton label="Classification" active={classificationFilter !== "all"} />
          <DropdownMenuContent align="end" className="w-56 rounded-xl max-h-60 overflow-y-auto">
            <DropdownMenuRadioGroup value={classificationFilter} onValueChange={setClassificationFilter}>
              <DropdownMenuRadioItem value="all">All Classifications</DropdownMenuRadioItem>
              {classifications.map((c) => (
                <DropdownMenuRadioItem key={String(c)} value={String(c)}>
                  {classificationsMeta[String(c)] || String(c)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <FilterButton label="Store Type" active={storeTypeFilter !== "all"} />
          <DropdownMenuContent align="end" className="w-56 rounded-xl max-h-60 overflow-y-auto">
            <DropdownMenuRadioGroup value={storeTypeFilter} onValueChange={setStoreTypeFilter}>
              <DropdownMenuRadioItem value="all">All Store Types</DropdownMenuRadioItem>
              {storeTypes.map((st) => (
                <DropdownMenuRadioItem key={String(st)} value={String(st)}>
                  {storeTypesMeta[String(st)] || String(st)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <FilterButton label="Status" active={statusFilter !== "all"} />
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
              {statuses.map((s) => (
                <DropdownMenuRadioItem key={String(s)} value={String(s)}>
                  {String(s)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <FilterButton label="Province" active={provinceFilter !== "all"} />
          <DropdownMenuContent align="end" className="w-56 rounded-xl max-h-60 overflow-y-auto">
            <DropdownMenuRadioGroup value={provinceFilter} onValueChange={setProvinceFilter}>
              <DropdownMenuRadioItem value="all">All Provinces</DropdownMenuRadioItem>
              {provinces.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {p}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <FilterButton label="City" active={cityFilter !== "all"} />
          <DropdownMenuContent align="end" className="w-56 rounded-xl max-h-60 overflow-y-auto">
            <DropdownMenuRadioGroup value={cityFilter} onValueChange={setCityFilter}>
              <DropdownMenuRadioItem value="all">All Cities</DropdownMenuRadioItem>
              {cities.map((c) => (
                <DropdownMenuRadioItem key={c} value={c}>
                  {c}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-10 rounded-xl text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="mr-1 h-3 w-3" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
