// src/modules/industrial-distribution-system/dashboard/hooks/useResize.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages widget resize via a SE (bottom-right) corner drag handle on desktop.
//
// How it works:
//  1. User presses the resize handle (mousedown → startResize()).
//  2. startResize() records the initial mouse position and widget dimensions (w, h).
//  3. Document-level mousemove listener computes column/row delta from cursor.
//     - Column delta:  deltaX / colWidth  (colWidth = containerWidth / 12)
//     - Row delta:     deltaY / rowHeight  (rowHeight passed as prop, e.g. 60px)
//  4. New w and h are clamped (min 2 cols, min 2 rows, max 12 cols).
//  5. onResize(id, newW, newH) is called on every move — the hook consumer
//     should debounce or batch saves (useDashboardState does this via saveState).
//  6. mouseup removes listeners and restores body cursor/userSelect.
//
// Mobile resize is intentionally excluded — the grip handle on mobile only
// triggers order drag, not resizing.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef, useCallback } from "react";
import { WidgetLayout } from "../types";

interface UseResizeOptions {
  /** Height in pixels of one grid row (e.g. 60). Must match gridAutoRows. */
  rowHeight: number;

  /** Called with updated (w, h) on every mousemove tick during resize. */
  onResize: (id: string, newW: number, newH: number) => void;
}

export function useResize({
  rowHeight,
  onResize,
}: UseResizeOptions) {
  // Guard to prevent multiple simultaneous resize sessions
  const isResizing = useRef(false);

  /**
   * Attach to onMouseDown of the SE resize handle in WidgetContainer.
   *
   * Usage in JSX:
   *   <div onMouseDown={(e) => startResize(layout.id, e, layout)} />
   */
  const startResize = useCallback(
    (id: string, e: React.MouseEvent, layout: WidgetLayout) => {
      // Only handle primary mouse button
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation(); // Don't accidentally trigger drag-start on parent

      if (isResizing.current) return;
      isResizing.current = true;

      const startY = e.clientY;
      const startH = layout.h;

      // Lock body cursor and disable text selection during resize
      document.body.style.cursor = "se-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const deltaY = ev.clientY - startY;

        // Round to nearest row; clamp height to minimum 2 rows
        const newH = Math.max(2, Math.round(startH + deltaY / rowHeight));

        onResize(id, layout.w, newH);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [rowHeight, onResize]
  );

  return {
    /** Call in onMouseDown of the resize corner handle */
    startResize,
  };
}
