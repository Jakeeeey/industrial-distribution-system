"use client";

import { useState } from "react";
import { LpgBillingList } from "./components/LpgBillingList";
import { LpgBillingForm } from "./components/LpgBillingForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, History, FileText } from "lucide-react";

export default function LpgBillingModule() {
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
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                <Flame className="h-6 w-6 animate-pulse" />
              </div>
              LPG Consumption Billing
            </h1>
            <p className="text-muted-foreground ml-12">Manage and record LPG consumption for industrial customers.</p>
          </div>

          <Tabs defaultValue="kilo" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-zinc-100/50 dark:bg-zinc-800/50 backdrop-blur-sm p-1 rounded-xl">
                <TabsTrigger value="kilo" className="rounded-lg gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm">
                  <History className="h-4 w-4" />
                  KILO Billing
                </TabsTrigger>
                <TabsTrigger value="metered" disabled className="rounded-lg gap-2">
                  <FileText className="h-4 w-4" />
                  Metered Billing
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="kilo" className="mt-0 border-none p-0 focus-visible:ring-0">
              <LpgBillingList onEdit={handleEdit} onCreate={handleCreate} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <LpgBillingForm 
          id={selectedId} 
          onSuccess={handleSuccess} 
          onCancel={handleCancel} 
        />
      )}
    </div>
  );
}
