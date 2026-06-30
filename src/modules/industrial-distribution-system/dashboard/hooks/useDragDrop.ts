// src/modules/industrial-distribution-system/dashboard/hooks/useDragDrop.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages widget drag-and-drop for BOTH desktop and mobile:
//
//  Desktop — HTML5 draggable API
//    • Only the GripVertical handle is draggable (not the entire card).
//    • dragStart / dragEnter / dragOver / dragEnd bubble through WidgetContainer.
//    • On dragEnd: swaps the two widget positions in the layout array.
//
//  Mobile — Touch events with document-level listeners
//    • handleTouchStartGrip() is called from the grip handle's onTouchStart.
//    • Registers { passive: false } touchmove/touchend on document to allow
//      preventDefault (prevents page scroll during drag).
//    • Detects target widget via document.elementFromPoint + data-widget-id
//      attribute walk-up.
//    • Creates a ghost element that follows the finger.
//    • On touchend: swaps the two widgets if a valid target was found.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useRef, useCallback } from "react";

interface UseDragDropOptions {
  /** Called when two widget IDs should be swapped in the layout array */
  onSwap: (idA: string, idB: string) => void;
}

export function useDragDrop({ onSwap }: UseDragDropOptions) {
  // ── Visual state (drives opacity + ring styles in WidgetContainer) ──────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // ── Refs to avoid stale closures in event handlers ──────────────────────────
  const draggedIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);

  // ── Mobile refs ─────────────────────────────────────────────────────────────
  const mobileDraggedId = useRef<string | null>(null);
  const mobileOverId = useRef<string | null>(null);
  const ghostEl = useRef<HTMLDivElement | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Clears all drag state (shared by both desktop and mobile cleanup) */
  const clearDragState = useCallback(() => {
    draggedIdRef.current = null;
    overIdRef.current = null;
    setDraggedId(null);
    setOverId(null);
  }, []);

  // ── Desktop DnD handlers ────────────────────────────────────────────────────

  /**
   * Attach to the grip handle's onDragStart.
   * Marks the widget as the active drag source.
   */
  const handleDragStart = useCallback((id: string) => {
    draggedIdRef.current = id;
    overIdRef.current = null;
    setDraggedId(id);
    setOverId(null);
  }, []);

  /**
   * Attach to each widget card's onDragEnter.
   * Marks the card as the current drop target.
   */
  const handleDragEnter = useCallback((id: string) => {
    // Don't mark the source card as a target
    if (id !== draggedIdRef.current) {
      overIdRef.current = id;
      setOverId(id);
    }
  }, []);

  /**
   * Attach to each widget card's onDragOver.
   * Must call preventDefault() to designate this element as a valid drop zone.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  /**
   * Attach to the grip handle's onDragEnd.
   * Reads from refs (not state) to avoid stale closure issues, then swaps.
   */
  const handleDragEnd = useCallback(() => {
    const from = draggedIdRef.current;
    const to = overIdRef.current;

    if (from && to && from !== to) {
      onSwap(from, to);
    }
    clearDragState();
  }, [onSwap, clearDragState]);

  // ── Mobile Touch DnD ────────────────────────────────────────────────────────

  /**
   * Attach to the grip handle's onTouchStart via:
   *   onTouchStart={(e) => handleTouchStartGrip(layout.id, e.nativeEvent, e.currentTarget)}
   *
   * Sets up { passive: false } document-level listeners so we can call
   * preventDefault on touchmove (prevents accidental page scroll during drag).
   * Creates a small ghost element that follows the user's finger.
   */
  const handleTouchStartGrip = useCallback(
    (id: string, nativeEvent: TouchEvent, sourceEl: HTMLElement) => {
      mobileDraggedId.current = id;
      mobileOverId.current = null;
      setDraggedId(id);
      setOverId(null);

      // Locate the widget card for ghost sizing
      const card = sourceEl.closest("[data-widget-id]") as HTMLElement | null;
      const cardRect = (card ?? sourceEl).getBoundingClientRect();
      const touch = nativeEvent.touches[0];

      // Build minimal ghost indicator
      const ghost = document.createElement("div");
      ghost.style.cssText = [
        "position:fixed",
        `top:${touch.clientY - 24}px`,
        `left:${touch.clientX - Math.min(cardRect.width, 160) / 2}px`,
        `width:${Math.min(cardRect.width, 160)}px`,
        "height:44px",
        "opacity:0.75",
        "pointer-events:none",
        "z-index:9999",
        "background:hsl(217 91% 60% / 0.12)",
        "border:2px solid hsl(217 91% 60% / 0.55)",
        "border-radius:10px",
        "backdrop-filter:blur(8px)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "font-size:10px",
        "font-weight:800",
        "letter-spacing:0.08em",
        "text-transform:uppercase",
        "color:hsl(217 91% 60%)",
      ].join(";");
      ghost.textContent = "Moving…";
      document.body.appendChild(ghost);
      ghostEl.current = ghost;

      // ── Document-level listeners ─────────────────────────────────────────
      const onTouchMove = (ev: TouchEvent) => {
        // Prevent scroll while dragging a widget
        ev.preventDefault();

        const t = ev.touches[0];

        // Reposition ghost to follow finger
        if (ghostEl.current) {
          const gW = Math.min(cardRect.width, 160);
          ghostEl.current.style.top = `${t.clientY - 24}px`;
          ghostEl.current.style.left = `${t.clientX - gW / 2}px`;
          // Temporarily hide ghost so elementFromPoint sees widgets beneath it
          ghostEl.current.style.display = "none";
        }

        const el = document.elementFromPoint(t.clientX, t.clientY);

        if (ghostEl.current) ghostEl.current.style.display = "";

        // Walk up DOM to find the nearest data-widget-id ancestor
        let found: string | null = null;
        let curr: Element | null = el;
        while (curr && curr !== document.body) {
          const wid = curr.getAttribute("data-widget-id");
          if (wid && wid !== mobileDraggedId.current) {
            found = wid;
            break;
          }
          curr = curr.parentElement;
        }

        mobileOverId.current = found;
        setOverId(found);
      };

      const onTouchEnd = () => {
        // Remove ghost from DOM
        if (ghostEl.current) {
          document.body.removeChild(ghostEl.current);
          ghostEl.current = null;
        }

        const fromId = mobileDraggedId.current;
        const toId = mobileOverId.current;

        if (fromId && toId && fromId !== toId) {
          onSwap(fromId, toId);
        }

        mobileDraggedId.current = null;
        mobileOverId.current = null;
        clearDragState();

        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };

      // { passive: false } is required to allow preventDefault in onTouchMove
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    },
    [onSwap, clearDragState]
  );

  return {
    /** ID of the widget currently being dragged (for opacity styling) */
    draggedId,
    /** ID of the widget the drag cursor is currently over (for ring styling) */
    overId,
    // Desktop
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragEnd,
    // Mobile
    handleTouchStartGrip,
  };
}
