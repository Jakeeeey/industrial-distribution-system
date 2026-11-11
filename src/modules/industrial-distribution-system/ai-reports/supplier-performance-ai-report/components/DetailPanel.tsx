/**
 * Detail Drawer Component - Slide-Over Sheet (Option A)
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Added client-side pagination to Return-To-Supplier Defect Logs (4 items per page)
 * - Clean document number badges, transaction dates, and item remarks
 */

'use client';

import React, { useState, useEffect } from 'react';
import { SupplierSummaryRow } from '../types';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import {
    ShieldAlert,
    Building2,
    Package,
    CheckCircle2,
    Clock,
    Split,
    FileText,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

interface DetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: SupplierSummaryRow | null;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
    isOpen,
    onClose,
    supplier,
}) => {
    // Pagination for RTS logs (4 logs per page)
    const [rtsPage, setRtsPage] = useState(1);
    const rtsPageSize = 4;

    // Reset pagination to page 1 whenever a new supplier is selected
    useEffect(() => {
        setRtsPage(1);
    }, [supplier?.supplierId]);

    if (!supplier) return null;

    const rtsLogs = supplier.rtsLogs || [];
    const totalRtsRecords = rtsLogs.length;
    const totalRtsPages = Math.ceil(totalRtsRecords / rtsPageSize) || 1;
    const paginatedRtsLogs = rtsLogs.slice((rtsPage - 1) * rtsPageSize, rtsPage * rtsPageSize);

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6 bg-background"
            >
                <SheetHeader className="pb-4 border-b border-border/80">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <SheetTitle className="text-lg font-bold text-foreground">
                            {supplier.supplierName}
                        </SheetTitle>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            ID #{supplier.supplierId}
                        </span>
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground mt-1">
                        {supplier.contactPerson ? `Contact: ${supplier.contactPerson} • ` : ''}
                        Terms: {supplier.paymentTerms || 'Standard'} / {supplier.deliveryTerms || 'FOB'}
                    </SheetDescription>
                </SheetHeader>

                {/* KPI Metrics Breakdown Grid */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Delivery & Fulfillment Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" />
                                Orders Due
                            </span>
                            <div className="text-xl font-bold text-foreground mt-1">
                                {supplier.totalOrdersDue}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                                On-Time Orders
                            </span>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {supplier.onTimeOrders}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                In-Full Orders
                            </span>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                {supplier.inFullOrders}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <Split className="h-3.5 w-3.5 text-amber-500" />
                                Split Deliveries
                            </span>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {supplier.splitDeliveryCount}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scorecard Summary Pill */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">OTIF Fulfillment Rate:</span>
                        <span className="font-bold text-foreground">
                            {supplier.otifPercentage !== null ? `${supplier.otifPercentage}%` : 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Rejection Rate:</span>
                        <span className="font-bold text-foreground">
                            {supplier.rejectionRatePercentage !== null ? `${supplier.rejectionRatePercentage}%` : '0.00%'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Cost Variance:</span>
                        <span className="font-bold text-foreground">
                            {supplier.averageCostVariancePercentage !== null ? `${supplier.averageCostVariancePercentage}%` : '0%'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Risk Assessment:</span>
                        <span
                            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                supplier.riskLevel === 'HIGH'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : supplier.riskLevel === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                        >
                            {supplier.riskLevel}
                        </span>
                    </div>
                </div>

                {/* Return to Supplier (RTS) Defect Log Section with Pagination */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="h-4 w-4 text-rose-500" />
                            Return-To-Supplier Defect Logs ({totalRtsRecords} events)
                        </h3>
                        {totalRtsPages > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                                Page {rtsPage} of {totalRtsPages}
                            </span>
                        )}
                    </div>

                    {totalRtsRecords === 0 ? (
                        <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                            No defective batches or RTS records logged for this vendor.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {paginatedRtsLogs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                            <span className="text-xs font-bold text-foreground">
                                                {log.docNo}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {log.quantity > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                                                    Qty: {log.quantity}
                                                </span>
                                            )}
                                            <span className="text-[11px] text-muted-foreground">
                                                {log.date}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-rose-900 dark:text-rose-300 font-medium leading-snug">
                                        "{log.reason}"
                                    </p>
                                </div>
                            ))}

                            {/* Pagination Controls for RTS logs */}
                            {totalRtsPages > 1 && (
                                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                                    <span className="text-[11px] text-muted-foreground">
                                        Showing {(rtsPage - 1) * rtsPageSize + 1} to{' '}
                                        {Math.min(rtsPage * rtsPageSize, totalRtsRecords)} of {totalRtsRecords}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setRtsPage((p) => Math.max(p - 1, 1))}
                                            disabled={rtsPage === 1}
                                            className="p-1 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                                            title="Previous RTS Logs"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRtsPage((p) => Math.min(p + 1, totalRtsPages))}
                                            disabled={rtsPage === totalRtsPages}
                                            className="p-1 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                                            title="Next RTS Logs"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
