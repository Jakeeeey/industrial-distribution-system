
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
import { CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BulkRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serials: string[];
  productId: number;
  branchId: number;
  onSuccess: () => void;
}

interface RegisterData {
  serial: string;
  condition: string;
  expiration: Date | undefined;
  tare: string;
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

  // Bulk fields
  const [bulkCondition, setBulkCondition] = useState("GOOD");
  const [bulkExpiration, setBulkExpiration] = useState<Date | undefined>(undefined);
  const [bulkTare, setBulkTare] = useState("");

  useEffect(() => {
    if (open) {
      setData(
        serials.map((s) => ({
          serial: s,
          condition: "GOOD",
          expiration: undefined,
          tare: "",
        }))
      );
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
    toast.success(`Applied bulk ${type} to all rows`);
  };

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      const payload = data.map((item) => ({
        product_id: productId,
        serial_number: item.serial,
        cylinder_status: "AVAILABLE",
        cylinder_condition: item.condition,
        current_branch_id: branchId,
        expiration_date: item.expiration ? format(item.expiration, "yyyy-MM-dd") : null,
        tare_weight: item.tare || "0.00",
      }));

      const res = await fetch("/api/ids/scm/inventory-management/stock-adjustment/register-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: payload }),
      });

      const result = await res.json();
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
             <div className="bg-blue-600 p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
             </div>
             <div>
                <DialogTitle className="text-xl font-bold">Bulk Register Cylinders</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Apply specific fields to all <span className="font-bold text-blue-600">{serials.length}</span> serials.
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
                <button onClick={() => applyBulk("condition")} className="text-[10px] font-bold text-blue-600 hover:underline">Apply to All</button>
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
                <button onClick={() => applyBulk("expiration")} className="text-[10px] font-bold text-blue-600 hover:underline">Apply to All</button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-background",
                      !bulkExpiration && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bulkExpiration ? format(bulkExpiration, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bulkExpiration}
                    onSelect={setBulkExpiration}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulk Tare (KG)</Label>
                <button onClick={() => applyBulk("tare")} className="text-[10px] font-bold text-blue-600 hover:underline">Apply to All</button>
              </div>
              <Input 
                type="number" 
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
             <div className="w-[25%]">Expiration Date</div>
             <div className="w-[25%]">Tare Weight (KG)</div>
          </div>

          {/* Table Body */}
          <ScrollArea className="h-[400px] pr-4">
             <div className="space-y-3">
                {data.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-6 py-3 border border-border/50 rounded-xl hover:bg-muted/30 transition-colors bg-white dark:bg-slate-900/40">
                     <div className="w-[25%]">
                        <span className="font-mono text-sm font-bold truncate text-blue-600 block">{item.serial}</span>
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
                        <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-9 justify-start text-left font-normal",
                                  !item.expiration && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {item.expiration ? format(item.expiration, "MM/dd/yyyy") : <span>mm/dd/yyyy</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={item.expiration}
                                onSelect={(date) => setData(prev => prev.map((d, i) => i === idx ? { ...d, expiration: date } : d))}
                                initialFocus
                              />
                            </PopoverContent>
                        </Popover>
                     </div>

                     <div className="w-[25%]">
                        <Input 
                          type="number" 
                          value={item.tare} 
                          onChange={(e) => setData(prev => prev.map((d, i) => i === idx ? { ...d, tare: e.target.value } : d))}
                          placeholder="0.00"
                          className="h-9"
                        />
                     </div>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t flex items-center justify-between">
           <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold">
              Clear All
           </Button>
           <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold">
                 Cancel
              </Button>
              <Button onClick={handleRegister} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8">
                 {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                 Register All Assets
              </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
