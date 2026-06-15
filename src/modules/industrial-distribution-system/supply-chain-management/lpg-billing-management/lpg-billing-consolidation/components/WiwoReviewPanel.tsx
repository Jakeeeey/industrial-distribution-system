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
  const [showPhotos, setShowPhotos] = useState(false);
  const [newGross, setNewGross] = useState<string>(
    detail.returned_gross_weight_kg != null ? String(detail.returned_gross_weight_kg) : ""
  );
  const [adjustReason, setAdjustReason] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Filter attachments relevant to this cylinder
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

  const initialLpg = Math.max(0, (detail.returned_gross_weight_kg ?? 0) - detail.tare_weight_kg);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm hover:shadow-md transition duration-200">
      {/* ── Cylinder Row Main Line ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-3 gap-3">
        {/* Left Side: Identity and Compact Weights */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Cylinder className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-black text-foreground">{detail.serial_number}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              {detail.product?.product_name ?? `Product #${detail.product_id}`}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize bg-muted/40 font-semibold shrink-0">
              {detail.line_type.toLowerCase().replace("_", " ")}
            </Badge>
          </div>

          {/* Inline weights - clean & high contrast, no boxes! */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] font-bold text-muted-foreground/80">
            <span>Tare: <span className="text-foreground">{detail.tare_weight_kg.toFixed(2)}kg</span></span>
            <span className="text-muted-foreground/30">•</span>
            {isOnboarding ? (
              <>
                <span>Gross: <span className="text-foreground">{detail.returned_gross_weight_kg?.toFixed(2) ?? "—"}kg</span></span>
                <span className="text-muted-foreground/30">•</span>
                <span>LPG Content: <span className="text-primary">{initialLpg.toFixed(2)}kg</span></span>
              </>
            ) : (
              <>
                <span>Prev LPG: <span className="text-foreground">{detail.previous_lpg_kg.toFixed(2)}kg</span></span>
                <span className="text-muted-foreground/30">•</span>
                <span>Gross: <span className="text-foreground">{detail.returned_gross_weight_kg?.toFixed(2) ?? "—"}kg</span></span>
                <span className="text-muted-foreground/30">•</span>
                <span>Remaining: <span className="text-foreground">{detail.remaining_lpg_kg.toFixed(2)}kg</span></span>
                <span className="text-muted-foreground/30">•</span>
                <span>Consumed: <span className="text-blue-600 dark:text-blue-400">{detail.consumed_lpg_kg.toFixed(2)}kg</span></span>
              </>
            )}
            <span className="text-muted-foreground/30">•</span>
            <span>Billable: <span className="text-emerald-600 dark:text-emerald-400">{detail.billable_kg.toFixed(2)}kg</span></span>
          </div>
        </div>

        {/* Right Side: Actions and Badges */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {/* Photo count toggler */}
          {cylinderAttachments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPhotos(!showPhotos)}
              className={cn(
                "h-7 px-2 rounded-lg border text-[10px] font-black flex items-center gap-1 transition-all",
                showPhotos
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{cylinderAttachments.length}</span>
            </button>
          )}

          <Badge
            className={cn(
              "text-[9px] font-black uppercase px-2 py-0.5 border",
              detail.is_billable === 1
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            )}
          >
            {detail.is_billable === 1 ? "Billable" : "Non-Billable"}
          </Badge>

          {/* Adjust trigger */}
          {!isEditing && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setNewGross(detail.returned_gross_weight_kg != null ? String(detail.returned_gross_weight_kg) : "");
                setIsEditing(true);
              }}
              className="h-7 w-7 border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
              title="Adjust gross weight"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Collapsible Content Areas (Photos & Editing) ── */}
      {(showPhotos || isEditing) && (
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/20 space-y-3">
          {/* Photos Area */}
          {showPhotos && cylinderAttachments.length > 0 && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Cylinder Photos</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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

          {/* Adjust Form Area */}
          {isEditing && (
            <div className="space-y-2.5 pt-1.5 border-t border-zinc-200/40 dark:border-zinc-700/40 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                <p className="text-[10px] font-bold">Verify the weighing scale photo before correcting.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Original Gross (kg)</Label>
                  <Input
                    value={detail.returned_gross_weight_kg?.toFixed(3) ?? ""}
                    disabled
                    className="h-8 text-xs bg-zinc-100 dark:bg-zinc-800 text-muted-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Corrected Gross (kg) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    value={newGross}
                    onChange={(e) => {
                      setNewGross(e.target.value);
                      setInputError(null);
                    }}
                    className="h-8 text-xs border-amber-300 focus-visible:ring-amber-400"
                    placeholder="e.g. 30.500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Reason *</Label>
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
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{inputError}</p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleAdjust}
                  disabled={isSubmitting}
                  className="h-7 text-[10px] gap-1 bg-primary hover:bg-primary/90 text-white font-bold"
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
      )}
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
        {isOnboarding ? (
          <Badge className="ml-auto text-[10px] px-2 py-0.5 border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 font-bold">
            Total Deployed LPG: {(wiwoHeader.details ?? []).reduce((sum, d) => sum + Math.max(0, (d.returned_gross_weight_kg ?? 0) - d.tare_weight_kg), 0).toFixed(3)} kg
          </Badge>
        ) : (
          <Badge className="ml-auto text-[10px] px-2 py-0.5 border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 font-bold">
            Total Billable: {wiwoHeader.total_billable_kg.toFixed(3)} kg
          </Badge>
        )}
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
