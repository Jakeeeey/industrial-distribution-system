"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface BulkRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serials: string[];
  productId: number;
  branchId: number;
  unitName?: string;
  onSuccess: () => void;
}

interface RegisterData {
  serial: string;
  condition: string;
  expiration: string;
  tare: string;
}

export function BulkRegisterModal({
  open,
  onOpenChange,
  serials,
  productId,
  branchId,
  unitName,
  onSuccess,
}: BulkRegisterModalProps) {
  const [data, setData] = useState<RegisterData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // AG-COMMENT: Track validation errors per row for required expiration date and tare weight
  const [rowErrors, setRowErrors] = useState<Record<number, { expiration?: boolean; tare?: boolean }>>({});

  // Bulk fields
  const [bulkCondition, setBulkCondition] = useState("GOOD");
  const [bulkExpiration, setBulkExpiration] = useState("");
  const [bulkTare, setBulkTare] = useState("");

  useEffect(() => {
    if (open) {
      setData(
        serials.map((s) => ({
          serial: s,
          condition: "GOOD",
          expiration: "",
          tare: "",
        }))
      );
      setRowErrors({});
    }
  }, [open, serials]);

  const applyBulk = (type: "condition" | "expiration" | "tare") => {
    setData((prev) =>
      prev.map((item) => ({
        ...item,
        ...(type === "condition" && { condition: bulkCondition }),
        ...(type === "expiration" && { expiration: bulkExpiration }),
        ...(type === "tare" && { tare: bulkTare }),
      }))
    );

    // AG-COMMENT: Clear corresponding row error flags when bulk values are applied
    if (type === "expiration" && bulkExpiration.trim()) {
      setRowErrors((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          const numKey = Number(key);
          if (updated[numKey]) {
            updated[numKey] = { ...updated[numKey], expiration: false };
          }
        });
        return updated;
      });
    }

    if (type === "tare" && bulkTare.trim() && !isNaN(Number(bulkTare)) && Number(bulkTare) > 0) {
      setRowErrors((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          const numKey = Number(key);
          if (updated[numKey]) {
            updated[numKey] = { ...updated[numKey], tare: false };
          }
        });
        return updated;
      });
    }

    toast.success(`Applied bulk ${type} to all rows`);
  };

  const handleRegister = async () => {
    const parsedBranchId = branchId ? Number(branchId) : 0;
    const parsedProductId = productId ? Number(productId) : 0;

    if (!parsedBranchId) {
      toast.error("Branch is required for cylinder registration. Please select a branch first.");
      return;
    }

    if (!parsedProductId) {
      toast.error("Product is required for cylinder registration.");
      return;
    }

    // AG-COMMENT: Strictly validate that every serial has expiration date and tare weight (> 0)
    const newErrors: Record<number, { expiration?: boolean; tare?: boolean }> = {};
    let hasValidationErrors = false;

    data.forEach((item, idx) => {
      const expMissing = !item.expiration || !item.expiration.trim();
      const tareNum = Number(item.tare);
      const tareMissing = !item.tare || !item.tare.trim() || isNaN(tareNum) || tareNum <= 0;

      if (expMissing || tareMissing) {
        newErrors[idx] = {
          expiration: expMissing,
          tare: tareMissing,
        };
        hasValidationErrors = true;
      }
    });

    if (hasValidationErrors) {
      setRowErrors(newErrors);
      toast.error("Validation Required", {
        description: "All serial numbers must have an expiration date and a tare weight (> 0 KG) before registering.",
        duration: 5000,
      });
      return;
    }

    setRowErrors({});
    setIsSubmitting(true);
    try {
      const isEmptyUom = unitName?.trim().toUpperCase() === "EMPTY";
      const draftStatus = isEmptyUom ? "EMPTY" : "AVAILABLE";

      const payload = data.map((item) => ({
        product_id: parsedProductId,
        serial_number: item.serial,
        cylinder_status: draftStatus,
        cylinder_condition: item.condition,
        current_branch_id: parsedBranchId,
        expiration_date: item.expiration.trim(),
        tare_weight: parseFloat(item.tare).toFixed(2),
        remarks: "Registered via Stock Adjustment",
      }));

      const res = await fetch("/api/ids/scm/inventory-management/stock-adjustment-serial-registration/register-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: payload }),
      });

      const result = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) throw new Error(result.error || "Failed to register assets");

      toast.success(`Successfully registered ${serials.length} cylinders`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Registration error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to register cylinders");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none sm:max-w-[95vw] lg:max-w-[1600px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-3">
             <div className="bg-primary p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
             </div>
             <div>
                <DialogTitle className="text-xl font-bold">Bulk Register Cylinders</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Apply required expiration date and tare weight to all <span className="font-bold text-primary">{serials.length}</span> serials.
                </p>
             </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Bulk Controls */}
          <div className="flex flex-col md:flex-row gap-6 p-4 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulk Condition</Label>
                <button onClick={() => applyBulk("condition")} className="text-[10px] font-bold text-primary hover:underline">Apply to All</button>
              </div>
              <Select value={bulkCondition} onValueChange={setBulkCondition}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOOD">GOOD</SelectItem>
                  <SelectItem value="FOR_REPAIR">FOR REPAIR</SelectItem>
                  <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                  <SelectItem value="SCRAP">SCRAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                {/* AG-COMMENT: Mark Bulk Expiration as required with red asterisk */}
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Bulk Expiration <span className="text-red-500">*</span>
                </Label>
                <button onClick={() => applyBulk("expiration")} className="text-[10px] font-bold text-primary hover:underline">Apply to All</button>
              </div>
              <Input
                type="date"
                value={bulkExpiration}
                onChange={(e) => setBulkExpiration(e.target.value)}
                className="h-10 bg-background"
              />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                {/* AG-COMMENT: Mark Bulk Tare as required with red asterisk */}
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Bulk Tare (KG) <span className="text-red-500">*</span>
                </Label>
                <button onClick={() => applyBulk("tare")} className="text-[10px] font-bold text-primary hover:underline">Apply to All</button>
              </div>
              <Input 
                type="number"
                step="0.01"
                value={bulkTare} 
                onChange={(e) => setBulkTare(e.target.value)}
                placeholder="0.00"
                className="h-10 bg-background"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="flex items-center gap-4 px-6 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border/50">
             <div className="w-[25%]">Serial Number</div>
             <div className="w-[25%]">Cylinder Condition</div>
             <div className="w-[25%]">
               Expiration Date <span className="text-red-500">*</span>
             </div>
             <div className="w-[25%]">
               Tare Weight (KG) <span className="text-red-500">*</span>
             </div>
          </div>

          {/* Table Body */}
          <ScrollArea className="h-[400px] pr-4">
             <div className="space-y-3">
                {data.map((item, idx) => {
                  const rowErr = rowErrors[idx];
                  return (
                    <div key={idx} className={`flex items-center gap-4 px-6 py-3 border rounded-xl hover:bg-muted/30 transition-colors bg-white dark:bg-slate-900/40 ${
                      rowErr?.expiration || rowErr?.tare ? "border-red-400 dark:border-red-800/60 bg-red-50/10" : "border-border/50"
                    }`}>
                       <div className="w-[25%]">
                          <span className="font-mono text-sm font-bold truncate text-primary block">{item.serial}</span>
                       </div>
                       
                       <div className="w-[25%]">
                          <Select 
                            value={item.condition} 
                            onValueChange={(val) => setData(prev => prev.map((d, i) => i === idx ? { ...d, condition: val } : d))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="GOOD">GOOD</SelectItem>
                               <SelectItem value="FOR_REPAIR">FOR REPAIR</SelectItem>
                               <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                               <SelectItem value="SCRAP">SCRAP</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="w-[25%]">
                          <Input
                            type="date"
                            value={item.expiration}
                            onChange={(e) => {
                              const val = e.target.value;
                              setData(prev => prev.map((d, i) => i === idx ? { ...d, expiration: val } : d));
                              if (rowErrors[idx]?.expiration && val.trim()) {
                                setRowErrors(prev => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], expiration: false }
                                }));
                              }
                            }}
                            className={`h-9 bg-background ${rowErr?.expiration ? "border-red-500 ring-1 ring-red-500 bg-red-50/30 dark:bg-red-950/20" : ""}`}
                          />
                          {rowErr?.expiration && (
                            <span className="text-[9px] text-red-500 font-bold mt-0.5 block">Expiration is required</span>
                          )}
                       </div>

                       <div className="w-[25%]">
                          <Input 
                            type="number" 
                            step="0.01"
                            value={item.tare} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setData(prev => prev.map((d, i) => i === idx ? { ...d, tare: val } : d));
                              if (rowErrors[idx]?.tare && val.trim() && !isNaN(Number(val)) && Number(val) > 0) {
                                setRowErrors(prev => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], tare: false }
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className={`h-9 bg-background ${rowErr?.tare ? "border-red-500 ring-1 ring-red-500 bg-red-50/30 dark:bg-red-950/20" : ""}`}
                          />
                          {rowErr?.tare && (
                            <span className="text-[9px] text-red-500 font-bold mt-0.5 block">Tare is required (&gt; 0)</span>
                          )}
                       </div>
                    </div>
                  );
                })}
             </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t flex items-center justify-between">
           <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold">
              Cancel
           </Button>
           <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold">
                 Cancel
              </Button>
              <Button onClick={handleRegister} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-white font-bold px-8">
                 {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                 Register All Assets
              </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
