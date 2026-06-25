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
import { SalesReturnProvider } from "../providers/fetchProviders";

interface BulkRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serials: string[];
  productId: number;
  branchId: number;
  onSuccess: (registeredSerials: Array<{
    serialNumber: string;
    tareWeight: number;
    expirationDate: string;
    cylinderCondition: string;
    remarks: string;
  }>) => void;
}

interface RegisterData {
  serial: string;
  condition: string;
  expiration: string;
  tare: string;
  remarks: string;
}

export function BulkRegisterModal({
  open,
  onOpenChange,
  serials,
  productId,
  branchId,
  onSuccess,
}: BulkRegisterModalProps) {
  const [data, setData] = useState<RegisterData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Bulk fields
  const [bulkCondition, setBulkCondition] = useState("GOOD");
  const [bulkExpiration, setBulkExpiration] = useState("");
  const [bulkTare, setBulkTare] = useState("");
  const [bulkRemarks, setBulkRemarks] = useState("");

  useEffect(() => {
    if (open) {
      setData(
        serials.map((s) => ({
          serial: s,
          condition: "GOOD",
          expiration: "",
          tare: "",
          remarks: "",
        }))
      );
      setBulkCondition("GOOD");
      setBulkExpiration("");
      setBulkTare("");
      setBulkRemarks("");
    }
  }, [open, serials]);

  const applyBulk = (type: "condition" | "expiration" | "tare" | "remarks") => {
    setData((prev) =>
      prev.map((item) => ({
        ...item,
        ...(type === "condition" && { condition: bulkCondition }),
        ...(type === "expiration" && { expiration: bulkExpiration }),
        ...(type === "tare" && { tare: bulkTare }),
        ...(type === "remarks" && { remarks: bulkRemarks }),
      }))
    );
    toast.success(`Applied bulk ${type} to all rows`);
  };

  const handlePreRegister = () => {
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

    setIsConfirmOpen(true);
  };

  const handleRegister = async () => {
    const parsedBranchId = branchId ? Number(branchId) : 0;
    const parsedProductId = productId ? Number(productId) : 0;

    setIsSubmitting(true);
    try {
      const payload = data.map((item) => ({
        product_id: parsedProductId,
        serial_number: item.serial,
        cylinder_status: "AVAILABLE",
        cylinder_condition: item.condition,
        current_branch_id: parsedBranchId,
        expiration_date: item.expiration || null,
        tare_weight: item.tare ? parseFloat(item.tare) : 0.00,
        remarks: item.remarks || null,
      }));

      // Call the SalesReturnProvider's registerAssets method
      await SalesReturnProvider.registerAssets(payload);

      toast.success(`Successfully registered ${serials.length} cylinders`);
      
      // Pass the fully structured objects back to the parent component
      onSuccess(
        data.map((item) => ({
          serialNumber: item.serial,
          tareWeight: item.tare ? parseFloat(item.tare) : 0.00,
          expirationDate: item.expiration || "",
          cylinderCondition: item.condition,
          remarks: item.remarks || "",
        }))
      );
      setIsConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      console.error("Registration error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to register cylinders");
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        aria-describedby="modal-description"
        className="max-w-none sm:max-w-[95vw] lg:max-w-[1200px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Bulk Register Cylinders</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Apply specific fields to all <span className="font-bold text-primary">{serials.length}</span> serials.
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulk Expiration</Label>
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulk Tare (KG)</Label>
                <button onClick={() => applyBulk("tare")} className="text-[10px] font-bold text-primary hover:underline">Apply to All</button>
              </div>
              <Input
                type="number"
                value={bulkTare}
                onChange={(e) => setBulkTare(e.target.value)}
                placeholder="0.00"
                className="h-10 bg-background"
              />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulk Remarks</Label>
                <button onClick={() => applyBulk("remarks")} className="text-[10px] font-bold text-primary hover:underline">Apply to All</button>
              </div>
              <Input
                type="text"
                value={bulkRemarks}
                onChange={(e) => setBulkRemarks(e.target.value)}
                placeholder="Remarks..."
                className="h-10 bg-background"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-5 gap-4 px-6 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border/50">
            <div>Serial Number</div>
            <div>Cylinder Condition</div>
            <div>Expiration Date</div>
            <div>Tare Weight (KG)</div>
            <div>Remarks</div>
          </div>

          {/* Table Body */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {data.map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-4 px-6 py-3 border border-border/50 rounded-xl hover:bg-muted/30 transition-colors bg-white dark:bg-slate-900/40 items-center">
                  <div>
                    <span className="font-mono text-sm font-bold truncate text-primary block">{item.serial}</span>
                  </div>

                  <div>
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

                  <div>
                    <Input
                      type="date"
                      value={item.expiration}
                      onChange={(e) => setData(prev => prev.map((d, i) => i === idx ? { ...d, expiration: e.target.value } : d))}
                      className="h-9 bg-background"
                    />
                  </div>

                  <div>
                    <Input
                      type="number"
                      value={item.tare}
                      onChange={(e) => setData(prev => prev.map((d, i) => i === idx ? { ...d, tare: e.target.value } : d))}
                      placeholder="0.00"
                      className="h-9"
                    />
                  </div>

                  <div>
                    <Input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => setData(prev => prev.map((d, i) => i === idx ? { ...d, remarks: e.target.value } : d))}
                      placeholder="Remarks"
                      className="h-9"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t flex items-center justify-end">
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold">
              Cancel
            </Button>
            <Button onClick={handlePreRegister} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-white font-bold px-8">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Register All Assets
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
      <DialogContent className="max-w-[400px] text-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-amber-100 dark:bg-amber-950/20 p-4 rounded-full text-amber-600"><CheckCircle2 className="h-10 w-10" /></div>
          <DialogTitle className="text-xl font-bold">Confirm Cylinder Registration</DialogTitle>
          <p className="text-sm text-muted-foreground">Are you sure you want to register <span className="font-bold text-primary">{serials.length}</span> cylinder(s) into the database? This action cannot be undone.</p>
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleRegister} disabled={isSubmitting} className="bg-primary text-white hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Confirm & Register
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
