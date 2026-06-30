// src/modules/industrial-distribution-system/dashboard/hooks/useDashboardState.ts
// NOTE: LAYOUT_VERSION must be bumped any time the grid coordinate system changes
// (e.g. when migrating from fractional react-rnd coords to integer CSS-Grid coords).
// A mismatch causes the cached layout to be discarded and replaced with fresh defaults.

"use client";

import { useState, useEffect, useCallback } from "react";
import { WidgetLayout, PresetId, WidgetId } from "../types";
import { DEFAULT_LAYOUTS, PRESETS } from "../utils/presets";
import { toast } from "sonner";
import { exportToCsv } from "../utils/kpiCalculations";

const ACTIVE_PRESET_KEY = "ids-dashboard-active-preset";
const LEGACY_LAYOUT_KEY = "ids-dashboard-layout"; // old single-key format — migrated on first load
const getPresetLayoutKey = (presetId: PresetId) => `ids-dashboard-layout-${presetId}`;

const WIDGET_NAMES: Record<string, string> = {
  "rto-overview": "RTO Operations Overview",
  "cylinder-aging": "Cylinder Return Aging",
  "order-status": "CRM Orders Status Flow",
  "logistics-trips": "Active Dispatches & Trips",
  "inventory-stock": "Warehouse Cylinder Stock",
  "low-stock-alert": "Low Inventory Alerts",
  "receivables": "Receivables & Credit Alerts",
  "activity-feed": "Live Audit Logs Timeline",
  "quick-actions": "Quick Action Shortcuts",
  "weather-calendar": "Logistics Weather & Calendar",
  "top-salesman": "Top Sales Performers",
  "top-customer": "Top Customer Revenue",
};


/**
 * One-time migration: reads the old `ids-dashboard-layout` key (which stored a single
 * layout object with an embedded `activePreset` field) and seeds the new per-preset keys.
 * Safe to call on every init — exits immediately if legacy key is absent.
 */
const migrateLegacyKey = () => {
  try {
    const raw = localStorage.getItem(LEGACY_LAYOUT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Legacy format: { version, activePreset, layouts }
    if (parsed?.layouts && Array.isArray(parsed.layouts)) {
      const legacyPreset: PresetId = (parsed.activePreset as PresetId) || "executive";
      const newKey = getPresetLayoutKey(legacyPreset);
      // Only seed if the new key doesn't already exist (don't overwrite newer saves)
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, JSON.stringify({ version: LAYOUT_VERSION, layouts: parsed.layouts }));
        console.info(`[Dashboard] Migrated legacy layout to key "${newKey}"`);
      }
    }
    // Clean up old key regardless
    localStorage.removeItem(LEGACY_LAYOUT_KEY);
    console.info("[Dashboard] Removed legacy ids-dashboard-layout key.");
  } catch (e) {
    console.warn("[Dashboard] Failed to migrate legacy layout key:", e);
  }
};

// Bump this whenever the coordinate system or schema changes.
const LAYOUT_VERSION = 6;

// Load a preset's layout from local storage or defaults
const loadPresetLayout = (presetId: PresetId): WidgetLayout[] => {
  try {
    const key = getPresetLayoutKey(presetId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.version === LAYOUT_VERSION && Array.isArray(parsed?.layouts) && parsed.layouts.length > 0) {
        return parsed.layouts;
      }
    }
  } catch (e) {
    console.error(`Failed to load preset ${presetId} from localStorage:`, e);
  }
  return DEFAULT_LAYOUTS[presetId] || DEFAULT_LAYOUTS.personal;
};

// Save a preset's layout to local storage
const savePresetLayout = (presetId: PresetId, layouts: WidgetLayout[]) => {
  try {
    const key = getPresetLayoutKey(presetId);
    const data = {
      version: LAYOUT_VERSION,
      layouts,
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save preset ${presetId} to localStorage:`, e);
  }
};

/**
 * Merges imported widget settings (visibility, w, h, x, y, customSize, collapsed) into existing layouts,
 * while aligning the array order of the widgets to match their order in the imported list.
 * Any existing widgets that were not imported are appended to the end.
 */
const mergeAndOrderLayouts = (existing: WidgetLayout[], imported: WidgetLayout[]): WidgetLayout[] => {
  const merged: WidgetLayout[] = [];

  // 1. Add imported widgets in their exact CSV order
  imported.forEach((imp) => {
    const match = existing.find((ex) => ex.id === imp.id);
    if (match) {
      merged.push({
        ...match,
        visible: imp.visible,
        w: imp.w,
        h: imp.h,
        x: typeof imp.x === "number" && !isNaN(imp.x) ? imp.x : match.x,
        y: typeof imp.y === "number" && !isNaN(imp.y) ? imp.y : match.y,
        customSize: imp.customSize,
        collapsed: imp.collapsed,
      });
    } else {
      // Discard or add. We'll add it in case it's a valid widget.
      merged.push(imp);
    }
  });

  // 2. Append any existing widgets that were missing from the import list
  existing.forEach((ex) => {
    const wasImported = imported.some((imp) => imp.id === ex.id);
    if (!wasImported) {
      merged.push(ex);
    }
  });

  return merged;
};


export function useDashboardState() {
  const [activePreset, setActivePreset] = useState<PresetId>("personal");
  const [layouts, setLayouts] = useState<WidgetLayout[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from local storage or defaults on mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Step 1: migrate old single-key format if it exists
        migrateLegacyKey();

        // Step 2: resolve active preset
        let preset: PresetId = "personal";
        const storedActive = localStorage.getItem(ACTIVE_PRESET_KEY);
        if (storedActive && DEFAULT_LAYOUTS[storedActive as PresetId]) {
          preset = storedActive as PresetId;
        }

        // Step 3: load that preset's layout
        const loadedLayout = loadPresetLayout(preset);
        setActivePreset(preset);
        setLayouts(loadedLayout);
      } catch (e) {
        console.error("Failed to initialize dashboard state from localStorage:", e);
        setLayouts(DEFAULT_LAYOUTS.personal);
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save state to localStorage with current version stamp
  const saveState = useCallback((preset: PresetId, currentLayouts: WidgetLayout[]) => {
    savePresetLayout(preset, currentLayouts);
  }, []);

  // Change preset
  const changePreset = useCallback((presetId: PresetId) => {
    if (DEFAULT_LAYOUTS[presetId]) {
      // 1. Save current active preset's layouts first
      savePresetLayout(activePreset, layouts);

      // 2. Load the target preset's layouts
      const targetLayout = loadPresetLayout(presetId);
      
      // 3. Update states
      setActivePreset(presetId);
      setLayouts(targetLayout);
      
      // 4. Update the active preset selection key
      try {
        localStorage.setItem(ACTIVE_PRESET_KEY, presetId);
      } catch (e) {
        console.error("Failed to save active preset key:", e);
      }
      
      toast.info(`Switched to ${PRESETS.find(p => p.id === presetId)?.name} preset.`);
    }
  }, [activePreset, layouts]);

  // Update layout coordinates or parameters of a single widget
  const updateWidgetLayout = useCallback((id: WidgetId, changes: Partial<WidgetLayout>) => {
    setLayouts((prev) => {
      const updated = prev.map((layout) => {
        if (layout.id === id) {
          return { ...layout, ...changes };
        }
        return layout;
      });
      saveState(activePreset, updated);
      return updated;
    });
  }, [activePreset, saveState]);

  // Reset current layout to preset default
  const resetLayout = useCallback(() => {
    const defaultLayout = DEFAULT_LAYOUTS[activePreset];
    if (defaultLayout) {
      setLayouts(defaultLayout);
      saveState(activePreset, defaultLayout);
      toast.success("Dashboard layout reset to preset defaults.");
    }
  }, [activePreset, saveState]);

  // Toggle widget visibility
  const toggleWidgetVisibility = useCallback((id: WidgetId) => {
    setLayouts((prev) => {
      const updated = prev.map((layout) => {
        if (layout.id === id) {
          return { ...layout, visible: !layout.visible };
        }
        return layout;
      });
      saveState(activePreset, updated);
      return updated;
    });
  }, [activePreset, saveState]);

  // Swap two widgets by exchanging their positions in the layout array.
  // Used by useDragDrop when a drag-and-drop completes (both desktop + mobile).
  const swapWidgets = useCallback((idA: string, idB: string) => {
    setLayouts((prev) => {
      const idxA = prev.findIndex((l) => l.id === idA);
      const idxB = prev.findIndex((l) => l.id === idB);
      if (idxA === -1 || idxB === -1) return prev;

      const updated = [...prev];
      // ES2015 destructured swap — no temp variable needed
      [updated[idxA], updated[idxB]] = [updated[idxB], updated[idxA]];

      saveState(activePreset, updated);
      return updated;
    });
  }, [activePreset, saveState]);

  // Resize a widget by setting new column width (w) and row height (h).
  // Called on every mousemove tick by useResize — saveState is called each time
  // which is acceptable since it only writes to localStorage (fast).
  // id typed as string (not WidgetId) so useResize can call it with generic string IDs
  const resizeWidget = useCallback((id: string, newW: number, newH: number) => {
    setLayouts((prev) => {
      const updated = prev.map((l) =>
        l.id === id ? { ...l, w: newW, h: newH } : l
      );
      saveState(activePreset, updated);
      return updated;
    });
  }, [activePreset, saveState]);

  // Import layout configuration from CSV — merges imported rows into layouts.
  // Supports single-preset layout arrays and multi-preset layout maps.
  const importLayouts = useCallback((imported: WidgetLayout[] | Record<PresetId, WidgetLayout[]>) => {
    if (Array.isArray(imported)) {
      // Single preset import (apply to activePreset)
      setLayouts((prev) => {
        const merged = mergeAndOrderLayouts(prev, imported);
        savePresetLayout(activePreset, merged);
        return merged;
      });
    } else {
      // Multi-preset import: update local storage for all presets present in the import map.
      // Merge and order to ensure we align elements to CSV rows order.
      Object.entries(imported).forEach(([presetKey, newLayouts]) => {
        const pKey = presetKey as PresetId;
        const existingLayouts = pKey === activePreset ? layouts : loadPresetLayout(pKey);
        const merged = mergeAndOrderLayouts(existingLayouts, newLayouts);
        savePresetLayout(pKey, merged);

        // If it's the currently active preset, update the React state as well so UI refreshes.
        if (pKey === activePreset) {
          setLayouts(merged);
        }
      });
    }
    // NOTE: Toast is shown by DashboardHeader which has the import count context.
    // Do NOT add another toast.success here — it would double-fire.
  }, [activePreset, layouts]);


  // Export layout configurations of all presets
  const exportAllLayouts = useCallback(() => {
    const allRows: Record<string, unknown>[] = [];
    PRESETS.forEach((preset) => {
      // Use current live state layouts if this preset is the active preset;
      // otherwise read the stored value (or fallback to defaults)
      const presetLayouts = preset.id === activePreset ? layouts : loadPresetLayout(preset.id);
      presetLayouts.forEach((l) => {
        const widgetName = WIDGET_NAMES[l.id] || "System Widget";
        allRows.push({
          PresetID: preset.id,
          PresetName: preset.name,
          WidgetID: l.id,
          WidgetName: widgetName,
          Status: l.visible ? "Visible" : "Hidden",
          GridX: l.x,
          GridY: l.y,
          GridW: l.w,
          GridH: l.h,
          CustomSize: l.customSize ? "Yes" : "No",
          Collapsed: l.collapsed ? "Yes" : "No",
        });
      });
    });
    exportToCsv(allRows, "ids-dashboard-all-layouts");
  }, [activePreset, layouts]);

  return {
    isLoaded,
    activePreset,
    layouts,
    changePreset,
    updateWidgetLayout,
    resetLayout,
    toggleWidgetVisibility,
    swapWidgets,
    resizeWidget,
    importLayouts,
    exportAllLayouts,
  };
}


