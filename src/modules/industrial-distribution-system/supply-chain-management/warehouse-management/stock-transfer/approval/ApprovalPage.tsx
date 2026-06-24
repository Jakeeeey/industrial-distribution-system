'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, ClipboardCheck, Loader2, RefreshCcw, ServerCrash, ArrowRight } from 'lucide-react';
import { useStockTransferApproval } from './hooks/use-stock-transfer-approval';
import type { OrderGroupItem, ProductRow } from '../types/stock-transfer.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Shared components
import { OrderSelectionModal } from '../shared/components/OrderSelectionModal';
import { QuantityStepper } from '../shared/components/QuantityStepper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

export default function StockTransferApprovalView() {
  const {
    orderGroups,
    selectedGroup,
    selectedOrderNo,
    setSelectedOrderNo,
    loading,
    processing,
    fetchError,
    updateStatus,
    getBranchName,
    refresh,
    allocatedQtys,
    availableQtys,
    fetchingAvailable,
    updateAllocatedQty,
    totalAllocatedCount,
  } = useStockTransferApproval();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [productSearch, setProductSearch] = React.useState('');

  // Reset page when group, search, or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrderNo, productSearch, itemsPerPage]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const filteredItems = React.useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.filter((item: OrderGroupItem) => {
      const product = typeof item.product_id === 'object' && item.product_id !== null ? (item.product_id as ProductRow) : null;
      const productName = product?.product_name || `PRD-${item.product_id}`;
      const barcode = product?.barcode || '';
      return (
        productName.toLowerCase().includes(productSearch.toLowerCase()) ||
        barcode.toLowerCase().includes(productSearch.toLowerCase()) ||
        String(item.product_id).includes(productSearch)
      );
    });
  }, [selectedGroup, productSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    if (current > 3) pages.push('ellipsis');
    const rangeStart = Math.max(2, current - 1);
    const rangeEnd = Math.min(total - 1, current + 1);
    for (let p = rangeStart; p <= rangeEnd; p++) pages.push(p);
    if (current < total - 2) pages.push('ellipsis');
    pages.push(total);
    return pages;
  }

  const currentTotalAmount = React.useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.items.reduce((sum: number, item: OrderGroupItem) => {
      const qty = allocatedQtys[item.id] ?? item.ordered_quantity ?? 0;
      const unitPrice = item.ordered_quantity > 0 ? (Number(item.amount || 0) / item.ordered_quantity) : 0;
      return sum + (qty * unitPrice);
    }, 0);
  }, [selectedGroup, allocatedQtys]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Stock Transfer Approval</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refresh()} 
            disabled={loading}
            className="gap-2 border-border shadow-none"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-none bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Review Requests</CardTitle>
            <CardDescription>
              Validate stock availability and approve transfers for picking.
            </CardDescription>
          </div>
          <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
        </CardHeader>

        <CardContent className="mt-4 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 border border-border rounded-xl bg-card gap-3 py-6">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/20 opacity-75"></span>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground animate-pulse font-medium">Loading pending transfer requests...</p>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center border border-border rounded-xl bg-destructive/5">
              <ServerCrash className="w-12 h-12 text-destructive/50" />
              <div>
                <p className="font-bold text-destructive">Connection Error</p>
                <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
              </div>
              <Button variant="outline" onClick={() => refresh()} className="gap-2 border-border">
                <RefreshCcw className="w-4 h-4" /> Try Again
              </Button>
            </div>
          )}

          {!loading && !fetchError && (
          <>
          {/* Select order dropdown bar */}
          <div className="flex items-center justify-between border border-border rounded-xl p-4 bg-muted/10">
            <div className="space-y-1.5 flex-1 max-w-sm">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                Request Order Number
              </label>
              <OrderSelectionModal 
                orderGroups={orderGroups}
                selectedOrderNo={selectedOrderNo}
                onSelect={setSelectedOrderNo}
                getBranchName={getBranchName}
                title="Select Pending Approval"
                description="Review stock transfer requests."
                placeholder="Search request number..."
              />
            </div>
            
            <div className="hidden sm:block text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Pending Count</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {orderGroups.length} requests
              </span>
            </div>
          </div>

          {/* Empty State placeholder */}
          {!selectedGroup && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/5 py-16 px-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 animate-pulse">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No Request Selected</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Search or select a pending stock transfer request order number above to view details, inspect item stock levels, and authorize releasing inventory.
              </p>
            </div>
          )}

          {selectedGroup && (
            <div className="space-y-6 border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <div className="bg-muted/20 p-5 border-b border-border">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  
                  {/* Visual branch route indicator badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">Source</span>
                      <span className="font-semibold text-sm text-foreground block truncate max-w-[180px] bg-background border border-border rounded-md px-2.5 py-1">
                        {getBranchName(selectedGroup.sourceBranch)}
                      </span>
                    </div>
                    
                    {/* Flow arrow */}
                    <div className="hidden sm:flex items-center justify-center pt-4">
                      <ArrowRight className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">Target</span>
                      <span className="font-semibold text-sm text-foreground block truncate max-w-[180px] bg-background border border-border rounded-md px-2.5 py-1">
                        {getBranchName(selectedGroup.targetBranch)}
                      </span>
                    </div>

                    <div className="h-8 w-px bg-border hidden lg:block" />

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">Lead Date</span>
                      <span className="font-semibold text-sm text-foreground block bg-background border border-border rounded-md px-2.5 py-1 font-mono">
                        {formatDate(selectedGroup.leadDate)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">Requested At</span>
                      <span className="font-semibold text-sm text-foreground block bg-background border border-border rounded-md px-2.5 py-1 font-mono">
                        {formatDate(selectedGroup.dateRequested)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="w-full lg:w-64 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background border-border shadow-sm focus-visible:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/20">
                      <TableHead className="text-[10px] uppercase font-bold">Product</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Details</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Brand</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Unit</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-center">Ordered</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-center">Available</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-center">Allocation</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-right">Draft Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item: OrderGroupItem) => {
                      const product = typeof item.product_id === 'object' && item.product_id !== null ? (item.product_id as ProductRow) : null;
                      const productName = product?.product_name || `PRD-${item.product_id}`;
                      const description = product?.description || product?.barcode || 'N/A';
                      const brandName = typeof product?.product_brand === 'object' ? product?.product_brand?.brand_name : 'N/A';
                      const unitName = typeof product?.unit_of_measurement === 'object' ? product?.unit_of_measurement?.unit_name : 'unit';
                      // const originalId = product ? (product.product_id) : item.product_id;

                      return (
                        <TableRow key={item.id} className="hover:bg-muted/5 border-b border-border/50">
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">{productName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{description}</TableCell>
                          <TableCell className="text-[10px] font-bold text-primary uppercase">{brandName}</TableCell>
                          <TableCell className="text-[10px] font-medium uppercase text-muted-foreground">{unitName}</TableCell>
                          <TableCell className="text-sm text-center font-medium">{item.ordered_quantity}</TableCell>
                          <TableCell className="text-sm text-center">
                            {fetchingAvailable ? (
                              <Loader2 className="w-3 h-3 animate-spin mx-auto text-primary" />
                            ) : (
                              <span className="font-mono text-xs">{availableQtys[item.id] ?? '—'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-center">
                            {fetchingAvailable ? (
                              <span className="text-muted-foreground/30">—</span>
                            ) : (
                              <QuantityStepper 
                                value={allocatedQtys[item.id] ?? 0}
                                max={Math.min(item.ordered_quantity || 0, availableQtys[item.id] || 0)}
                                onChange={(val) => {
                                  updateAllocatedQty(item.id, val, Math.min(item.ordered_quantity || 0, availableQtys[item.id] || 0));
                                }}
                                className="h-8 w-fit mx-auto"
                                size="sm"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold text-foreground">
                            ₱{((allocatedQtys[item.id] ?? item.ordered_quantity ?? 0) * (item.ordered_quantity > 0 ? (Number(item.amount || 0) / item.ordered_quantity) : 0)).toLocaleString('en-PH', {minimumFractionDigits: 2})}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter className="bg-muted/10">
                    <TableRow>
                      <TableCell colSpan={7} className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4">Total Value</TableCell>
                      <TableCell className="text-right text-base font-bold text-emerald-600 py-4">
                        ₱{currentTotalAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>

                {/* Pagination Section */}
                {filteredItems.length > 0 && (
                  <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 bg-muted/5">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {Math.min(itemsPerPage * (currentPage - 1) + 1, filteredItems.length)}–{Math.min(itemsPerPage * currentPage, filteredItems.length)} of {filteredItems.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Show</span>
                        <Select
                          value={String(itemsPerPage)}
                          onValueChange={(v) => setItemsPerPage(Number(v))}
                        >
                          <SelectTrigger className="h-7 w-[60px] text-[10px] font-bold border-border shadow-none bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[10, 20, 50, 100].map((s) => (
                              <SelectItem key={s} value={String(s)} className="text-[10px] font-bold">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <Pagination className="w-auto mx-0 justify-end scale-90 origin-right">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                              className={currentPage === 1 ? 'pointer-events-none opacity-40' : ''}
                            />
                          </PaginationItem>
                          {buildPageList(currentPage, totalPages).map((p, i) =>
                            p === 'ellipsis' ? (
                              <PaginationItem key={`ellipsis-${i}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={p}>
                                <PaginationLink
                                  href="#"
                                  isActive={p === currentPage}
                                  onClick={(e) => { e.preventDefault(); setCurrentPage(p); }}
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-40' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold"
                        disabled={processing}
                      >
                        Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel the transfer request.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => updateStatus(selectedGroup.orderNo, 'rejected')}
                          className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                          Confirm Reject
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none font-bold text-xs"
                        disabled={processing || fetchingAvailable || totalAllocatedCount === 0}
                      >
                        {(processing || fetchingAvailable) && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        {fetchingAvailable ? 'Checking Inventory...' : 'Approve & Release'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Approve Transfer?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Release items for picking and dispatching.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => updateStatus(selectedGroup.orderNo, 'approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Confirm Approval
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
