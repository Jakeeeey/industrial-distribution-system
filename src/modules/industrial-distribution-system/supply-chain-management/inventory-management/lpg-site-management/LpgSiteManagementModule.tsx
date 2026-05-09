"use client";

import { useState } from "react";
import { LpgSiteList } from "./components/LpgSiteList";
import { LpgSiteForm } from "./components/LpgSiteForm";
import { MapPin, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LpgSiteManagementModule() {
  const [view, setView] = useState<"list" | "form">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleEdit = (id: number) => {
    setSelectedId(id);
    setView("form");
  };

  const handleCreate = () => {
    setSelectedId(null);
    setView("form");
  };

  const handleSuccess = () => {
    setView("list");
    setSelectedId(null);
  };

  const handleCancel = () => {
    setView("list");
    setSelectedId(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {view === "list" ? (
        <>
          <div className="flex flex-col gap-1 mb-2">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 shadow-inner">
                <MapPin className="h-7 w-7" />
              </div>
              LPG Site Management
            </h1>
            <p className="text-muted-foreground ml-16 text-lg">
              Manage industrial customer installations and deployed cylinder assets.
            </p>
          </div>

          <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 rounded-2xl ml-16 max-w-3xl">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100 font-bold">Operational Context</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Sites defined here are used as the foundation for **LPG Consumption Billing**. 
              Manage site-specific pricing and cylinder deployments here.
            </AlertDescription>
          </Alert>

          <div className="mt-4">
            <LpgSiteList onEdit={handleEdit} onCreate={handleCreate} />
          </div>
        </>
      ) : (
        <LpgSiteForm 
          id={selectedId} 
          onSuccess={handleSuccess} 
          onCancel={handleCancel} 
        />
      )}
    </div>
  );
}
