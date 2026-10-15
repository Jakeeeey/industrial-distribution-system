"use client";

import * as React from "react";
import { ReceivingProductsProvider } from "./providers/ReceivingProductsProvider";
import { AvailableForReceiving } from "./components/AvailableForReceiving";
import { ReceiptDetailsWorkbench } from "./components/ReceiptDetailsWorkbench";

export function ReceiptDetailsModule({ receiverId, receiverName }: { receiverId?: number; receiverName?: string }) {
    return (
        <ReceivingProductsProvider receiverId={receiverId} isReceiptMode={true}>
            <div className="h-full flex flex-col px-6 py-4 overflow-hidden">
                <div className="mb-4 shrink-0">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Purchase Order Receipt RFID
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Enter receipt details and finalize received products from approved purchase orders
                    </p>
                </div>

                <div className="flex-1 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] min-h-0 overflow-hidden">
                    <div className="h-full overflow-hidden flex flex-col">
                        <AvailableForReceiving />
                    </div>
                    <div className="h-full overflow-hidden flex flex-col">
                        <ReceiptDetailsWorkbench receiverName={receiverName} />
                    </div>
                </div>
            </div>
        </ReceivingProductsProvider>
    );
}

export default ReceiptDetailsModule;
