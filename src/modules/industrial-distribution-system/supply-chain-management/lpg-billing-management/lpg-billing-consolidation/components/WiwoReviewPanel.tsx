"use client";

// ─── WiwoReviewPanel.tsx ──────────────────────────────────────────────────────
// Reviewer panel for WIWO cylinder details.
// Displays each cylinder line with returned weight, computed KG, photos, and
// allows per-cylinder weight correction with audit trail support.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Scale, Camera, AlertTriangle, Pencil, X, Check, Cylinder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ConsolidationWiwoHeader,
  ConsolidationWiwoDetail,
  ConsolidationAttachment,
} from "../types/billing-consolidation.types";

interface WiwoReviewPanelProps {
  wiwoHeader: ConsolidationWiwoHeader;
  attachments: ConsolidationAttachment[];
  transactionId: number;
  isSubmitting: boolean;
  onAdjust: (payload: {
    transactionId: number;
    wiwoDetailId: number;
    wiwoHeaderId: number;
    new_returned_gross_weight_kg: number;
    adjustment_reason: string;
  }) => Promise<boolean>;
}

const ASSET_URL = "/api/ids/scm/lpg-billing-management/metered-billing/asset";

// ─── Cylinder Photo ───────────────────────────────────────────────────────────

function CylinderPhoto({
  fileId,
  label,
}: {
  fileId: string;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="group relative w-full h-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-blue-400 transition"
        title={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSET_URL}?id=${encodeURIComponent(fileId)}`}
          alt={label}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] font-semibold text-center py-0.5">
          {label}
        </p>
      </button>
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
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
    </>
  );
}

// ─── Per-Cylinder Adjust Row ──────────────────────────────────────────────────

function CylinderDetailRow({
  detail,
  attachments,
  transactionId,
  wiwoHeaderId,
  isOnboarding,
  isSubmitting,
  onAdjust,
}: {
  detail: ConsolidationWiwoDetail;
  attachments: ConsolidationAttachment[];
  transactionId: number;
  wiwoHeaderId: number;
  isOnboarding: boolean;
  isSubmitting: boolean;
  onAdjust: WiwoReviewPanelProps["onAdjust"];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newGross, setNewGross] = useState<string>(
    detail.returned_gross_weight_kg != null ? String(detail.returned_gross_weight_kg) : ""
  );
  const [adjustReason, setAdjustReason] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Filter attachments relevant to this cylinder (by cylinder_asset_id or site_cylinder_id)
  const cylinderAttachments = attachments.filter(
    (a) =>
      (a.cylinder_asset_id === detail.cylinder_asset_id) ||
      (a.site_cylinder_id !== null && a.site_cylinder_id === detail.site_cylinder_id)
  );

  const handleAdjust = async () => {
    const parsed = parseFloat(newGross);
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
      wiwoDetailId: detail.id,
      wiwoHeaderId,
      new_returned_gross_weight_kg: parsed,
      adjustment_reason: adjustReason.trim(),
    });

    if (success) {
      setIsEditing(false);
      setAdjustReason("");
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Cylinder Row Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50/80 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-700/50">
        <div className="flex items-center gap-2">
          <Cylinder className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
              {detail.serial_number}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {detail.product?.product_name ?? `Product #${detail.product_id}`}
              {" · "}
              <span className="capitalize">{detail.line_type.toLowerCase().replace("_", " ")}</span>
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "text-[9px] px-1.5 py-0 border",
            detail.is_billable === 1
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
          )}
        >
          {detail.is_billable === 1 ? "Billable" : "Non-Billable"}
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        {/* Weight / KG Values */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "Tare Weight", value: detail.tare_weight_kg.toFixed(3), unit: "kg" },
            ...(!isOnboarding ? [
              { label: "Previous LPG", value: detail.previous_lpg_kg.toFixed(3), unit: "kg" }
            ] : []),
            { label: "Returned Gross", value: detail.returned_gross_weight_kg?.toFixed(3) ?? "—", unit: "kg", highlight: true },
            ...(!isOnboarding ? [
              { label: "Remaining LPG", value: detail.remaining_lpg_kg.toFixed(3), unit: "kg" },
              { label: "Consumed LPG", value: detail.consumed_lpg_kg.toFixed(3), unit: "kg", highlight: true }
            ] : []),
            { label: "Billable KG", value: detail.billable_kg.toFixed(3), unit: "kg", highlight: true },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-md p-2 border",
                item.highlight
                  ? "bg-blue-50/60 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/30"
                  : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/30 dark:border-zinc-700"
              )}
            >
              <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">
                {item.label}
              </p>
              <p className="text-xs font-black text-zinc-800 dark:text-zinc-100">
                {item.value}
                {item.unit && (
                  <span className="text-[9px] font-medium text-muted-foreground ml-1">
                    {item.unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Cylinder Photos */}
        {cylinderAttachments.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Camera className="h-3 w-3 text-muted-foreground" />
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                Cylinder Photos
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cylinderAttachments.map((att) => (
                <CylinderPhoto
                  key={att.id}
                  fileId={att.directus_file_id}
                  label={att.attachment_type.replace("_", " ")}
                />
              ))}
            </div>
          </div>
        )}

        {/* Adjust Form */}
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewGross(detail.returned_gross_weight_kg != null ? String(detail.returned_gross_weight_kg) : "");
              setIsEditing(true);
            }}
            className="h-7 text-[10px] gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
          >
            <Pencil className="h-3 w-3" />
            Adjust Returned Gross Weight
          </Button>
        ) : (
          <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <p className="text-[10px] font-semibold">
                Verify the weighing scale photo before correcting.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Original Gross (kg)
                </Label>
                <Input
                  value={detail.returned_gross_weight_kg?.toFixed(3) ?? ""}
                  disabled
                  className="h-7 text-xs bg-zinc-100 dark:bg-zinc-800 text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Corrected Gross (kg) *
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  value={newGross}
                  onChange={(e) => {
                    setNewGross(e.target.value);
                    setInputError(null);
                  }}
                  className="h-7 text-xs border-amber-300 focus-visible:ring-amber-400"
                  placeholder="e.g. 30.500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                Reason *
              </Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => {
                  setAdjustReason(e.target.value);
                  setInputError(null);
                }}
                placeholder="Reason for correction (e.g. scale photo shows 30.50 not 31.00)"
                className="text-xs resize-none h-14"
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
                className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Check className="h-3 w-3" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setInputError(null);
                }}
                className="h-7 text-[10px]"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function WiwoReviewPanel({
  wiwoHeader,
  attachments,
  transactionId,
  isSubmitting,
  onAdjust,
}: WiwoReviewPanelProps) {
  const isOnboarding = wiwoHeader.wiwo_no === "WIWO-ONB-BASELINE" || wiwoHeader.wiwo_type === "DEPLOYMENT_ONLY";

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/20 dark:bg-blue-900/5 p-4 space-y-3">
      {/* Panel Header */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Scale className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300">
            WIWO Cylinder Details
          </p>
          <p className="text-[10px] text-muted-foreground">
            {wiwoHeader.wiwo_no} · {wiwoHeader.transaction_date} ·{" "}
            {wiwoHeader.details?.length ?? 0} cylinder(s)
          </p>
        </div>
        <Badge
          className="ml-auto text-[10px] px-1.5 py-0 border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
        >
          Total: {wiwoHeader.total_billable_kg.toFixed(3)} kg
        </Badge>
      </div>

      {/* Cylinder Rows */}
      <div className="space-y-3">
        {(wiwoHeader.details ?? []).map((detail) => (
          <CylinderDetailRow
            key={detail.id}
            detail={detail}
            attachments={attachments}
            transactionId={transactionId}
            wiwoHeaderId={wiwoHeader.id}
            isOnboarding={isOnboarding}
            isSubmitting={isSubmitting}
            onAdjust={onAdjust}
          />
        ))}

        {!wiwoHeader.details?.length && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No cylinder detail lines found for this WIWO record.
          </p>
        )}
      </div>
    </div>
  );
}
