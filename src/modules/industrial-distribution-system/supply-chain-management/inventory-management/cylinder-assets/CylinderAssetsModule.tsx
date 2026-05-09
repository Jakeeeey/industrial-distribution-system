"use client";

import { useState } from "react";
import { useCylinderAssets } from "./hooks/useCylinderAssets";
import { CylinderAssetsList } from "./components/CylinderAssetsList";
import { CylinderAssetsForm } from "./components/CylinderAssetsForm";
import { ModuleSkeleton } from "@/components/shared/ModuleSkeleton";
import ErrorPage from "@/components/shared/ErrorPage";
import { CylinderAsset } from "./types";

export default function CylinderAssetsModule() {
  const {
    data,
    isLoading,
    error,
    refresh,
    filters,
    pagination,
    sorting,
    createBulkAssets,
    updateAsset,
    deleteAsset,
  } = useCylinderAssets();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<CylinderAsset | null>(null);

  if (isLoading && data.length === 0) {
    return <ModuleSkeleton hasTabs={false} rowCount={6} />;
  }

  if (error) {
    return (
      <ErrorPage
        code="Connection Error"
        title="Failed to Load Cylinder Assets"
        message={error}
        reset={refresh}
      />
    );
  }

  const handleCreate = () => {
    setSelectedId(null);
    setView("create");
  };

  const handleEdit = (id: number) => {
    const asset = data.find((a) => a.id === id) ?? null;
    setSelectedId(id);
    setSelectedAsset(asset);
    setView("edit");
  };

  const handleBack = () => {
    setSelectedId(null);
    setSelectedAsset(null);
    setView("list");
  };

  return (
    <div className="h-full">
      <CylinderAssetsList
        data={data}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={deleteAsset}
        filters={filters}
        pagination={pagination}
        sorting={sorting}
      />

      <CylinderAssetsForm
        id={selectedId}
        asset={selectedAsset}
        open={view === "create" || view === "edit"}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleBack();
        }}
        onSuccess={() => {
          handleBack();
          refresh();
        }}
        createBulkAssets={createBulkAssets}
        updateAsset={updateAsset}
      />
    </div>
  );
}
