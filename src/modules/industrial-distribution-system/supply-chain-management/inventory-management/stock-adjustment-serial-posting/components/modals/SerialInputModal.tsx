"use client";

import React, { useState } from "react";
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
import { ScanLine, Tag, Search } from "lucide-react";

// AG-COMMENT: Read-only serial viewer for Stock Adjustment Posting module
interface SerialInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  onSave?: (serials: string[]) => void;
  initialSerials?: string[];
  type?: "IN" | "OUT";
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
  initialSerials = [],
}: SerialInputModalProps) {
  const [search, setSearch] = useState("");

  const filteredSerials = React.useMemo(() => {
    if (!search.trim()) return initialSerials;
    return initialSerials.filter((s) =>
      s.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [initialSerials, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[650px] border-none shadow-2xl overflow-hidden p-0 bg-card max-h-[90vh] sm:h-[520px] flex flex-col">
        {/* Header */}
        <div className="bg-primary p-4 sm:p-5 text-white shadow-inner shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-white/20 dark:bg-black/20 p-2 rounded-lg backdrop-blur-md">
                <ScanLine className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight text-white/95">
                Tagged Serial Numbers
              </DialogTitle>
            </div>
            <p className="text-white/80 text-xs font-medium">
              Product: <span className="text-white font-bold underline decoration-white/30 underline-offset-4">{productName}</span>
            </p>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex flex-col flex-1 min-h-0 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search serial numbers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs border-input font-mono"
              />
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5 font-bold rounded-lg shrink-0 text-xs">
              {initialSerials.length} TOTAL SERIALS
            </Badge>
          </div>

          {/* Serial Badges Grid */}
          <div className="border border-border rounded-xl bg-muted/10 overflow-hidden flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 w-full h-full">
              {initialSerials.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-12 p-4">
                  <Tag className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No serial numbers attached to this line item.</p>
                </div>
              ) : filteredSerials.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-50 py-12 p-4">
                  <p className="text-xs font-medium text-muted-foreground">No serials matching &quot;{search}&quot;</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 p-4 pb-8 max-w-full">
                  {filteredSerials.map((serial, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-card border-border text-foreground px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm font-mono text-xs"
                    >
                      <Tag className="h-3 w-3 text-primary/70 shrink-0" />
                      <span className="leading-tight">{serial}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="bg-muted/10 p-4 border-t border-border flex justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-6 font-bold rounded-lg text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
