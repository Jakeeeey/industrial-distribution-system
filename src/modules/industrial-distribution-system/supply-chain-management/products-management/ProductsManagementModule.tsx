"use client";

import React, { useState } from "react";
import { useProductsManagement } from "./hooks/useProductsManagement";
import { ProductTable } from "./components/ProductTable";
import { ProductCatalog } from "./components/ProductCatalog";
import { CategoryTable } from "./components/CategoryTable";
import { BrandTable } from "./components/BrandTable";
import { ProductForm } from "./components/ProductForm";
import { CategoryForm } from "./components/CategoryForm";
import { BrandForm } from "./components/BrandForm";
import { productsService } from "./services/products-service";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Package, Tags, Briefcase, Trash, List, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

interface ProductsManagementModuleProps {
  initialTab?: string;
  hideTabs?: boolean;
}

export default function ProductsManagementModule({ 
  initialTab = "products", 
  hideTabs = false 
}: ProductsManagementModuleProps) {
  const { 
    products, 
    categories, 
    brands, 
    units, 
    loading, 
    refresh,
    page,
    setPage,
    limit,
    totalItems
  } = useProductsManagement();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "catalog">("list");

  const handleCreate = () => {
    setEditingItem(null);
    setIsViewOnly(false);
    setIsDialogOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsViewOnly(false);
    setIsDialogOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleView = (item: any) => {
    setEditingItem(item);
    setIsViewOnly(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    try {
      if (activeTab === "products") await productsService.deleteProduct(id);
      // Add delete for categories/brands if needed
      toast.success("Item deleted successfully");
      refresh();
    } catch (error) {
      toast.error("Delete failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedProductIds.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedProductIds.length} items?`)) return;

    try {
      await productsService.deleteProducts(selectedProductIds);
      toast.success("Items deleted successfully");
      setSelectedProductIds([]);
      refresh();
    } catch (error) {
      toast.error("Bulk delete failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (values: any) => {
    setIsSaving(true);
    try {
      if (activeTab === "products") {
        if (editingItem) {
          await productsService.updateProduct(editingItem.product_id, values);
          toast.success("Product updated successfully");
        } else {
          await productsService.createProduct(values);
          toast.success("Product created successfully");
        }
      } else if (activeTab === "categories") {
        if (editingItem) {
          await productsService.updateCategory(editingItem.category_id, values);
          toast.success("Category updated successfully");
        } else {
          await productsService.createCategory(values);
          toast.success("Category created successfully");
        }
      } else if (activeTab === "brands") {
        if (editingItem) {
          await productsService.updateBrand(editingItem.brand_id, values);
          toast.success("Brand updated successfully");
        } else {
          await productsService.createBrand(values);
          toast.success("Brand created successfully");
        }
      }
      
      setIsDialogOpen(false);
      refresh();
    } catch (error) {
      toast.error("Save failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="container mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Products Management
            </h1>
            <p className="text-muted-foreground text-lg mt-1">
              Master catalog for products, categories, and brands.
            </p>
          </div>
          <Button 
            onClick={handleCreate} 
            className="h-12 px-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-none text-white font-bold"
          >
            <Plus className="mr-2 h-5 w-5" /> 
            Create New {activeTab === "products" ? "Product" : activeTab === "categories" ? "Category" : "Brand"}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!hideTabs && (
          <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 p-1 text-slate-500 dark:text-slate-400 mb-8">
            <TabsTrigger 
              value="products" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm"
            >
              <Package className="h-4 w-4 mr-2" /> Products
            </TabsTrigger>
            <TabsTrigger 
              value="categories" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm"
            >
              <Tags className="h-4 w-4 mr-2" /> Categories
            </TabsTrigger>
            <TabsTrigger 
              value="brands" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm"
            >
              <Briefcase className="h-4 w-4 mr-2" /> Brands
            </TabsTrigger>
          </TabsList>
        )}

          <div className="glass-card rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-2xl backdrop-blur-md bg-white/40 dark:bg-slate-900/40 p-1">
            <TabsContent value="products" className="m-0 focus-visible:outline-none">
              <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-2">
                  <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "list" | "catalog")} className="bg-background border border-border/50 rounded-xl p-0.5 mr-2">
                    <ToggleGroupItem value="list" aria-label="List View" className="rounded-lg px-3 data-[state=on]:bg-primary/10 data-[state=on]:text-primary h-8">
                      <List className="w-4 h-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="catalog" aria-label="Catalog View" className="rounded-lg px-3 data-[state=on]:bg-primary/10 data-[state=on]:text-primary h-8">
                      <LayoutGrid className="w-4 h-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {selectedProductIds.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="animate-in fade-in slide-in-from-left-2">
                      <Trash className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedProductIds.length})
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {totalItems} items
                </div>
              </div>

              {viewMode === "list" ? (
                <ProductTable 
                  products={products} 
                  categories={categories}
                  brands={brands}
                  selectedIds={selectedProductIds}
                  onSelectionChange={setSelectedProductIds}
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                  onView={handleView} 
                />
              ) : (
                <ProductCatalog 
                  products={products} 
                  categories={categories}
                  brands={brands}
                  selectedIds={selectedProductIds}
                  onSelectionChange={setSelectedProductIds}
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                  onView={handleView} 
                />
              )}

              <div className="flex items-center justify-end space-x-2 py-4 px-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {page} of {Math.ceil(totalItems / limit) || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalItems / limit) || loading}
                >
                  Next
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="categories" className="m-0 focus-visible:outline-none">
              <CategoryTable 
                categories={categories} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            </TabsContent>

            <TabsContent value="brands" className="m-0 focus-visible:outline-none">
              <BrandTable 
                brands={brands} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {isViewOnly ? "View" : editingItem ? "Edit" : "Create"} {activeTab === "products" ? "Product" : activeTab === "categories" ? "Category" : "Brand"}
            </DialogTitle>
            <DialogDescription>
              {isViewOnly ? "Viewing details of the selected item." : `Fill in the details below to ${editingItem ? "update the existing" : "add a new"} ${activeTab.slice(0, -1)}.`}
            </DialogDescription>
          </DialogHeader>

          {activeTab === "products" && (
            <ProductForm 
              initialValues={editingItem} 
              categories={categories} 
              brands={brands} 
              units={units}
              onSubmit={handleSubmit} 
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSaving}
              readOnly={isViewOnly}
            />
          )}

          {activeTab === "categories" && (
            <CategoryForm 
              initialValues={editingItem}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSaving}
            />
          )}

          {activeTab === "brands" && (
            <BrandForm 
              initialValues={editingItem}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSaving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
