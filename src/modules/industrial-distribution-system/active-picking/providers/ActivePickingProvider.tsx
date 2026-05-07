"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useActivePicking } from "../hooks/useActivePicking";

type ActivePickingContextType = ReturnType<typeof useActivePicking>;

const ActivePickingContext = createContext<ActivePickingContextType | null>(null);

export function ActivePickingProvider({ children, userId }: { children: React.ReactNode, userId: number | null }) {
    const pickingState = useActivePicking(userId);
    const { fetchBranches, fetchPickings } = pickingState;

    // Initial fetch of branches and pickings
    useEffect(() => {
        fetchBranches();
        fetchPickings();
    }, [fetchBranches, fetchPickings]);

    return (
        <ActivePickingContext.Provider value={pickingState}>
            {children}
        </ActivePickingContext.Provider>
    );
}

export function useActivePickingContext() {
    const context = useContext(ActivePickingContext);
    if (!context) {
        throw new Error("useActivePickingContext must be used within an ActivePickingProvider");
    }
    return context;
}
