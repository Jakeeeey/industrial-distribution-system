"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCylinderTagging } from "./hooks/useCylinderTagging";
import CylinderTaggingDesktop from "./components/CylinderTaggingDesktop";
import CylinderTaggingMobile from "./components/CylinderTaggingMobile";
import { fetchProvider } from "./providers/fetchProvider";
import { SalesOrderListItem } from "./types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Cylinder,
  Search,
  ArrowLeft,
  AlertCircle,
  ScanLine,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function SalesOrderSerialTagging() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Get active orderId from search parameters
  const orderIdParam = searchParams.get("orderId");
  const [optimisticOrderId, setOptimisticOrderId] = useState<string | null>(orderIdParam);

  // Sync optimistic selection with URL parameter updates
  useEffect(() => {
    setOptimisticOrderId(orderIdParam);
  }, [orderIdParam]);

  // Orders list states
  const [orders, setOrders] = useState<SalesOrderListItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("196");
  const [searchText, setSearchText] = useState("");

  // Extract unique branches from orders to resolve their names dynamically
  const availableBranches = Array.from(
    new Map(
      orders
        .map((o) => [o.branch_id, o.branch_name || `Branch ${o.branch_id}`])
    ).entries()
  ).map(([id, name]) => ({ id: String(id), name }));

  const {
    loading,
    submitting,
    error,
    orderDetails,
    mappedSerials,
    customerAssets,
    scannedList,
    handleScan,
    handleRemove,
    clearScanned,
    submitTagging,
    refreshData,
  } = useCylinderTagging(optimisticOrderId);

  useEffect(() => {
    const loadOrdersList = async () => {
      setLoadingOrders(true);
      setOrdersError(null);
      try {
        const data = await fetchProvider.listOrders();
        setOrders(data);
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : "Failed to load sales orders.";
        setOrdersError(msg);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrdersList();
  }, []);

  const handleSelectOrder = (id: number) => {
    const idStr = String(id);
    setOptimisticOrderId(idStr);
    const params = new URLSearchParams(searchParams.toString());
    params.set("orderId", idStr);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleGoBack = () => {
    setOptimisticOrderId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("orderId");
    router.push(`${pathname}?${params.toString()}`);
  };

  // Filter orders by branch and search string on client side
  const filteredOrders = orders.filter((o) => {
    // 1. Branch filter (only branch 196 or branch 197 allowed as per requirements)
    if (branchFilter === "196" && o.branch_id !== 196) return false;
    if (branchFilter === "197" && o.branch_id !== 197) return false;

    // 2. Search query (order number, customer name, customer code)
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      const matchNo = o.order_no.toLowerCase().includes(query);
      const matchName = o.customer_name.toLowerCase().includes(query);
      const matchCode = o.customer_code.toLowerCase().includes(query);
      return matchNo || matchName || matchCode;
    }

    return true;
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Reset pagination on search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, branchFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reusable order list rendering function
  const renderOrdersList = (isSidebar: boolean = false) => {
    return (
      <div className="flex flex-col gap-2.5 h-full overflow-hidden">
        {!isSidebar && (
          <div className="flex flex-col gap-1 text-center items-center shrink-0">
            <div className="p-2 bg-primary/10 rounded-2xl w-fit shadow-inner mb-1 animate-pulse">
              <Cylinder className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              Sales Order Serial Tagging
            </h2>
            <p className="text-muted-foreground text-xs max-w-sm">
              Select a pending Sales Order to verify and tag physical cylinder assets to the customer.
            </p>
          </div>
        )}

        {ordersError && (
          <Alert variant="destructive" className="shadow-lg border-2 shrink-0 p-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold text-xs">Error Loading Orders</AlertTitle>
            <AlertDescription className="text-xs opacity-90 italic">
              {ordersError}
            </AlertDescription>
          </Alert>
        )}

        <Card className={`border shadow-lg flex flex-col ${isSidebar ? "flex-1 h-90% overflow-hidden" : "h-[calc(100vh-14rem)] md:h-auto overflow-hidden"}`}>
          <CardHeader className="px-3 shrink-0 flex flex-col gap-2.5">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5 text-primary" />
                Select Sales Order
              </CardTitle>
            </div>

            {/* 1-Line Search Bar and Branch Filter */}
            <div className="flex items-center gap-2 w-full">
              {/* Compact Search Input */}
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search SO or customer..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 h-8 text-xs font-medium"
                />
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              </div>

               {/* Compact Branch Selector Dropdown */}
              <Select key={availableBranches.length} value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-8 w-15 p-0 shrink-0 flex items-center justify-center" title="Filter by Branch">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="sr-only">
                    <SelectValue placeholder="Branch" />
                  </span>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="196" className="text-xs font-semibold">
                    {availableBranches.find(b => b.id === "196")?.name || "WAREHOUSE - INDUSTRIAL"}
                  </SelectItem>
                  <SelectItem value="197" className="text-xs font-semibold">
                    {availableBranches.find(b => b.id === "197")?.name || "WAREHOUSE - INDUSTRIAL - Bad Stock"}
                  </SelectItem>
                  <SelectItem value="all" className="text-xs font-semibold">
                    All Branches
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 border-t flex-1 overflow-hidden flex flex-col">
            {loadingOrders ? (
              <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-semibold flex-1 flex flex-col justify-center items-center">
                <Filter className="w-6 h-6 text-muted-foreground/50 mb-1" />
                <p className="text-xs">No pending Sales Orders found.</p>
                <p className="text-[10px] opacity-75 mt-0.5">Try adjusting filters or search.</p>
              </div>
            ) : isSidebar ? (
              // Sidebar View: compact responsive card stack
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {paginatedOrders.map((o) => {
                  const isSelected = optimisticOrderId === String(o.order_id);
                  return (
                    <div
                      key={o.order_id}
                      onClick={() => handleSelectOrder(o.order_id)}
                      className={`p-3 flex justify-between items-center transition-colors cursor-pointer border-l-4 ${
                        isSelected
                          ? "bg-primary/10 border-l-primary"
                          : "border-l-transparent hover:bg-secondary/15 active:bg-secondary/30"
                      }`}
                    >
                      <div className="space-y-1 pr-2 min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{o.order_no}</span>
                          <Badge variant="outline" className="text-[9px] font-semibold py-0 h-4.5 border-primary/40 text-primary px-1.5 max-w-[120px] truncate">
                            {o.branch_name || `Branch ${o.branch_id}`}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground truncate">{o.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground/80 font-mono">Code: {o.customer_code}</p>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? "text-primary translate-x-1" : "text-muted-foreground"}`} />
                    </div>
                  );
                })}
              </div>
            ) : isMobile ? (
              // Mobile View: responsive card stack
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {paginatedOrders.map((o) => (
                  <div
                    key={o.order_id}
                    onClick={() => handleSelectOrder(o.order_id)}
                    className="p-3.5 flex justify-between items-center hover:bg-secondary/20 active:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1 pr-3 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{o.order_no}</span>
                        <Badge variant="outline" className="text-[9px] font-semibold py-0 h-4.5 border-primary/40 text-primary px-1.5 max-w-[125px] truncate">
                          {o.branch_name || `Branch ${o.branch_id}`}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground truncate">{o.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground/80 font-mono">Code: {o.customer_code}</p>
                    </div>
                    <ChevronRight className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              // Desktop fallback view
              <div className="overflow-y-auto flex-1">
                <Table>
                  <TableHeader className="bg-secondary/10 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Order No</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Customer Name</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Customer Code</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Branch</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Status</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((o) => (
                      <TableRow
                        key={o.order_id}
                        onClick={() => handleSelectOrder(o.order_id)}
                        className="hover:bg-secondary/15 cursor-pointer transition-colors"
                      >
                        <TableCell className="font-bold text-foreground text-sm">{o.order_no}</TableCell>
                        <TableCell className="font-semibold text-foreground text-sm">{o.customer_name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground text-xs">{o.customer_code}</TableCell>
                        <TableCell className="font-semibold text-xs">{o.branch_name || `Branch ${o.branch_id}`}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-bold text-[11px]">
                            {o.order_status || "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <ChevronRight className="w-4.5 h-4.5 text-muted-foreground ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {/* Pagination Footer Controls */}
          {totalPages > 1 && (
            <div className="p-2.5 border-t flex items-center justify-between bg-secondary/5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 text-[11px] font-bold px-2.5"
              >
                Previous
              </Button>
              <span className="text-[10px] font-bold text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 text-[11px] font-bold px-2.5"
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ==========================================
  // MOBILE RENDERING FLOW
  // ==========================================
  if (isMobile) {
    if (!optimisticOrderId) {
      return (
        <div className="py-2">
          {renderOrdersList(false)}
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-4 space-y-4 py-8">
          <Alert variant="destructive" className="shadow-lg border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-bold">Execution Error</AlertTitle>
            <AlertDescription className="text-sm opacity-90 italic">
              {error}
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 w-full">
            <Button onClick={handleGoBack} variant="outline" className="font-bold flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" /> BACK TO LIST
            </Button>
            <Button onClick={refreshData} className="font-bold flex-1">
              RETRY FETCH
            </Button>
          </div>
        </div>
      );
    }

    if (!orderDetails) {
      return (
        <div className="flex flex-col items-center justify-center p-4 py-8 space-y-4">
          <Alert variant="destructive" className="shadow-lg border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-bold">Data Missing</AlertTitle>
            <AlertDescription className="text-sm opacity-90 italic">
              Could not fetch Sales Order data.
            </AlertDescription>
          </Alert>
          <Button onClick={handleGoBack} className="font-bold w-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> BACK TO LIST
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Mobile Workspace Title Header */}
        <div className="flex items-center gap-3 border-b pb-3">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="icon"
            className="h-10 w-10 hover:bg-secondary border-2"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Sales Order Serial Tagging
            </h2>
            <p className="text-[11px] text-muted-foreground font-semibold">
              Scan and link cylinders to order items.
            </p>
          </div>
        </div>

        <CylinderTaggingMobile
          orderDetails={orderDetails}
          mappedSerials={mappedSerials}
          customerAssets={customerAssets}
          scannedList={scannedList}
          submitting={submitting}
          onScan={handleScan}
          onRemove={handleRemove}
          onClear={clearScanned}
          onSubmit={submitTagging}
          onRefresh={refreshData}
        />
      </div>
    );
  }

  // ==========================================
  // DESKTOP RENDERING FLOW (Split layout)
  // ==========================================
  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4.5rem)] overflow-hidden">
      {/* Module Title Section */}
      <div className="flex items-center justify-between border-b pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Cylinder className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Sales Order Serial Tagging
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground font-semibold">
              Scan and link physical cylinders to Sales Order line items.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch flex-1 overflow-hidden">
        {/* Left Sidebar Pane */}
        <div className="w-full md:w-80 lg:w-90 shrink-0 flex flex-col h-full overflow-hidden">
          {renderOrdersList(true)}
        </div>

        {/* Right Workspace Pane */}
        <div className="flex-1 min-w-0 w-full h-full overflow-y-auto pr-1">
          {!optimisticOrderId ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed rounded-2xl p-12 text-center bg-secondary/5">
              <div className="p-4 bg-primary/5 rounded-full mb-4 border border-primary/10">
                <ScanLine className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No Sales Order Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1.5">
                Select a pending Sales Order from the left sidebar to start scanning and tagging physical cylinders.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
                <div className="lg:col-span-5">
                  <Skeleton className="h-96 w-full" />
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-6 space-y-4 py-12">
              <Alert variant="destructive" className="max-w-md shadow-lg border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-bold">Execution Error</AlertTitle>
                <AlertDescription className="text-sm opacity-90 italic">
                  {error}
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={handleGoBack} variant="outline" className="font-bold">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Clear Selection
                </Button>
                <Button onClick={refreshData} className="font-bold">
                  Retry Fetch
                </Button>
              </div>
            </div>
          ) : !orderDetails ? (
            <div className="flex flex-col items-center justify-center p-6 py-12 space-y-4">
              <Alert variant="destructive" className="max-w-md shadow-lg border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-bold">Data Missing</AlertTitle>
                <AlertDescription className="text-sm opacity-90 italic">
                  Could not fetch Sales Order data.
                </AlertDescription>
              </Alert>
              <Button onClick={handleGoBack} className="font-bold">
                <ArrowLeft className="mr-2 h-4 w-4" /> Choose Different Order
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <CylinderTaggingDesktop
                orderDetails={orderDetails}
                mappedSerials={mappedSerials}
                customerAssets={customerAssets}
                scannedList={scannedList}
                submitting={submitting}
                onScan={handleScan}
                onRemove={handleRemove}
                onClear={clearScanned}
                onSubmit={submitTagging}
                onRefresh={refreshData}
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
