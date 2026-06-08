"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  Plus,
  Scale,
  Gauge,
  AlertCircle,
  TrendingUp,
  Truck,
  Calendar as CalendarIcon,
  CheckCircle2,
  Loader2
} from "lucide-react";
import type { CylinderAsset, CustomerSiteCylinder, MeteredWiwoTransaction, CustomerSite, MeterReading, WiwoHeader } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { format } from "date-fns";

interface WiwoFormProps {
  txId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function getCylinderCapacity(productName?: string): number {
  if (!productName) return 50;
  const match = productName.match(/(\d+)\s*(KG|kg)/);
  if (match) return parseInt(match[1]);
  const numMatch = productName.match(/\d+/);
  return numMatch ? parseInt(numMatch[0]) : 50;
}

export function WiwoForm({ txId, onSuccess, onCancel }: WiwoFormProps) {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [availableCylinders, setAvailableCylinders] = useState<CylinderAsset[]>([]);
  const [activeSiteCylinders, setActiveSiteCylinders] = useState<CustomerSiteCylinder[]>([]);

  // Form State
  const [customerCode, setCustomerCode] = useState("");
  const [siteId, setSiteId] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [flowType, setFlowType] = useState<"ROUTINE" | "ONBOARDING">("ROUTINE");
  const [pricePerKg, setPricePerKg] = useState(0);

  // Flow A state: Onboarding
  const [serialInput, setSerialInput] = useState("");
  const [isValidatingSerial, setIsValidatingSerial] = useState(false);
  const [selectedOnboardCylinders, setSelectedOnboardCylinders] = useState<{
    cylinderAssetId: number;
    serialNumber: string;
    productName: string;
    tareWeight: number;
    capacity: number;
    targetKg: number | string;
    pricePerKg: number;
  }[]>([]);

  // Flow B state: Routine Check & Swap
  const [previousReading, setPreviousReading] = useState(0);
  const [currentReading, setCurrentReading] = useState(0);
  const [returnedWeights, setReturnedWeights] = useState<Record<number, number>>({});
  const [selectedReplacementCylinders, setSelectedReplacementCylinders] = useState<{ cylinderAssetId: number; targetKg: number }[]>([]);

  const [remarks, setRemarks] = useState("");
  const [varianceReasonCode, setVarianceReasonCode] = useState<string>("NONE");
  const [status, setStatus] = useState<"DRAFT" | "POSTED" | "CANCELLED">("DRAFT");

  // Existing View State
  const [txDetail, setTxDetail] = useState<MeteredWiwoTransaction | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelledReason, setCancelledReason] = useState("");

  // Combobox Search States
  const [siteSearch, setSiteSearch] = useState("");

  // Load Sites & Available Cylinders
  useEffect(() => {
    const initLookups = async () => {
      try {
        const sRes = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=sites");
        const sData = await sRes.json();
        setSites(sData.data || []);

        const cyRes = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=available");
        const cyData = await cyRes.json();
        setAvailableCylinders(cyData.data || []);
      } catch (err) {
        console.error("Failed to load initial metadata", err);
      }
    };
    initLookups();
  }, []);

  // Fetch Site specific metrics and cylinders when siteId changes
  useEffect(() => {
    if (!siteId) {
      setActiveSiteCylinders([]);
      setPreviousReading(0);
      setPricePerKg(0);
      setCustomerCode("");
      return;
    }
    const selectedSite = sites.find((s) => String(s.id) === siteId);
    if (selectedSite) {
      setCustomerCode(selectedSite.customer_code);
      setPreviousReading(Number(selectedSite.last_meter_reading ?? 0));
      setCurrentReading(Number(selectedSite.last_meter_reading ?? 0));
      setPricePerKg(Number(selectedSite.default_price_per_kg ?? 0));
    }

    const fetchCylinders = async () => {
      try {
        const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=site-cylinders&siteId=${siteId}`);
        const data = await res.json();
        setActiveSiteCylinders(data.data || []);
        
        // Reset returned weights mapping
        const initialWeights: Record<number, number> = {};
        (data.data || []).forEach((c: CustomerSiteCylinder) => {
          initialWeights[c.id] = Number(c.cylinder_asset?.tare_weight ?? 0);
        });
        setReturnedWeights(initialWeights);
      } catch (err) {
        console.error("Failed to load active site cylinders", err);
      }
    };
    fetchCylinders();
  }, [siteId, sites]);

  // Load Existing Transaction Details
  useEffect(() => {
    if (!txId) {
      setTxDetail(null);
      return;
    }
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing/${txId}`);
        const data = await res.json();
        setTxDetail(data.data || null);
        if (data.data) {
          setStatus(data.data.status);
          setVarianceReasonCode(data.data.variance_reason_code || "NONE");
        }
      } catch (err) {
        console.error("Failed to load transaction details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [txId]);

  const handleAddSerial = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const serial = serialInput.trim();
    if (!serial) return;

    // Check if already added
    if (selectedOnboardCylinders.some((c) => c.serialNumber.toUpperCase() === serial.toUpperCase())) {
      alert("This cylinder is already added to the baseline.");
      setSerialInput("");
      return;
    }

    setIsValidatingSerial(true);
    try {
      const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=validate-serial&serial=${encodeURIComponent(serial)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to validate serial number.");
      }

      const cyl = data.data;
      const cap = getCylinderCapacity(cyl.product?.product_name);
      setSelectedOnboardCylinders((prev) => [
        ...prev,
        {
          cylinderAssetId: cyl.id,
          serialNumber: cyl.serial_number,
          productName: cyl.product?.product_name || "Unknown Product",
          tareWeight: cyl.tare_weight || 0,
          capacity: cap,
          targetKg: "",
          pricePerKg: pricePerKg,
        },
      ]);
      setSerialInput("");
    } catch (err) {
      const error = err as Error;
      alert(error.message || "Invalid serial number.");
    } finally {
      setIsValidatingSerial(false);
    }
  };

  // ─── Mathematical Calculations (Flow B) ─────────────────────────────────────
  const meteredKg = Math.max(0, currentReading - previousReading);

  // Map and calculate returned cylinders
  const calculatedReturnedCylinders = activeSiteCylinders.map((sc) => {
    const returnedGross = returnedWeights[sc.id] ?? 0;
    const tare = Number(sc.cylinder_asset?.tare_weight ?? 0);
    const opening = Number(sc.previous_lpg_kg ?? 0);

    const remaining = Math.max(0, returnedGross - tare);
    const consumed = Math.max(0, opening - remaining);

    return {
      ...sc,
      returnedGross,
      tare,
      opening,
      remaining: parseFloat(remaining.toFixed(3)),
      consumed: parseFloat(consumed.toFixed(3)),
      isValid: returnedGross >= tare,
    };
  });

  const totalWiwoKg = calculatedReturnedCylinders.reduce((sum, c) => sum + c.consumed, 0);
  const billableKg = Math.max(meteredKg, totalWiwoKg);
  const varianceKg = Math.abs(meteredKg - totalWiwoKg);
  const mismatchExists = meteredKg !== totalWiwoKg;

  // Validation boundary: block if weight entries are completely illogical
  const hasNegativeWeightErrors = calculatedReturnedCylinders.some(
    (c) => c.returnedGross > 0 && c.returnedGross < c.tare
  );

  const isReadOnly = txId ? txDetail?.status === "POSTED" || txDetail?.status === "CANCELLED" : false;

  // Submit Handler
  const handleSubmit = async () => {
    if (loading) return;

    if (mismatchExists && flowType === "ROUTINE" && !remarks.trim()) {
      alert("A text explanation in the remarks field is required due to Metered vs WIWO discrepancy.");
      return;
    }

    if (hasNegativeWeightErrors) {
      alert("Returned gross weight cannot be less than the cylinder's empty tare weight.");
      return;
    }

    setLoading(true);
    try {
      let payload: Record<string, unknown> = {};
      if (flowType === "ONBOARDING") {
        if (selectedOnboardCylinders.length === 0) {
          alert("Please select at least one cylinder for onboarding.");
          setLoading(false);
          return;
        }
        const emptyGas = selectedOnboardCylinders.find(
          (c) => c.targetKg === undefined || c.targetKg === null || String(c.targetKg).trim() === ""
        );
        if (emptyGas) {
          alert(`Please enter a starting gas weight for cylinder ${emptyGas.serialNumber}.`);
          setLoading(false);
          return;
        }
        const capacityOverrun = selectedOnboardCylinders.find(
          (c) => Number(c.targetKg) - c.tareWeight > c.capacity
        );
        if (capacityOverrun) {
          alert(`Starting gas weight for cylinder ${capacityOverrun.serialNumber} (${(Number(capacityOverrun.targetKg) - capacityOverrun.tareWeight).toFixed(2)} KG net) cannot exceed its actual capacity of ${capacityOverrun.capacity} KG.`);
          setLoading(false);
          return;
        }
        const tareUnderrun = selectedOnboardCylinders.find(
          (c) => Number(c.targetKg) < c.tareWeight
        );
        if (tareUnderrun) {
          alert(`Starting gross weight for cylinder ${tareUnderrun.serialNumber} cannot be less than its empty tare weight of ${tareUnderrun.tareWeight} KG.`);
          setLoading(false);
          return;
        }
        payload = {
          transaction_type: "ONBOARDING_BASELINE",
          customer_code: customerCode,
          lpg_site_id: Number(siteId),
          transaction_date: transactionDate,
          cylinders: selectedOnboardCylinders.map(c => ({
            cylinderAssetId: c.cylinderAssetId,
            targetKg: c.targetKg,
            pricePerKg: c.pricePerKg
          })),
        };
      } else {
        // Routine check & swap
        const returnedCylindersPayload = calculatedReturnedCylinders.map((c) => ({
          siteCylinderId: c.id,
          returnedGrossWeight: c.returnedGross,
        }));

        payload = {
          transaction_type: "REGULAR_BILLING",
          customer_code: customerCode,
          lpg_site_id: Number(siteId),
          transaction_date: transactionDate,
          previous_reading: previousReading,
          current_reading: currentReading,
          price_per_kg: pricePerKg,
          returned_cylinders: returnedCylindersPayload,
          new_cylinders: selectedReplacementCylinders,
          varianceReasonCode: varianceReasonCode,
          remarks: remarks,
        };
      }

      const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process transaction.");
      }

      alert("Transaction saved and posted successfully!");
      onSuccess();
    } catch (err) {
      const error = err as Error;
      alert(error.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Rollback Submit Handler
  const handleCancelTransaction = async () => {
    if (!cancelledReason.trim()) {
      alert("Please enter a valid reason for cancellation.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCEL",
          cancelled_reason: cancelledReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to cancel transaction.");
      }

      alert("Transaction successfully rolled back and cancelled.");
      setIsCancelModalOpen(false);
      onSuccess();
    } catch (err) {
      const error = err as Error;
      alert(error.message || "An error occurred during cancellation.");
    } finally {
      setLoading(false);
    }
  };

  const selectedSite = sites.find(s => String(s.id) === siteId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // ─── Rendering Unified Form View ──────────────────────────────────────────
  const isViewMode = !!txId && !!txDetail;
  const isCancelled = isViewMode && txDetail?.status === "CANCELLED";
  const isPosted = isViewMode && txDetail?.status === "POSTED";

  // Financial computations
  const finalBillableKg = isViewMode ? txDetail.billable_kg : billableKg;
  const finalPricePerKg = isViewMode ? txDetail.price_per_kg : pricePerKg;
  const finalGross = isViewMode ? txDetail.gross_amount : parseFloat((finalBillableKg * finalPricePerKg).toFixed(2));
  const finalVat = isViewMode ? txDetail.vat_amount : parseFloat((finalGross * 0.12).toFixed(2));
  const finalNet = isViewMode ? txDetail.net_amount : parseFloat((finalGross + finalVat).toFixed(2));
  const finalBillableSource = isViewMode ? txDetail.billable_source : (meteredKg >= totalWiwoKg ? "METERED" : "WIWO");

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Locked Notice */}
      {isReadOnly && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-250 dark:border-yellow-900/50 rounded-2xl p-4 text-xs text-yellow-800 dark:text-yellow-400 flex items-center gap-3 shadow-md">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="font-bold">Transaction Locked: </span>
            This physical validation & billing record is <span className="font-bold text-violet-600 dark:text-violet-400">{txDetail?.status}</span> and cannot be modified.
          </div>
        </div>
      )}

      {/* Cancellation Notice */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-4 text-xs text-red-800 dark:text-red-300 space-y-1 shadow-md">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            Transaction Rollback Audit Logs
          </div>
          <div>Cancelled On: {txDetail?.cancelled_date}</div>
          <div>Reason: {txDetail?.cancelled_reason}</div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent truncate">
            {isViewMode
              ? `WIWO Validation Log: ${txDetail?.transaction_no}`
              : flowType === "ONBOARDING"
              ? "New Onboarding Baseline (Flow A)"
              : "New Routine Check & Swap (Flow B)"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isViewMode
              ? `Transaction type: ${txDetail?.transaction_type?.replace("_", " ")}`
              : flowType === "ONBOARDING"
              ? "Establish site inventory baseline with zero-amount logistics tracking"
              : "Dual Meter-Sync & Weigh-In / Weigh-Out consumption verification"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 hover:bg-red-50 hover:text-red-600"
          >
            {isReadOnly ? "Close" : "Cancel"}
          </Button>

          {isPosted && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setIsCancelModalOpen(true)}
              className="h-9 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all active:scale-95"
            >
              Cancel & Rollback
            </Button>
          )}

          {!isReadOnly && !isViewMode && (
            <Button
              onClick={handleSubmit}
              disabled={loading || (flowType === "ROUTINE" && mismatchExists && !remarks.trim()) || hasNegativeWeightErrors}
              className="h-9 px-6 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20 transition-all active:scale-95 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Post Validation
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout: single column on mobile, 3-col on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card A: Transaction Info */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                <Gauge className="h-4 w-4" />
              </div>
              <h2 className="font-semibold text-sm">Transaction Details</h2>
            </div>

            {/* Toggle Flow type if New Mode */}
            {!isViewMode && (
              <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setFlowType("ROUTINE")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
                    flowType === "ROUTINE"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600"
                      : "text-muted-foreground hover:text-zinc-900"
                  }`}
                >
                  Regular Routine Swap (Flow B)
                </button>
                <button
                  type="button"
                  onClick={() => setFlowType("ONBOARDING")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
                    flowType === "ONBOARDING"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600"
                      : "text-muted-foreground hover:text-zinc-900"
                  }`}
                >
                  Onboarding Baseline (Flow A)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">LPG Site</Label>
                {isViewMode ? (
                  <Input
                    value={txDetail.site?.site_name || `Site ID: ${txDetail.lpg_site_id}`}
                    readOnly
                    className="bg-zinc-50 dark:bg-zinc-800 font-medium"
                  />
                ) : (
                  <Combobox
                    value={selectedSite}
                    onValueChange={(val: CustomerSite | null) => {
                      setSiteId(val ? String(val.id) : "");
                      if (val) setSiteSearch(val.site_name || `Site #${val.id}`);
                    }}
                  >
                    <ComboboxInput
                      placeholder={sites.length === 0 ? "Loading sites..." : "Select LPG Site..."}
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                      showTrigger
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {sites.length === 0 && <ComboboxEmpty>No sites.</ComboboxEmpty>}
                        {sites
                          .filter((s) =>
                            (s.site_name || "").toLowerCase().includes(siteSearch.toLowerCase()) ||
                            s.customer_code.toLowerCase().includes(siteSearch.toLowerCase())
                          )
                          .map((s) => (
                            <ComboboxItem key={String(s.id)} value={s}>
                              {s.site_name ? `${s.site_name} (${s.customer_code})` : `Site #${s.id} (${s.customer_code})`}
                            </ComboboxItem>
                          ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customer Code</Label>
                <Input
                  value={isViewMode ? txDetail.customer_code : customerCode || "—"}
                  readOnly
                  className="bg-zinc-50 dark:bg-zinc-800 font-mono font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Date</Label>
                {isReadOnly || isViewMode ? (
                  <Input value={isViewMode ? txDetail.transaction_date : transactionDate} readOnly className="bg-zinc-50 dark:bg-zinc-800" />
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left text-xs font-medium h-9"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {transactionDate ? format(new Date(transactionDate), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={transactionDate ? new Date(transactionDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setTransactionDate(date.toISOString().split("T")[0]);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price per KG</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={isViewMode ? txDetail.price_per_kg : pricePerKg}
                    onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
                    readOnly={isReadOnly || isViewMode}
                    className="pl-8 font-mono"
                  />
                </div>
              </div>

              {/* Initial Meter Reading removed for Onboarding */}
            </div>
          </div>

          {/* Card B: Flow B Readings and Scales */}
          {flowType === "ROUTINE" && (
            <>
              {/* Meter Sync panel */}
              <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-sm">Meter Sync Syncing</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Previous Reading</Label>
                    <Input
                      type="number"
                      value={isViewMode ? txDetail?.meter_reading_id ? (txDetail.meter_reading_id as unknown as MeterReading).previous_reading : 0 : previousReading}
                      readOnly
                      className="bg-zinc-50 dark:bg-zinc-800 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Current Reading</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={isViewMode ? txDetail?.meter_reading_id ? (txDetail.meter_reading_id as unknown as MeterReading).current_reading : 0 : currentReading}
                      onChange={(e) => setCurrentReading(parseFloat(e.target.value) || 0)}
                      readOnly={isReadOnly || isViewMode}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Metered KG (computed)</Label>
                    <Input
                      value={isViewMode ? txDetail.metered_kg : meteredKg.toFixed(3)}
                      readOnly
                      className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">WIWO KG (computed)</Label>
                    <Input
                      value={isViewMode ? txDetail.wiwo_kg : totalWiwoKg.toFixed(3)}
                      readOnly
                      className="font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Connected cylinders returns weights table */}
              <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <Scale className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-sm">Cylinders Physical Validation (Weigh-Out Returns)</h2>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10">
                  <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[520px]">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="p-3">Serial</th>
                        <th className="p-3 text-right">Tare Weight</th>
                        <th className="p-3 text-right">Previous KG</th>
                        <th className="p-3 w-40">Ret. Gross Weight</th>
                        <th className="p-3 text-right">Remaining KG</th>
                        <th className="p-3 text-right">Consumed KG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                      {isViewMode ? (
                        (txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ? (
                          ((txDetail.wiwo_header_id as unknown as WiwoHeader).details ?? [])
                            .filter(l => l.line_type === "CONSUMPTION_RETURN")
                            .map((line, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                                <td className="p-3 font-mono font-bold">{line.serial_number}</td>
                                <td className="p-3 text-right font-mono">{line.tare_weight_kg} KG</td>
                                <td className="p-3 text-right font-mono">{line.previous_lpg_kg} KG</td>
                                <td className="p-3 font-mono">{line.returned_gross_weight_kg} KG</td>
                                <td className="p-3 text-right font-mono text-zinc-500">{line.remaining_lpg_kg} KG</td>
                                <td className="p-3 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">{line.consumed_lpg_kg} KG</td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-muted-foreground">No return lines found.</td>
                          </tr>
                        )
                      ) : (
                        calculatedReturnedCylinders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-muted-foreground">
                              No connected cylinders found for this site. Must run onboarding setup first.
                            </td>
                          </tr>
                        ) : (
                          calculatedReturnedCylinders.map((row) => {
                            const weightError = row.returnedGross > 0 && row.returnedGross < row.tare;
                            return (
                              <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                                <td className="p-3 font-mono font-bold">{row.cylinder_asset?.serial_number}</td>
                                <td className="p-3 text-right font-mono">{row.tare} KG</td>
                                <td className="p-3 text-right font-mono">{row.opening} KG</td>
                                <td className="p-2">
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      step="0.001"
                                      value={returnedWeights[row.id] ?? ""}
                                      placeholder="Scale gross weight"
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setReturnedWeights((prev) => ({ ...prev, [row.id]: val }));
                                      }}
                                      className={`pr-8 h-8 text-xs ${weightError ? "border-rose-500" : ""}`}
                                    />
                                    <span className="absolute right-2 top-2 text-[10px] text-zinc-400">KG</span>
                                  </div>
                                  {weightError && (
                                    <span className="text-[9px] text-rose-500 block mt-0.5">Below Tare weight!</span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-zinc-600 dark:text-zinc-400">
                                  {row.remaining} KG
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                  {row.consumed} KG
                                </td>
                              </tr>
                            );
                          })
                        )
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Card C: Cylinder Allocations/Deployments */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Truck className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-sm">
                  {flowType === "ONBOARDING" ? "Baseline Connected Cylinders" : "Replacement Deployed Cylinders (Swapping In)"}
                </h2>
              </div>
              {!isReadOnly && !isViewMode && flowType === "ROUTINE" && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    if (availableCylinders.length === 0) return;
                    setSelectedReplacementCylinders((prev) => [
                      ...prev,
                      { cylinderAssetId: availableCylinders[0].id, targetKg: 50 },
                    ]);
                  }}
                  disabled={availableCylinders.length === 0}
                  className="flex items-center gap-1 font-bold text-[10px] uppercase"
                >
                  <Plus className="h-3 w-3" /> Add Cylinder
                </Button>
              )}
            </div>

            {isViewMode ? (
              <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10">
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[420px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Serial</th>
                      <th className="p-3 text-right">Tare Weight</th>
                      <th className="p-3 text-right">Previous Weight</th>
                      <th className="p-3">Resulting State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                    {(txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ? (
                      ((txDetail.wiwo_header_id as unknown as WiwoHeader).details ?? [])
                        .filter(l => l.line_type === "NEW_DEPLOYMENT")
                        .map((line, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                            <td className="p-3 font-mono font-bold">{line.serial_number}</td>
                            <td className="p-3 text-right font-mono">{line.tare_weight_kg} KG</td>
                            <td className="p-3 text-right font-mono">{line.previous_lpg_kg} KG</td>
                            <td className="p-3">
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                Connected
                              </Badge>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">No deployment details loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            ) : flowType === "ONBOARDING" ? (
              <div className="space-y-3">
                <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 bg-white dark:bg-zinc-955/10 text-xs">
                  <form onSubmit={handleAddSerial} className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Scan or enter serial number..."
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      disabled={isValidatingSerial}
                      className="font-mono text-sm"
                      autoFocus
                    />
                    <Button 
                      type="submit" 
                      disabled={isValidatingSerial || !serialInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shrink-0"
                    >
                      {isValidatingSerial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      {isValidatingSerial ? "Checking..." : "Add"}
                    </Button>
                  </form>
                </div>

                {selectedOnboardCylinders.length > 0 && (
                  <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10 mt-3 shadow-sm">
                    <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[480px]">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="p-3">Serial</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-right">Tare Weight</th>
                          <th className="p-3 text-right w-44">Starting Gross Weight (KG)</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                        {selectedOnboardCylinders.map((cyl, idx) => (
                          <tr key={cyl.cylinderAssetId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                            <td className="p-3 font-mono font-bold text-zinc-700 dark:text-zinc-300">{cyl.serialNumber}</td>
                            <td className="p-3 text-zinc-600">{cyl.productName}</td>
                            <td className="p-3 text-right font-mono text-zinc-600">{cyl.tareWeight} KG</td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.1"
                                value={cyl.targetKg}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const val = raw === "" ? "" : parseFloat(raw);
                                  setSelectedOnboardCylinders((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], targetKg: val };
                                    return copy;
                                  });
                                }}
                                className={`text-xs h-8 text-right font-mono ${
                                  (Number(cyl.targetKg) - cyl.tareWeight > cyl.capacity || (cyl.targetKg !== "" && Number(cyl.targetKg) < cyl.tareWeight)) ? "border-red-500 text-red-500 bg-red-50/10 focus-visible:ring-red-500" : ""
                                }`}
                              />
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedOnboardCylinders((prev) => prev.filter((c) => c.cylinderAssetId !== cyl.cylinderAssetId))}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50/50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {selectedReplacementCylinders.length === 0 ? (
                  <div className="border border-dashed border-zinc-250 dark:border-zinc-800 rounded-xl p-6 text-center text-muted-foreground bg-zinc-50/10">
                    No replacement cylinders added to deployment details.
                  </div>
                ) : (
                  selectedReplacementCylinders.map((item, idx) => {
                    const cylVal = availableCylinders.find(ca => ca.id === item.cylinderAssetId) || null;
                    return (
                      <div key={idx} className="flex gap-3 items-center bg-zinc-50/50 dark:bg-zinc-900/20 p-2.5 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                        <div className="flex-1 space-y-1 flex flex-col justify-end">
                          <Label className="text-[10px] font-bold text-zinc-400 mb-0.5">Asset / Serial</Label>
                          <Combobox
                            value={cylVal}
                            onValueChange={(val: CylinderAsset | null) => {
                              if (val) {
                                setSelectedReplacementCylinders((prev) => {
                                  const copy = [...prev];
                                  copy[idx].cylinderAssetId = val.id;
                                  return copy;
                                });
                              }
                            }}
                          >
                            <ComboboxInput
                              placeholder="Search cylinder..."
                              showTrigger
                            />
                            <ComboboxContent>
                              <ComboboxList>
                                {availableCylinders.length === 0 && <ComboboxEmpty>No cylinders.</ComboboxEmpty>}
                                {availableCylinders.map((cyl) => (
                                  <ComboboxItem key={cyl.id} value={cyl}>
                                    {cyl.serial_number} (Tare: {cyl.tare_weight} KG)
                                  </ComboboxItem>
                                ))}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>

                        <div className="w-32 space-y-1 flex flex-col justify-end">
                          <Label className="text-[10px] font-bold text-zinc-400 mb-0.5">Previous KG</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.targetKg}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSelectedReplacementCylinders((prev) => {
                                const copy = [...prev];
                                copy[idx].targetKg = val;
                                return copy;
                              });
                            }}
                            className="text-xs h-9"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setSelectedReplacementCylinders((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-500 hover:text-rose-700 mt-5"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          {/* Card D: Summary Card */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-6 text-white shadow-2xl shadow-violet-500/30 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Gauge className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg">WIWO Billing Summary</h3>
            </div>

            {flowType === "ROUTINE" && (
              <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-violet-100">
                  <span>Metered KG</span>
                  <span className="font-mono font-bold">{meteredKg.toFixed(3)} kg</span>
                </div>
                <div className="flex justify-between text-violet-100">
                  <span>WIWO KG</span>
                  <span className="font-mono font-bold">{totalWiwoKg.toFixed(3)} kg</span>
                </div>
                <div className="flex justify-between text-violet-200 border-t border-white/10 pt-1.5">
                  <span>Variance</span>
                  <span className="font-mono">{varianceKg.toFixed(3)} kg</span>
                </div>
              </div>
            )}

            {flowType === "ROUTINE" && (
              <div className="flex items-center justify-between bg-white/15 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-white/80" />
                  <span className="text-sm font-semibold">Billable Source</span>
                </div>
                <Badge
                  className={`font-bold text-xs tracking-wider border-none ${
                    finalBillableSource === "METERED"
                      ? "bg-blue-300/30 text-blue-100"
                      : "bg-orange-300/30 text-orange-100"
                  }`}
                >
                  {finalBillableSource}
                </Badge>
              </div>
            )}

            <div className="space-y-2.5 text-sm pt-2">
              <div className="flex justify-between text-violet-100">
                <span>Billable KG</span>
                <span className="font-bold font-mono">{Number(finalBillableKg).toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-violet-100">
                <span>Price / KG</span>
                <span className="font-bold font-mono">₱ {Number(finalPricePerKg).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-violet-100 border-t border-white/10 pt-2">
                <span>Gross Amount</span>
                <span className="font-bold font-mono">₱ {Number(finalGross).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-violet-100">
                <span>12% VAT</span>
                <span className="font-bold font-mono">₱ {Number(finalVat).toFixed(2)}</span>
              </div>
              <div className="border-t border-white/20 pt-3 flex justify-between items-end">
                <span className="font-bold text-base">Total Amount</span>
                <span className="text-xl font-black font-mono">
                  ₱ {Number(finalNet).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card E: Status Selection & Remarks notes */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {([ "DRAFT", "POSTED", ...(status === "CANCELLED" ? ["CANCELLED"] as const : []) ] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isReadOnly || isViewMode}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      status === s
                        ? s === "POSTED"
                          ? "bg-white dark:bg-zinc-700 shadow-sm text-green-600"
                          : s === "CANCELLED"
                          ? "bg-white dark:bg-zinc-700 shadow-sm text-red-600"
                          : "bg-white dark:bg-zinc-700 shadow-sm text-violet-600"
                        : "text-muted-foreground hover:text-zinc-900"
                    } ${(isReadOnly || isViewMode) ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {flowType === "ROUTINE" && mismatchExists && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Variance Reason
                </Label>
                <select
                  value={isViewMode ? txDetail?.variance_reason_code || "NONE" : varianceReasonCode}
                  onChange={(e) => setVarianceReasonCode(e.target.value)}
                  disabled={isReadOnly || isViewMode}
                  className="w-full text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 h-9 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="NONE">Select Reason...</option>
                  <option value="METER_DRIFT">Meter Calibration Drift</option>
                  <option value="PHYSICAL_LEAK">Physical Leak Detected</option>
                  <option value="METER_MALFUNCTION">Meter Malfunction / Frozen</option>
                  <option value="TEMPERATURE_VARIATION">Temperature / Expansion Difference</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Remarks / Discrepancy Note
                {flowType === "ROUTINE" && mismatchExists && !isReadOnly && !isViewMode && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded font-bold">REQUIRED</span>
                )}
              </Label>
              <Textarea
                value={isViewMode ? txDetail.remarks || "" : remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Explanatory remarks for audits..."
                className="resize-none h-28 text-xs"
                readOnly={isReadOnly || isViewMode}
              />
              {flowType === "ROUTINE" && mismatchExists && !remarks.trim() && !isReadOnly && !isViewMode && (
                <p className="text-[10px] text-red-500 font-semibold mt-1">
                  ⚠️ Remarks are required because there is a variance between Metered and WIWO readings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel/Rollback Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                Confirm Rollback & Void
              </h3>
              <p className="text-xs text-muted-foreground">
                This action systematically voids this billing validation, reverses customer site cylinder connections, and restores asset registers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-500">Reason for Cancellation</Label>
              <Textarea
                placeholder="Provide explicit reasons for rolling back this transaction..."
                value={cancelledReason}
                onChange={(e) => setCancelledReason(e.target.value)}
                className="h-24"
              />
            </div>

            <div className="flex gap-2.5 justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={loading}
              >
                Keep Transaction
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelTransaction}
                disabled={loading}
              >
                {loading ? "Cancelling..." : "Void & Restore Assets"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
