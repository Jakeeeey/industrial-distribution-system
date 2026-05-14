
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Trash2, ScanLine, Tag, Wifi, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface SerialInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  onSave: (serials: string[]) => void;
  initialSerials?: string[];
  type: "IN" | "OUT";
  branchId?: number;
  productId?: number;
  validateSerial?: (serial: string, branchId?: number) => Promise<{ exists: boolean; location?: string }>;
  excludeSerials?: string[];
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
}: SerialInputModalProps) {
  const [serials, setSerials] = useState<string[]>(initialSerials);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSerials(initialSerials);
    }
  }

  const [currentInput, setCurrentInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isFetchingLast, setIsFetchingLast] = useState(false);
  const [lastSerial, setLastSerial] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchLastSerial = useCallback(async () => {
    if (!productId || type !== "IN") return;
    setIsFetchingLast(true);
    try {
      const res = await fetch(`/api/ids/scm/inventory-management/stock-adjustment/last-serial?productId=${productId}${branchId ? `&branchId=${branchId}` : ""}`);
      const data = await res.json();
      if (data.lastSerial) {
        setLastSerial(data.lastSerial);
      }
    } catch (err) {
      console.error("Failed to fetch last serial:", err);
    } finally {
      setIsFetchingLast(false);
    }
  }, [productId, type, branchId]);

  useEffect(() => {
    if (open) {
      fetchLastSerial();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open, fetchLastSerial]);

  const suggestNextSerial = (current: string) => {
    if (!current) return "";
    // Matches numbers at the end of the string
    const match = current.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numberStr = match[2];
      const nextNumber = (parseInt(numberStr, 10) + 1).toString();
      // Pad with leading zeros if necessary
      const paddedNumber = nextNumber.padStart(numberStr.length, "0");
      return prefix + paddedNumber;
    }
    return current + "-1"; // Fallback
  };

  const handleApplySuggestion = () => {
    const base = lastSerial || (serials.length > 0 ? serials[serials.length - 1] : "");
    if (base) {
      let next = suggestNextSerial(base);
      // Keep suggesting until we find one not in current list or excluded list
      while (serials.includes(next) || excludeSerials.includes(next)) {
        next = suggestNextSerial(next);
      }
      setCurrentInput(next);
      inputRef.current?.focus();
    }
  };

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

    if (type === "IN" && validateSerial) {
      setIsValidating(true);
      try {
        const { exists, location } = await validateSerial(rawSerial, branchId);
        if (exists) {
          toast.error("Process Blocked", {
            description: `Serial number ${rawSerial} already exists (${location || "Unknown Location"}).`,
            duration: 5000,
          });
          setCurrentInput("");
          return;
        }
      } catch (err) {
        console.error("Serial Validation failed:", err);
      } finally {
        setIsValidating(false);
      }
    }

    setSerials((prev) => [...prev, rawSerial]);
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
      <DialogContent className="w-[95vw] sm:max-w-[500px] border-none shadow-2xl overflow-hidden p-0 bg-card max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="bg-blue-600 dark:bg-blue-700 p-4 sm:p-6 text-white shadow-inner shrink-0">
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

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1 overflow-y-auto min-h-0">
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
                   className="flex-1 h-11 border-blue-500/20 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl"
                  disabled={isValidating}
                />
                <Button 
                  onClick={() => handleAddSerial(currentInput)}
                  disabled={isValidating || !currentInput.trim()}
                  className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/10 transition-all gap-2"
                >
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground/60 italic">
                  Tip: Press Enter after typing to add the serial number.
                </p>
                {(lastSerial || serials.length > 0) && (
                  <button
                    type="button"
                    onClick={handleApplySuggestion}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 flex items-center gap-1"
                  >
                    {isFetchingLast ? <Loader2 className="h-2 w-2 animate-spin" /> : <Wifi className="h-2 w-2" />}
                    Suggest Next Serial
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-4 px-4 border-2 border-dashed border-blue-500/10 bg-blue-500/5 dark:bg-blue-500/5 rounded-2xl space-y-2">
               <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-blue-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-blue-500">
                    Ready for Manual Input
                  </span>
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                Serial List
              </h3>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30 px-3 py-1 font-black rounded-lg">
                {serials.length} SERIALS
              </Badge>
            </div>
            <div className="border border-border rounded-xl bg-muted/10 overflow-hidden">
                <ScrollArea className="h-[200px] sm:h-[300px] w-full p-4">
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
            className="flex-1 h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/10 rounded-xl transition-all"
          >
            Confirm {serials.length} Serials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
