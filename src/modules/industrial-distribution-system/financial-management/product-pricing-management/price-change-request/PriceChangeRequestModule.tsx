// src/modules/industrial-distribution-system/financial-management/product-pricing-management/price-change-request/PriceChangeRequestModule.tsx
// Refactored from ProductPricingModule to PriceChangeRequestModule
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import PricingMatrixView from "./components/PricingMatrixView";

export default function PriceChangeRequestModule() {
    
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">Price Change Request</CardTitle>
            </CardHeader>
            <CardContent>
                <PricingMatrixView />
            </CardContent>
        </Card>
    );
}

export { PriceChangeRequestModule };
