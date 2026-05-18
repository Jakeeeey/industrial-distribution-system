"use client";

import React, { useState, useMemo } from "react";
import { Trash2, ScanLine, Plus, Loader2, X as CloseIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { 
  CartItem, 
  LineDiscount, 
  RTSReturnType, 
  DiscountType, 
  LinePerDiscountType 
} from "../types/rts.schema";
import { validateSerialNumber as apiValidateSerial } from "../providers/fetchProviders";

interface ReturnReviewPanelProps {
  items: CartItem[];
  lineDiscounts: LineDiscount[];
  discountTypes: DiscountType[];
  linePerDiscountType: LinePerDiscountType[];
  returnTypes: RTSReturnType[];
  onUpdateItem: (id: string, field: keyof CartItem, value: any) => void;
  onRemoveItem: (id: string) => void;
  remarks: string;
  setRemarks: (val: string) => void;
  branchId?: number | null;
  readOnly?: boolean;
}

export function ReturnReviewPanel({
  items,
  lineDiscounts,
  discountTypes,
  linePerDiscountType,
  returnTypes = [],
  onUpdateItem,
  onRemoveItem,
  remarks,
  setRemarks,
  branchId,
  readOnly = false,
}: ReturnReviewPanelProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Unified calculation
  const { totalAmount, totalQuantity, totalDiscountAmount, grossAmount } =
    useMemo(() => items.reduce(
      (acc, item) => {
        const unitPrice = item.customPrice || item.price;
        const rowGross = Math.round(unitPrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round(rowGross * item.discount * 100) / 100;
        const rowNet = Math.round((rowGross - rowDiscount) * 100) / 100;

        acc.grossAmount += rowGross;
        acc.totalDiscountAmount += rowDiscount;
        acc.totalAmount += rowNet;
        acc.totalQuantity += item.quantity;
        return acc;
      },
      { totalAmount: 0, totalQuantity: 0, totalDiscountAmount: 0, grossAmount: 0 },
    ), [items]);

  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  const getDiscountName = (item: CartItem) => {
    if (item.discountTypeId) {
      const match = discountTypes.find((d) => d.id === item.discountTypeId);
      if (match) return match.discount_type_name || match.discount_type || match.name || `Type ${match.id}`;
    }
    const matchByValue = lineDiscounts.find((d) => Math.abs(Number(d.percentage) / 100 - item.discount) < 0.0001);
    if (matchByValue) return matchByValue.line_discount;
    return `${(item.discount * 100).toFixed(2)}%`;
  };

  const handleAddSerial = async (serial: string) => {
    if (!selectedItemId || !selectedItem || !serial.trim() || !branchId) return;
    
    const sn = serial.trim();

    // 1. Session Check (All items - Case Insensitive)
    const normalizedSn = sn.toLowerCase();
    const isDuplicateInSession = items.some(item => 
      item.serials.some(s => s.trim().toLowerCase() === normalizedSn)
    );
    
    if (isDuplicateInSession) {
      toast.error(`Serial Number "${sn}" is already added to this transaction.`);
      return;
    }

    setIsValidating(true);
    try {
      // 2. Database & Inventory Check
      await apiValidateSerial(sn, selectedItem.productId, branchId);
      
      const newSerials = [...selectedItem.serials, sn];
      onUpdateItem(selectedItemId, "serials", newSerials);
      onUpdateItem(selectedItemId, "quantity", newSerials.length);
      setSerialInput("");
      toast.success(`Serial "${sn}" verified and added.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to validate serial number.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveSerial = (serial: string) => {
    if (!selectedItemId || !selectedItem) return;

    const newSerials = selectedItem.serials.filter(s => s !== serial);
    onUpdateItem(selectedItemId, "serials", newSerials);
    onUpdateItem(selectedItemId, "quantity", newSerials.length);
  };

  const handleDiscountChange = (itemId: string, val: string) => {
    const selectedType = discountTypes.find((d) => d.id.toString() === val);
    if (selectedType) {
      onUpdateItem(itemId, "discountTypeId", selectedType.id);
      const junctions = linePerDiscountType.filter((j) => String(j.type_id) === String(selectedType.id));
      if (junctions.length > 0) {
        const lineDiscount = lineDiscounts.find((ld) => String(ld.id) === String(junctions[0].line_id));
        if (lineDiscount) {
          onUpdateItem(itemId, "discount", Number(lineDiscount.percentage) / 100);
        }
      } else {
        onUpdateItem(itemId, "discount", 0);
      }
    }
  };

  const colSpanCount = readOnly ? 8 : 9;

  return (
    <div className="space-y-6">
      {/* 1. TABLE SECTION */}
      <div className="rounded-md border overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50 border-b">
            <TableRow>
              <TableHead className="w-[120px] text-xs font-bold text-muted-foreground uppercase pl-4">Code</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground uppercase">Product Name</TableHead>
              <TableHead className="w-20 text-xs font-bold text-muted-foreground uppercase text-center">Unit</TableHead>
              <TableHead className="w-[100px] text-xs font-bold text-muted-foreground uppercase text-center">Quantity</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-muted-foreground uppercase text-right">Unit Price</TableHead>
              <TableHead className="w-40 text-xs font-bold text-muted-foreground uppercase text-center">Discount Type</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-muted-foreground uppercase text-right">Discount Amt</TableHead>
              <TableHead className="w-40 text-xs font-bold text-muted-foreground uppercase text-center">Return Type</TableHead>
              <TableHead className="w-[120px] text-xs font-bold text-muted-foreground uppercase text-right">Total</TableHead>
              {!readOnly && <TableHead className="w-[60px] text-xs font-bold text-muted-foreground uppercase text-center pr-4">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpanCount + 1} className="h-32 text-center text-muted-foreground/50">
                  No items selected.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const unitPrice = item.customPrice || item.price;
                const totalLineDiscount = (unitPrice * item.quantity) * item.discount;
                const rowTotal = (unitPrice * item.quantity) - totalLineDiscount;
                const isSelected = selectedItemId === item.id;

                return (
                  <TableRow 
                    key={item.id} 
                    className={cn(
                      "hover:bg-muted/30 border-b transition-colors cursor-pointer",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono pl-4">{item.code}</TableCell>
                    <TableCell className="font-medium text-sm">{item.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">{item.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm font-bold text-primary">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ₱ {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {readOnly ? (
                        <div className="text-center text-sm font-medium">{getDiscountName(item)}</div>
                      ) : (
                        <div className="flex justify-center">
                          <Select
                            value={item.discountTypeId ? item.discountTypeId.toString() : ""}
                            onValueChange={(val) => handleDiscountChange(item.id, val)}
                          >
                            <SelectTrigger className="h-8 w-full text-xs truncate"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              {discountTypes.map((d) => (
                                <SelectItem key={d.id} value={d.id.toString()}>
                                  {d.discount_type_name || d.discount_type || d.name || `Type ${d.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {totalLineDiscount > 0 ? (
                        <span>₱ {totalLineDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {readOnly ? (
                        <div className="text-center text-sm">
                          {returnTypes.find((r) => r.id === item.return_type_id)?.return_type_name || "-"}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <Select
                            value={item.return_type_id ? String(item.return_type_id) : ""}
                            onValueChange={(val) => onUpdateItem(item.id, "return_type_id", Number(val))}
                          >
                            <SelectTrigger className="h-8 w-full text-xs truncate"><SelectValue placeholder="Select Type" /></SelectTrigger>
                            <SelectContent>
                              {returnTypes.map((r) => (
                                <SelectItem key={r.id} value={String(r.id)}>{r.return_type_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm text-primary">
                      ₱ {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="text-center pr-4" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (selectedItemId === item.id) setSelectedItemId(null);
                            onRemoveItem(item.id);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 2. SERIAL MANAGEMENT COMPONENT (Shows when an item is selected) */}
      {selectedItem && (
        <div className="bg-[#fcfaff] rounded-xl border border-[#e0d7f7] p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white border border-[#e0d7f7] p-2.5 rounded-xl shadow-sm">
                <ScanLine className="h-6 w-6 text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold text-[#1a1a1a]">
                Serial Management for: <span className="text-[#6d28d9] font-black">{selectedItem.name}</span>
              </h4>
            </div>

            <div className="flex items-center gap-4">
               {!readOnly && (
                 <div className="relative group">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2">
                     {isValidating ? (
                       <Loader2 className="h-4 w-4 text-primary animate-spin" />
                     ) : (
                       <ScanLine className="h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
                     )}
                   </div>
                   <Input
                     placeholder={isValidating ? "Validating..." : "Type serial and press +"}
                     className="h-10 pl-10 pr-10 w-[320px] rounded-full border-[#e0d7f7] bg-white focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                     value={serialInput}
                     onChange={(e) => setSerialInput(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && !isValidating && handleAddSerial(serialInput)}
                     disabled={isValidating}
                   />
                   <button 
                     onClick={() => handleAddSerial(serialInput)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:scale-110 transition-transform disabled:opacity-50"
                     disabled={isValidating || !serialInput.trim()}
                   >
                     {isValidating ? (
                       <Loader2 className="h-5 w-5 animate-spin" />
                     ) : (
                       <Plus className="h-5 w-5" />
                     )}
                   </button>
                 </div>
               )}
               <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[11px] font-black tracking-tighter border border-emerald-100 shadow-sm">
                 {selectedItem.serials.length} TOTAL
               </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {selectedItem.serials.length === 0 ? (
              <div className="w-full h-24 flex items-center justify-center bg-white/50 rounded-xl border border-dashed border-[#e0d7f7] text-muted-foreground/50 italic text-xs tracking-wide">
                No serial numbers registered yet. Start by typing or scanning above.
              </div>
            ) : (
              selectedItem.serials.map((sn) => (
                <div 
                  key={sn} 
                  className="flex items-center gap-3 py-2 px-4 rounded-lg bg-white border border-[#f0ebff] shadow-sm animate-in zoom-in-95 duration-200"
                >
                  <span className="font-mono text-xs font-bold text-[#4a4a4a] tracking-tight">{sn}</span>
                  {!readOnly && (
                    <button 
                      onClick={() => handleRemoveSerial(sn)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. REMARKS & SUMMARY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          <Label className="flex items-center gap-2 font-bold text-sm">Transaction Remarks</Label>
          <Textarea
            placeholder="Enter detailed reasons for this return (Optional)..."
            className="min-h-40 resize-none shadow-sm"
            value={remarks}
            onChange={(e) => !readOnly && setRemarks(e.target.value)}
            readOnly={readOnly}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border p-6 shadow-sm h-full flex flex-col">
            <h4 className="font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-wider border-b pb-3">Return Summary</h4>
            <div className="space-y-4 text-sm flex-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Line Items</span>
                <span className="font-medium text-foreground">{items.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Quantity</span>
                <span className="font-medium text-foreground">{totalQuantity} units</span>
              </div>
              <div className="border-t border-dashed my-4"></div>
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Amount</span>
                <span className="font-medium text-foreground">
                  ₱ {grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-amber-500/10 text-amber-600">
                <span>Total Discount</span>
                <span className="font-medium">- ₱ {totalDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="border-t mt-6 pt-4">
              <div className="flex justify-between items-end">
                <span className="font-bold text-muted-foreground uppercase text-xs mb-1">Net Amount</span>
                <span className="font-extrabold text-3xl text-primary leading-none">
                  ₱ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
