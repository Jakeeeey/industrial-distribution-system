//src/modules/industrial-distribution-system/supply-chain-management/physical-inventory-serial-management/components/PhysicalInventoryGlobalSerialScannerDialog.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import type {
  GroupedPhysicalInventoryChildRow,
  PhysicalInventoryDetailSerialRow,
  PhysicalInventoryDetailRow,
} from "../types";
import {
  createPhysicalInventoryDetailSerial,
  fetchPhysicalInventoryDetailSerial,
  fetchSerialOnhandByTag,
  fetchSerialOnhandByBranch,
  updatePhysicalInventoryDetail,
  fetchCylinderAssetBySerial,
} from "../providers/fetchProvider";
import {
  computeAmount,
  computeDifferenceCost,
  computeVariance,
} from "../utils/compute";

import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ScanLine,
  Wifi,
  X,
} from "lucide-react";

type SerialSavedPayload = {
  updatedDetail: PhysicalInventoryDetailRow;
  serialCount: number;
};

type Props = {
  open: boolean;
  branchId: number | null;
  phId: number | null;
  rows: GroupedPhysicalInventoryChildRow[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (payload: SerialSavedPayload) => Promise<void> | void;
};

type ScannerSignalState = "idle" | "ready" | "processing" | "success" | "error";
type ScanAnimationState = "none" | "success" | "error";

function finalizeSerialTag(rawValue: string): string {
  return rawValue.trim().toUpperCase();
}

function sameTag(a: string, b: string): boolean {
  return finalizeSerialTag(a) === finalizeSerialTag(b);
}

function playTone(
  audioContext: AudioContext,
  frequency: number,
  durationMs: number,
  startAt: number,
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + durationMs / 1000,
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + durationMs / 1000);
}

export function PhysicalInventoryGlobalSerialScannerDialog(props: Props) {
  const { open, branchId, phId, rows, canEdit, onOpenChange, onSaved } = props;

  const [, setIsLoadingExisting] = React.useState(false);
  const [isInternalProcessing, setIsInternalProcessing] = React.useState(false);
  const [existingPiTags, setExistingPiTags] = React.useState<
    PhysicalInventoryDetailSerialRow[]
  >([]);
  const [onhandCache, setOnhandCache] = React.useState<Map<string, number>>(
    new Map(),
  );
  const [scannerSignal, setScannerSignal] =
    React.useState<ScannerSignalState>("idle");
  const [lastScannedTag, setLastScannedTag] = React.useState<string>("");
  const [lastSignalMessage, setLastSignalMessage] = React.useState<string>(
    "Scanner is waiting.",
  );
  const [scanAnimation, setScanAnimation] =
    React.useState<ScanAnimationState>("none");
  const [savedCountPulse, setSavedCountPulse] = React.useState(false);
  const [pendingTags, setPendingTags] = React.useState<Set<string>>(new Set());
  const isProcessing = isInternalProcessing || pendingTags.size > 0;

  const hiddenInputRef = React.useRef<HTMLInputElement | null>(null);
  const signalResetTimerRef = React.useRef<number | null>(null);
  const animationResetTimerRef = React.useRef<number | null>(null);
  const savedCountPulseTimerRef = React.useRef<number | null>(null);
  const finalizeScanTimerRef = React.useRef<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const scanBufferRef = React.useRef("");
  const lastKeyAtRef = React.useRef(0);

  const flattenedRows = React.useMemo(() => rows, [rows]);

  const rowByProductId = React.useMemo(() => {
    const map = new Map<number, GroupedPhysicalInventoryChildRow>();

    for (const row of flattenedRows) {
      map.set(row.product_id, row);
    }

    return map;
  }, [flattenedRows]);

  const ensureAudioContext =
    React.useCallback(async (): Promise<AudioContext | null> => {
      if (typeof window === "undefined") return null;

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) return null;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      if (audioContextRef.current.state === "suspended") {
        try {
          await audioContextRef.current.resume();
        } catch {
          return null;
        }
      }

      return audioContextRef.current;
    }, []);

  const playSuccessBeep = React.useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) return;

    const startAt = context.currentTime;
    playTone(context, 880, 90, startAt);
    playTone(context, 1180, 120, startAt + 0.11);
  }, [ensureAudioContext]);

  const playErrorBeep = React.useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) return;

    const startAt = context.currentTime;
    playTone(context, 320, 140, startAt);
    playTone(context, 240, 180, startAt + 0.16);
  }, [ensureAudioContext]);

  const triggerScanAnimation = React.useCallback(
    (state: Exclude<ScanAnimationState, "none">) => {
      if (animationResetTimerRef.current !== null) {
        window.clearTimeout(animationResetTimerRef.current);
        animationResetTimerRef.current = null;
      }

      setScanAnimation("none");

      window.setTimeout(() => {
        setScanAnimation(state);

        animationResetTimerRef.current = window.setTimeout(() => {
          setScanAnimation("none");
        }, 420);
      }, 0);
    },
    [],
  );

  const triggerSavedCountPulse = React.useCallback(() => {
    if (savedCountPulseTimerRef.current !== null) {
      window.clearTimeout(savedCountPulseTimerRef.current);
      savedCountPulseTimerRef.current = null;
    }

    setSavedCountPulse(false);

    window.setTimeout(() => {
      setSavedCountPulse(true);

      savedCountPulseTimerRef.current = window.setTimeout(() => {
        setSavedCountPulse(false);
      }, 360);
    }, 0);
  }, []);

  const focusHiddenReceiver = React.useCallback(() => {
    if (!open || !canEdit) return;

    window.setTimeout(() => {
      hiddenInputRef.current?.focus();
    }, 0);
  }, [canEdit, open]);

  const clearSignalResetTimer = React.useCallback(() => {
    if (signalResetTimerRef.current !== null) {
      window.clearTimeout(signalResetTimerRef.current);
      signalResetTimerRef.current = null;
    }
  }, []);

  const clearAnimationResetTimer = React.useCallback(() => {
    if (animationResetTimerRef.current !== null) {
      window.clearTimeout(animationResetTimerRef.current);
      animationResetTimerRef.current = null;
    }
  }, []);

  const clearSavedCountPulseTimer = React.useCallback(() => {
    if (savedCountPulseTimerRef.current !== null) {
      window.clearTimeout(savedCountPulseTimerRef.current);
      savedCountPulseTimerRef.current = null;
    }
  }, []);

  const clearFinalizeScanTimer = React.useCallback(() => {
    if (finalizeScanTimerRef.current !== null) {
      window.clearTimeout(finalizeScanTimerRef.current);
      finalizeScanTimerRef.current = null;
    }
  }, []);

  const resetScannerBuffer = React.useCallback(() => {
    scanBufferRef.current = "";
    lastKeyAtRef.current = 0;
    clearFinalizeScanTimer();

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = "";
    }
  }, [clearFinalizeScanTimer]);

  const setTemporarySignal = React.useCallback(
    (
      state: Extract<ScannerSignalState, "success" | "error">,
      message: string,
      scannedTag: string,
    ) => {
      clearSignalResetTimer();
      setScannerSignal(state);
      setLastSignalMessage(message);
      setLastScannedTag(scannedTag);

      if (state === "success") {
        void playSuccessBeep();
        triggerScanAnimation("success");
        triggerSavedCountPulse();
      } else {
        void playErrorBeep();
        triggerScanAnimation("error");
      }

      signalResetTimerRef.current = window.setTimeout(() => {
        setScannerSignal(canEdit ? "ready" : "idle");
        setLastSignalMessage(
          canEdit
            ? "Ready to scan. Present a Serial tag."
            : "Scanner is disabled.",
        );
        setLastScannedTag("");
        setScanAnimation("none");
        resetScannerBuffer();
        focusHiddenReceiver();
      }, 450);
    },
    [
      canEdit,
      clearSignalResetTimer,
      focusHiddenReceiver,
      playErrorBeep,
      playSuccessBeep,
      resetScannerBuffer,
      triggerSavedCountPulse,
      triggerScanAnimation,
    ],
  );

  const loadExistingPiTags = React.useCallback(async () => {
    if (!phId) {
      setExistingPiTags([]);
      return;
    }

    try {
      setIsLoadingExisting(true);
      const CACHE_KEY = `serial_onhand_${branchId}`;
      const cachedStorage = localStorage.getItem(CACHE_KEY);
      const nextCache = new Map<string, number>();

      if (cachedStorage) {
        try {
          const parsed = JSON.parse(cachedStorage);
          if (Array.isArray(parsed)) {
            for (const [key, val] of parsed) {
              nextCache.set(key, val);
            }
          }
        } catch {
          // ignore parse error
        }
      }

      const tags = await fetchPhysicalInventoryDetailSerial(phId);
      setExistingPiTags(tags);

      if (nextCache.size === 0 && branchId) {
        const onhandRows = await fetchSerialOnhandByBranch(branchId);
        for (const row of onhandRows) {
          nextCache.set(row.serial, row.productId);
        }
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify(Array.from(nextCache.entries())),
        );
      }

      setOnhandCache(nextCache);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load existing Serial tags.";
      toast.error(message);
    } finally {
      setIsLoadingExisting(false);
    }
  }, [phId, branchId]);

  React.useEffect(() => {
    if (!open) {
      clearSignalResetTimer();
      clearAnimationResetTimer();
      clearSavedCountPulseTimer();
      clearFinalizeScanTimer();
      setExistingPiTags([]);
      setScannerSignal("idle");
      setLastScannedTag("");
      setLastSignalMessage("Scanner is waiting.");
      setScanAnimation("none");
      setSavedCountPulse(false);
      resetScannerBuffer();
      return;
    }

    setScannerSignal(canEdit ? "ready" : "idle");
    setLastSignalMessage(
      canEdit
        ? "Ready to scan. Present a Serial tag."
        : "This PI can no longer be edited.",
    );
    setLastScannedTag("");
    setScanAnimation("none");
    setSavedCountPulse(false);
    resetScannerBuffer();
    void loadExistingPiTags();
  }, [
    canEdit,
    clearAnimationResetTimer,
    clearFinalizeScanTimer,
    clearSavedCountPulseTimer,
    clearSignalResetTimer,
    loadExistingPiTags,
    open,
    resetScannerBuffer,
  ]);

  React.useEffect(() => {
    if (!open || !canEdit) return;

    const timer = window.setTimeout(() => {
      focusHiddenReceiver();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [canEdit, focusHiddenReceiver, open]);

  React.useEffect(() => {
    if (!open || !canEdit) return;

    const handlePointerOrFocus = () => {
      if (isProcessing) return;
      focusHiddenReceiver();
    };

    window.addEventListener("click", handlePointerOrFocus);
    window.addEventListener("focus", handlePointerOrFocus);

    return () => {
      window.removeEventListener("click", handlePointerOrFocus);
      window.removeEventListener("focus", handlePointerOrFocus);
    };
  }, [canEdit, focusHiddenReceiver, isProcessing, open]);

  React.useEffect(() => {
    return () => {
      clearSignalResetTimer();
      clearAnimationResetTimer();
      clearSavedCountPulseTimer();
      clearFinalizeScanTimer();

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [
    clearAnimationResetTimer,
    clearFinalizeScanTimer,
    clearSavedCountPulseTimer,
    clearSignalResetTimer,
  ]);

  const hasDuplicateInCurrentPi = React.useCallback(
    (serialTag: string): boolean => {
      const normalized = finalizeSerialTag(serialTag);
      if (
        existingPiTags.some((row) => sameTag(row.serial_number, normalized))
      ) {
        return true;
      }
      return pendingTags.has(normalized);
    },
    [existingPiTags, pendingTags],
  );

  const processScan = React.useCallback(
    async (rawTag: string) => {
      const normalized = finalizeSerialTag(rawTag);

      if (!canEdit) {
        const message = "This PI can no longer be edited.";
        toast.error(message, {
          description: normalized ? `Serial: ${normalized}` : undefined,
        });
        setTemporarySignal("error", message, normalized);
        return;
      }

      if (!normalized) {
        return;
      }

      if (!branchId) {
        const message = "Branch is required before scanning Serial.";
        toast.error(message, {
          description: `Serial: ${normalized}`,
        });
        setTemporarySignal("error", message, normalized);
        return;
      }

      if (!phId) {
        const message = "Please save the PI header first.";
        toast.error(message, {
          description: `Serial: ${normalized}`,
        });
        setTemporarySignal("error", message, normalized);
        return;
      }

      if (!flattenedRows.length) {
        const message = "Load products first before scanning Serial.";
        toast.error(message, {
          description: `Serial: ${normalized}`,
        });
        setTemporarySignal("error", message, normalized);
        return;
      }

      if (hasDuplicateInCurrentPi(normalized)) {
        const message = "This Serial tag already exists or is being processed.";
        toast.error(message, {
          description: `Serial: ${normalized}`,
        });
        setTemporarySignal("error", message, normalized);
        return;
      }

      // Immediately reset buffer and refocus for next scan
      resetScannerBuffer();
      focusHiddenReceiver();

      try {
        // Track as pending to prevent duplicate scans while processing
        setPendingTags((prev) => {
          const next = new Set(prev);
          next.add(normalized);
          return next;
        });

        setIsInternalProcessing(true);
        setScannerSignal("processing");
        setLastSignalMessage("Processing scan...");
        setLastScannedTag(normalized);
        setScanAnimation("none");

        // Verify where it belongs (Current On-hand)
        // Use local cache for instant lookup to support fast scan
        let serialProductId: number | null = null;
        const cachedProductId = onhandCache.get(normalized);

        if (cachedProductId !== undefined) {
          serialProductId = cachedProductId;
        } else {
          // Background fallback to API if not in cache
          const resolved = await fetchSerialOnhandByTag(normalized, branchId);
          if (!resolved.ok) {
            throw new Error(resolved.message || "Serial lookup failed.");
          }
          if (resolved.item) {
            serialProductId = resolved.item.productId;
            // Update cache for future scans in this session
            setOnhandCache((prev) => {
              const next = new Map(prev);
              next.set(normalized, serialProductId!);
              localStorage.setItem(
                `serial_onhand_${branchId}`,
                JSON.stringify(Array.from(next.entries())),
              );
              return next;
            });
          }
        }

        if (serialProductId === null) {
          const message = "Serial not found in on-hand records.";
          toast.error(message, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("error", message, normalized);
          return;
        }

        const matchedRow = rowByProductId.get(serialProductId);

        if (!matchedRow) {
          const message = `Scanned Serial belongs to product ID ${serialProductId}, but that product is not loaded in the current PI.`;
          toast.error(message, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("error", message, normalized);
          return;
        }

        if (!matchedRow.detail_id) {
          const message = `Matched product "${matchedRow.product_name}" does not have a valid PI detail row.`;
          toast.error(message, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("error", message, normalized);
          return;
        }

        // Enforce that it exists in cylinder_assets
        const cylinderAsset = await fetchCylinderAssetBySerial(normalized);
        if (!cylinderAsset) {
          const message =
            "Serial is not registered as a Cylinder Asset. Please register it via the Specific Product Modal.";
          toast.error(message, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("error", message, normalized);
          return;
        }

        const createdTag = await createPhysicalInventoryDetailSerial({
          pi_detail_id: matchedRow.detail_id,
          serial_number: normalized,
        });

        setExistingPiTags((prev) => [createdTag, ...prev]);

        let updatedDetail: PhysicalInventoryDetailRow;
        let nextSerialCount = 0;

        if (matchedRow.requires_serial) {
          const currentSerialCount = existingPiTags.filter(
            (tag) => tag.pi_detail_id === matchedRow.detail_id,
          ).length;
          nextSerialCount = currentSerialCount + 1;

          const nextVariance = computeVariance(
            nextSerialCount,
            matchedRow.system_count,
          );
          const nextDifferenceCost = computeDifferenceCost(
            nextVariance,
            matchedRow.unit_price,
          );
          const nextAmount = computeAmount(
            nextSerialCount,
            matchedRow.unit_price,
          );

          updatedDetail = await updatePhysicalInventoryDetail(
            matchedRow.detail_id,
            {
              physical_count: nextSerialCount,
              variance: nextVariance,
              difference_cost: nextDifferenceCost,
              amount: nextAmount,
            },
          );

          const successMessage = `Serial counted to ${matchedRow.product_name} (${matchedRow.unit_name ?? matchedRow.unit_shortcut ?? "UOM"}).`;
          toast.success(successMessage, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("success", successMessage, normalized);
        } else {
          nextSerialCount =
            existingPiTags.filter(
              (tag) => tag.pi_detail_id === matchedRow.detail_id,
            ).length + 1;

          const nextPhysicalCount = matchedRow.physical_count + 1;
          const nextVariance = computeVariance(
            nextPhysicalCount,
            matchedRow.system_count,
          );
          const nextDifferenceCost = computeDifferenceCost(
            nextVariance,
            matchedRow.unit_price,
          );
          const nextAmount = computeAmount(
            nextPhysicalCount,
            matchedRow.unit_price,
          );

          updatedDetail = await updatePhysicalInventoryDetail(
            matchedRow.detail_id,
            {
              physical_count: nextPhysicalCount,
              variance: nextVariance,
              difference_cost: nextDifferenceCost,
              amount: nextAmount,
            },
          );

          const successMessage = `Tag saved and count incremented to ${matchedRow.product_name} (${matchedRow.unit_name ?? matchedRow.unit_shortcut ?? "UOM"}). Physical count is now ${nextPhysicalCount}.`;
          toast.success(successMessage, {
            description: `Serial: ${normalized}`,
          });
          setTemporarySignal("success", successMessage, normalized);
        }

        if (onSaved) {
          await onSaved({
            updatedDetail,
            serialCount: nextSerialCount,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to process Serial scan.";

        toast.error(message, {
          description: `Serial: ${normalized}`,
        });
        setTemporarySignal("error", message, normalized);
      } finally {
        // Clear from pending
        setPendingTags((prev) => {
          const next = new Set(prev);
          next.delete(normalized);
          return next;
        });
        setIsInternalProcessing(false);
      }
    },
    [
      branchId,
      canEdit,
      flattenedRows.length,
      focusHiddenReceiver,
      hasDuplicateInCurrentPi,
      onSaved,
      phId,
      resetScannerBuffer,
      rowByProductId,
      setTemporarySignal,
      existingPiTags,
      onhandCache,
    ],
  );

  const totalSerialRows = existingPiTags.length;
  const totalSerialEligibleRows = flattenedRows.filter(
    (row) => row.requires_serial,
  ).length;

  const signalToneClasses =
    scannerSignal === "processing"
      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
      : scannerSignal === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
        : scannerSignal === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";

  const signalAnimationClasses =
    scanAnimation === "success"
      ? "animate-[scanSuccess_420ms_ease-out]"
      : scanAnimation === "error"
        ? "animate-[scanError_420ms_ease-out]"
        : "";

  const savedCountAnimationClasses = savedCountPulse
    ? "animate-[savedCountPop_360ms_ease-out]"
    : "";

  const readyRippleClasses =
    scannerSignal === "ready" && canEdit
      ? "animate-[scannerRipple_1.8s_ease-out_infinite]"
      : "";

  return (
    <>
      <style jsx>{`
        @keyframes scanSuccess {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
          30% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.16);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes scanError {
          0% {
            transform: scale(1) translateX(0);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
          20% {
            transform: scale(1.01) translateX(-4px);
          }
          40% {
            transform: scale(1.01) translateX(4px);
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.12);
          }
          60% {
            transform: scale(1.01) translateX(-3px);
          }
          80% {
            transform: scale(1.005) translateX(3px);
          }
          100% {
            transform: scale(1) translateX(0);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }

        @keyframes savedCountPop {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.18);
          }
          65% {
            transform: scale(0.96);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes scannerRipple {
          0% {
            transform: scale(0.8);
            opacity: 0.35;
          }
          70% {
            transform: scale(1.45);
            opacity: 0;
          }
          100% {
            transform: scale(1.45);
            opacity: 0;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="flex w-[min(640px,96vw)] max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
              <div className="flex items-start justify-between border-b px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold sm:text-lg">
                    Global Serial Scanner
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Pure scanner mode. Results are shown in toast notifications.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                ref={hiddenInputRef}
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0"
                disabled={!open || !canEdit}
                onBlur={() => {
                  if (!open || !canEdit || isProcessing) return;
                  focusHiddenReceiver();
                }}
                onChange={(event) => {
                  scanBufferRef.current = event.target.value.toUpperCase();
                }}
                onKeyDown={(event) => {
                  const now = Date.now();

                  if (now - lastKeyAtRef.current > 1000) {
                    scanBufferRef.current = "";
                    if (hiddenInputRef.current) {
                      hiddenInputRef.current.value = "";
                    }
                  }

                  lastKeyAtRef.current = now;

                  if (event.key === "Enter") {
                    event.preventDefault();

                    clearFinalizeScanTimer();

                    finalizeScanTimerRef.current = window.setTimeout(() => {
                      const rawFromInput = hiddenInputRef.current?.value ?? "";
                      const rawFromBuffer = scanBufferRef.current;

                      const finalizedFromInput =
                        finalizeSerialTag(rawFromInput);
                      const finalizedFromBuffer =
                        finalizeSerialTag(rawFromBuffer);

                      const finalTag =
                        finalizedFromInput.length >= finalizedFromBuffer.length
                          ? finalizedFromInput
                          : finalizedFromBuffer;

                      if (!finalTag) {
                        toast.error("Empty Serial scan.", {
                          description: "No characters were received.",
                        });

                        resetScannerBuffer();
                        focusHiddenReceiver();
                        return;
                      }

                      void processScan(finalTag);
                    }, 35);

                    return;
                  }

                  if (event.key === "Backspace") {
                    scanBufferRef.current = scanBufferRef.current.slice(0, -1);
                    return;
                  }

                  if (
                    event.key.length === 1 &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    !event.metaKey
                  ) {
                    scanBufferRef.current += event.key.toUpperCase();
                  }
                }}
              />

              <div className="space-y-4 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
                  <div>
                    <span className="font-medium">Serial Rows:</span>{" "}
                    {totalSerialEligibleRows}
                  </div>
                  <div>
                    <span className="font-medium">Saved:</span>{" "}
                    <span
                      className={[
                        "inline-block font-semibold text-emerald-700 dark:text-emerald-300",
                        savedCountAnimationClasses,
                      ].join(" ")}
                    >
                      {totalSerialRows}
                    </span>
                  </div>
                </div>

                <div
                  className={[
                    "rounded-xl border px-4 py-5 text-center transition-colors will-change-transform",
                    signalToneClasses,
                    signalAnimationClasses,
                  ].join(" ")}
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-9 w-9 items-center justify-center">
                        {scannerSignal === "ready" && canEdit ? (
                          <>
                            <span
                              className={[
                                "absolute h-9 w-9 rounded-full border border-emerald-400/40",
                                readyRippleClasses,
                              ].join(" ")}
                            />
                            <Wifi className="relative z-10 h-5 w-5" />
                          </>
                        ) : scannerSignal === "processing" ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : scannerSignal === "success" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : scannerSignal === "error" ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <Wifi className="h-5 w-5" />
                        )}
                      </div>

                      <span className="text-lg font-semibold">
                        {scannerSignal === "processing"
                          ? "Processing"
                          : scannerSignal === "success"
                            ? "Success"
                            : scannerSignal === "error"
                              ? "Error"
                              : canEdit
                                ? "Ready to Scan"
                                : "Scanner Disabled"}
                      </span>
                    </div>

                    <p className="text-sm opacity-90">{lastSignalMessage}</p>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] opacity-90">
                      <span className="rounded-full border border-current/20 px-2 py-0.5">
                        Pure scanner
                      </span>
                      <span className="rounded-full border border-current/20 px-2 py-0.5">
                        Serial-optimized
                      </span>
                      <span className="rounded-full border border-current/20 px-2 py-0.5">
                        Toast feedback
                      </span>
                    </div>

                    <div className="w-full rounded-lg border border-current/15 bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm">
                      <div className="flex items-center justify-center gap-2">
                        <ScanLine
                          className={[
                            "h-4 w-4 shrink-0",
                            scannerSignal === "processing"
                              ? "animate-pulse"
                              : "",
                          ].join(" ")}
                        />
                        <span className="break-all font-medium">
                          {lastScannedTag
                            ? lastScannedTag
                            : "Waiting for Serial scan..."}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/10 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Notes</p>
                  <p className="mt-1">
                    This mode does not keep an in-modal scan history. Every scan
                    result is shown through toast notifications, while the last
                    full Serial remains visible above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}
