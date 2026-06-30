// src/modules/industrial-distribution-system/dashboard/components/GridSizeSelector.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Grid Size Selector (similar to table generator in Word/Google Docs).
// Renders a hoverable 12x8 matrix of squares.
// Hovering over cell (C, R) highlights all squares from (1,1) to (C,R).
// Clicking selects width C (cols) and height R (rows).
// Includes a "Reset to Auto-Scale" option to return to paired dynamic widths.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Grid } from "lucide-react";

interface GridSizeSelectorProps {
  currentW: number;
  currentH: number;
  isCustom: boolean;
  onSelect: (w: number, h: number) => void;
  onReset: () => void;
}

const COLS = 12;
const ROWS = 12;

export const GridSizeSelector: React.FC<GridSizeSelectorProps> = ({
  currentW,
  currentH,
  isCustom,
  onSelect,
  onReset,
}) => {
  const [hoveredW, setHoveredW] = useState<number | null>(null);
  const [hoveredH, setHoveredH] = useState<number | null>(null);

  // Active display width/height for visualization
  const displayW = hoveredW !== null ? hoveredW : currentW;
  const displayH = hoveredH !== null ? hoveredH : currentH;

  return (
    <div className="w-[210px] p-2 bg-popover rounded-xl select-none text-card-foreground">
      {/* Selector Header */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-border/40 px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Grid className="h-3.5 w-3.5 text-primary" />
          <span>Grid Size</span>
        </div>
        <span className="font-mono text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
          {displayW} × {displayH}
        </span>
      </div>

      {/* Grid Matrix */}
      <div 
        className="grid grid-cols-12 gap-[3px] p-1.5 border border-border/50 rounded-lg bg-muted/20"
        onMouseLeave={() => {
          setHoveredW(null);
          setHoveredH(null);
        }}
      >
        {Array.from({ length: ROWS }).map((_, rIdx) => {
          const r = rIdx + 1;
          return (
            <React.Fragment key={rIdx}>
              {Array.from({ length: COLS }).map((_, cIdx) => {
                const c = cIdx + 1;
                const isActive = c <= displayW && r <= displayH;
                const isHovered = hoveredW !== null && hoveredH !== null && c <= hoveredW && r <= hoveredH;

                return (
                  <div
                    key={cIdx}
                    className={cn(
                      "w-3.5 h-3.5 rounded-sm border border-border/60 transition-all duration-100 cursor-pointer",
                      isActive 
                        ? "bg-primary border-primary shadow-xs shadow-primary/20 scale-[1.05]" 
                        : "bg-background hover:bg-primary/25 hover:border-primary/50",
                      isHovered && "bg-primary/80 border-primary/80"
                    )}
                    onMouseEnter={() => {
                      setHoveredW(c);
                      setHoveredH(r);
                    }}
                    onClick={() => onSelect(c, r)}
                    title={`${c} columns × ${r} rows`}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-[8px] font-medium text-slate-400 mt-2 text-center">
        Hover to size, click to select
      </p>

      {/* Reset button */}
      {isCustom && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="w-full text-center mt-2 text-[9px] h-7 font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
        >
          Reset to Auto-Scale
        </Button>
      )}
    </div>
  );
};
