'use client';

/**
 * DiscrepancyModal Component
 * 
 * Provides a user-friendly modal for confirming partial stock transfer dispatches 
 * when scanned/actual quantities differ from expected/requested quantities.
 * Captures discrepancy reason codes and remarks to keep warehouse floor state 
 * and logistics audit trails accurate without halting operations.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, PackageX, CheckCircle, Info, Loader2 } from 'lucide-react';
import type { OrderGroupItem, ProductRow } from '../../types/stock-transfer.types';

export interface DiscrepancyReasonEntry {
  itemId: number;
  reason: string;
  remarks?: string;
}

export interface DiscrepancyModalProps {
  open: boolean;
  onClose: () => void;
  orderNo: string;
  items: OrderGroupItem[];
  processing: boolean;
  onConfirm: (payload: {
    globalReason: string;
    globalRemarks: string;
    itemReasons: Record<number, { reason: string; remarks?: string }>;
  }) => void;
}

export const DISCREPANCY_REASONS = [
  { value: 'Damaged Stock', label: 'Damaged Stock on Floor' },
  { value: 'Missing Inventory', label: 'Missing / Lost Inventory' },
  { value: 'Misplaced / Out of Stock', label: 'Misplaced or Stockout at Source' },
  { value: 'Short Shipment', label: 'Short Shipment / Quantity Mismatch' },
  { value: 'Quality Control Hold', label: 'QC Hold / Expired Items' },
  { value: 'Other Discrepancy', label: 'Other Warehouse Discrepancy' },
];

export function DiscrepancyModal({
  open,
  onClose,
  orderNo,
  items,
  processing,
  onConfirm,
}: DiscrepancyModalProps) {
  const [globalReason, setGlobalReason] = useState<string>('Missing Inventory');
  const [globalRemarks, setGlobalRemarks] = useState<string>('');
  const [itemReasons, setItemReasons] = useState<Record<number, { reason: string; remarks?: string }>>({});

  // Filter items that have discrepancies (allocated > scanned)
  const discrepantItems = React.useMemo(() => {
    return items.filter((item) => {
      const targetQty = Math.max(0, item.allocated_quantity ?? item.ordered_quantity ?? 0);
      const actualQty = item.scannedQty ?? item.picked_quantity ?? 0;
      return actualQty < targetQty;
    });
  }, [items]);

  const totalRequested = React.useMemo(() => {
    return items.reduce((acc, i) => acc + Math.max(0, i.allocated_quantity ?? i.ordered_quantity ?? 0), 0);
  }, [items]);

  const totalDispatched = React.useMemo(() => {
    return items.reduce((acc, i) => acc + (i.scannedQty ?? i.picked_quantity ?? 0), 0);
  }, [items]);

  const totalShortage = totalRequested - totalDispatched;

  const handleItemReasonChange = (itemId: number, reason: string) => {
    setItemReasons((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), reason },
    }));
  };

  const handleConfirmSubmit = () => {
    onConfirm({
      globalReason,
      globalRemarks,
      itemReasons,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val: boolean) => !val && onClose()}>
      <DialogContent className="max-w-2xl bg-background border-border shadow-xl rounded-2xl overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Partial Dispatch & Discrepancy Confirmation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Order <span className="font-semibold text-foreground">{orderNo}</span> has actual picked quantities differing from expected requested quantities.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border">
            <div className="space-y-0.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Requested</span>
              <p className="text-lg font-extrabold text-foreground">{totalRequested} units</p>
            </div>
            <div className="space-y-0.5 text-center border-x border-border">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Actual Picked</span>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{totalDispatched} units</p>
            </div>
            <div className="space-y-0.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Shortage / Variance</span>
              <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">-{totalShortage} units</p>
            </div>
          </div>

          {/* Discrepant Items Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <PackageX className="h-4 w-4 text-amber-500" />
                Line Items with Discrepancies ({discrepantItems.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Select reason for each variance</span>
            </div>

            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {discrepantItems.map((item) => {
                const product = typeof item.product_id === 'object' && item.product_id !== null ? (item.product_id as ProductRow) : null;
                const prodName = product?.description || product?.product_name || `Product #${item.product_id}`;
                const targetQty = Math.max(0, item.allocated_quantity ?? item.ordered_quantity ?? 0);
                const actualQty = item.scannedQty ?? item.picked_quantity ?? 0;
                const diff = targetQty - actualQty;
                const currentReason = itemReasons[item.id]?.reason || globalReason;

                return (
                  <div key={item.id} className="p-3 bg-card hover:bg-muted/20 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">{prodName}</span>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-muted-foreground">Req: {targetQty}</span>
                        <span className="font-bold text-emerald-600">Picked: {actualQty}</span>
                        <span className="font-extrabold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Variance: -{diff}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Select
                        value={currentReason}
                        onValueChange={(val: string) => handleItemReasonChange(item.id, val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue placeholder="Select Reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCREPANCY_REASONS.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <input
                        type="text"
                        placeholder="Optional line remarks..."
                        value={itemReasons[item.id]?.remarks || ''}
                        onChange={(e) =>
                          setItemReasons((prev) => ({
                            ...prev,
                            [item.id]: {
                              reason: currentReason,
                              remarks: e.target.value,
                            },
                          }))
                        }
                        className="h-8 px-3 rounded-md text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary Reason & Remarks Form */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Primary Discrepancy Reason Code</Label>
              <Select value={globalReason} onValueChange={setGlobalReason}>
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Select primary reason" />
                </SelectTrigger>
                <SelectContent>
                  {DISCREPANCY_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs font-medium">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Overall Discrepancy Remarks & Floor Notes</Label>
              <Textarea
                placeholder="Describe warehouse floor conditions, missing cylinder serials, or supplier delivery variances..."
                value={globalRemarks}
                onChange={(e) => setGlobalRemarks(e.target.value)}
                className="text-xs bg-background border-border min-h-[70px]"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Finalizing this dispatch will update order status to <span className="font-bold">For Loading / Dispatched</span> with actual floor counts ({totalDispatched} units). The recorded variances will be logged for inventory reconciliation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="bg-muted/30 border-t border-border px-6 py-3 flex items-center justify-between sm:justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={processing} className="text-xs font-bold">
            Resume Scanning / Edit Qty
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmSubmit}
            disabled={processing}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            Confirm & Finalize Dispatch with Discrepancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
