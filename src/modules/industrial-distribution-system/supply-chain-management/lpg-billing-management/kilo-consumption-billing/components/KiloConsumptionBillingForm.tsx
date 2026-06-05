"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Hash,
  Calendar,
  DollarSign,
  Save,
  CheckCircle2,
  Loader2,
  Flame,
  Building2,
} from "lucide-react";


import { KiloConsumptionDetail } from "./KiloConsumptionDetail";
import { KiloBillingSummaryCard } from "./KiloBillingSummaryCard";
import { useKiloBillingForm } from "../hooks/useKiloConsumption";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  wiwoId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function KiloConsumptionBillingForm({ wiwoId, onSuccess, onCancel }: Props) {
  const {
    wiwo,
    setWiwo,
    loading,
    submitting,
    form,
    setForm,
    summary,
    canPost,
    submit,
  } = useKiloBillingForm(wiwoId);


  const handleSubmit = async () => {
    const ok = await submit();
    if (ok) onSuccess();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const isEditable = !wiwoId || form.status === "DRAFT";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            {wiwoId ? "Generate WIWO Invoice" : "Record Cylinder Returns & Invoice"}
          </h2>
          {wiwo && (
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm text-muted-foreground font-bold">
                {wiwo.transaction_no}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {wiwo.transaction_date
                  ? format(new Date(wiwo.transaction_date), "MMM dd, yyyy")
                  : "—"}
              </span>
              <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-bold uppercase tracking-wider">
                KILO
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 hover:bg-red-50 hover:text-red-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !canPost}
            className="h-9 px-6 bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : form.status === "POSTED" ? (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {form.status === "POSTED" ? "Post Invoice" : "Save Draft"}
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Site Information */}
          {wiwo && (
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <h2 className="font-semibold">Customer & Site Information</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Customer</p>
                  <p className="font-bold">{wiwo.customer?.customer_name ?? "—"}</p>
                  <p className="text-muted-foreground font-mono text-xs">{wiwo.customer_code}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">LPG Site</p>
                  <p className="font-bold">{wiwo.site?.site_name ?? "—"}</p>
                </div>
              </div>
            </div>
          )}


          {/* Invoice Fields */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                <Flame className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Invoice Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invoice No
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="kilo-invoice-no"
                    value={form.invoiceNo}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))}
                    className="pl-10 font-mono"
                    readOnly={!isEditable}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invoice Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="kilo-invoice-date"
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                    className="pl-10"
                    readOnly={!isEditable}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Price / KG
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                    <DollarSign className="h-4 w-4" />
                  </span>
                  <Input
                    id="kilo-price-per-kg"
                    type="number"
                    step="0.01"
                    value={form.pricePerKg}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerKg: Number(e.target.value) }))}
                    className="pl-10"
                    readOnly={!isEditable}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* WIWO Cylinder Lines */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/20 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold">Cylinder Returns (WIWO)</h2>
                  <p className="text-[10px] text-muted-foreground">Weight-In Weight-Out detail lines</p>
                </div>
              </div>
              {wiwo?.details && (
                <Badge variant="secondary" className="font-mono">
                  {wiwo.details.length} cylinders
                </Badge>
              )}
            </div>
            <KiloConsumptionDetail 
              details={wiwo?.details ?? []} 
              editable={isEditable}
              onChange={(updated) => setWiwo(prev => prev ? ({ ...prev, details: updated }) : null)}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <KiloBillingSummaryCard
            billableKg={summary.billableKg}
            grossAmount={summary.grossAmount}
            vatAmount={summary.vatAmount}
            netAmount={summary.netAmount}
            pricePerKg={form.pricePerKg}
            cylinderCount={wiwo?.details?.length ?? 0}
          />

          {/* Status + Remarks */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </Label>
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {(["DRAFT", "POSTED"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!isEditable && s === "DRAFT"}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.status === s
                        ? s === "POSTED"
                          ? "bg-white dark:bg-zinc-700 shadow-sm text-green-600"
                          : "bg-white dark:bg-zinc-700 shadow-sm text-blue-600"
                        : "text-muted-foreground hover:text-zinc-900"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Remarks
              </Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Internal notes..."
                className="resize-none h-24"
                readOnly={!isEditable}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

