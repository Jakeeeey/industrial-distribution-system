import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Product, Category, Brand, ProductFormValues } from "../types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Info, DollarSign, Package, Upload, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Image from "next/image";

interface ProductFormProps {
  initialValues?: Partial<Product>;
  categories: Category[];
  brands: Brand[];
  units: { unit_id: number | string; unit_name: string; unit_shortcut: string }[];
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ProductForm({
  initialValues,
  categories,
  brands,
  units,
  onSubmit,
  onCancel,
  isLoading,
  readOnly
}: ProductFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const initialImageUrl = initialValues?.product_image
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055"}/assets/${initialValues.product_image}`
    : null;
    
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is 5 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`Invalid file type. Allowed: JPEG, PNG, WebP, GIF`);
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (readOnly) return;
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, [validateAndSetFile, readOnly]);

  const clearImage = () => {
    if (readOnly) return;
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    form.setValue("product_image", null);
  };

  const form = useForm<ProductFormValues>({
    defaultValues: {
      product_name: initialValues?.product_name || "",
      product_code: initialValues?.product_code || "",
      description: initialValues?.description || "",
      short_description: initialValues?.short_description || "",
      product_category: typeof initialValues?.product_category === 'object' ? initialValues.product_category.category_id : (initialValues?.product_category || 0),
      product_brand: typeof initialValues?.product_brand === 'object' ? initialValues.product_brand.brand_id : (initialValues?.product_brand || 0),
      unit_of_measurement: typeof initialValues?.unit_of_measurement === 'object' ? initialValues.unit_of_measurement.unit_id : (initialValues?.unit_of_measurement || 0),
      unit_of_measurement_count: initialValues?.unit_of_measurement_count || 1,
      cost_per_unit: initialValues?.cost_per_unit || 0,
      price_per_unit: initialValues?.price_per_unit || 0,
      isActive: initialValues?.isActive ?? 1,
      is_serialized: initialValues?.is_serialized ?? 1,
      status: initialValues?.status || "Active",
      product_image: initialValues?.product_image || null,
    }
  });

  const handleFormSubmit = async (values: ProductFormValues) => {
    try {
      setIsUploading(true);
      let imageId = values.product_image || null;

      // Upload image first if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder_name", "product_image");

        const uploadRes = await fetch("/api/scm/product-management/product-image-upload", {
          method: "POST",
          body: formData,
        });

        const uploadResult = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || "Image upload failed");
        }

        imageId = uploadResult.data?.id || null;
      } else if (!imagePreview) {
        // Handle case where image was cleared
        imageId = null;
      }

      onSubmit({ ...values, product_image: imageId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save product");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8 py-2">
        {/* Section: Basic Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm uppercase tracking-wider">
            <Info className="h-4 w-4" />
            Basic Information
          </div>
          <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Code</FormLabel>
                  <FormControl>
                    <Input placeholder="PROD-001" {...field} value={field.value ?? ""} className="bg-slate-50/50 dark:bg-slate-900/50" disabled={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} value={field.value ?? ""} className="bg-slate-50/50 dark:bg-slate-900/50" disabled={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="product_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={categories.map((cat) => ({
                        value: cat.category_id.toString(),
                        label: cat.category_name,
                      }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      placeholder="Select category"
                      className="bg-slate-50/50 dark:bg-slate-900/50"
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="product_brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={brands.map((brand) => ({
                        value: brand.brand_id.toString(),
                        label: brand.brand_name,
                      }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      placeholder="Select brand"
                      className="bg-slate-50/50 dark:bg-slate-900/50"
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Pricing & Inventory */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm uppercase tracking-wider">
            <DollarSign className="h-4 w-4" />
            Pricing & Inventory
          </div>
          <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="cost_per_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Unit (PHP)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₱</span>
                      <Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="pl-7 bg-slate-50/50 dark:bg-slate-900/50" disabled={true} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price_per_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per Unit (PHP)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₱</span>
                      <Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="pl-7 bg-slate-50/50 dark:bg-slate-900/50" disabled={true} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormField
              control={form.control}
              name="unit_of_measurement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UOM</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={units.map((unit) => ({
                        value: unit.unit_id.toString(),
                        label: `${unit.unit_name} (${unit.unit_shortcut})`,
                      }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      placeholder="Select unit"
                      className="bg-slate-50/50 dark:bg-slate-900/50"
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit_of_measurement_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity per Unit</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseInt(e.target.value))} className="bg-slate-50/50 dark:bg-slate-900/50" disabled={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_serialized"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0 p-3 rounded-lg border bg-slate-50/30 dark:bg-slate-900/30">
                  <FormControl>
                    <Checkbox
                      checked={field.value === 1}
                      onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormLabel className="text-xs font-semibold cursor-pointer">Serialized</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Descriptions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm uppercase tracking-wider">
            <Package className="h-4 w-4" />
            Additional Details
          </div>
          <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />
          <FormField
            control={form.control}
            name="short_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Short Description</FormLabel>
                <FormControl>
                  <Input placeholder="Brief summary for reports" {...field} value={field.value ?? ""} className="bg-slate-50/50 dark:bg-slate-900/50" disabled={readOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Technical Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Detailed product specifications..." {...field} value={field.value ?? ""} className="min-h-[100px] bg-slate-50/50 dark:bg-slate-900/50 resize-none" disabled={readOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-3 pt-2">
            <FormLabel>Product Image</FormLabel>
            <div
              onClick={() => { if (!readOnly) fileInputRef.current?.click(); }}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); if (!readOnly) setIsDragging(true); }}
              onDragLeave={() => { if (!readOnly) setIsDragging(false); }}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                readOnly ? "cursor-default opacity-80 bg-slate-50/50 dark:bg-slate-900/50" : "cursor-pointer"
              } ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              {imagePreview ? (
                <div className="relative">
                  <Image
                    src={imagePreview}
                    alt="Product Preview"
                    width={160}
                    height={160}
                    className="h-40 w-40 rounded-lg object-contain aspect-square bg-white dark:bg-slate-950 border"
                    unoptimized
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/80 shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!readOnly && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Click to replace image
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="rounded-full bg-muted p-4 mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Click or drag to upload</p>
                  <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
                    JPEG, PNG, WebP, GIF up to 5MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={readOnly}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) validateAndSetFile(file);
                }}
              />
            </div>
            <FormMessage />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={isLoading || isUploading}>
              {isLoading || isUploading ? "Saving..." : "Save Product"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
