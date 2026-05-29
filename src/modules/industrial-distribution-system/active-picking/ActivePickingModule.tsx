"use client";

import React from "react";
import { ActivePickingProvider } from "./providers/ActivePickingProvider";
import { ConsolidatorSidebar } from "./components/ConsolidatorSidebar";
import { PickingWorkbench } from "./components/PickingWorkbench";

export default function ActivePickingModule({ userId }: { userId: number | null }) {
    return (
        <ActivePickingProvider userId={userId}>
            <div className="flex flex-col md:flex-row h-full w-full gap-4 p-2 md:p-0 overflow-hidden">
                <ConsolidatorSidebar />
                <PickingWorkbench />
            </div>
        </ActivePickingProvider>
    );
}