"use client";

// ─── WiwoReviewPanel.tsx ──────────────────────────────────────────────────────
// Reviewer panel for WIWO cylinder details.
// Each cylinder shows as a compact row; clicking "View Details" opens a modal
// that displays all detail fields, the cylinder photo gallery, and the
// per-cylinder weight adjustment form.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  Scale,
  Camera,
  AlertTriangle,
  Pencil,
  X,
  Check,
  Cylinder,
  ChevronRight,
  Image as ImageIcon,
  Info,
  Loader2,
} from "lucide-react";
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

// ─── Image with loading skeleton ─────────────────────────────────────────────

function CylinderImage({
  fileId,
  label,
  onClick,
}: {
  fileId: string;
  label: string;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = `${ASSET_URL}?id=${encodeURIComponent(fileId)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-violet-400 transition-all shadow-sm"
      title={label}
    >
      {/* Skeleton while loading */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/50">
          <ImageIcon className="h-6 w-6" />
          <span className="text-[9px]">No image</span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={label}
          className={cn(
            "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-semibold text-center py-1 leading-tight">
        {label.replace(/_/g, " ")}
      </p>
      {/* Hover zoom hint */}
      {!error && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-white text-[9px] font-bold bg-black/60 px-2 py-0.5 rounded-full">
            Click to enlarge
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Full-screen image lightbox ───────────────────────────────────────────────

function ImageLightbox({
  fileId,
  label,
  onClose,
}: {
  fileId: string;
  label: string;
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSET_URL}?id=${encodeURIComponent(fileId)}`}
          alt={label}
          className="w-full h-full object-contain max-h-[85vh]"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs font-semibold text-center py-2">
          {label.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}

// ─── Cylinder Detail Modal ────────────────────────────────────────────────────

function CylinderDetailModal({
  detail,
  attachments,
  transactionId,
  wiwoHeaderId,
  isOnboarding,
  isSubmitting,
  onAdjust,
  onClose,
}: {
  detail: ConsolidationWiwoDetail;
  attachments: ConsolidationAttachment[];
  transactionId: number;
  wiwoHeaderId: number;
  isOnboarding: boolean;
  isSubmitting: boolean;
  onAdjust: WiwoReviewPanelProps["onAdjust"];
  onClose: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newGross, setNewGross] = useState<string>(
    detail.returned_gross_weight_kg != null ? String(detail.returned_gross_weight_kg) : ""
  );
  const [adjustReason, setAdjustReason] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [lightboxFile, setLightboxFile] = useState<{ id: string; label: string } | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxFile) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, lightboxFile]);

  // Filter attachments for this cylinder
  const cylinderAttachments = attachments.filter(
    (a) =>
      a.cylinder_asset_id === detail.cylinder_asset_id ||
      (a.site_cylinder_id !== null && a.site_cylinder_id === detail.site_cylinder_id)
  );

  const initialLpg = Math.max(0, (detail.returned_gross_weight_kg ?? 0) - detail.tare_weight_kg);

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Modal Header ── */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-blue-50/60 via-violet-50/40 to-transparent dark:from-blue-950/20 dark:via-violet-950/10 dark:to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 shadow-sm">
                <Cylinder className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-foreground truncate">{detail.serial_number}</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {detail.product?.product_name ?? `Product #${detail.product_id}`}
                  {" · "}
                  <span className="capitalize">{detail.line_type.toLowerCase().replace(/_/g, " ")}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
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
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Modal Body (scrollable) ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── Weight Details Grid ── */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" />
                Weight & Billing Details
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Tare Weight */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tare Weight</p>
                  <p className="text-sm font-black text-foreground">{detail.tare_weight_kg.toFixed(3)} <span className="text-xs font-medium text-muted-foreground">kg</span></p>
                </div>

                {/* Gross Weight */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Returned Gross</p>
                  <p className="text-sm font-black text-foreground">
                    {detail.returned_gross_weight_kg != null ? `${detail.returned_gross_weight_kg.toFixed(3)} ` : "—"}
                    {detail.returned_gross_weight_kg != null && <span className="text-xs font-medium text-muted-foreground">kg</span>}
                  </p>
                  {/* AG-CHANGE: Show true original (pre-audit) gross when the cylinder has been adjusted */}
                  {detail.is_adjusted && detail.original_returned_gross_weight_kg != null && (
                    <p className="text-[9px] text-rose-500 dark:text-rose-400 font-semibold mt-0.5 line-through">
                      Original: {detail.original_returned_gross_weight_kg.toFixed(3)} kg
                    </p>
                  )}
                </div>

                {/* LPG / Previous */}
                {isOnboarding ? (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">Deployed LPG</p>
                    <p className="text-sm font-black text-blue-700 dark:text-blue-400">{initialLpg.toFixed(3)} <span className="text-xs font-medium">kg</span></p>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Previous LPG</p>
                    <p className="text-sm font-black text-foreground">{detail.previous_lpg_kg.toFixed(3)} <span className="text-xs font-medium text-muted-foreground">kg</span></p>
                  </div>
                )}

                {/* Remaining */}
                {!isOnboarding && (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Remaining LPG</p>
                    <p className="text-sm font-black text-foreground">{detail.remaining_lpg_kg.toFixed(3)} <span className="text-xs font-medium text-muted-foreground">kg</span></p>
                  </div>
                )}

                {/* Consumed */}
                {!isOnboarding && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">Consumed</p>
                    <p className="text-sm font-black text-blue-700 dark:text-blue-400">{detail.consumed_lpg_kg.toFixed(3)} <span className="text-xs font-medium">kg</span></p>
                  </div>
                )}

                {/* Billable KG */}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Billable KG</p>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{detail.billable_kg.toFixed(3)} <span className="text-xs font-medium">kg</span></p>
                </div>
              </div>

              {/* Billing Amounts */}
              <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 border border-violet-200 dark:border-violet-800/40 rounded-xl p-4 space-y-2">
                {/* BIR-compliant labels: Vatable Sales, 12% Output VAT, Total Amount Due (NIRC / RR 7-2024) */}
                <p className="text-[9px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-2">Billing Computation</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price / KG</span>
                    <span className="font-bold">₱ {detail.price_per_kg.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vatable Sales</span>
                    <span className="font-bold">₱ {(detail.gross_amount / 1.12).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">12% Output VAT</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">₱ {detail.vat_amount.toFixed(2)}</span>
                  </div>
                  {detail.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">-₱ {detail.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-violet-200 dark:border-violet-800/40 pt-2 flex justify-between">
                    <span className="font-black text-violet-700 dark:text-violet-300">Total Amount Due</span>
                    <span className="font-black text-violet-700 dark:text-violet-300">₱ {detail.net_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {detail.remarks && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Remarks</p>
                  <p className="text-xs text-foreground">{detail.remarks}</p>
                </div>
              )}
            </div>

            {/* ── Photos Gallery ── */}
            {cylinderAttachments.length > 0 && (
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Cylinder Photos ({cylinderAttachments.length})
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {cylinderAttachments.map((att) => {
                    // AG-CHANGE: Prefix label to distinguish historical onboarding baseline photos from current swap photos
                    const displayLabel = att.transaction_id !== transactionId
                      ? `ONBOARDING_${att.attachment_type}`
                      : att.attachment_type;
                    return (
                      <CylinderImage
                        key={att.id}
                        fileId={att.directus_file_id}
                        label={displayLabel}
                        onClick={() =>
                          setLightboxFile({ id: att.directus_file_id, label: displayLabel })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Weight Adjustment Form ── */}
            <div className="px-5 pb-5">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewGross(
                      detail.returned_gross_weight_kg != null
                        ? String(detail.returned_gross_weight_kg)
                        : ""
                    );
                    setIsEditing(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition text-xs font-bold"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Adjust Gross Weight
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/40 rounded-xl animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[10px] font-bold">Verify the weighing scale photo before correcting.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Original Gross (kg)
                      </Label>
                      {/* AG-CHANGE: Show the true pre-audit original gross weight from the audit trail.
                          Falls back to the current returned_gross_weight_kg if no prior adjustment exists. */}
                      <Input
                        value={
                          detail.is_adjusted && detail.original_returned_gross_weight_kg != null
                            ? detail.original_returned_gross_weight_kg.toFixed(3)
                            : detail.returned_gross_weight_kg?.toFixed(3) ?? ""
                        }
                        disabled
                        className="h-8 text-xs bg-zinc-100 dark:bg-zinc-800 text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
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
                        className="h-8 text-xs border-amber-300 focus-visible:ring-amber-400"
                        placeholder="e.g. 30.500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
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
                      {isSubmitting ? "Saving..." : "Save Adjustment"}
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
        </div>
      </div>

      {/* Lightbox for full-screen image */}
      {lightboxFile && (
        <ImageLightbox
          fileId={lightboxFile.id}
          label={lightboxFile.label}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </>
  );
}

// ─── Compact Cylinder Row Card ────────────────────────────────────────────────

function CylinderRowCard({
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
  const [modalOpen, setModalOpen] = useState(false);

  const cylinderAttachmentCount = attachments.filter(
    (a) =>
      a.cylinder_asset_id === detail.cylinder_asset_id ||
      (a.site_cylinder_id !== null && a.site_cylinder_id === detail.site_cylinder_id)
  ).length;

  return (
    <>
      {/* Compact row */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all group">
        {/* Left: identity */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center shrink-0">
            <Cylinder className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <div>
              <p className="text-xs font-black text-foreground truncate">{detail.serial_number}</p>
              <p className="text-[9px] text-muted-foreground truncate">
                {detail.product?.product_name ?? `Product #${detail.product_id}`}
              </p>
            </div>
            {detail.is_adjusted && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded shrink-0 select-none">
                Adjusted
              </span>
            )}
          </div>
        </div>

        {/* Weight stats */}
        <div className="hidden sm:flex items-center gap-3.5 text-xs font-mono shrink-0 mr-2 text-right">
          <div>
            <span className="text-[8px] text-muted-foreground uppercase block font-bold tracking-wider leading-none mb-0.5">Gross</span>
            <div className="flex flex-col items-end">
              <span className="font-bold text-foreground text-[11px]">
                {detail.returned_gross_weight_kg != null ? `${detail.returned_gross_weight_kg.toFixed(1)} kg` : "—"}
              </span>
              {detail.is_adjusted && detail.original_returned_gross_weight_kg != null && (
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 line-through leading-none mt-0.5">
                  Orig: {detail.original_returned_gross_weight_kg.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-[8px] text-muted-foreground uppercase block font-bold tracking-wider leading-none mb-0.5">Tare</span>
            <span className="font-medium text-muted-foreground text-[11px]">
              {detail.tare_weight_kg.toFixed(1)} kg
            </span>
          </div>
          <div>
            <span className="text-[8px] text-muted-foreground uppercase block font-bold tracking-wider leading-none mb-0.5">Net</span>
            <span className="font-black text-violet-600 dark:text-violet-400 text-[11px]">
              {detail.returned_gross_weight_kg != null ? `${Math.max(0, detail.returned_gross_weight_kg - detail.tare_weight_kg).toFixed(1)} kg` : "—"}
            </span>
          </div>
        </div>

        {/* Right: badges + view btn */}
        <div className="flex items-center gap-2 shrink-0">
          {cylinderAttachmentCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-full px-2 py-0.5">
              <Camera className="h-3 w-3" />
              {cylinderAttachmentCount}
            </span>
          )}
          <Badge
            className={cn(
              "text-[9px] font-black uppercase px-2 py-0.5 border hidden md:flex",
              detail.is_billable === 1
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            )}
          >
            {detail.is_billable === 1 ? "Billable" : "Non-Billable"}
          </Badge>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 transition"
          >
            View Details
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {modalOpen && (
        <CylinderDetailModal
          detail={detail}
          attachments={attachments}
          transactionId={transactionId}
          wiwoHeaderId={wiwoHeaderId}
          isOnboarding={isOnboarding}
          isSubmitting={isSubmitting}
          onAdjust={onAdjust}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
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
  const isOnboarding =
    wiwoHeader.wiwo_no === "WIWO-ONB-BASELINE" || wiwoHeader.wiwo_type === "DEPLOYMENT_ONLY";

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/20 dark:bg-blue-900/5 p-4 space-y-3">
      {/* Panel Header */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Scale className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300">WIWO Cylinder Details</p>
          <p className="text-[10px] text-muted-foreground">
            {wiwoHeader.wiwo_no} · {wiwoHeader.transaction_date} ·{" "}
            {wiwoHeader.details?.length ?? 0} cylinder(s)
          </p>
        </div>
        {isOnboarding ? (
          <Badge className="ml-auto text-[10px] px-2 py-0.5 border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 font-bold">
            Total Deployed LPG:{" "}
            {(wiwoHeader.details ?? [])
              .reduce((sum, d) => sum + Math.max(0, (d.returned_gross_weight_kg ?? 0) - d.tare_weight_kg), 0)
              .toFixed(3)}{" "}
            kg
          </Badge>
        ) : (
          <Badge className="ml-auto text-[10px] px-2 py-0.5 border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 font-bold">
            Total Billable: {wiwoHeader.total_billable_kg.toFixed(3)} kg
          </Badge>
        )}
      </div>

      {/* Compact Cylinder Rows */}
      <div className="space-y-2">
        {(wiwoHeader.details ?? []).map((detail) => (
          <CylinderRowCard
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
