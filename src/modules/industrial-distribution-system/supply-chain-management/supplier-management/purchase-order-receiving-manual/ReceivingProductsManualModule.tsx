"use client";

import * as React from "react";
import { ReceivingProductsManualProvider } from "./providers/ReceivingProductsManualProvider";
import { AvailableForReceivingManual } from "./components/AvailableForReceivingManual";
import { ReceivingWorkbenchManual } from "./components/ReceivingWorkbenchManual";

export function ReceivingProductsManualModule({ receiverId, receiverName }: { receiverId?: number; receiverName?: string }) {
    return (
        <ReceivingProductsManualProvider receiverId={receiverId}>
            <div className="h-full flex flex-col px-6 py-4 overflow-hidden">
                <div className="mb-4 shrink-0">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Receiving of Products Manual
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Scan and receive products from approved purchase orders
                    </p>
                </div>

                <div className="flex-1 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] min-h-0 overflow-hidden">
                    <div className="h-full overflow-hidden flex flex-col">
                        <AvailableForReceivingManual />
                    </div>
                    <div className="h-full overflow-hidden flex flex-col">
                        <ReceivingWorkbenchManual receiverName={receiverName} />
                    </div>
                </div>
            </div>
        </ReceivingProductsManualProvider>
    );
}

export default ReceivingProductsManualModule;
