"use client";

import * as React from "react";
import { useReceivingProductsManual } from "../providers/ReceivingProductsManualProvider";
import { ReceiptDetailsStep } from "./steps/ReceiptDetailsStep";
import { ProductVerificationStep } from "./steps/ProductVerificationStep";
import { RefillManualProductsStep } from "./steps/RefillManualProductsStep";
import { ReviewReceiptStep } from "./steps/ReviewReceiptStep";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Step dot styling for POs
function StepDot({ active }: { active: boolean }) {
    return (
        <div
            className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-300",
                active ? "bg-primary scale-125 shadow-sm shadow-primary/50" : "bg-slate-200 dark:bg-slate-800"
            )}
        />
    );
}

/**
 * ReceivingWorkbenchRefillManual Component
 * Dedicated workbench view for receiving Refilled POs.
 * Features a cylinder refill theme matching the Normal PO theme.
 */
export function ReceivingWorkbenchRefillManual({ receiverName }: { receiverName?: string }) {
    const { selectedPO, receiptSaved } = useReceivingProductsManual();
    const [step, setStep] = React.useState(0);

    // Reset to step 0 if PO is deselected
    React.useEffect(() => {
        if (!selectedPO) setStep(0);
    }, [selectedPO]);

    // Keep on review step (index 3) to show success state when saved
    React.useEffect(() => {
        if (receiptSaved) {
            setStep(3);
        }
    }, [receiptSaved]);

    if (!selectedPO) {
        return (
            <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <div className="text-lg font-semibold">No Refill Purchase Order Selected</div>
                    <div className="text-sm text-slate-500">Select a Refill PO from the sidebar to begin cylinder serial registration</div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 h-full flex flex-col overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 shrink-0 border-b pb-3">
                <div>
                    <div className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                        <span>Refill Cylinder Receiving Workbench</span>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-primary text-white px-2 py-0.5 rounded-md shadow-sm">Refill</span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Follow the steps to register cylinder serials and receive items for {selectedPO.poNumber}
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
                    // RefillManualProductsStep — standard themed step with tagged serials view & rapid scan
                    <RefillManualProductsStep onContinue={() => setStep(3)} onBack={() => setStep(1)} />
                ) : step === 3 ? (
                    <ReviewReceiptStep onBack={() => setStep(2)} receiverName={receiverName} />
                ) : null}
            </div>
        </Card>
    );
}

export default ReceivingWorkbenchRefillManual;
