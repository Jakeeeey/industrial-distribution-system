"use client";

import { useState } from "react";
import { LpgSiteList } from "./components/LpgSiteList";
import { LpgSiteForm } from "./components/LpgSiteForm";
import { LpgSiteView } from "./components/LpgSiteView";
import { MapPin, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function LpgSiteManagementModule() {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleView = (id: number) => {
    setSelectedId(id);
    setIsViewModalOpen(true);
  };

  const handleEdit = (id: number) => {
    setSelectedId(id);
    setIsFormModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedId(null);
    setIsFormModalOpen(true);
  };

  const handleSuccess = () => {
    setIsFormModalOpen(false);
    setSelectedId(null);
  };

  const handleCancel = () => {
    setIsFormModalOpen(false);
    setSelectedId(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
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
        <LpgSiteList onEdit={handleEdit} onCreate={handleCreate} onView={handleView} />
      </div>

      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent showCloseButton={false} className="max-w-6xl sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-0 border-none">
          <LpgSiteForm 
            id={selectedId} 
            onSuccess={handleSuccess} 
            onCancel={handleCancel} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent showCloseButton={false} className="max-w-6xl sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-0 border-none">
          {selectedId && (
            <LpgSiteView
              id={selectedId}
              onBack={() => setIsViewModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
