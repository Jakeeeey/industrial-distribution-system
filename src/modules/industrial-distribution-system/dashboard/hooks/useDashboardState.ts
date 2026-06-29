// src/modules/industrial-distribution-system/dashboard/hooks/useDashboardState.ts
// NOTE: LAYOUT_VERSION must be bumped any time the grid coordinate system changes
// (e.g. when migrating from fractional react-rnd coords to integer CSS-Grid coords).
// A mismatch causes the cached layout to be discarded and replaced with fresh defaults.

"use client";

import { useState, useEffect, useCallback } from "react";
import { WidgetLayout, PresetId, WidgetId } from "../types";
import { DEFAULT_LAYOUTS, PRESETS } from "../utils/presets";
import { toast } from "sonner";

const LOCAL_STORAGE_KEY = "ids-dashboard-layout";

// Bump this whenever the coordinate system or schema changes.
const LAYOUT_VERSION = 2; // v2 = integer-only CSS Grid coords (was v1 react-rnd fractional)

interface LocalStorageState {
  version?: number;
  activePreset: PresetId;
  layouts: WidgetLayout[];
}

export function useDashboardState() {
  const [activePreset, setActivePreset] = useState<PresetId>("executive");
  const [layouts, setLayouts] = useState<WidgetLayout[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from local storage or defaults on mount.
  // Discard cached data if the version stamp doesn't match LAYOUT_VERSION.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as LocalStorageState;
          const isValidVersion = parsed?.version === LAYOUT_VERSION;
          const hasLayouts = Array.isArray(parsed?.layouts) && parsed.layouts.length > 0;

          if (isValidVersion && hasLayouts && parsed.activePreset) {
            setActivePreset(parsed.activePreset);
            setLayouts(parsed.layouts);
            setIsLoaded(true);
            return;
          } else {
            // Stale or incompatible cached layout — clear it
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            console.info("[Dashboard] Cleared stale layout cache (version mismatch).");
          }
        }
      } catch (e) {
        console.error("Failed to load dashboard layout from localStorage:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      // Fallback to default Executive preset
      setLayouts(DEFAULT_LAYOUTS.executive);
      setIsLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save state to localStorage with current version stamp
  const saveState = useCallback((preset: PresetId, currentLayouts: WidgetLayout[]) => {
    try {
      const stateToStore: LocalStorageState = {
        version: LAYOUT_VERSION,
        activePreset: preset,
        layouts: currentLayouts,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToStore));
    } catch (e) {
      console.error("Failed to save dashboard state to localStorage:", e);
    }
  }, []);

  // Change preset
  const changePreset = useCallback((presetId: PresetId) => {
    const defaultLayout = DEFAULT_LAYOUTS[presetId];
    if (defaultLayout) {
      setActivePreset(presetId);
      setLayouts(defaultLayout);
      saveState(presetId, defaultLayout);
      toast.info(`Switched to ${PRESETS.find(p => p.id === presetId)?.name} preset.`);
    }
  }, [saveState]);

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

  return {
    isLoaded,
    activePreset,
    layouts,
    changePreset,
    updateWidgetLayout,
    resetLayout,
    toggleWidgetVisibility,
  };
}

