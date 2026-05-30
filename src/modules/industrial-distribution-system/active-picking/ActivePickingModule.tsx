"use client";

import React from "react";
import { ActivePickingProvider, useActivePickingContext } from "./providers/ActivePickingProvider";
import { ConsolidatorSidebar } from "./components/ConsolidatorSidebar";
import { PickingWorkbench } from "./components/PickingWorkbench";
import { cn } from "@/lib/utils";

export default function ActivePickingModule({ userId }: { userId: number | null }) {
    return (
        <ActivePickingProvider userId={userId}>
            <ActivePickingContent />
        </ActivePickingProvider>
    );
}

function ActivePickingContent() {
    const { activePickingId } = useActivePickingContext();

    return (
        <div className="flex flex-col md:flex-row h-full w-full gap-4 p-2 md:p-0 overflow-hidden">
            {/* Sidebar list: show always on desktop, on mobile show only if no picking is active */}
            <div className={cn("h-full md:block flex-shrink-0 w-full md:w-auto", activePickingId ? "hidden" : "block")}>
                <ConsolidatorSidebar />
            </div>

            {/* Workbench: show always on desktop, on mobile show only if a picking is active */}
            <div className={cn("h-full flex-1 md:block w-full md:w-auto", activePickingId ? "block" : "hidden")}>
                <PickingWorkbench />
            </div>
        </div>
    );
}