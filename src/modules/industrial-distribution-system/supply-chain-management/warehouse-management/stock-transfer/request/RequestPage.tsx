'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RefreshCcw, CheckCircle2, Printer, ShoppingBag, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

// New centralized hooks
import { useStockTransferRequest } from './hooks/use-stock-transfer-request';
import { getBranchLabel } from '../services/stock-transfer.helpers';

// Shared components
import StockTransferTable from '../shared/components/StockTransferTable';
import { BranchCombobox } from '../shared/components/BranchCombobox';
import { ProductSelectionModal } from '../shared/components/ProductSelectionModal';
import { EnrichedProduct } from '../types/stock-transfer.types';
import { StockTransferPrintPreview } from '../shared/components/StockTransferPrintPreview';

export default function StockTransferRequestView({ salesmanName }: { salesmanName?: string }) {
  const {
    branches,
    loading,
    confirming,
    sourceBranch,
    setSourceBranch,
    targetBranch,
    setTargetBranch,
    leadDate,
    setLeadDate,
    scannedItems,
    handleAddProduct,
    updateQty,
    removeItem,
    reset,
    confirmTransfer,
    isTransferConfirmed,
    orderNo,
    status,
  } = useStockTransferRequest();

  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  /* ── Helpers ─────────────────────────────────────────── */
  const sourceBranchLabel = branches.find((b) => b.id.toString() === sourceBranch)
    ? getBranchLabel(branches.find((b) => b.id.toString() === sourceBranch)!)
    : sourceBranch || '—';

  const targetBranchLabel = branches.find((b) => b.id.toString() === targetBranch)
    ? getBranchLabel(branches.find((b) => b.id.toString() === targetBranch)!)
    : targetBranch || '—';

  const handleConfirmClick = () => {
    if (!sourceBranch || !targetBranch || !leadDate) {
      toast.error('Incomplete Form', {
        description: 'Please fill out Source Branch, Target Branch, and Lead Date.',
      });
      return;
    }
    if (scannedItems.length === 0) {
      toast.error('No Items', {
        description: 'Select at least one product to transfer.',
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmFinal = async () => {
    setShowConfirmDialog(false);
    try {
      await confirmTransfer();
      toast.success('Stock Transfer Confirmed', {
        description: `Transfer saved to database.`,
      });
      reset();
    } catch (err) {
      toast.error('Transfer Failed', {
        description: err instanceof Error ? err.message : 'Could not save to database.',
      });
    }
  };

  const handlePrint = () => setShowPreview(true);

  return (
    <>
      <div className="print:hidden w-full min-w-0 p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Stock Transfer Request
        </h1>

        {/* ── Transfer origin and destination configuration card ── */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Visual Route Flow */}
            <div className="flex-1 grid grid-cols-1 md:flex md:items-center gap-4">
              <div className="flex-1 space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Source Branch <span className="text-destructive">*</span>
                </label>
                <BranchCombobox
                  branches={branches}
                  value={sourceBranch}
                  onChange={setSourceBranch}
                  placeholder="Select source branch"
                />
              </div>

              {/* Directional Flow Arrow */}
              <div className="hidden md:flex h-10 items-end justify-center pb-2 px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target Branch <span className="text-destructive">*</span>
                </label>
                <BranchCombobox
                  branches={branches}
                  value={targetBranch}
                  onChange={setTargetBranch}
                  placeholder="Select target branch"
                />
              </div>
            </div>

            {/* Date and Browse Product action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto lg:min-w-[400px]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Lead Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={leadDate}
                  onChange={(e) => setLeadDate(e.target.value)}
                  className="h-10 text-sm bg-background border-border focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manual Selection
                </label>
                <Button 
                  variant="outline" 
                  className="w-full h-10 gap-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-xs font-bold transition-all duration-300 shadow-sm"
                  onClick={() => setShowProductModal(true)}
                >
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  Browse Products
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Table Loading / Empty State / Render Table ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-52 border border-border rounded-xl bg-card gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/20 opacity-75"></span>
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground animate-pulse font-medium">Fetching transfer request data...</p>
          </div>
        ) : scannedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/5 py-12 px-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 animate-pulse">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No Products Selected</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Please select products to transfer by clicking <strong>Browse Products</strong> or scanning an RFID barcode.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProductModal(true)}
                className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5 hover:border-primary/50 text-xs font-semibold"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Browse Products
              </Button>
            </div>
          </div>
        ) : (
          <StockTransferTable items={scannedItems} onQtyChange={updateQty} onDelete={removeItem} />
        )}

        {/* ── Bottom Action Row ── */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={reset} 
              className="gap-2 border-border shadow-none hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all duration-300"
            >
              <RefreshCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="gap-2 border-border shadow-none hover:bg-muted/50 transition-all duration-300"
            >
              <Printer className="w-4 h-4" />
              Print Document
            </Button>
            <Button
              onClick={handleConfirmClick}
              disabled={isTransferConfirmed || confirming}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm shadow-primary/15 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {confirming ? 'Saving...' : 'Confirm Transfer'}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stock Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure this is the final stock transfer request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmFinal}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Yes, Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StockTransferPrintPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        orderNo={orderNo}
        status={status}
        sourceBranchLabel={sourceBranchLabel}
        targetBranchLabel={targetBranchLabel}
        leadDate={leadDate}
        scannedItems={scannedItems}
        salesmanName={salesmanName}
      />
      <ProductSelectionModal 
        open={showProductModal} 
        onOpenChange={setShowProductModal} 
        sourceBranch={sourceBranch}
        selectedProducts={scannedItems.map(item => ({
          product_id: item.productId,
          product_name: item.productName,
          barcode: item.description,
          cost_per_unit: item.unitPrice,
          quantity: item.unitQty,
          totalAmount: item.totalAmount,
          unit_of_measurement: { unit_name: item.unit },
          qtyAvailable: item.qtyAvailable
        } as unknown as EnrichedProduct))}
        onSelect={(p) => {
          handleAddProduct(p);
          toast.success(`Added ${p.product_name} to transfer list.`);
        }} 
        onUpdateQty={(pid, qty) => {
          const item = scannedItems.find(i => i.productId === pid);
          if (item) updateQty(item.rfid, qty);
        }}
        onRemoveItem={(pid) => {
          const item = scannedItems.find(i => i.productId === pid);
          if (item) removeItem(item.rfid);
        }}
      />
    </>
  );
}