"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, useWatch, Control, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Tag,
  ArrowLeft,
  Package,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SerialInputModal } from "../modals/SerialInputModal";
import {
  StockAdjustmentFormSchema,
  StockAdjustmentFormValues,
  StockAdjustmentProduct,
  StockAdjustmentItem,
} from "../../types/stock-adjustment.schema";
import { useStockAdjustmentForm } from "../../hooks/useStockAdjustmentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

// ——————————————————————————————————————————————————————————————————————————————
interface StockAdjustmentFormProps {
  id: number | null;
  onCancel: () => void;
  onSuccess: () => void;
}

// ——————————————————————————————————————————————————————————————————————————————
// Memoised item row (renders only when *its own* data changes)
interface ItemRowProps {
  index: number;
  control: Control<StockAdjustmentFormValues>;
  productOptions: { value: string; label: string; item: StockAdjustmentProduct }[];
  isProductsLoading: boolean;
  isLoadingDetails: boolean;
  onProductSelect: (index: number, product: StockAdjustmentProduct) => void;
  onRemove: (index: number) => void;
  setValue: UseFormSetValue<StockAdjustmentFormValues>;
  onOpenSerialInput: (index: number) => void;
  isReadOnly?: boolean;
}

const StockAdjustmentItemRow = React.memo(function StockAdjustmentItemRow({
  index,
  control,
  productOptions,
  isProductsLoading,
  isLoadingDetails,
  onProductSelect,
  onRemove,
  setValue,
  onOpenSerialInput,
  isReadOnly = false,
}: ItemRowProps) {
  // useWatch subscribes to specific fields — only this row re-renders when its own data changes.
  const product_name = useWatch({ control, name: `items.${index}.product_name` });
  const productId = useWatch({ control, name: `items.${index}.product_id` });
  const unitName = useWatch({ control, name: `items.${index}.unit_name` });
  const quantity = useWatch({ control, name: `items.${index}.quantity` });
  const costPerUnit = useWatch({ control, name: `items.${index}.cost_per_unit` });
  const isSerialized = useWatch({ control, name: `items.${index}.is_serialized` });
  const serialNumbers = useWatch({ control, name: `items.${index}.serial_numbers` });
  const brandName = useWatch({ control, name: `items.${index}.brand_name` });
  const barcode = useWatch({ control, name: `items.${index}.barcode` });
  const description = useWatch({ control, name: `items.${index}.description` });

  const [productSearch, setProductSearch] = useState("");
  const [productInputValue, setProductInputValue] = useState(product_name || "");

  // Synchronize input value (e.g. for Edit mode) during render if name changed
  // This avoids the 'cascading renders' lint error from useEffect
  const [prevProductName, setPrevProductName] = useState(product_name);
  if (product_name !== prevProductName) {
    setPrevProductName(product_name);
    if (!productSearch) {
      setProductInputValue(product_name || "");
    }
  }

  const dbId = useWatch({ control, name: `items.${index}.db_id` });

  const totalCost = Number(quantity || 0) * Number(costPerUnit || 0);

  return (
    <div
      className={`border-b last:border-0 p-6 space-y-4 transition-colors duration-200 relative ${isSerialized ? "bg-blue-50/10 dark:bg-blue-900/10 border-blue-200/30 dark:border-blue-800/20" : "border-border/50"
        }`}
    >
      {/* Per-row loading overlay for Serial/inventory lookup */}
      {isLoadingDetails && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-md">
          <div className="flex items-center gap-3 bg-background border border-border shadow-sm px-4 py-2.5 rounded-lg">
            <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-muted-foreground">Checking serial data...</span>
          </div>
        </div>
      )}
      <div className="flex items-start gap-4">
        {/* Product Selection */}
        <div className="flex-[3] space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Product <span className="text-red-500">*</span>
          </Label>
          <Combobox
            value={String(productId || "")}
            onValueChange={(val: string | null) => {
              if (!val) {
                setProductInputValue("");
                return;
              }
              const product = productOptions.find(
                (p) => String(p.value) === val
              )?.item;
              if (product) {
                setProductInputValue(product.product_name);
                onProductSelect(index, product);
              }
            }}
            inputValue={productInputValue}
            onInputValueChange={(v: string) => {
              // base-ui fires this with the raw ID after selection — show the product name instead
              const matched = productOptions.find(p => String(p.value) === v);
              if (matched) {
                setProductInputValue(matched.item.product_name);
                setProductSearch("");
              } else {
                setProductInputValue(v);
                setProductSearch(v);
              }
            }}
          >
            <ComboboxInput
              placeholder="Select Product"
              disabled={isProductsLoading || isReadOnly || !!dbId}
              showClear
            />
            <ComboboxContent>
              <ComboboxList>
                {(() => {
                  const filtered = productOptions.filter(opt =>
                    opt.label.toLowerCase().includes(productSearch.toLowerCase()) ||
                    opt.item.product_code?.toLowerCase().includes(productSearch.toLowerCase())
                  );
                  if (filtered.length === 0) return <ComboboxEmpty>No products found.</ComboboxEmpty>;
                  return filtered.map((option) => {
                    const p = option.item;
                    return (
                      <ComboboxItem key={option.value} value={option.value}>
                        <div className="flex items-center justify-between w-full gap-4 min-w-[300px]">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground line-clamp-1 text-xs">
                              {p.product_name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {p.product_code}
                              </span>
                              {p.unit_name && (
                                <>
                                  <span className="text-[9px] text-muted-foreground/30">•</span>
                                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight bg-blue-50 dark:bg-blue-900/20 px-1 rounded">
                                    {p.unit_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {p.is_serialized && (
                            <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 shrink-0">
                              <Tag className="h-2 w-2 fill-blue-700 dark:fill-blue-400" />
                              SERIALIZED
                            </div>
                          )}
                        </div>
                      </ComboboxItem>
                    );
                  });
                })()}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {/* Unit */}
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Unit
          </Label>
          <div className="h-10 w-full bg-muted/30 border border-border rounded-md flex items-center px-3 text-sm text-muted-foreground font-medium overflow-hidden">
            <span className="truncate">{unitName || "-"}</span>
          </div>
        </div>

        {/* Qty */}
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Qty <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            value={isSerialized ? (serialNumbers?.length || 0) : (quantity ?? "")}
            onChange={(e) => {
              if (isSerialized) return; // Prevent manual change if serialized
              setValue(
                `items.${index}.quantity`,
                e.target.value === "" ? 0 : Number(e.target.value)
              )
            }}
            readOnly={isReadOnly || isSerialized}
            className={`h-10 border-input focus:ring-blue-500 rounded-md text-sm ${isReadOnly || isSerialized
              ? "bg-muted text-muted-foreground cursor-not-allowed font-bold"
              : ""
              }`}
            min={0}
          />
        </div>

        {/* Serial Input Trigger */}
        {isSerialized && (
          <div className="flex items-end pb-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenSerialInput(index)}
              className="h-10 border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700 font-bold gap-2 px-3 transition-all duration-200 shadow-sm"
            >
              <Tag className="h-4 w-4" />
              Serial Numbers
            </Button>
          </div>
        )}

        {/* Cost/Unit */}
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Cost/Unit
          </Label>
          <Input
            value={`₱${Number(costPerUnit || 0).toFixed(2)}`}
            className="h-10 border-input bg-muted/30 rounded-md text-sm"
            readOnly
          />
        </div>

        {/* Total Cost */}
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Total Cost
          </Label>
          <div className="h-10 border border-blue-100/20 dark:border-blue-900/20 bg-blue-50/30 dark:bg-blue-900/10 rounded-md flex items-center px-3 font-bold text-blue-600 text-sm">
            ₱
            {Number(totalCost || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        {/* Delete */}
        <div className="pt-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={isReadOnly || !!dbId}
            className={`shrink-0 self-end mb-0.5 rounded-full transition-all ${isReadOnly ? "hidden" : "hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-muted-foreground/50"
              } ${!!dbId && !isReadOnly ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
            title={!!dbId && !isReadOnly ? "Existing items cannot be deleted" : "Remove item"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata Section */}
      {productId ? (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-6 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/70 font-bold uppercase tracking-tighter">
                Brand:
              </span>{" "}
              {brandName || "N/A"}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/70 font-bold uppercase tracking-tighter">
                Barcode:
              </span>{" "}
              {barcode || "N/A"}
            </span>
          </div>

          {isSerialized && (
            <div className="flex items-center gap-2 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 w-fit px-2.5 py-1 rounded-md">
              <Tag className="h-3 w-3 text-blue-500 fill-blue-500" />
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-500">
                {(serialNumbers?.length || 0)} Serial Number(s) added
              </span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/60 italic font-medium">
            {description || "No description available."}
          </p>
        </div>
      ) : null}

      {/* Remarks Section */}
      <div className="space-y-2">
        <Label className="text-xs font-bold text-muted-foreground">Item Remarks</Label>
        <Input
          placeholder="Enter remarks for this item..."
          value={useWatch({ control, name: `items.${index}.remarks` }) || ""}
          onChange={(e) => setValue(`items.${index}.remarks`, e.target.value)}
          className="h-10 border-input focus:ring-blue-500 rounded-md text-sm bg-background"
          readOnly={isReadOnly}
        />
      </div>
    </div>
  );
});

// ——————————————————————————————————————————————————————————————————————————————
function FormSummary({
  control,
  fieldCount,
  isSerialLoading,
}: {
  control: Control<StockAdjustmentFormValues>;
  fieldCount: number;
  isSerialLoading: boolean;
}) {
  const items = useWatch({ control, name: "items" });

  const { totalQuantity, totalAmount, serializedItemsCount } = useMemo(() => {
    const currentItems = items || [];
    let qty = 0;
    let amt = 0;
    let serialized = 0;
    for (const item of currentItems) {
      const q = Number(item?.quantity || 0);
      const c = Number(item?.cost_per_unit || 0);
      qty += q;
      amt += q * c;
      if (item?.is_serialized) serialized++;
    }
    return { totalQuantity: qty, totalAmount: amt, serializedItemsCount: serialized };
  }, [items]);

  return (
    <div className="border-t border-border px-8 py-5 flex justify-end bg-muted/30">
      <div className="w-full max-w-[400px] space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="font-bold text-muted-foreground">Total Items:</span>
          <span className="font-bold text-foreground">
            {fieldCount} product(s)
          </span>
        </div>
        <div className="h-px bg-border w-full" />
        <div className="flex justify-between items-center text-sm">
          <span className="font-bold text-muted-foreground">Total Quantity:</span>
          <span className="font-bold text-foreground">
            {totalQuantity} units
          </span>
        </div>
        <div className="h-px bg-border w-full" />
        <div className="flex justify-between items-center pt-1">
          <span className="font-bold text-muted-foreground text-sm">
            Total Amount:
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            ₱
            {Number(totalAmount || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {(serializedItemsCount > 0 || isSerialLoading) && (
          <>
            <div className="h-px bg-border w-full" />
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Serialized Items:
              </span>
              {isSerialLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 bg-blue-100/20 dark:bg-blue-900/20 animate-pulse" />
                  <span className="text-[10px] text-blue-400 animate-pulse">
                    Checking...
                  </span>
                </div>
              ) : (
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {serializedItemsCount} product(s)
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————————
function SerialBanner({ control }: { control: Control<StockAdjustmentFormValues> }) {
  const items = useWatch({ control, name: "items" });
  const serializedItemsCount = useMemo(() => {
    const currentItems = (items || []) as StockAdjustmentItem[];
    return currentItems.filter((item) => item?.is_serialized).length;
  }, [items]);

  if (serializedItemsCount === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 px-6 py-4 rounded-xl flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <h4 className="font-bold text-blue-900 dark:text-blue-400">
          Serialized Items Detected
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-300 opacity-90 text-[11px] font-medium mt-1">
          {serializedItemsCount} item(s) in this adjustment are serialized. Please ensure proper serial number management.
        </p>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————————
export function StockAdjustmentForm({
  id,
  onCancel,
  onSuccess,
}: StockAdjustmentFormProps) {
  const {
    fetchById,
    createAdjustment,
    updateAdjustment,
    fetchProducts,
    fetchProductsBySupplier,
    products = [],
    suppliers = [],
    isProductsLoading,
    isSuppliersLoading,
    isSerialLoading,
    branches,
    fetchInventory,
    fetchBranchSerialData,
    fetchBranchInventory,
    inventoryMap,
    fetchNextDocNo,
    postAdjustment,
    validateSerialAvailability,
  } = useStockAdjustmentForm();

  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
  const [showSerialInput, setShowSerialInput] = useState(false);
  const [showPostConfirmation, setShowPostConfirmation] = useState(false);
  const [serialContext, setSerialContext] = useState<{ index: number; productName: string } | null>(null);
  const [isScannerPreparing, setIsScannerPreparing] = useState(false);
  const [branchInputValue, setBranchInputValue] = useState("");
  const [supplierInputValue, setSupplierInputValue] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  // --- Memoize product options to prevent expensive re-mapping in every row ---
  const productOptions = useMemo(() => {
    return products.map((p) => ({
      // Use record PK (id) for absolute uniqueness, fallback to product_id
      value: String(p.id || p.product_id),
      // Include unit in label to prevent CommandItem collision and help user selection
      label: p.unit_name ? `${p.product_name} (${p.unit_name})` : p.product_name,
      item: p
    }));
  }, [products]);

  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(StockAdjustmentFormSchema),
    defaultValues: {
      doc_no: "", // Will be fetched via effect
      branch_id: 0,
      supplier_id: 0,
      type: "IN",
      remarks: "",
      items: [],
      isPosted: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // ——————————————————————————————————————————————————————————————————————————————
  useEffect(() => {
    const unlock = () => {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.body.style.removeProperty('pointer-events');
      }
    };
    unlock();
    const timer = setTimeout(unlock, 1000);
    const timer2 = setTimeout(unlock, 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [loading]);

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        setLoading(true);
        try {
          const data = await fetchById(id);

          // --- Auto-Infer Supplier ID ---
          let finalSupplierId = data.supplier_id
            ? (typeof data.supplier_id === "object" ? (data.supplier_id as { id: number }).id : data.supplier_id)
            : 0;

          // If header supplier is missing, try to get it from the first item with an inferred supplier
          // If header supplier is missing, try to get it from the first item with an inferred supplier
          if (!finalSupplierId && data.items && data.items.length > 0) {
            const firstWithInferred = data.items.find((item) => (item as StockAdjustmentItem).inferred_supplier_id);
            if (firstWithInferred) {
              finalSupplierId = (firstWithInferred as StockAdjustmentItem).inferred_supplier_id || 0;
            }
          }

            // Directus may return isPosted as a Buffer {type:'Buffer',data:[0|1]},
            // a number (0 or 1), or a boolean. Normalise to a real boolean:
            const rawPosted = data.isPosted as unknown;
            const resolvedIsPosted =
              rawPosted && typeof rawPosted === 'object' && 'data' in rawPosted
                ? (rawPosted as { data: number[] }).data?.[0] === 1
                : Number(rawPosted) === 1;

          form.reset({
            doc_no: data.doc_no,
            branch_id:
              typeof data.branch_id === "object"
                ? data.branch_id?.id
                : (data.branch_id || 0),
            supplier_id: finalSupplierId,
            type: data.type,
            remarks: data.remarks || "",
            isPosted: resolvedIsPosted,
            items: data.items.map((item) => ({
              ...item,
              product_id: String(
                (item.product_id as { id?: number; product_id?: number })?.id ||
                (item.product_id as { id?: number; product_id?: number })?.product_id ||
                item.product_id
              ),
              product_name:
                (item.product_id as { product_name?: string })?.product_name ||
                item.product_name ||
                "",
              product_code:
                (item.product_id as { product_code?: string })?.product_code ||
                item.product_code ||
                "",
              cost_per_unit:
                (item.product_id as { cost_per_unit?: number; price_per_unit?: number })?.cost_per_unit ||
                (item.product_id as { cost_per_unit?: number; price_per_unit?: number })?.price_per_unit ||
                item.cost_per_unit ||
                0,
              current_stock: item.current_stock || 0,
              is_serialized: !!item.is_serialized,
              unit_name:
                item.unit_name ||
                (item.product_id as { unit_name?: string })?.unit_name ||
                "pcs",
              unit_order: (item.product_id as { unit_of_measurement?: { order: number } })?.unit_of_measurement?.order || 1,
              serial_numbers: item.serial_numbers || [],
              serial_count: item.serial_count || 0,
              db_id: item.id,
            })),
            posted_by: data.posted_by,
            postedAt: data.postedAt,
          });
        } catch (error) {
          toast.error("Failed to load adjustment details");
          console.error("Load error:", error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ——————————————————————————————————————————————————————————————————————————————
  // Auto-populate combobox display labels when editing (branch & supplier)
  // Runs whenever branches/suppliers load OR when the form values change.
  const watchedBranchId = useWatch({ control: form.control, name: "branch_id" });
  const watchedSupplierId = useWatch({ control: form.control, name: "supplier_id" });

  useEffect(() => {
    if (watchedBranchId && branches.length > 0) {
      const found = branches.find(b => b.id === Number(watchedBranchId));
      if (found) setBranchInputValue(`${found.branch_name} (${found.branch_code ?? ""})`);
    }
  }, [watchedBranchId, branches]);

  useEffect(() => {
    if (watchedSupplierId && suppliers.length > 0) {
      const found = suppliers.find(s => s.id === Number(watchedSupplierId));
      if (found) setSupplierInputValue(`${found.supplier_name}${found.supplier_shortcut ? ` (${found.supplier_shortcut})` : ""}`);
    }
  }, [watchedSupplierId, suppliers]);

  useEffect(() => {
    if (watchedBranchId) {
      fetchBranchSerialData(Number(watchedBranchId));
      fetchBranchInventory(Number(watchedBranchId));
    }
  }, [watchedBranchId, fetchBranchSerialData, fetchBranchInventory]);

  // ——————————————————————————————————————————————————————————————————————————————
  useEffect(() => {
    if (!id) {
      const updateDocNo = async () => {
        const type = form.getValues("type");
        const nextDocNo = await fetchNextDocNo(type);
        form.setValue("doc_no", nextDocNo);
      };
      updateDocNo();
    }
  }, [id, fetchNextDocNo, form]);

  // ——————————————————————————————————————————————————————————————————————————————
  const watchedTypeToUpdateDocNo = useWatch({ control: form.control, name: "type" });
  useEffect(() => {
    if (!id && watchedTypeToUpdateDocNo) {
      const updateDocNo = async () => {
        const nextDocNo = await fetchNextDocNo(watchedTypeToUpdateDocNo);
        form.setValue("doc_no", nextDocNo);
      };
      updateDocNo();
    }
  }, [id, watchedTypeToUpdateDocNo, fetchNextDocNo, form]);

  // ——————————————————————————————————————————————————————————————————————————————
  useEffect(() => {
    if (watchedSupplierId && suppliers.length > 0) {
      const selectedSupplier = suppliers.find(s => s.id === Number(watchedSupplierId));
      if (selectedSupplier?.division_id === 1) {
        fetchProductsBySupplier(Number(watchedSupplierId));
      } else {
        fetchProducts();
      }
    } else if (!watchedSupplierId) {
      fetchProducts();
    }
  }, [watchedSupplierId, suppliers, fetchProductsBySupplier, fetchProducts]);

  // ——————————————————————————————————————————————————————————————————————————————
  const isFormLoading = id ? loading : false;
  const isPosted = useWatch({ control: form.control, name: "isPosted" });
  const isReadOnly = !!isPosted;

  // ——————————————————————————————————————————————————————————————————————————————
  const handlePost = async () => {
    if (!id) return;
    setShowPostConfirmation(true);
  };

  const confirmPost = async () => {
    setShowPostConfirmation(false);
    if (!id) return;
    setLoading(true);
    try {
      await postAdjustment(id);
      toast.success("Adjustment Posted Successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post adjustment");
    } finally {
      setLoading(false);
    }
  };

  // ——————————————————————————————————————————————————————————————————————————————
  const onSubmit = useCallback(
    async (values: StockAdjustmentFormValues) => {
      setLoading(true);
      try {
        if (id) {
          await updateAdjustment(id, values);
          toast.success("Adjustment Updated Successfully");
        } else {
          await createAdjustment(values);
          toast.success("Adjustment Created Successfully");
        }
        onSuccess();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save adjustment";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [id, createAdjustment, updateAdjustment, onSuccess]
  );

  // ——————————————————————————————————————————————————————————————————————————————
  const handleAddProduct = useCallback(() => {
    const supplierId = form.getValues("supplier_id");
    if (!supplierId) {
      toast.error("Please select a supplier first");
      return;
    }

    append({
      product_id: 0,
      product_name: "",
      product_code: "",
      quantity: 0,
      branch_id: form.getValues("branch_id"),
      type: form.getValues("type"),
      cost_per_unit: 0,
      unit_name: "-",
      remarks: "",
      serial_numbers: [],
      serial_count: 0,
    });
  }, [append, form]);

  const handleSerialSave = useCallback((serials: string[]) => {
    if (serialContext) {
      const { index } = serialContext;
      form.setValue(`items.${index}.serial_numbers`, serials, { shouldValidate: true });
      form.setValue(`items.${index}.serial_count`, serials.length, { shouldValidate: true });
      form.setValue(`items.${index}.quantity`, serials.length, { shouldValidate: true });
      setSerialContext(null);
    }
  }, [serialContext, form]);

  // ——————————————————————————————————————————————————————————————————————————————
  const handleProductSelect = useCallback(
    async (index: number, product: StockAdjustmentProduct) => {
      if (!product) return;

      const selectionId = String(product.id || product.product_id);
      const productId = product.product_id || product.id;

      const currentProductId = form.getValues(`items.${index}.product_id`);
      const isNewSelection = String(currentProductId) !== String(selectionId);

      form.setValue(`items.${index}.product_id`, selectionId);
      form.setValue(`items.${index}.product_name`, product.product_name);
      form.setValue(`items.${index}.product_code`, product.product_code);
      form.setValue(`items.${index}.cost_per_unit`, product.cost_per_unit || product.price_per_unit || 0);
      form.setValue(`items.${index}.unit_name`, product.unit_name || "pcs");
      form.setValue(`items.${index}.brand_name`, product.brand_name || "N/A");
      form.setValue(`items.${index}.barcode`, product.barcode || "N/A");
      form.setValue(`items.${index}.description`, product.description || "No description available.");
      form.setValue(`items.${index}.unit_order`, product.unit_of_measurement?.order || 1);
      form.setValue(`items.${index}.is_serialized`, !!product.is_serialized);

      if (product.is_serialized) {
        form.setValue(`items.${index}.quantity`, 0);
      }

      const cachedStock = inventoryMap.get(Number(productId)) ?? 0;
      form.setValue(`items.${index}.current_stock`, cachedStock);

      form.setValue(`items.${index}.is_serialized`, !!product.is_serialized);
      form.setValue(`items.${index}.serial_count`, 0);

      // --- Scanner Logic (Only for new user selections, NOT initial load) ---
      if (product.is_serialized && isNewSelection && !loading) {
        setSerialContext({ index, productName: product.product_name || "Product" });
        setIsScannerPreparing(true);

        toast.info(`Serial Input Required`, {
          description: `Preparing serial input for ${product.product_name}...`,
          duration: 1500,
          icon: <Tag className="h-4 w-4 text-blue-500" />,
        });

        const timer = setTimeout(() => {
          setIsScannerPreparing(false);
          setShowSerialInput(true);
        }, 300);
        return () => clearTimeout(timer);
      }

      (async () => {
        try {
          const branchId = form.getValues("branch_id");
          const currentStock = await (cachedStock === 0
            ? fetchInventory(productId, branchId)
            : Promise.resolve(cachedStock));

          form.setValue(`items.${index}.current_stock`, currentStock);

        } catch (err) {
          console.error("Background fetch error:", err);
        } finally {
          setLoadingRows((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }
      })();
    },
    [fetchInventory, form, inventoryMap, loading]
  );

  const handleOpenSerialInput = useCallback((index: number) => {
    const productName = form.getValues(`items.${index}.product_name`) ?? "Product";
    setSerialContext({ index, productName });

    setIsScannerPreparing(true);
    toast.info(`Opening Serial Input`, {
      description: `Preparing serial input for ${productName}...`,
      duration: 1500,
    });

    setTimeout(() => {
      setIsScannerPreparing(false);
      setShowSerialInput(true);
    }, 600);
  }, [form]);

  const watchedBranchIdForSelect = useWatch({ control: form.control, name: "branch_id" });
  const watchedSupplierIdForSelect = useWatch({ control: form.control, name: "supplier_id" });
  const watchedType = useWatch({ control: form.control, name: "type" });

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto w-full bg-background">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Stock Adjustment Module
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Inventory Management System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="gap-2 h-10 border-border bg-card shadow-sm font-bold text-muted-foreground hover:bg-muted rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {id ? "Edit Stock Adjustment" : "New Stock Adjustment"}
          </h1>
          {id && (
            <Badge
              variant="outline"
              className={`px-3 py-1 font-bold shadow-sm ${isPosted
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:blue-400 border-blue-200 dark:border-blue-800/50 uppercase tracking-wider'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:amber-400 border-amber-200 dark:border-amber-800/50 uppercase tracking-wider'
                }`}
            >
              {isPosted ? 'Posted' : 'Draft / Unposted'}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Record stock movement and adjust inventory levels
        </p>

        {isPosted && (
          <div className="flex items-center gap-6 mt-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <span className="text-[10px] uppercase font-black text-blue-400">Posted At:</span>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                {form.getValues().postedAt ? format(new Date(form.getValues().postedAt as string), "MMMM d, yyyy, hh:mm a") : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <span className="text-[10px] uppercase font-black text-blue-400">Posted By:</span>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                {(() => {
                  const postedBy = form.getValues("posted_by");
                  return typeof postedBy === 'object' ? `${postedBy?.user_fname} ${postedBy?.user_lname}` : postedBy || "System User";
                })()}
              </span>
            </div>
          </div>
        )}
      </div>

      <SerialBanner control={form.control} />

      {isScannerPreparing && (
        <div className="fixed inset-0 bg-background/40 backdrop-blur-[1px] z-[100] flex items-center justify-center animate-in fade-in duration-300">
          <Card className="w-full max-w-sm border-none shadow-2xl bg-card/90 overflow-hidden p-0 backdrop-blur-md">
            <div className="bg-blue-600 h-1.5 w-full">
              <div className="bg-blue-400 h-full animate-[loading_1.5s_infinite_linear]" style={{ width: '40%' }} />
            </div>
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted border-t-blue-500 animate-spin" />
                <Tag className="h-6 w-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-foreground">Preparing Serial Input</h3>
                <p className="text-sm text-muted-foreground">Please wait a moment...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-border shadow-sm bg-card">
          <CardHeader className="bg-card border-b border-border py-4 px-6">
            <CardTitle className="text-base font-bold text-foreground">
              Adjustment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="doc_no" className="text-sm font-bold text-muted-foreground">
                  Document Number
                </Label>
                <Input
                  id="doc_no"
                  {...form.register("doc_no")}
                  readOnly
                  className="bg-muted/50 border-input h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch" className="text-sm font-bold text-muted-foreground">
                  Branch <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  value={watchedBranchIdForSelect ? String(watchedBranchIdForSelect) : ""}
                  onValueChange={(v: string | null) => {
                    if (!v) {
                      setBranchInputValue("");
                      form.setValue("branch_id", 0, { shouldValidate: true });
                      return;
                    }
                    const found = branches.find(b => String(b.id) === v);
                    if (found) setBranchInputValue(`${found.branch_name} (${found.branch_code})`);
                    form.setValue("branch_id", Number(v), { shouldValidate: true });
                  }}
                  inputValue={branchInputValue}
                  onInputValueChange={(v: string) => {
                    const matched = branches.find(b => String(b.id) === v);
                    if (matched) {
                      setBranchInputValue(`${matched.branch_name} (${matched.branch_code})`);
                      setBranchSearch("");
                    } else {
                      setBranchInputValue(v);
                      setBranchSearch(v);
                    }
                  }}
                >
                  <ComboboxInput
                    placeholder="Select Branch"
                    disabled={isReadOnly || !!id || fields.length > 0}
                    className={form.formState.errors.branch_id ? "border-red-500 bg-red-50 dark:bg-red-900/10" : ""}
                    showTrigger={!id && fields.length === 0}
                    showClear={!id && !isReadOnly && fields.length === 0}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {(() => {
                        const filtered = branches.filter(b =>
                           b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                           (b.branch_code ?? "").toLowerCase().includes(branchSearch.toLowerCase())
                        );
                        if (filtered.length === 0) return <ComboboxEmpty>No branches found.</ComboboxEmpty>;
                        return filtered.map(b => {
                          const bCode = b.branch_code ?? "";
                          return (
                            <ComboboxItem key={b.id} value={String(b.id)}>
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{b.branch_name}</span>
                                <span className="text-[10px] font-bold text-muted-foreground/40 font-mono">
                                  {bCode}
                                </span>
                              </div>
                            </ComboboxItem>
                          );
                        });
                      })()}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.branch_id && (
                  <p className="text-xs text-red-500 font-medium">
                    {String(form.formState.errors.branch_id.message)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-bold text-muted-foreground">
                  Supplier <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  value={watchedSupplierIdForSelect ? String(watchedSupplierIdForSelect) : ""}
                  onValueChange={(v: string | null) => {
                    if (!v) {
                      setSupplierInputValue("");
                      form.setValue("supplier_id", 0, { shouldValidate: true });
                      return;
                    }
                    const found = suppliers.find(s => String(s.id) === v);
                    if (found) setSupplierInputValue(`${found.supplier_name}${found.supplier_shortcut ? ` (${found.supplier_shortcut})` : ""}`);
                    form.setValue("supplier_id", Number(v), { shouldValidate: true });
                  }}
                  inputValue={supplierInputValue}
                  onInputValueChange={(v: string) => {
                    const matched = suppliers.find(s => String(s.id) === v);
                    if (matched) {
                      setSupplierInputValue(`${matched.supplier_name}${matched.supplier_shortcut ? ` (${matched.supplier_shortcut})` : ""}`);
                      setSupplierSearch("");
                    } else {
                      setSupplierInputValue(v);
                      setSupplierSearch(v);
                    }
                  }}
                >
                  <ComboboxInput
                    placeholder={isSuppliersLoading ? "Loading suppliers..." : "Select Supplier"}
                    disabled={isReadOnly || !!id || fields.length > 0}
                    className={form.formState.errors.supplier_id ? "border-red-500 bg-red-50 dark:bg-red-900/10" : ""}
                    showTrigger={!id && fields.length === 0}
                    showClear={!id && !isReadOnly && fields.length === 0}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {(() => {
                        const filtered = suppliers.filter(s =>
                          s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          (s.supplier_shortcut ?? "").toLowerCase().includes(supplierSearch.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return (
                            <ComboboxEmpty>
                              {isSuppliersLoading ? "Fetching supplier list..." : "No suppliers found."}
                            </ComboboxEmpty>
                          );
                        }
                        return filtered.map(s => (
                          <ComboboxItem key={s.id} value={String(s.id)}>
                            <span className="font-medium">{s.supplier_name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/40 font-mono italic ml-2">
                              {s.supplier_shortcut || ""}
                            </span>
                          </ComboboxItem>
                        ));
                      })()}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.supplier_id && (
                  <p className="text-xs text-red-500 font-medium">
                    {String(form.formState.errors.supplier_id.message)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-muted-foreground">
                Adjustment Type <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={watchedType}
                onValueChange={(v) => form.setValue("type", v as "IN" | "OUT")}
                className="flex gap-4 pt-1"
                disabled={isReadOnly}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="IN"
                    id="type-in"
                    className="border-blue-500 text-blue-600 h-4 w-4"
                  />
                  <Label htmlFor="type-in" className="text-sm font-bold text-foreground/80">
                    Stock In
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="OUT"
                    id="type-out"
                    className="border-input text-blue-600 h-4 w-4"
                  />
                  <Label htmlFor="type-out" className="text-sm font-bold text-foreground/80">
                    Stock Out
                  </Label>
                </div>
              </RadioGroup>
              {form.formState.errors.type && (
                <p className="text-xs text-red-500 font-medium">
                  {String(form.formState.errors.type.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-sm font-bold text-muted-foreground">
                Remarks
              </Label>
              <Textarea
                id="remarks"
                {...form.register("remarks")}
                placeholder="Additional information about this adjustment..."
                className="min-h-[120px] bg-background border-input focus:ring-blue-500 rounded-xl p-4 text-sm"
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-card">
          <CardHeader className="bg-card border-b border-border flex flex-row items-center justify-between py-4 px-6">
            <CardTitle className="text-base font-bold text-foreground">
              Product Items
            </CardTitle>
            <Button
              type="button"
              onClick={handleAddProduct}
              disabled={!watchedSupplierIdForSelect || isReadOnly}
              className={`${(!watchedSupplierIdForSelect || isReadOnly)
                ? "bg-muted text-muted-foreground border-border"
                : "bg-blue-600 hover:bg-blue-700 text-white"
                } font-bold h-9 px-4 rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all`}
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {isFormLoading || (isProductsLoading && fields.length === 0) ? (
                  <div className="p-6 space-y-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-10 flex-[3]" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : fields.length === 0 ? (
                  <div className="bg-muted/10 border-2 border-dashed border-border rounded-xl p-16 text-center">
                    <div className="flex justify-center mb-4">
                      <div className={`p-5 rounded-full border border-dashed ${watchedSupplierIdForSelect ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50" : "bg-muted border-border"
                        }`}>
                        <Package className={`h-10 w-10 ${watchedSupplierIdForSelect ? "text-blue-400" : "text-muted-foreground/30"
                          }`} />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      {watchedSupplierIdForSelect ? "Ready to add products" : "Supplier required"}
                    </h3>
                    <p className="text-muted-foreground font-medium max-w-xs mx-auto text-sm">
                      {watchedSupplierIdForSelect
                        ? "Click 'Add Product' to start building your adjustment from this supplier."
                        : "Select a supplier first to see the products linked to them."}
                    </p>
                    {form.formState.errors.items &&
                      form.formState.errors.items.message && (
                        <p className="text-sm text-red-500 font-bold mt-4">
                          {form.formState.errors.items.message}
                        </p>
                      )}
                  </div>
                ) : (
                  <div className="p-0">
                    {fields.map((field, index) => (
                      <StockAdjustmentItemRow
                        key={field.id}
                        index={index}
                        control={form.control}
                        productOptions={productOptions}
                        isProductsLoading={isProductsLoading}
                        isLoadingDetails={loadingRows.has(index)}
                        onProductSelect={handleProductSelect}
                        onRemove={remove}
                        setValue={form.setValue}
                        onOpenSerialInput={handleOpenSerialInput}
                        isReadOnly={isReadOnly}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Summary Block */}
            <FormSummary
              control={form.control}
              fieldCount={fields.length}
              isSerialLoading={isSerialLoading}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-10 px-8 font-bold border-border text-muted-foreground hover:bg-card rounded-lg"
          >
            Cancel
          </Button>
          {!isReadOnly && (
            <div className="flex flex-col items-end gap-1">
              <Button
                type="submit"
                disabled={loading}
                onClick={() => {
                  const errors = form.formState.errors;
                  if (Object.keys(errors).length > 0) {
                    console.error("Form Validation Errors:", errors);
                    toast.error("Please fix the validation errors before saving.", {
                      description: "Check required fields like Branch, Supplier, or Product details."
                    });
                  }
                }}
                className="h-10 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm rounded-lg"
              >
                {loading ? (
                  <span className="animate-spin mr-2">â—Œ</span>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {id ? "Update Adjustment" : "Save Adjustment"}
              </Button>
              {Object.keys(form.formState.errors).length > 0 && (
                <p className="text-[10px] text-red-500 font-bold animate-pulse">
                  {Object.keys(form.formState.errors).length} validation error(s) detected
                </p>
              )}
            </div>
          )}

          {id && !isReadOnly && (
            <Button
              type="button"
              onClick={handlePost}
              disabled={loading}
              className="h-10 px-8 font-bold bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm rounded-lg animate-in fade-in zoom-in-95 duration-200"
            >
              {loading ? (
                <span className="animate-spin mr-2">â—Œ</span>
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post Adjustment
            </Button>
          )}
        </div>
      </form>

      {serialContext && (
        <SerialInputModal
          open={showSerialInput}
          onOpenChange={setShowSerialInput}
          productName={serialContext.productName}
          onSave={handleSerialSave}
          type={form.getValues("type")}
          initialSerials={form.getValues(`items.${serialContext.index}.serial_numbers`) || []}
          excludeSerials={(form.getValues("items") || [])
            .filter((_, idx) => idx !== serialContext.index)
            .flatMap(item => item.serial_numbers || [])
          }
          branchId={Number(form.getValues("branch_id"))}
          productId={Number(form.getValues(`items.${serialContext.index}.product_id`))}
          validateSerial={validateSerialAvailability}
        />
      )}


      {/* Post Confirmation Modal */}
      <AlertDialog open={showPostConfirmation} onOpenChange={setShowPostConfirmation}>
        <AlertDialogContent className="max-w-md bg-card p-6 rounded-xl shadow-2xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Confirm Post Adjustment
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-4">
              Are you sure you want to post this adjustment? Once posted, the record will become **READ-ONLY** and inventory levels will be updated across the system.
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPostConfirmation(false)}
              className="flex-1 h-11 font-bold text-muted-foreground border-border hover:bg-muted rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPost}
              className="flex-1 h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100 dark:shadow-none rounded-lg"
            >
              Confirm and Post
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

