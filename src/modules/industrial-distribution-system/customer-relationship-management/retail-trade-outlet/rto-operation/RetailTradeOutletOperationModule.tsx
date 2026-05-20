"use client"
import { 
  Map, 
  Receipt, 
  AlertCircle, 
  RefreshCw, 
  Truck,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsUpDown } from "lucide-react";
import { DealerCard } from "./components/DealerCard";
import { Filters } from "./components/Filters";
import {
  useRetailTradeOutletOperation,
  MissingStatusFilter,
  BalanceStatusFilter,
} from "./hooks/useRetailTradeOutletOperation";



export default function RetailTradeOutletOperationModule() {
  const {
    dealers,
    totalCount,
    totalPages,
    page,
    pageSize,
    isLoading,
    isFiltered,
    searchQuery,
    missingStatusFilter,
    balanceStatusFilter,
    setPage,
    setPageSize,
    setSearchQuery,
    setMissingStatusFilter,
    setBalanceStatusFilter,
    resetFilters,
    refetch,
  } = useRetailTradeOutletOperation();

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Retail Trade Outlet
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track bulk deliveries, unpaid balances, and missing cylinders.
          </p>
        </div>

        <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 duration-700">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="shadow-sm"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>

          <Button size="sm" className="shadow-sm" id="btn-add-city-dealer">
            <UserPlus className="mr-2 h-4 w-4" />
            Add City Dealer
          </Button>
          <Button size="sm" className="shadow-sm" id="btn-log-delivery">
            <Truck className="mr-2 h-4 w-4" />
            Log Delivery Truck
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      {/* ── TOOLBAR ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100 fill-mode-both">
        <Filters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          missingStatusFilter={missingStatusFilter}
          setMissingStatusFilter={setMissingStatusFilter}
          balanceStatusFilter={balanceStatusFilter}
          setBalanceStatusFilter={setBalanceStatusFilter}
          resetFilters={resetFilters}
          isFiltered={isFiltered}
          totalCount={totalCount}
          filteredCount={dealers.length}
        />
      </div>

      {/* ── CARD LIST WITH HEADER ─────────────────────────────────────────── */}
      <Card className="rounded-xl shadow-sm border border-slate-200 overflow-hidden p-0 gap-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200 fill-mode-both">
        {/* Table/List Header (Shared) */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b bg-slate-50/50">
          <div className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Map className="w-3.5 h-3.5" /> Address Book
          </div>
          <div className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> Missing Tank Monitor
          </div>
          <div className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5" /> Automatic Billing
          </div>
        </div>

        {/* List Body */}
        <div className="p-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3">
                <div className="space-y-3"><div className="h-6 w-48 bg-slate-100 animate-pulse rounded" /><div className="h-4 w-32 bg-slate-50 animate-pulse rounded" /></div>
                <div className="space-y-3"><div className="h-4 w-full bg-slate-100 animate-pulse rounded" /><div className="h-4 w-full bg-slate-100 animate-pulse rounded" /></div>
                <div className="flex justify-between items-start"><div className="h-4 w-16 bg-slate-100 animate-pulse rounded" /><div className="h-8 w-24 bg-slate-100 animate-pulse rounded" /></div>
              </div>
            ))
          ) : dealers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No dealers found matching your criteria.
            </div>
          ) : (
            dealers.map((dealer) => (
              <DealerCard key={dealer.id} dealer={dealer} />
            ))
          )}
        </div>
      </Card>

      {/* ── PAGINATION ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
        <div className="text-sm text-muted-foreground">
          {isFiltered ? (
            <span>
              Showing {dealers.length} of {totalCount} filtered results
            </span>
          ) : (
            <span>Total {totalCount} records</span>
          )}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-17.5">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-25 items-center justify-center text-sm font-medium">
            Page {page} of {totalPages || 1}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || totalPages === 0 || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || totalPages === 0 || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
