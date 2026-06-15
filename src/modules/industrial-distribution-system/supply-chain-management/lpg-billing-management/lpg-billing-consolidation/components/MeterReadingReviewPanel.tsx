"use client";

// ─── MeterReadingReviewPanel.tsx ──────────────────────────────────────────────
// Reviewer panel for a single meter reading record.
// Shows previous/current reading, photos, computed KG, and allows the reviewer
// to correct the current reading with a reason before triggering recompute.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Gauge, Camera, AlertTriangle, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConsolidationMeterReading, ConsolidationAttachment } from "../types/billing-consolidation.types";

interface MeterReadingReviewPanelProps {
  reading: ConsolidationMeterReading;
  attachments: ConsolidationAttachment[];
  transactionId: number;
  isSubmitting: boolean;
  isOnboarding?: boolean;
  onAdjust: (payload: {
    transactionId: number;
    meterReadingId: number;
    new_current_reading: number;
    adjustment_reason: string;
  }) => Promise<boolean>;
}

const ASSET_URL = "/api/ids/scm/lpg-billing-management/metered-billing/asset";

function MeterPhoto({ fileId, label }: { fileId: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {/* Thumbnail */}
      <button
        onClick={() => setExpanded(true)}
        className="group relative w-full h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-violet-400 transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSET_URL}?id=${encodeURIComponent(fileId)}`}
          alt={label}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100">
          <span className="text-[9px] font-bold text-white bg-black/50 px-2 py-0.5 rounded">Expand</span>
        </div>
      </button>
      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-2xl w-full max-h-[90vh] rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ASSET_URL}?id=${encodeURIComponent(fileId)}`}
              alt={label}
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs font-semibold text-center py-1.5">
              {label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MeterReadingReviewPanel({
  reading,
  attachments,
  transactionId,
  isSubmitting,
  isOnboarding = false,
  onAdjust,
}: MeterReadingReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newCurrentReading, setNewCurrentReading] = useState<string>(
    String(reading.current_reading)
  );
  const [adjustReason, setAdjustReason] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Filter to only Metered Reading (SERIAL_IMAGE) and PSI (WEIGHT_IMAGE) images that are not associated with a cylinder
  const meterImages = attachments.filter((a) =>
    !a.site_cylinder_id &&
    !a.cylinder_asset_id &&
    (a.attachment_type === "SERIAL_IMAGE" || a.attachment_type === "WEIGHT_IMAGE")
  );

  const handleAdjust = async () => {
    const parsed = parseFloat(newCurrentReading);
    if (isNaN(parsed) || parsed < 0) {
      setInputError("Please enter a valid positive number.");
      return;
    }
    if (!adjustReason.trim()) {
      setInputError("Adjustment reason is required.");
      return;
    }
    setInputError(null);

    const success = await onAdjust({
      transactionId,
      meterReadingId: reading.id,
      new_current_reading: parsed,
      adjustment_reason: adjustReason.trim(),
    });

    if (success) {
      setIsEditing(false);
      setAdjustReason("");
    }
  };

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-900/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Gauge className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-violet-800 dark:text-violet-300">
              Meter Reading
            </p>
            <p className="text-[10px] text-muted-foreground">
              {reading.reading_no ?? `ID: ${reading.id}`} · {reading.reading_date}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "text-[10px] px-1.5 py-0 border",
            reading.reading_status === "POSTED"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
          )}
        >
          {reading.reading_status}
        </Badge>
      </div>

      {/* Reading Values Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          ...(!isOnboarding ? [
            { label: "Previous Reading", value: reading.previous_reading.toFixed(3), unit: reading.meter_unit }
          ] : []),
          { label: "Current Reading", value: reading.current_reading.toFixed(3), unit: reading.meter_unit, highlight: true },
          ...(!isOnboarding ? [
            { label: "Raw Consumption", value: reading.raw_consumption.toFixed(3), unit: reading.meter_unit }
          ] : []),
          { label: "Conversion Factor", value: reading.conversion_factor.toFixed(6) },
          ...(!isOnboarding ? [
            { label: "KG Consumed", value: reading.kg_consumed.toFixed(3), unit: "kg", highlight: true }
          ] : []),
          { label: "Price / KG", value: `₱ ${reading.price_per_kg.toFixed(2)}` },
        ].map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-lg p-2.5 border",
              item.highlight
                ? "bg-violet-100/60 border-violet-200 dark:bg-violet-900/10 dark:border-violet-800/30"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
            )}
          >
            <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">
              {item.label}
            </p>
            <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
              {item.value}
              {item.unit && <span className="text-[10px] font-medium text-muted-foreground ml-1">{item.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Photos Row */}
      {meterImages.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Uploaded Photos
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {meterImages.map((att) => (
              <MeterPhoto
                key={att.id}
                fileId={att.directus_file_id}
                label={att.attachment_type === "SERIAL_IMAGE" ? "METERED READING" : "PSI"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviewer Adjustment */}
      {!isEditing ? (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewCurrentReading(String(reading.current_reading));
              setIsEditing(true);
            }}
            className="h-8 text-xs gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
          >
            <Pencil className="h-3 w-3" />
            Adjust Current Reading
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-violet-200 dark:border-violet-800/30">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold">
              Reviewer Adjustment — verify against the meter photo before saving.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Original Reading
              </Label>
              <Input
                value={reading.current_reading.toFixed(3)}
                disabled
                className="h-8 text-sm bg-zinc-100 dark:bg-zinc-800 text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Corrected Reading *
              </Label>
              <Input
                type="number"
                min={0}
                step={0.001}
                value={newCurrentReading}
                onChange={(e) => {
                  setNewCurrentReading(e.target.value);
                  setInputError(null);
                }}
                className="h-8 text-sm border-amber-300 focus-visible:ring-amber-400"
                placeholder="e.g. 1260.000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Reason for Adjustment *
            </Label>
            <Textarea
              value={adjustReason}
              onChange={(e) => {
                setAdjustReason(e.target.value);
                setInputError(null);
              }}
              placeholder="Describe why the reading was corrected (e.g. photo shows 1,260 not 1,250)"
              className="text-xs resize-none h-16"
            />
          </div>

          {inputError && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">{inputError}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAdjust}
              disabled={isSubmitting}
              className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Check className="h-3 w-3" />
              {isSubmitting ? "Saving..." : "Save Adjustment"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setInputError(null);
              }}
              className="h-8 text-xs"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
