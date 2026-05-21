"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  AlertCircle,
  UserSearch,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  CustomerHistoryProvider,
  useCustomerHistoryContext,
} from "./providers/CustomerHistoryProvider";
import { CustomerFilter } from "./components/CustomerFilter";
import { CustomerKpiCards } from "./components/CustomerKpiCards";
import { TransactionLedger } from "./components/TransactionLedger";

// ─── Inner content (needs context) ───────────────────────────────────────────

function CustomerHistoryContent() {
  const {
    data,
    loading,
    error,
    refetch,
    selectedCustomer,
    setSelectedCustomer,
  } = useCustomerHistoryContext();

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-bold tracking-tight">
          Connection Error
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <span className="text-sm">{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="w-full sm:w-auto bg-background hover:bg-muted text-foreground"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Connection
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <Card className="border-border/60 shadow-sm py-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100 fill-mode-both">
        <CardContent className="px-5 py-2 flex justify-between flex-col sm:flex-row sm:items-center gap-4 transition-shadow duration-200 ease-in-out ">
          <CustomerFilter
            customers={data}
            selected={selectedCustomer}
            onSelect={setSelectedCustomer}
            loading={loading}
            disabled={loading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className={cn(
              "shrink-0 shadow-sm font-bold uppercase tracking-widest text-[10px] h-11 px-5 rounded-xl transition-colors duration-200 ease-in-out motion-safe:transform motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-in-out motion-safe:hover:-translate-y-1",
            )}
          >
            <RefreshCw
              className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")}
            />
            Sync Data
          </Button>
        </CardContent>
      </Card>

      {/* EMPTY STATE */}
      {!loading && !selectedCustomer && (
        <div className="flex flex-col items-center justify-center h-72 border-2 border-dashed rounded-2xl border-border/50 bg-muted/10 text-center gap-3">
          <UserSearch className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-bold text-muted-foreground">
              No Customer Selected
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the dropdown above to select a customer and view their
              history.
            </p>
          </div>
          {data.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 text-xs transition-colors duration-200 ease-in-out motion-safe:transform motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-1"
              onClick={() => setSelectedCustomer(data[0])}
            >
              View first customer <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {/* MAIN CONTENT */}
      {!loading && selectedCustomer && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200 fill-mode-both">
          <CustomerKpiCards customer={selectedCustomer} />

          <Separator />

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-500 fill-mode-both">
            <TransactionLedger transactions={selectedCustomer.transactions} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shell (reads URL params, provides context) ───────────────────────────────

export default function CustomerHistoryModule() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");

  return (
    <CustomerHistoryProvider initialCustomerId={initialCustomerId}>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in duration-500">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="animate-in fade-in slide-in-from-left-4 duration-700">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Customer Profile &amp; History
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor account health and logistics performance.
            </p>
          </div>
          {initialCustomerId && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="self-start sm:self-auto text-muted-foreground hover:text-foreground font-semibold transition-colors duration-200 ease-in-out"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Directory
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <CustomerHistoryContent />
      </div>
    </CustomerHistoryProvider>
  );
}
