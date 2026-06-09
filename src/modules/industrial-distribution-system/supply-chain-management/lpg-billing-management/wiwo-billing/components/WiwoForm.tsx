"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  Plus,
  Scale,
  X,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface WiwoFormProps {
  txId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
  initialFlowType?: "ROUTINE" | "ONBOARDING";
}

function getCylinderCapacity(productName?: string): number {
  if (!productName) return 50;
  const match = productName.match(/(\d+)\s*(KG|kg)/);
  if (match) return parseInt(match[1]);
  const numMatch = productName.match(/\d+/);
  return numMatch ? parseInt(numMatch[0]) : 50;
}

export function WiwoForm({ txId, onSuccess, onCancel, initialFlowType = "ROUTINE" }: WiwoFormProps) {

  const serialPhotoInputRef = useRef<HTMLInputElement>(null);
  const weightPhotoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [, setAvailableCylinders] = useState<CylinderAsset[]>([]);
  const [activeSiteCylinders, setActiveSiteCylinders] = useState<CustomerSiteCylinder[]>([]);

  // Form State
  const [customerCode, setCustomerCode] = useState("");
  const [siteId, setSiteId] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [flowType, setFlowType] = useState<"ROUTINE" | "ONBOARDING">(initialFlowType);
  const [swappedCylinders, setSwappedCylinders] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setFlowType(initialFlowType);
  }, [initialFlowType]);
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

  const clearWeighingCache = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("wiwo_weigh_cache_")) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error("Failed to clear localStorage cache", e);
    }
  };

  // Weigh Cylinder Modal States (In-place)
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighingCylinderId, setWeighingCylinderId] = useState<number | null>(null);
  const [weighingCylinderSearch, setWeighingCylinderSearch] = useState("");
  const [weighingGross, setWeighingGross] = useState("");

  const [, setSerialFile] = useState<File | null>(null);
  const [serialFileUrl, setSerialFileUrl] = useState<string | null>(null);
  const [serialDirectusId, setSerialDirectusId] = useState<string | null>(null);
  const [isUploadingSerial, setIsUploadingSerial] = useState(false);

  const [, setWeightFile] = useState<File | null>(null);
  const [weightFileUrl, setWeightFileUrl] = useState<string | null>(null);
  const [weightDirectusId, setWeightDirectusId] = useState<string | null>(null);
  const [isUploadingWeight, setIsUploadingWeight] = useState(false);

  const [attachmentsState, setAttachmentsState] = useState<{
    siteCylinderId: number;
    cylinderAssetId: number;
    attachmentType: "SERIAL_IMAGE" | "WEIGHT_IMAGE";
    directusFileId: string;
  }[]>([]);
  const [selectedReplacementCylinders, setSelectedReplacementCylinders] = useState<{
    cylinderAssetId: number;
    serialNumber: string;
    productName: string;
    tareWeight: number;
    capacity: number;
    targetKg: number | string;
    swappedOutCylinderId: number | null;
    isValidating?: boolean;
    error?: string;
  }[]>([]);

  // Draft pre-fill extras
  const [billingPeriodFrom, setBillingPeriodFrom] = useState("");
  const [billingPeriodTo, setBillingPeriodTo] = useState("");
  const [draftMeteredKg, setDraftMeteredKg] = useState<number | null>(null);

  const [remarks, setRemarks] = useState("");
  const [operationMode, setOperationMode] = useState<"SWAP_AND_SYNC" | "METER_SYNC_ONLY">("SWAP_AND_SYNC");
  const [varianceReasonCode, setVarianceReasonCode] = useState<string>("NONE");
  const [status, setStatus] = useState<"DRAFT" | "POSTED" | "CANCELLED">("DRAFT");

  // Existing View State
  const [txDetail, setTxDetail] = useState<MeteredWiwoTransaction | null>(null);
  const isViewMode = !!txId && !!txDetail;
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelledReason, setCancelledReason] = useState("");

  // Combobox Search States
  const [siteSearch, setSiteSearch] = useState("");
  const [draftTransactions, setDraftTransactions] = useState<MeteredWiwoTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>("");
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [siteSearchFilter, setSiteSearchFilter] = useState("");

  const filteredDrafts = draftTransactions.filter((tx) => {
    if (tx.transaction_date) {
      const txDate = tx.transaction_date;
      if (startDateFilter && txDate < startDateFilter) return false;
      if (endDateFilter && txDate > endDateFilter) return false;
    }
    if (siteSearchFilter.trim()) {
      const q = siteSearchFilter.trim().toLowerCase();
      const site = sites.find(st => st.id === tx.lpg_site_id);
      const siteName = (site?.site_name || `Site #${tx.lpg_site_id}`).toLowerCase();
      if (!siteName.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (flowType !== "ROUTINE" || isViewMode) return;
    const fetchDrafts = async () => {
      try {
        const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?status=DRAFT&limit=100");
        const data = await res.json();
        const drafts = (data.data || []).filter((tx: MeteredWiwoTransaction) => tx.transaction_type === "REGULAR_BILLING");
        setDraftTransactions(drafts);
      } catch (err) {
        console.error("Failed to load draft transactions", err);
      }
    };
    fetchDrafts();
  }, [flowType, isViewMode]);

  // ─── Shared Draft Selection Handler ────────────────────────────────────────
  const handleDraftSelect = async (tx: MeteredWiwoTransaction) => {
    setSelectedTxId(String(tx.id));
    setSiteId(String(tx.lpg_site_id));
    setCustomerCode(tx.customer_code);
    setTransactionDate(tx.transaction_date);
    setPricePerKg(Number(tx.price_per_kg));
    setBillingPeriodFrom(tx.billing_period_from ?? "");
    setBillingPeriodTo(tx.billing_period_to ?? "");
    setDraftMeteredKg(Number(tx.metered_kg));

    if (tx.meter_reading_id) {
      const mr = tx.meter_reading_id as unknown as MeterReading;
      setPreviousReading(Number(mr.previous_reading ?? 0));
      setCurrentReading(Number(mr.current_reading ?? 0));
    }

    // Set site label in combobox search
    const knownSite = sites.find(st => st.id === tx.lpg_site_id);
    if (knownSite) {
      setSiteSearch(knownSite.site_name || `Site #${knownSite.id}`);
    } else {
      setSiteSearch(`Site #${tx.lpg_site_id}`);
    }

    // Directly fetch site cylinders (avoids race with useEffect)
    try {
      const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=site-cylinders&siteId=${tx.lpg_site_id}`);
      const data = await res.json();
      const cylinders = data.data || [];
      setActiveSiteCylinders(cylinders);
      setReturnedWeights({});
      setSwappedCylinders({});
    } catch (err) {
      console.error("Failed to pre-load site cylinders for draft", err);
    }

    setIsDraftModalOpen(false);
  };

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
        setReturnedWeights({});
        setSwappedCylinders({});
        clearWeighingCache();
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

  const handleValidateReplacementSerial = async (index: number, serial: string) => {
    const s = serial.trim();
    if (!s) return;

    const isDuplicate = selectedReplacementCylinders.some(
      (c, idx) => idx !== index && c.serialNumber.toUpperCase() === s.toUpperCase()
    );
    if (isDuplicate) {
      setSelectedReplacementCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          error: "This cylinder is already added.",
        };
        return copy;
      });
      return;
    }

    setSelectedReplacementCylinders((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        isValidating: true,
        error: undefined,
      };
      return copy;
    });

    try {
      const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=validate-serial&serial=${encodeURIComponent(s)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to validate serial.");
      }

      const cyl = data.data;
      const cap = getCylinderCapacity(cyl.product?.product_name);
      const defaultTarget = (cyl.tare_weight || 0) + cap;

      setSelectedReplacementCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          cylinderAssetId: cyl.id,
          serialNumber: cyl.serial_number,
          productName: cyl.product?.product_name || "Unknown Product",
          tareWeight: cyl.tare_weight || 0,
          capacity: cap,
          targetKg: defaultTarget,
          isValidating: false,
          error: undefined,
        };
        return copy;
      });
    } catch (err) {
      const error = err as Error;
      setSelectedReplacementCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          isValidating: false,
          error: error.message || "Invalid serial.",
        };
        return copy;
      });
    }
  };

  const handleFileUpload = async (file: File, type: "SERIAL" | "WEIGHT") => {
    const isSerial = type === "SERIAL";
    if (isSerial) {
      setIsUploadingSerial(true);
      setSerialFile(file);
      setSerialFileUrl(URL.createObjectURL(file));
      setSerialDirectusId(null);
    } else {
      setIsUploadingWeight(true);
      setWeightFile(file);
      setWeightFileUrl(URL.createObjectURL(file));
      setWeightDirectusId(null);
    }

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }

      const fileId = data.data?.id;
      if (!fileId) throw new Error("File ID missing from upload response");

      if (isSerial) {
        setSerialDirectusId(fileId);
      } else {
        setWeightDirectusId(fileId);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to upload ${isSerial ? "Serial" : "Weight"} photo. Please try again.`);
      if (isSerial) {
        setSerialFile(null);
        setSerialFileUrl(null);
      } else {
        setWeightFile(null);
        setWeightFileUrl(null);
      }
    } finally {
      if (isSerial) {
        setIsUploadingSerial(false);
      } else {
        setIsUploadingWeight(false);
      }
    }
  };

  // ─── Mathematical Calculations (Flow B) ─────────────────────────────────────
  const meteredKg = Math.max(0, currentReading - previousReading);

  // Map and calculate returned cylinders
  const calculatedReturnedCylinders = activeSiteCylinders.map((sc) => {
    const isSwapped = swappedCylinders[sc.id] ?? false;
    const returnedGross = returnedWeights[sc.id] ?? 0;
    const tare = Number(sc.cylinder_asset?.tare_weight ?? 0);
    const opening = Number(sc.previous_lpg_kg ?? 0);

    const remaining = isSwapped ? Math.min(opening, Math.max(0, returnedGross - tare)) : opening;
    const consumed = isSwapped ? Math.max(0, opening - remaining) : 0;

    return {
      ...sc,
      isSwapped,
      returnedGross,
      tare,
      opening,
      remaining: parseFloat(remaining.toFixed(3)),
      consumed: parseFloat(consumed.toFixed(3)),
      isValid: !isSwapped || returnedGross >= tare,
    };
  });

  const totalWiwoKg = calculatedReturnedCylinders.reduce((sum, c) => sum + c.consumed, 0);
  const billableKg = Math.max(meteredKg, totalWiwoKg);
  const varianceKg = Math.abs(meteredKg - totalWiwoKg);
  const mismatchExists = meteredKg !== totalWiwoKg;

  // Validation boundary: block if weight entries are completely illogical
  const hasNegativeWeightErrors = calculatedReturnedCylinders.some(
    (c) => c.isSwapped && c.returnedGross > 0 && c.returnedGross < c.tare
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
        if (operationMode === "METER_SYNC_ONLY") {
          const returnedCylindersPayload = calculatedReturnedCylinders
            .filter((c) => c.isSwapped)
            .map((c) => ({
              siteCylinderId: c.id,
              returnedGrossWeight: c.returnedGross,
            }));
          payload = {
            transaction_type: "REGULAR_BILLING",
            transaction_id: selectedTxId ? Number(selectedTxId) : undefined,
            customer_code: customerCode,
            lpg_site_id: Number(siteId),
            transaction_date: transactionDate,
            previous_reading: previousReading,
            current_reading: currentReading,
            price_per_kg: pricePerKg,
            returned_cylinders: returnedCylindersPayload,
            new_cylinders: [],
            varianceReasonCode: varianceReasonCode,
            remarks: remarks,
            is_no_swap: true,
            attachments: attachmentsState.map(att => ({
              siteCylinderId: att.siteCylinderId,
              cylinderAssetId: att.cylinderAssetId,
              attachmentType: att.attachmentType,
              directusFileId: att.directusFileId,
            })),
          };
        } else {
          if (selectedReplacementCylinders.some(c => !c.cylinderAssetId)) {
            alert("Please verify all replacement cylinder serial numbers.");
            setLoading(false);
            return;
          }
          if (selectedReplacementCylinders.some(c => c.swappedOutCylinderId === null)) {
            alert("Please select the swapped-out cylinder for each replacement.");
            setLoading(false);
            return;
          }
          const emptyTarget = selectedReplacementCylinders.find(
            c => c.targetKg === undefined || c.targetKg === null || String(c.targetKg).trim() === ""
          );
          if (emptyTarget) {
            alert(`Please enter a starting gross weight for cylinder ${emptyTarget.serialNumber}.`);
            setLoading(false);
            return;
          }
          const capacityOverrun = selectedReplacementCylinders.find(
            c => Number(c.targetKg) - c.tareWeight > c.capacity
          );
          if (capacityOverrun) {
            alert(`Starting gross weight for cylinder ${capacityOverrun.serialNumber} (${(Number(capacityOverrun.targetKg) - capacityOverrun.tareWeight).toFixed(2)} KG net) cannot exceed its capacity of ${capacityOverrun.capacity} KG.`);
            setLoading(false);
            return;
          }
          const textUnderrun = selectedReplacementCylinders.find(
            c => Number(c.targetKg) < c.tareWeight
          );
          if (textUnderrun) {
            alert(`Starting gross weight for cylinder ${textUnderrun.serialNumber} cannot be less than its empty tare weight of ${textUnderrun.tareWeight} KG.`);
            setLoading(false);
            return;
          }

          const returnedCylindersPayload = calculatedReturnedCylinders
            .filter((c) => c.isSwapped)
            .map((c) => ({
              siteCylinderId: c.id,
              returnedGrossWeight: c.returnedGross,
            }));

          payload = {
            transaction_type: "REGULAR_BILLING",
            transaction_id: selectedTxId ? Number(selectedTxId) : undefined,
            customer_code: customerCode,
            lpg_site_id: Number(siteId),
            transaction_date: transactionDate,
            previous_reading: previousReading,
            current_reading: currentReading,
            price_per_kg: pricePerKg,
            returned_cylinders: returnedCylindersPayload,
            new_cylinders: selectedReplacementCylinders.map(c => ({
              cylinderAssetId: c.cylinderAssetId,
              targetKg: Number(c.targetKg)
            })),
            varianceReasonCode: varianceReasonCode,
            remarks: remarks,
          };
        }
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
      clearWeighingCache();
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
      clearWeighingCache();
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
              {flowType === "ROUTINE" && !isViewMode && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Draft Metered Transaction
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      placeholder="No draft transaction selected"
                      value={
                        selectedTxId
                          ? `${draftTransactions.find(t => String(t.id) === selectedTxId)?.transaction_no || ""} - ${draftTransactions.find(t => String(t.id) === selectedTxId)?.customer?.customer_name || ""}`
                          : ""
                      }
                      className="bg-zinc-50 dark:bg-zinc-800 font-medium text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDraftModalOpen(true)}
                      className="text-xs h-9 bg-zinc-100 hover:bg-zinc-250 border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold px-4 rounded-xl shrink-0"
                    >
                      Find Transaction
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">LPG Site</Label>
                {isViewMode || !!selectedTxId ? (
                  <Input
                    value={isViewMode
                      ? (txDetail.site?.site_name || `Site ID: ${txDetail.lpg_site_id}`)
                      : siteSearch || `Site #${siteId}`}
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

              <div className="space-y-1.5">
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
                {isReadOnly || isViewMode || !!selectedTxId ? (
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

              {/* Billing Period (from draft metered transaction) */}
              {(!!selectedTxId || isViewMode) && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Period From</Label>
                    <Input
                      value={isViewMode ? (txDetail.billing_period_from ?? "—") : billingPeriodFrom || "—"}
                      readOnly
                      className="bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Period To</Label>
                    <Input
                      value={isViewMode ? (txDetail.billing_period_to ?? "—") : billingPeriodTo || "—"}
                      readOnly
                      className="bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            {flowType === "ROUTINE" && !isViewMode && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Flow</Label>
                <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl max-w-sm">
                  <button
                    type="button"
                    onClick={() => setOperationMode("SWAP_AND_SYNC")}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                      operationMode === "SWAP_AND_SYNC"
                        ? "bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm shadow-zinc-200/50"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800"
                    }`}
                  >
                    Cylinder Swap & Meter Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationMode("METER_SYNC_ONLY")}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                      operationMode === "METER_SYNC_ONLY"
                        ? "bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm shadow-zinc-200/50"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800"
                    }`}
                  >
                    Meter Sync Only (No Swap)
                  </button>
                </div>
              </div>
            )}
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
                  <h2 className="font-semibold text-sm">Meter Reading Details</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground h-4 flex items-center">Previous Reading</Label>
                    <Input
                      type="number"
                      value={isViewMode ? txDetail?.meter_reading_id ? (txDetail.meter_reading_id as unknown as MeterReading).previous_reading : 0 : previousReading}
                      readOnly
                      className="bg-zinc-50 dark:bg-zinc-800 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground h-4 flex items-center">Current Reading</Label>
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
                    <div className="flex items-center justify-between gap-1.5 h-4">
                      <Label className="text-xs text-muted-foreground">Metered KG</Label>
                      {draftMeteredKg !== null && !isViewMode && (
                        <span className="text-[8px] leading-none font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                          From Metered Tx
                        </span>
                      )}
                    </div>
                    <Input
                      value={isViewMode
                        ? txDetail.metered_kg
                        : draftMeteredKg !== null
                        ? draftMeteredKg.toFixed(3)
                        : meteredKg.toFixed(3)}
                      readOnly
                      className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground h-4 flex items-center">WIWO KG (computed)</Label>
                    <Input
                      value={isViewMode ? txDetail.wiwo_kg : totalWiwoKg.toFixed(3)}
                      readOnly
                      className="font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Connected cylinders returns weights table */}
              {(isViewMode || operationMode === "SWAP_AND_SYNC" || operationMode === "METER_SYNC_ONLY") && (
                <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                        <Scale className="h-4 w-4" />
                      </div>
                      <h2 className="font-semibold text-sm">
                        {operationMode === "METER_SYNC_ONLY" ? "Cylinder In-Place Weighing (No Swap)" : "Returned Cylinders (Weigh-Out)"}
                      </h2>
                    </div>
                    {operationMode === "METER_SYNC_ONLY" && !isReadOnly && !isViewMode && (
                      <Button
                        type="button"
                        onClick={() => {
                          setWeighingCylinderId(null);
                          setWeighingCylinderSearch("");
                          setWeighingGross("");
                          setSerialFile(null);
                          setSerialFileUrl(null);
                          setSerialDirectusId(null);
                          setWeightFile(null);
                          setWeightFileUrl(null);
                          setWeightDirectusId(null);
                          setIsWeighModalOpen(true);
                        }}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 rounded-lg flex items-center gap-1.5 shadow"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Weigh Cylinder
                      </Button>
                    )}
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10">
                    <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[520px]">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          {!isViewMode && <th className="p-3 w-16 text-center">{operationMode === "METER_SYNC_ONLY" ? "Weighed" : "Swap"}</th>}
                          <th className="p-3">Serial</th>
                          <th className="p-3 text-right">Tare Weight</th>
                          <th className="p-3 text-right">Previous KG</th>
                          <th className="p-3 w-40">{operationMode === "METER_SYNC_ONLY" ? "Gross Weight" : "Ret. Gross Weight"}</th>
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
                              <td colSpan={7} className="p-6 text-center text-muted-foreground">
                                No connected cylinders found for this site. Must run onboarding setup first.
                              </td>
                            </tr>
                          ) : (
                            calculatedReturnedCylinders.map((row) => {
                              const weightError = row.isSwapped && row.returnedGross > 0 && row.returnedGross < row.tare;
                              const hasSerial = attachmentsState.some(a => a.siteCylinderId === row.id && a.attachmentType === "SERIAL_IMAGE");
                              const hasWeight = attachmentsState.some(a => a.siteCylinderId === row.id && a.attachmentType === "WEIGHT_IMAGE");
                              return (
                                <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                                  <td className="p-3 text-center">
                                    {operationMode === "METER_SYNC_ONLY" ? (
                                      row.isSwapped ? (
                                        <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400">
                                          ✓ Yes
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )
                                    ) : (
                                      <Checkbox
                                        checked={row.isSwapped}
                                        onCheckedChange={(checked) => {
                                          setSwappedCylinders((prev) => ({ ...prev, [row.id]: !!checked }));
                                        }}
                                      />
                                    )}
                                  </td>
                                  <td className="p-3 font-mono font-bold">{row.cylinder_asset?.serial_number}</td>
                                  <td className="p-3 text-right font-mono">{row.tare} KG</td>
                                  <td className="p-3 text-right font-mono">{row.opening} KG</td>
                                  <td className="p-2">
                                    {operationMode === "METER_SYNC_ONLY" ? (
                                      <div className="space-y-1">
                                        <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                                          {row.isSwapped ? `${row.returnedGross} KG` : "—"}
                                        </div>
                                        {row.isSwapped && (
                                          <div className="flex gap-1.5 flex-wrap">
                                            <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${hasSerial ? "bg-emerald-105 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400"}`}>
                                              Serial: {hasSerial ? "✓ Saved" : "Missing"}
                                            </Badge>
                                            <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${hasWeight ? "bg-emerald-105 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400"}`}>
                                              Weight: {hasWeight ? "✓ Saved" : "Missing"}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="relative">
                                          <Input
                                            type="number"
                                            step="0.001"
                                            value={row.isSwapped ? (returnedWeights[row.id] ?? "") : ""}
                                            placeholder={row.isSwapped ? `Max ${row.opening} KG` : "N/A - Not Swapped"}
                                            disabled={!row.isSwapped}
                                            onChange={(e) => {
                                              let val = parseFloat(e.target.value);
                                              const maxGross = row.opening;
                                              if (!isNaN(val) && val > maxGross) {
                                                val = maxGross;
                                              }
                                              setReturnedWeights((prev) => ({ ...prev, [row.id]: isNaN(val) ? 0 : val }));
                                            }}
                                            className={`pr-8 h-8 text-xs ${weightError ? "border-rose-500" : ""}`}
                                          />
                                          {row.isSwapped && <span className="absolute right-2 top-2 text-[10px] text-zinc-400">KG</span>}
                                        </div>
                                        {weightError && (
                                          <span className="text-[9px] text-rose-500 block mt-0.5">Below Tare weight!</span>
                                        )}
                                      </>
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
              )}
            </>
          )}

          {/* Card C: Cylinder Allocations/Deployments */}
          {(isViewMode || flowType === "ONBOARDING" || operationMode === "SWAP_AND_SYNC") && (
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Truck className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-sm">
                    {flowType === "ONBOARDING" ? "Baseline Connected Cylinders" : "New Cylinders Deployed (Swapping In)"}
                  </h2>
                </div>
                {!isReadOnly && !isViewMode && flowType === "ROUTINE" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setSelectedReplacementCylinders((prev) => [
                        ...prev,
                        {
                          cylinderAssetId: 0,
                          serialNumber: "",
                          productName: "",
                          tareWeight: 0,
                          capacity: 0,
                          targetKg: "",
                          swappedOutCylinderId: null,
                        },
                      ]);
                    }}
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
                      return (
                        <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-zinc-50/50 dark:bg-zinc-900/20 p-3.5 border border-zinc-150 dark:border-zinc-850 rounded-xl relative">
                          {/* Swapped-out cylinder selection dropdown */}
                          <div className="flex-1 w-full space-y-1 flex flex-col justify-end">
                            <Label className="text-[10px] font-bold text-zinc-400 mb-0.5">Swapped-out Cylinder (Empty)</Label>
                            <select
                              value={item.swappedOutCylinderId ?? ""}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setSelectedReplacementCylinders((prev) => {
                                  const copy = [...prev];
                                  copy[idx].swappedOutCylinderId = val;
                                  return copy;
                                });
                              }}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">-- Select Cylinder --</option>
                              {calculatedReturnedCylinders
                                .filter((c) => c.isSwapped)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.cylinder_asset?.serial_number} (Tare: {c.tare} KG)
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Scan/Input Serial with Verification */}
                          <div className="flex-1 w-full space-y-1 flex flex-col justify-end">
                            <Label className="text-[10px] font-bold text-zinc-400 mb-0.5">Scan / Input New Serial</Label>
                            <div className="flex gap-1.5 items-center w-full">
                              <Input
                                type="text"
                                placeholder="Serial number..."
                                value={item.serialNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedReplacementCylinders((prev) => {
                                    const copy = [...prev];
                                    copy[idx].serialNumber = val;
                                    copy[idx].cylinderAssetId = 0;
                                    copy[idx].productName = "";
                                    copy[idx].tareWeight = 0;
                                    copy[idx].capacity = 0;
                                    copy[idx].error = undefined;
                                    return copy;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleValidateReplacementSerial(idx, item.serialNumber);
                                  }
                                }}
                                className={`text-xs h-9 w-full ${item.error ? "border-rose-500" : item.cylinderAssetId ? "border-emerald-500 bg-emerald-50/10" : ""}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleValidateReplacementSerial(idx, item.serialNumber)}
                                disabled={item.isValidating || !item.serialNumber.trim()}
                                className="h-9 font-bold text-xs shrink-0"
                              >
                                {item.isValidating ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : item.cylinderAssetId ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  "Verify"
                                )}
                              </Button>
                            </div>
                            {item.error && (
                              <span className="text-[9px] text-rose-500 block mt-0.5">{item.error}</span>
                            )}
                            {item.cylinderAssetId > 0 && (
                              <span className="text-[9px] text-emerald-600 block mt-0.5">
                                Verified: {item.productName} (Tare: {item.tareWeight} KG)
                              </span>
                            )}
                          </div>

                          {/* Starting Gross KG */}
                          <div className="w-full md:w-32 space-y-1 flex flex-col justify-end">
                            <Label className="text-[10px] font-bold text-zinc-400 mb-0.5">Gross Weight (KG)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.targetKg}
                              disabled={!item.cylinderAssetId}
                              onChange={(e) => {
                                const raw = e.target.value;
                                  const val = raw === "" ? "" : parseFloat(raw);
                                setSelectedReplacementCylinders((prev) => {
                                  const copy = [...prev];
                                  copy[idx].targetKg = val;
                                  return copy;
                                });
                              }}
                              placeholder={item.cylinderAssetId ? String(item.tareWeight + item.capacity) : "N/A"}
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
                            className="text-rose-500 hover:text-rose-700 mt-2 md:mt-5 self-end md:self-center shrink-0"
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
          )}
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
      {isCancelModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
        </div>,
        document.body
      )}

      {/* Draft Transaction Selector Modal */}
      {isDraftModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[88vh] sm:max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Scale className="h-4 w-4 text-violet-500 shrink-0" />
                Select Metered Transaction
              </h3>
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">From Date</Label>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">To Date</Label>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Search by Site</Label>
                  <Input
                    type="text"
                    placeholder="Type site name..."
                    value={siteSearchFilter}
                    onChange={(e) => setSiteSearchFilter(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredDrafts.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No matching draft transactions found.
                  </div>
                ) : (
                  filteredDrafts.map((tx) => (
                    <div key={tx.id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-[12px] text-zinc-800 dark:text-zinc-100 truncate">{tx.transaction_no}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{tx.customer?.customer_name || tx.customer_code}</p>
                          <p className="text-[10px] text-violet-500 dark:text-violet-400 font-semibold truncate mt-0.5">
                            {(() => { const s = sites.find(st => st.id === tx.lpg_site_id); return s?.site_name || `Site #${tx.lpg_site_id}`; })()}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{tx.metered_kg} KG</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-400">{tx.transaction_date}</span>
                        <Button
                          type="button"
                          onClick={() => handleDraftSelect(tx)}
                          className="h-8 text-[11px] font-bold bg-violet-600 hover:bg-violet-700 text-white px-4 rounded-xl cursor-pointer"
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
                  <tr>
                    <th className="p-3">Tx No</th>
                    <th className="p-3">Site</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Metered KG</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredDrafts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No matching draft transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredDrafts.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                        <td className="p-3 font-mono font-bold text-zinc-700 dark:text-zinc-300">{tx.transaction_no}</td>
                        <td className="p-3 text-violet-600 dark:text-violet-400 font-semibold truncate max-w-[130px]">
                          {(() => { const s = sites.find(st => st.id === tx.lpg_site_id); return s?.site_name || `Site #${tx.lpg_site_id}`; })()}
                        </td>
                        <td className="p-3 text-zinc-600 dark:text-zinc-400 truncate max-w-[130px]">{tx.customer?.customer_name || tx.customer_code}</td>
                        <td className="p-3 font-mono">{tx.transaction_date}</td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">{tx.metered_kg} KG</td>
                        <td className="p-3 text-center">
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => handleDraftSelect(tx)}
                            className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white font-bold px-3.5 py-1 rounded-xl text-[10px] cursor-pointer shadow-sm"
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStartDateFilter("");
                  setEndDateFilter("");
                  setSiteSearchFilter("");
                }}
                className="text-xs text-muted-foreground hover:text-zinc-800 dark:hover:text-zinc-100"
              >
                Clear Filters
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDraftModalOpen(false)}
                className="text-xs font-bold px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cylinder In-Place Weighing Modal */}
      <Dialog open={isWeighModalOpen} onOpenChange={setIsWeighModalOpen}>
        <DialogContent 
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-lg p-0 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-955 gap-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <DialogTitle className="text-base font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Scale className="h-5 w-5 text-emerald-500" />
              Cylinder In-Place Weighing
            </DialogTitle>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Select Cylinder */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Cylinder</Label>
              <Combobox
                value={activeSiteCylinders.find(c => c.id === weighingCylinderId) || null}
                onValueChange={(val: CustomerSiteCylinder | null) => {
                  const id = val ? val.id : null;
                  setWeighingCylinderId(id);
                  setWeighingCylinderSearch(val ? (val.cylinder_asset?.serial_number ?? "") : "");
                  
                  if (id) {
                    const cachedData = localStorage.getItem(`wiwo_weigh_cache_${id}`);
                    if (cachedData) {
                      try {
                        const parsed = JSON.parse(cachedData);
                        setWeighingGross(parsed.gross || "");
                        setSerialFile(null);
                        setSerialFileUrl(parsed.serialFileUrl || null);
                        setSerialDirectusId(parsed.serialDirectusId || null);
                        setWeightFile(null);
                        setWeightFileUrl(parsed.weightFileUrl || null);
                        setWeightDirectusId(parsed.weightDirectusId || null);
                      } catch (e) {
                        console.error("Failed to parse cached data", e);
                      }
                    } else {
                      // Fallback to saved state if any
                      const savedGross = returnedWeights[id] !== undefined ? String(returnedWeights[id]) : "";
                      const serialAtt = attachmentsState.find(a => a.siteCylinderId === id && a.attachmentType === "SERIAL_IMAGE");
                      const weightAtt = attachmentsState.find(a => a.siteCylinderId === id && a.attachmentType === "WEIGHT_IMAGE");
                      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
                      const sId = serialAtt?.directusFileId || null;
                      const wId = weightAtt?.directusFileId || null;
                      
                      setWeighingGross(savedGross);
                      setSerialFile(null);
                      setSerialFileUrl(sId ? `${apiBaseUrl}/assets/${sId}` : null);
                      setSerialDirectusId(sId);
                      setWeightFile(null);
                      setWeightFileUrl(wId ? `${apiBaseUrl}/assets/${wId}` : null);
                      setWeightDirectusId(wId);
                    }
                  } else {
                    setWeighingGross("");
                    setSerialFile(null);
                    setSerialFileUrl(null);
                    setSerialDirectusId(null);
                    setWeightFile(null);
                    setWeightFileUrl(null);
                    setWeightDirectusId(null);
                  }
                }}
              >
                <ComboboxInput
                  placeholder="Select Cylinder to Weigh..."
                  value={weighingCylinderSearch}
                  onChange={(e) => setWeighingCylinderSearch(e.target.value)}
                  showTrigger
                />
                <ComboboxContent>
                  <ComboboxList>
                    {activeSiteCylinders.length === 0 && <ComboboxEmpty>No cylinders connected.</ComboboxEmpty>}
                    {activeSiteCylinders
                      .filter((c) =>
                        (c.cylinder_asset?.serial_number || "").toLowerCase().includes(weighingCylinderSearch.toLowerCase())
                      )
                      .map((c) => {
                        const hasWeight = returnedWeights[c.id] !== undefined;
                        return (
                          <ComboboxItem key={c.id} value={c}>
                            {c.cylinder_asset?.serial_number} ({c.cylinder_asset?.tare_weight} KG Tare) {hasWeight ? " - [Re-weigh]" : ""}
                          </ComboboxItem>
                        );
                      })}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            {weighingCylinderId && (() => {
              const selectedCyl = activeSiteCylinders.find(c => c.id === weighingCylinderId);
              if (!selectedCyl) return null;
              const tare = Number(selectedCyl.cylinder_asset?.tare_weight ?? 0);
              const opening = Number(selectedCyl.previous_lpg_kg ?? 0);
              const maxGross = opening;
              const isWeightInvalid = weighingGross ? parseFloat(weighingGross) < tare : false;

              return (
                <>
                  {/* Gross Weight input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Weight (Scale Reading)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="Scale gross weight"
                        value={weighingGross}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > maxGross) {
                            setWeighingGross(String(maxGross));
                          } else {
                            setWeighingGross(e.target.value);
                          }
                        }}
                        className={`pr-8 h-10 text-sm ${isWeightInvalid ? "border-rose-500" : ""}`}
                      />
                      <span className="absolute right-3 top-3 text-xs text-zinc-400 font-bold">KG</span>
                    </div>
                    {isWeightInvalid && (
                      <span className="text-[11px] text-rose-500 block mt-0.5">Gross weight cannot be below tare weight of {tare} KG!</span>
                    )}
                  </div>

                  {/* Camera Photo Captures */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Cylinder Serial Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cylinder Serial Photo</Label>
                      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {isUploadingSerial ? (
                          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                        ) : serialFileUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={serialFileUrl} alt="Serial Capture" className="max-h-20 object-contain rounded-lg shadow-sm border" />
                            <button
                              type="button"
                              onClick={() => {
                                  setSerialFile(null);
                                  setSerialFileUrl(null);
                                  setSerialDirectusId(null);
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm animate-in fade-in"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => serialPhotoInputRef.current?.click()}
                            className="cursor-pointer flex flex-col items-center text-center p-2 w-full h-full justify-center"
                          >
                            <Plus className="h-5 w-5 text-zinc-400 mb-1" />
                            <span className="text-[10px] text-zinc-500 font-bold">Capture Serial</span>
                            <input
                              ref={serialPhotoInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(f, "SERIAL");
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scale Weight Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scale Weight Photo</Label>
                      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {isUploadingWeight ? (
                          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                        ) : weightFileUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={weightFileUrl} alt="Weight Capture" className="max-h-20 object-contain rounded-lg shadow-sm border" />
                            <button
                              type="button"
                              onClick={() => {
                                  setWeightFile(null);
                                  setWeightFileUrl(null);
                                  setWeightDirectusId(null);
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm animate-in fade-in"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => weightPhotoInputRef.current?.click()}
                            className="cursor-pointer flex flex-col items-center text-center p-2 w-full h-full justify-center"
                          >
                            <Plus className="h-5 w-5 text-zinc-400 mb-1" />
                            <span className="text-[10px] text-zinc-500 font-bold">Capture Weight</span>
                            <input
                              ref={weightPhotoInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(f, "WEIGHT");
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsWeighModalOpen(false)}
              className="text-xs font-bold px-4 h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !weighingCylinderId ||
                !weighingGross ||
                parseFloat(weighingGross) < Number(activeSiteCylinders.find(c => c.id === weighingCylinderId)?.cylinder_asset?.tare_weight ?? 0) ||
                isUploadingSerial ||
                isUploadingWeight ||
                !serialDirectusId ||
                !weightDirectusId
              }
              onClick={() => {
                if (!weighingCylinderId) return;
                const selectedCyl = activeSiteCylinders.find(c => c.id === weighingCylinderId);
                if (!selectedCyl) return;
                const assetId = selectedCyl.cylinder_asset?.id || selectedCyl.cylinder_asset_id;

                // Update weight mapping
                setReturnedWeights(prev => ({
                  ...prev,
                  [weighingCylinderId]: parseFloat(weighingGross),
                }));
                // Set cylinder marked as "weighed"
                setSwappedCylinders(prev => ({
                  ...prev,
                  [weighingCylinderId]: true,
                }));

                // Update attachments
                setAttachmentsState((prev) => {
                  const filtered = prev.filter(a => a.siteCylinderId !== weighingCylinderId);
                  return [
                    ...filtered,
                    {
                      siteCylinderId: weighingCylinderId,
                      cylinderAssetId: assetId,
                      attachmentType: "SERIAL_IMAGE" as const,
                      directusFileId: serialDirectusId!,
                    },
                    {
                      siteCylinderId: weighingCylinderId,
                      cylinderAssetId: assetId,
                      attachmentType: "WEIGHT_IMAGE" as const,
                      directusFileId: weightDirectusId!,
                    }
                  ];
                });

                // Save to localStorage cache
                try {
                  const cachePayload = {
                    gross: weighingGross,
                    serialDirectusId: serialDirectusId,
                    serialFileUrl: serialFileUrl,
                    weightDirectusId: weightDirectusId,
                    weightFileUrl: weightFileUrl,
                  };
                  localStorage.setItem(`wiwo_weigh_cache_${weighingCylinderId}`, JSON.stringify(cachePayload));
                } catch (e) {
                  console.error("Failed to save to localStorage cache", e);
                }

                setIsWeighModalOpen(false);
              }}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9"
            >
              Save Weighing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
