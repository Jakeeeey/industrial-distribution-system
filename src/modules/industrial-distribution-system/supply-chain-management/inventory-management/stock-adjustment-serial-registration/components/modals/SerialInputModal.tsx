"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Trash2, ScanLine, Tag, Wifi, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BulkRegisterModal } from "./BulkRegisterModal";

interface SerialInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  onSave: (serials: string[]) => void;
  initialSerials?: string[];
  type: "IN" | "OUT";
  branchId?: number;
  productId?: number;
  validateSerial?: (
    serial: string,
    branchId?: number,
    productId?: number,
    type?: "IN" | "OUT"
  ) => Promise<{ exists: boolean; location?: string; isBlocked?: boolean; errorMsg?: string }>;
  excludeSerials?: string[];
  unitName?: string;
}

export function SerialInputModal({
  open,
  onOpenChange,
  productName,
  onSave,
  initialSerials = [],
  type,
  branchId,
  productId,
  validateSerial,
  excludeSerials = [],
  unitName,
}: SerialInputModalProps) {
  const [serials, setSerials] = useState<string[]>(initialSerials);
  const [unregisteredSerials, setUnregisteredSerials] = useState<string[]>([]);
  const [showBulkRegister, setShowBulkRegister] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSerials(initialSerials);
      setUnregisteredSerials([]);
    }
  }

  const [currentInput, setCurrentInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !isValidating) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isValidating]);

  const handleAddSerial = async (serial: string) => {
    const rawSerial = serial.trim().toUpperCase();
    if (!rawSerial) return;

    if (serials.includes(rawSerial)) {
      toast.error("Serial number already added to this product");
      return;
    }

    if (excludeSerials.includes(rawSerial)) {
      toast.error("Serial number already used in another product in this adjustment");
      return;
    }

    if (validateSerial) {
      setIsValidating(true);
      try {
        const res = await validateSerial(rawSerial, branchId, productId, type);
        
        if (res.isBlocked) {
          toast.error("Validation Failed", {
            description: res.errorMsg || `Serial "${rawSerial}" is invalid for this adjustment.`,
            duration: 5000,
          });
          return;
        }

        if (res.exists) {
          setSerials((prev) => Array.from(new Set([...prev, rawSerial])));
          toast.success(`Serial "${rawSerial}" added successfully.`);
        } else {
          setUnregisteredSerials((prev) => Array.from(new Set([...prev, rawSerial])));
          toast.info(`Serial "${rawSerial}" requires registration`, {
            description: type === "OUT" 
              ? "Serial is not currently on-hand. Please register it before adding to the adjustment."
              : "Serial does not exist. Please register it before adding to the adjustment.",
          });
        }
      } catch (err) {
        console.error("Serial Validation failed:", err);
      } finally {
        setIsValidating(false);
      }
    } else {
      setSerials((prev) => [...prev, rawSerial]);
    }

    setCurrentInput("");
    inputRef.current?.focus();
  };

  const initialSerialsSet = React.useMemo(() => new Set(initialSerials), [initialSerials]);

  const handleRemoveSerial = (index: number) => {
    const serialToRemove = serials[index];
    if (initialSerialsSet.has(serialToRemove)) {
      toast.error("Existing serials cannot be removed");
      return;
    }
    setSerials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    const removableCount = serials.filter(s => !initialSerialsSet.has(s)).length;
    if (removableCount === 0) {
      toast.info("No removable serial numbers to clear");
      return;
    }
    setSerials((prev) => prev.filter((s) => initialSerialsSet.has(s)));
    toast.success(`Cleared ${removableCount} newly added serial numbers`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isValidating) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSerial(currentInput);
    }
  };

  const handleSave = () => {
    onSave(serials);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[850px] border-none shadow-2xl overflow-hidden p-0 bg-card max-h-[95vh] sm:h-[600px] flex flex-col">
        <div className="bg-primary p-4 sm:p-6 text-white shadow-inner shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 dark:bg-black/20 p-2 rounded-lg backdrop-blur-md">
                <ScanLine className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white/95">
                Serial Number Input
              </DialogTitle>
            </div>
            <p className="text-white/80 text-sm font-medium">
              Adding serials for: <span className="text-white font-bold underline decoration-white/30 underline-offset-4">{productName}</span>
            </p>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-0">
          {/* Left Column: Input and Alerts */}
          <div className="space-y-6 flex flex-col min-h-0 overflow-y-auto pr-1 justify-start">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Input Serial Number
                </label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Type or scan serial number..."
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="flex-1 h-11 border-primary/20 focus:border-primary focus:ring-primary/20 rounded-xl"
                    disabled={isValidating}
                  />
                  <Button 
                    onClick={() => handleAddSerial(currentInput)}
                    disabled={isValidating || !currentInput.trim()}
                    className="h-11 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/10 transition-all gap-2"
                  >
                    {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground/60 italic">
                    Tip: Press Enter after typing to add the serial number.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-4 px-4 border-2 border-dashed border-primary/10 bg-primary/[0.03] rounded-2xl space-y-2">
                 <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-primary">
                      Ready for Manual Input
                    </span>
                 </div>
              </div>
            </div>

            {/* Unregistered Serials Section */}
            {unregisteredSerials.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-2xl p-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-orange-500 p-1.5 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-500">
                      {unregisteredSerials.length} Unregistered Serials
                    </h4>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setShowBulkRegister(true)}
                    className="h-8 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-tighter px-4 rounded-lg"
                  >
                    Register All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                  {unregisteredSerials.map((s, i) => (
                    <Badge 
                      key={i} 
                      className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/30 font-mono text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1.5"
                    >
                      {s}
                      <button 
                      onClick={() => setUnregisteredSerials(prev => prev.filter(x => x !== s))}
                        className="hover:text-orange-900 dark:hover:text-orange-200"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Serial List */}
          <div className="flex flex-col space-y-3 min-h-0 h-full">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                Serial List
              </h3>
              <div className="flex items-center gap-2">
                {serials.some(s => !initialSerialsSet.has(s)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold uppercase tracking-wider rounded-lg transition-all"
                  >
                    Clear All
                  </Button>
                )}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-black rounded-lg">
                  {serials.length} SERIALS
                </Badge>
              </div>
            </div>
            <div className="border border-border rounded-xl bg-muted/10 overflow-hidden flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 w-full p-4">
                {serials.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 py-12">
                    <Tag className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No serial numbers added yet</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {serials.map((serial, idx) => {
                      const isPermanent = initialSerialsSet.has(serial);
                      return (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="bg-background border-border text-foreground px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-200 max-w-[calc(100%-4px)] overflow-hidden shrink-0"
                        >
                          <span className="font-mono text-xs leading-tight truncate min-w-0 flex-1">{serial}</span>
                          <button 
                            onClick={() => handleRemoveSerial(idx)}
                            disabled={isPermanent}
                            title={isPermanent ? "Saved serials cannot be removed" : "Remove serial"}
                            className={`transition-colors shrink-0 p-0.5 ${
                              isPermanent ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-red-500"
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/10 p-4 sm:p-6 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 font-bold text-muted-foreground hover:bg-card hover:text-foreground rounded-xl transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={serials.length === 0}
            className="flex-1 h-11 font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 rounded-xl transition-all"
          >
            Confirm {serials.length} Serials
          </Button>
        </DialogFooter>
      </DialogContent>

      <BulkRegisterModal 
        open={showBulkRegister}
        onOpenChange={setShowBulkRegister}
        serials={unregisteredSerials}
        productId={productId || 0}
        branchId={branchId || 0}
        unitName={unitName}
        onSuccess={() => {
          setSerials(prev => Array.from(new Set([...prev, ...unregisteredSerials])));
          setUnregisteredSerials([]);
          toast.success("All cylinders registered and added to list");
        }}
      />
    </Dialog>
  );
}
