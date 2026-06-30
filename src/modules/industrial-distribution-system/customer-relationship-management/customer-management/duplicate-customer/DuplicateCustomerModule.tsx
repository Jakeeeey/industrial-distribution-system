"use client";

import React from "react";
import { DuplicateDashboard } from "./components/DuplicateDashboard";
// ✅ Use the global Toaster in layout.tsx — do NOT mount a local Toaster here

/**
 * DuplicateCustomerModule
 * 
 * Standalone module for identifying and managing duplicate customer records.
 * Encapsulated within its own directory to prevent global side effects.
 */
const DuplicateCustomerModule: React.FC = () => {
    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-background">
            <DuplicateDashboard />
        </div>
    );
};

export default DuplicateCustomerModule;
