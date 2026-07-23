"use client";

import * as React from "react";
import { useReceivingProductsManual } from "../providers/ReceivingProductsManualProvider";
import { ReceiptDetailsStep } from "./steps/ReceiptDetailsStep";
import { ProductVerificationStep } from "./steps/ProductVerificationStep";
import { ManualProductsStep } from "./steps/ManualProductsStep";
import { ReviewReceiptStep } from "./steps/ReviewReceiptStep";
import { ReadonlyReceivingPODetails } from "./ReadonlyReceivingPODetails";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReceivingWorkbenchRefillManual } from "./ReceivingWorkbenchRefillManual";
import { receivingManualWorkbenchMode, shouldShowReceivingWorkbenchSkeleton } from "../utils/receivingManualView";

function StepDot({ active }: { active: boolean }) {
    return (
        <div
            className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-primary" : "bg-muted")}
        />
    );
}

export function ReceivingWorkbenchManual({ receiverName }: { receiverName?: string }) {
    const { selectedPO, receiptSaved, openingPOId } = useReceivingProductsManual();

    // Hooks must be called unconditionally before any early returns - AG 2026-06-26
    const [step, setStep] = React.useState(0);
    const workbenchMode = receivingManualWorkbenchMode(selectedPO);
    const showSkeleton = shouldShowReceivingWorkbenchSkeleton(openingPOId);

    // Reset to step 0 if PO is deselected - AG 2026-06-26
    React.useEffect(() => {
        if (!selectedPO) setStep(0);
    }, [selectedPO]);

    // If receipt is saved, we usually stay on step 3 or the module handles visibility - AG 2026-06-26
    React.useEffect(() => {
        if (receiptSaved) {
            // Keep on review step (index 3) to show success state
            setStep(3);
        }
    }, [receiptSaved]);

    if (showSkeleton) {
        return <ReceivingWorkbenchSkeleton />;
    }

    if (workbenchMode === "readonly") {
        return (
            <Card className="p-4 h-full flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 shrink-0">
                    <div>
                        <div className="text-base font-semibold">Purchase Order Receiving Details</div>
                        <div className="text-xs text-muted-foreground">
                            Review received items and receipt history for {selectedPO?.poNumber}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex-1 overflow-hidden flex flex-col">
                    <ReadonlyReceivingPODetails />
                </div>
            </Card>
        );
    }

    // Delegate to dedicated refill workbench if selected PO is a refill PO.
    // Moved after hooks to comply with Rules of Hooks. - AG 2026-06-26
    if (selectedPO?.isRefill) {
        return <ReceivingWorkbenchRefillManual receiverName={receiverName} />;
    }

    if (!selectedPO) {
        return (
            <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <div className="text-lg font-semibold">No Purchase Order Selected</div>
                    <div className="text-sm text-muted-foreground">Select a PO from the sidebar to begin receiving</div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 shrink-0">
                <div>
                    <div className="text-base font-semibold">Receiving Workbench Manual</div>
                    <div className="text-xs text-muted-foreground">
                        Follow the steps to receive items for {selectedPO.poNumber}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <StepDot active={step === 0} />
                    <StepDot active={step === 1} />
                    <StepDot active={step === 2} />
                    <StepDot active={step === 3} />
                </div>
            </div>

            <div className="mt-4 flex-1 overflow-hidden flex flex-col">
                {step === 0 ? (
                    <ReceiptDetailsStep onContinue={() => setStep(1)} />
                ) : step === 1 ? (
                    <ProductVerificationStep onContinue={() => setStep(2)} />
                ) : step === 2 ? (
                    <ManualProductsStep onContinue={() => setStep(3)} onBack={() => setStep(1)} />
                ) : step === 3 ? (
                    <ReviewReceiptStep onBack={() => setStep(2)} receiverName={receiverName} />
                ) : null}
            </div>
        </Card>
    );
}

function ReceivingWorkbenchSkeleton() {
    return (
        <Card className="p-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 shrink-0">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-3 w-96 max-w-full" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                </div>
            </div>

            <div className="mt-4 flex-1 overflow-hidden flex flex-col gap-4">
                <Card className="p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <Skeleton className="h-3 w-44" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-y-4 gap-x-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <React.Fragment key={index}>
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-3 w-full max-w-72 justify-self-end" />
                            </React.Fragment>
                        ))}
                    </div>
                    <Skeleton className="mt-6 h-9 w-full rounded-lg" />
                </Card>

                <Card className="p-4 shadow-sm">
                    <Skeleton className="h-3 w-48" />
                    <div className="mt-4 space-y-3">
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                </Card>

                <Card className="p-4 shadow-sm flex-1">
                    <Skeleton className="h-3 w-36" />
                    <div className="mt-6 space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-9 w-full rounded-lg" />
                        ))}
                    </div>
                </Card>
            </div>
        </Card>
    );
}
