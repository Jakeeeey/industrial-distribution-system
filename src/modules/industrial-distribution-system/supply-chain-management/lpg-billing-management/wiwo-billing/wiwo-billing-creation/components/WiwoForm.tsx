"use client";

import { useEffect, useState, useRef, Fragment } from "react";
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
  Loader2,
  ScanBarcode,
  ChevronRight,
  Printer
} from "lucide-react";
import type { CylinderAsset, CustomerSiteCylinder, MeteredWiwoTransaction, CustomerSite, MeterReading, WiwoHeader, LpgTransactionHeader } from "../types";
import { toast } from "sonner";
import WiwoThermalReceiptModal from "./WiwoThermalReceiptModal";
import type { WiwoThermalReceiptData } from "./WiwoThermalReceiptModal";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WiwoFormProps {
  txId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
  initialFlowType?: "ROUTINE" | "ONBOARDING";
  transactionHeader: LpgTransactionHeader;
  salesInvoice?: { invoice_id: number; invoice_no: string; total_amount: number; invoice_date: string; transaction_status: string };
}

function getCylinderCapacity(productName?: string): number {
  if (!productName) return 50;
  const match = productName.match(/(\d+)\s*(KG|kg)/);
  if (match) return parseInt(match[1]);
  const numMatch = productName.match(/\d+/);
  return numMatch ? parseInt(numMatch[0]) : 50;
}

export function WiwoForm({ txId, onSuccess, onCancel, initialFlowType = "ROUTINE", transactionHeader, salesInvoice }: WiwoFormProps) {

  const serialPhotoInputRef = useRef<HTMLInputElement>(null);
  const weightPhotoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [, setAvailableCylinders] = useState<CylinderAsset[]>([]);
  const [activeSiteCylinders, setActiveSiteCylinders] = useState<CustomerSiteCylinder[]>([]);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerError, setScannerError] = useState("");

  // Form State
  const [customerCode, setCustomerCode] = useState("");
  const [siteId, setSiteId] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [flowType, setFlowType] = useState<"ROUTINE" | "ONBOARDING">(initialFlowType);
  const [swappedCylinders, setSwappedCylinders] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setFlowType(initialFlowType);
  }, [initialFlowType]);

  useEffect(() => {
    setSiteId(String(transactionHeader.customer_site_id));
    setCustomerCode(transactionHeader.customer_id);
    setBillingPeriodFrom(transactionHeader.period_from);
    setBillingPeriodTo(transactionHeader.period_to);
    const headerSite = transactionHeader.site;
    if (headerSite) {
      setSiteSearch(headerSite.site_name || `Site #${headerSite.id}`);
      setPreviousReading(Number(headerSite.last_meter_reading ?? 0));
      setCurrentReading(Number(headerSite.last_meter_reading ?? 0));
      setPricePerKg(Number(headerSite.default_price_per_kg ?? 0));
    }
  }, [transactionHeader]);
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
    // AG-CHANGE: Added type properties for onboarding photo capture
    serialPhotoId?: string | null;
    serialPhotoUrl?: string | null;
    weightPhotoId?: string | null;
    weightPhotoUrl?: string | null;
    isUploadingSerial?: boolean;
    isUploadingWeight?: boolean;
  }[]>([]);

  // Flow B state: Routine Check & Swap
  const [previousReading, setPreviousReading] = useState(0);
  const [currentReading, setCurrentReading] = useState(0);
  const [returnedWeights, setReturnedWeights] = useState<Record<number, number>>({});

  const clearWeighingCache = (txIdToClear?: string) => {
    try {
      if (txIdToClear) {
        localStorage.removeItem(`wiwo_draft_cache_${txIdToClear}`);
      }
      localStorage.removeItem("wiwo_draft_transaction");
    } catch (e) {
      console.error("Failed to clear localStorage cache", e);
    }
  };

  // Weigh Cylinder Modal States (In-place)
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighingCylinderId, setWeighingCylinderId] = useState<number | null>(null);
  const [weighingGross, setWeighingGross] = useState("");
  // AG-CHANGE: Onboarding Weighing Modal States
  const [isOnboardWeighModalOpen, setIsOnboardWeighModalOpen] = useState(false);
  const [weighingOnboardIndex, setWeighingOnboardIndex] = useState<number | null>(null);
  const [onboardingWeighingGross, setOnboardingWeighingGross] = useState("");
  const [replacementModalIndex, setReplacementModalIndex] = useState<number | null>(null);

  const [, setSerialFile] = useState<File | null>(null);
  const [serialFileUrl, setSerialFileUrl] = useState<string | null>(null);
  const [serialDirectusId, setSerialDirectusId] = useState<string | null>(null);
  const [isUploadingSerial, setIsUploadingSerial] = useState(false);

  const [, setWeightFile] = useState<File | null>(null);
  const [weightFileUrl, setWeightFileUrl] = useState<string | null>(null);
  const [weightDirectusId, setWeightDirectusId] = useState<string | null>(null);
  const [isUploadingWeight, setIsUploadingWeight] = useState(false);

  const [attachmentsState, setAttachmentsState] = useState<{
    siteCylinderId: number | null;
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
    serialPhotoId?: string | null;
    serialPhotoUrl?: string | null;
    weightPhotoId?: string | null;
    weightPhotoUrl?: string | null;
    isUploadingSerial?: boolean;
    isUploadingWeight?: boolean;
    isValidating?: boolean;
    error?: string;
  }[]>([]);
  const replacementModalItem =
    replacementModalIndex === null ? null : selectedReplacementCylinders[replacementModalIndex] ?? null;

  // Draft pre-fill extras
  const [billingPeriodFrom, setBillingPeriodFrom] = useState("");
  const [billingPeriodTo, setBillingPeriodTo] = useState("");
  const [draftMeteredKg, setDraftMeteredKg] = useState<number | null>(null);

  const [remarks, setRemarks] = useState("");
  const [varianceReasonCode, setVarianceReasonCode] = useState<string>("NONE");

  // Existing View State
  const [txDetail, setTxDetail] = useState<MeteredWiwoTransaction | null>(null);
  const isViewMode = !!txId && !!txDetail && txDetail.status !== "DRAFT";
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isExitWarningOpen, setIsExitWarningOpen] = useState(false);
  const [cancelledReason, setCancelledReason] = useState("");

  // RULE DEV: Print receipt modal states
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [isAfterSubmit, setIsAfterSubmit] = useState(false);
  const [submittedTxNo, setSubmittedTxNo] = useState<string | null>(null);
  const [autoPrintActive, setAutoPrintActive] = useState(false);

  // Combobox Search States
  const [siteSearch, setSiteSearch] = useState("");
  const [draftTransactions, setDraftTransactions] = useState<MeteredWiwoTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>("");
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileEditingCylinderId, setMobileEditingCylinderId] = useState<number | null>(null);

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
    // Price per kg will be finalized after resolving knownSite below
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

    setPricePerKg(Number(tx.price_per_kg) || (knownSite ? Number(knownSite.default_price_per_kg) : 0));

    // Directly fetch site cylinders (avoids race with useEffect)
    try {
      const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=site-cylinders&siteId=${tx.lpg_site_id}`);
      const data = await res.json();
      const cylinders = data.data || [];
      setActiveSiteCylinders(cylinders);

      // Load cached draft state if exists
      const cacheKey = `wiwo_draft_cache_${tx.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setReturnedWeights(parsed.returnedWeights || {});
          setSwappedCylinders(parsed.swappedCylinders || {});
          if (parsed.selectedReplacementCylinders) setSelectedReplacementCylinders(parsed.selectedReplacementCylinders);
          if (parsed.remarks !== undefined) setRemarks(parsed.remarks);
          if (parsed.varianceReasonCode) setVarianceReasonCode(parsed.varianceReasonCode);
          if (parsed.currentReading) setCurrentReading(parsed.currentReading);
          if (parsed.previousReading) setPreviousReading(parsed.previousReading);
        } catch {
          setReturnedWeights({});
          setSwappedCylinders({});
        }
      } else {
        setReturnedWeights({});
        setSwappedCylinders({});
        setSelectedReplacementCylinders([]);
        setRemarks("");
        setVarianceReasonCode("NONE");
      }
    } catch (err) {
      console.error("Failed to pre-load site cylinders for draft", err);
    }

    setIsDraftModalOpen(false);
  };

  // Auto-save routine check progress to localStorage based on selected draft
  useEffect(() => {
    if (flowType === "ROUTINE" && selectedTxId && !isViewMode && mounted) {
      const cacheKey = `wiwo_draft_cache_${selectedTxId}`;
      const stateToCache = {
        returnedWeights,
        swappedCylinders,
        selectedReplacementCylinders,
        remarks,
        varianceReasonCode,
        currentReading,
        previousReading,
      };
      localStorage.setItem(cacheKey, JSON.stringify(stateToCache));
    }
  }, [
    flowType,
    selectedTxId,
    isViewMode,
    mounted,
    returnedWeights,
    swappedCylinders,
    selectedReplacementCylinders,
    remarks,
    varianceReasonCode,
    currentReading,
    previousReading,
  ]);

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
    if (!selectedTxId) {
      const selectedSite = sites.find((s) => String(s.id) === siteId);
      if (selectedSite) {
        setCustomerCode(selectedSite.customer_code);
        setPreviousReading(Number(selectedSite.last_meter_reading ?? 0));
        setCurrentReading(Number(selectedSite.last_meter_reading ?? 0));
        setPricePerKg(Number(selectedSite.default_price_per_kg ?? 0));
      }
    }

    const fetchCylinders = async () => {
      try {
        const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=site-cylinders&siteId=${siteId}`);
        const data = await res.json();
        setActiveSiteCylinders(data.data || []);
        const draftStr = localStorage.getItem("wiwo_draft_transaction");
        let hydrated = false;
        if (draftStr && !isViewMode && flowType === "ROUTINE") {
          try {
            const draft = JSON.parse(draftStr);
            if (draft.siteId === siteId) {
              setReturnedWeights(draft.returnedWeights || {});
              setSwappedCylinders(draft.swappedCylinders || {});
              setSelectedReplacementCylinders(draft.selectedReplacementCylinders || []);
              setAttachmentsState(draft.attachmentsState || []);
              setCustomerCode(draft.customerCode || "");
              setSiteSearch(draft.siteSearch || "");
              hydrated = true;
            }
          } catch (e) {
            console.error("Failed to parse draft", e);
          }
        }

        if (!hydrated) {
          // Reset returned weights mapping
          setReturnedWeights({});
          setSwappedCylinders({});
          setSelectedReplacementCylinders([]);
          setAttachmentsState([]);
          clearWeighingCache(selectedTxId);
        }
      } catch (err) {
        console.error("Failed to load active site cylinders", err);
      }
    };
    fetchCylinders();
  }, [siteId, sites, selectedTxId, flowType, isViewMode]);

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
        const tx = data.data || null;
        setTxDetail(tx);
        if (tx) {
          setVarianceReasonCode(tx.variance_reason_code || "NONE");
          if (tx.status === "DRAFT") {
            setSelectedTxId(String(tx.id));
            setSiteId(String(tx.lpg_site_id));
            setCustomerCode(tx.customer_code);
            setTransactionDate(tx.transaction_date);
            setBillingPeriodFrom(tx.billing_period_from ?? "");
            setBillingPeriodTo(tx.billing_period_to ?? "");
            setDraftMeteredKg(Number(tx.metered_kg));

            if (tx.meter_reading_id) {
              const mr = tx.meter_reading_id as unknown as MeterReading;
              setPreviousReading(Number(mr.previous_reading ?? 0));
              setCurrentReading(Number(mr.current_reading ?? 0));
            }
            setPricePerKg(Number(tx.price_per_kg) || 0);
          }
        }
      } catch (err) {
        console.error("Failed to load transaction details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [txId]);

  // Persist Form State to Local Storage
  useEffect(() => {
    if (isViewMode || flowType !== "ROUTINE") return;
    if (!siteId) return;

    const draft = {
      siteId,
      customerCode,
      siteSearch,
      returnedWeights,
      swappedCylinders,
      selectedReplacementCylinders,
      attachmentsState
    };
    localStorage.setItem("wiwo_draft_transaction", JSON.stringify(draft));
  }, [siteId, customerCode, siteSearch, returnedWeights, swappedCylinders, selectedReplacementCylinders, attachmentsState, isViewMode, flowType]);

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

  const handleReplacementFileUpload = async (
    index: number,
    file: File,
    type: "SERIAL" | "WEIGHT",
  ) => {
    const isSerial = type === "SERIAL";
    const previewUrl = URL.createObjectURL(file);

    setSelectedReplacementCylinders((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        ...(isSerial
          ? { isUploadingSerial: true, serialPhotoUrl: previewUrl, serialPhotoId: null }
          : { isUploadingWeight: true, weightPhotoUrl: previewUrl, weightPhotoId: null }),
      };
      return copy;
    });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.data?.id) {
        throw new Error(data.error || "Upload failed");
      }

      setSelectedReplacementCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          ...(isSerial
            ? { isUploadingSerial: false, serialPhotoId: data.data.id }
            : { isUploadingWeight: false, weightPhotoId: data.data.id }),
        };
        return copy;
      });
    } catch (err) {
      console.error(err);
      URL.revokeObjectURL(previewUrl);
      setSelectedReplacementCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          ...(isSerial
            ? { isUploadingSerial: false, serialPhotoUrl: null, serialPhotoId: null }
            : { isUploadingWeight: false, weightPhotoUrl: null, weightPhotoId: null }),
        };
        return copy;
      });
      alert(`Failed to upload new cylinder ${isSerial ? "serial" : "weight"} photo.`);
    }
  };

  // AG-CHANGE: Added handleOnboardFileUpload to support onboarding baseline cylinder photo capture & upload
  const handleOnboardFileUpload = async (
    index: number | null,
    file: File,
    type: "SERIAL" | "WEIGHT",
  ) => {
    if (index === null) return;
    const isSerial = type === "SERIAL";
    const previewUrl = URL.createObjectURL(file);

    setSelectedOnboardCylinders((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        ...(isSerial
          ? { isUploadingSerial: true, serialPhotoUrl: previewUrl, serialPhotoId: null }
          : { isUploadingWeight: true, weightPhotoUrl: previewUrl, weightPhotoId: null }),
      };
      return copy;
    });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.data?.id) {
        throw new Error(data.error || "Upload failed");
      }

      setSelectedOnboardCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          ...(isSerial
            ? { isUploadingSerial: false, serialPhotoId: data.data.id }
            : { isUploadingWeight: false, weightPhotoId: data.data.id }),
        };
        return copy;
      });
    } catch (err) {
      console.error(err);
      URL.revokeObjectURL(previewUrl);
      setSelectedOnboardCylinders((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          ...(isSerial
            ? { isUploadingSerial: false, serialPhotoUrl: null, serialPhotoId: null }
            : { isUploadingWeight: false, weightPhotoUrl: null, weightPhotoId: null }),
        };
        return copy;
      });
      alert(`Failed to upload cylinder ${isSerial ? "serial" : "weight"} photo.`);
    }
  };

  const selectedSite = sites.find((s) => String(s.id) === siteId) || null;
  const isKiloMode = (selectedSite?.billing_mode ?? transactionHeader.site?.billing_mode) === "KILO";

  // ─── Mathematical Calculations (Flow B) ─────────────────────────────────────
  const meteredKg = isKiloMode
    ? 0
    : (draftMeteredKg !== null
      ? draftMeteredKg
      : Math.max(0, currentReading - previousReading));

  // Map and calculate returned cylinders
  const calculatedReturnedCylinders = activeSiteCylinders.map((sc) => {
    const isSwapped = swappedCylinders[sc.id] ?? false;
    const rawReturned = returnedWeights[sc.id];
    const hasReturnedWeight = rawReturned !== undefined && rawReturned !== null && (rawReturned as unknown) !== "" && !isNaN(Number(rawReturned));
    const returnedGross = hasReturnedWeight ? Number(rawReturned) : 0;
    const tare = Number(sc.cylinder_asset?.tare_weight ?? 0);
    const opening = Number(sc.current_lpg_kg ?? 0); // Treats current_lpg_kg as Previous Gross

    const openingNet = Math.max(0, opening - tare);
    const remaining = hasReturnedWeight ? Math.min(openingNet, Math.max(0, returnedGross - tare)) : openingNet;
    const consumed = hasReturnedWeight ? Math.max(0, openingNet - remaining) : 0;

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
  const billableKg = isKiloMode ? totalWiwoKg : Math.max(meteredKg, totalWiwoKg);
  const varianceKg = isKiloMode ? 0 : Math.abs(meteredKg - totalWiwoKg);
  const mismatchExists = isKiloMode ? false : meteredKg !== totalWiwoKg;

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
        // AG-CHANGE: Enforce photo validation for onboarding cylinders
        const missingEvidence = selectedOnboardCylinders.find(
          (c) => !c.serialPhotoId || !c.weightPhotoId
        );
        if (missingEvidence) {
          alert(`Please capture both serial and scale photos for onboarding cylinder ${missingEvidence.serialNumber}.`);
          setLoading(false);
          return;
        }
        payload = {
          transaction_header_id: transactionHeader.header_id,
          transaction_type: "ONBOARDING_BASELINE",
          customer_code: customerCode,
          lpg_site_id: Number(siteId),
          transaction_date: transactionDate,
          sales_invoice_id: salesInvoice?.invoice_id,
          sales_invoice_no: salesInvoice?.invoice_no,
          // AG-CHANGE: Pass photo IDs to onboarding baseline cylinders payload
          cylinders: selectedOnboardCylinders.map(c => ({
            cylinderAssetId: c.cylinderAssetId,
            targetKg: c.targetKg,
            pricePerKg: c.pricePerKg,
            serialPhotoId: c.serialPhotoId,
            weightPhotoId: c.weightPhotoId,
          })),
        };
      } else {
        // Routine check & swap
        const missingAttachments = calculatedReturnedCylinders.find((c) => {
          if (c.returnedGross > 0) {
            const hasSerial = attachmentsState.some(a => a.siteCylinderId === c.id && a.attachmentType === "SERIAL_IMAGE");
            const hasWeight = attachmentsState.some(a => a.siteCylinderId === c.id && a.attachmentType === "WEIGHT_IMAGE");
            return !hasSerial || !hasWeight;
          }
          return false;
        });

        if (missingAttachments) {
          alert(`Please capture both serial and weight images for cylinder ${missingAttachments.cylinder_asset?.serial_number}.`);
          setLoading(false);
          return;
        }

        if (selectedReplacementCylinders.length > 0) {
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
          const missingReplacementEvidence = selectedReplacementCylinders.find(
            c => !c.serialPhotoId || !c.weightPhotoId
          );
          if (missingReplacementEvidence) {
            alert(`Please capture both serial and weight images for new cylinder ${missingReplacementEvidence.serialNumber}.`);
            setLoading(false);
            return;
          }
        }

        const returnedCylindersPayload = calculatedReturnedCylinders
          .filter((c) => c.returnedGross > 0)
          .map((c) => ({
            siteCylinderId: c.id,
            returnedGrossWeight: c.returnedGross,
            isSwapped: c.isSwapped,
          }));

        payload = {
          transaction_header_id: transactionHeader.header_id,
          transaction_type: "REGULAR_BILLING",
          transaction_id: selectedTxId ? Number(selectedTxId) : undefined,
          customer_code: customerCode,
          lpg_site_id: Number(siteId),
          transaction_date: transactionDate,
          previous_reading: isKiloMode ? 0 : previousReading,
          current_reading: isKiloMode ? 0 : currentReading,
          metered_kg: isKiloMode ? 0 : meteredKg,
          price_per_kg: pricePerKg,
          returned_cylinders: returnedCylindersPayload,
          new_cylinders: selectedReplacementCylinders.map(c => ({
            cylinderAssetId: c.cylinderAssetId,
            targetKg: Number(c.targetKg),
            serialPhotoId: c.serialPhotoId,
            weightPhotoId: c.weightPhotoId,
          })),
          varianceReasonCode: varianceReasonCode,
          remarks: remarks,
          sales_invoice_id: salesInvoice?.invoice_id,
          sales_invoice_no: salesInvoice?.invoice_no,
          is_no_swap: selectedReplacementCylinders.length === 0,
          attachments: attachmentsState.map(att => ({
            siteCylinderId: att.siteCylinderId,
            cylinderAssetId: att.cylinderAssetId,
            attachmentType: att.attachmentType,
            directusFileId: att.directusFileId,
          })).concat(selectedReplacementCylinders.flatMap(c => [
            {
              siteCylinderId: null,
              cylinderAssetId: c.cylinderAssetId,
              attachmentType: "SERIAL_IMAGE",
              directusFileId: c.serialPhotoId!,
            },
            {
              siteCylinderId: null,
              cylinderAssetId: c.cylinderAssetId,
              attachmentType: "WEIGHT_IMAGE",
              directusFileId: c.weightPhotoId!,
            },
          ])),
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

      toast.success("Transaction saved and posted successfully!");
      clearWeighingCache(selectedTxId);
      if (data.data?.transaction_no) {
        setSubmittedTxNo(data.data.transaction_no);
      }
      setIsAfterSubmit(true);
      // DEV-CHANGE: Bypass printing flow if onboarding
      if (flowType !== "ONBOARDING") {
        setAutoPrintActive(true);
        setPrintModalOpen(true);
      } else {
        onSuccess();
      }
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Rollback Submit Handler
  const handleCancelTransaction = async () => {
    if (!cancelledReason.trim()) {
      toast.warning("Please enter a valid reason for cancellation.");
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

      toast.success("Transaction successfully rolled back and cancelled.");
      setIsCancelModalOpen(false);
      clearWeighingCache(selectedTxId);
      onSuccess();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "An error occurred during cancellation.");
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  const finalVat = isViewMode ? txDetail.vat_amount : parseFloat((finalGross - (finalGross / 1.12)).toFixed(2));
  // IDS-CHANGE: VAT is absorbed / inclusive: total amount = gross = vatable amount
  const finalNet = isViewMode ? txDetail.gross_amount : finalGross;
  const finalBillableSource = isViewMode ? txDetail.billable_source : (meteredKg >= totalWiwoKg ? "METERED" : "WIWO");

  // RULE DEV: Map printer data for WIWO receipt
  const siteName = selectedSite?.site_name || transactionHeader?.site?.site_name || null;

  const printReturnedCylinders = isViewMode
    ? (((txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ?? [])
      .filter((d) => d.line_type === "CONSUMPTION_RETURN")
      .map((d) => ({
        serialNumber: d.serial_number,
        tareWeight: d.tare_weight_kg,
        previousLpgKg: d.previous_lpg_kg,
        returnedGrossWeight: d.returned_gross_weight_kg ?? 0,
        consumedLpgKg: d.consumed_lpg_kg,
      })))
    : calculatedReturnedCylinders
      .filter((c) => c.returnedGross > 0)
      .map((c) => ({
        serialNumber: c.cylinder_asset?.serial_number || "",
        tareWeight: c.tare,
        previousLpgKg: c.opening,
        returnedGrossWeight: c.returnedGross,
        consumedLpgKg: c.consumed,
      }));

  const printDeployedCylinders = isViewMode
    ? (((txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ?? [])
      .filter((d) => d.line_type === "NEW_DEPLOYMENT")
      .map((d) => ({
        serialNumber: d.serial_number,
        tareWeight: d.tare_weight_kg,
        deployedGrossWeight: d.previous_lpg_kg,
      })))
    : flowType === "ONBOARDING"
      ? selectedOnboardCylinders.map((c) => ({
        serialNumber: c.serialNumber,
        tareWeight: c.tareWeight,
        deployedGrossWeight: Number(c.targetKg),
      }))
      : selectedReplacementCylinders.map((c) => ({
        serialNumber: c.serialNumber,
        tareWeight: c.tareWeight,
        deployedGrossWeight: Number(c.targetKg),
      }));

  const printTxType = isViewMode
    ? txDetail?.transaction_type === "ONBOARDING_BASELINE"
      ? "Onboarding Baseline"
      : txDetail?.transaction_type === "REGULAR_BILLING"
        ? "Regular Billing"
        : "Adjustment"
    : flowType === "ONBOARDING"
      ? "Onboarding Baseline"
      : "Regular Billing";

  const printTxData: WiwoThermalReceiptData = {
    transactionNo: isViewMode
      ? txDetail?.transaction_no || ""
      : submittedTxNo || txDetail?.transaction_no || "",
    transactionDate: isViewMode ? txDetail?.transaction_date || "" : transactionDate,
    transactionType: printTxType,
    customerName: isViewMode
      ? txDetail?.customer?.customer_name || txDetail?.customer_code || "—"
      : transactionHeader?.customer_name || customerCode || "—",
    siteName: siteName,
    salesInvoiceNo: isViewMode
      ? txDetail?.sales_invoice_no
      : salesInvoice?.invoice_no || null,
    salesOrderNo: isViewMode
      ? txDetail?.sales_order_no
      : null,
    previousReading: isViewMode
      ? txDetail?.meter_reading_id
        ? (txDetail.meter_reading_id as unknown as MeterReading).previous_reading
        : null
      : previousReading,
    currentReading: isViewMode
      ? txDetail?.meter_reading_id
        ? (txDetail.meter_reading_id as unknown as MeterReading).current_reading
        : null
      : currentReading,
    meteredKg: isViewMode ? txDetail?.metered_kg : meteredKg,
    wiwoKg: isViewMode ? txDetail?.wiwo_kg || 0 : totalWiwoKg,
    billableKg: finalBillableKg,
    billableSource: finalBillableSource as "METERED" | "WIWO" | "NONE",
    pricePerKg: finalPricePerKg,
    grossAmount: finalGross,
    vatAmount: finalVat,
    netAmount: finalNet,
    returnedCylinders: printReturnedCylinders,
    deployedCylinders: printDeployedCylinders,
    isOnboarding: isViewMode
      ? txDetail?.transaction_type === "ONBOARDING_BASELINE"
      : flowType === "ONBOARDING",
    remarks: isViewMode ? txDetail?.remarks : remarks,
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Locked Notice */}
      {isReadOnly && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-250 dark:border-yellow-900/50 rounded-2xl p-4 text-xs text-yellow-800 dark:text-yellow-400 flex items-center gap-3 shadow-md">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="font-bold">Transaction Locked: </span>
            This physical validation & billing record is <span className="font-bold text-primary">{txDetail?.status}</span> and cannot be modified.
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
          <h2 className="text-lg sm:text-xl font-black text-primary truncate">
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
      </div>

      {/* Main Layout: single column on mobile, 3-col on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card A: Transaction Info */}
          <div className="bg-card/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Gauge className="h-4 w-4" />
              </div>
              <h2 className="font-semibold text-sm">Transaction Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border">
              {flowType === "ROUTINE" && !isViewMode && !isKiloMode && (
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
                      className="bg-accent font-medium text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDraftModalOpen(true)}
                      className="text-xs h-9 bg-zinc-100 hover:bg-zinc-250 border-border dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground font-bold px-4 rounded-xl shrink-0"
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
                      ? (txDetail.site?.site_name || `Site #${txDetail.lpg_site_id}`)
                      : (siteSearch && !siteSearch.startsWith("Site #") ? siteSearch : (transactionHeader.site?.site_name || siteSearch || `Site #${siteId}`))}
                    readOnly
                    className="bg-accent font-medium"
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

              {/* AG-CHANGE: Show customer code as prefix + customer name for readability */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customer</Label>
                <Input
                  value={isViewMode
                    ? `${txDetail.customer_code}${txDetail.customer?.customer_name ? ` · ${txDetail.customer.customer_name}` : ""}`
                    : `${customerCode}${transactionHeader.customer_name ? ` · ${transactionHeader.customer_name}` : ""}`
                  }
                  readOnly
                  className="bg-accent font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Date</Label>
                {isReadOnly || isViewMode || !!selectedTxId ? (
                  <Input value={isViewMode ? txDetail.transaction_date : transactionDate} readOnly className="bg-accent" />
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
                      className="bg-accent font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Period To</Label>
                    <Input
                      value={isViewMode ? (txDetail.billing_period_to ?? "—") : billingPeriodTo || "—"}
                      readOnly
                      className="bg-accent font-mono text-xs"
                    />
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Card B: Flow B Readings and Scales */}
          {flowType === "ROUTINE" && (
            <>
              {/* Meter Sync panel */}
              {!isKiloMode && (
                <div className="bg-card/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-primary">
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
                        className="bg-accent font-mono"
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
                        className="font-mono bg-emerald-50 dark:bg-emerald-900/20 text-primary font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Connected cylinders returns weights table */}
              {(isViewMode || flowType === "ROUTINE") && (
                <div className="bg-card/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Scale className="h-4 w-4" />
                      </div>
                      <h2 className="font-semibold text-sm">Connected Cylinders & Weight Check</h2>
                    </div>
                    {!isViewMode && flowType === "ROUTINE" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setScannerError("");
                          setScannerInput("");
                          setIsScannerModalOpen(true);
                        }}
                        className="bg-white dark:bg-zinc-900 text-muted-foreground dark:text-zinc-300 hover:text-primary dark:hover:text-emerald-400 text-xs px-2 sm:px-3 h-8 shadow-sm border-border"
                      >
                        <ScanBarcode className="h-4 w-4 sm:mr-1.5 text-primary" />
                        <span className="hidden sm:inline">Scan Cylinder</span>
                      </Button>
                    )}
                  </div>

                  <div className="border border-border/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-full">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="p-2 sm:p-3 sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 text-[10px] sm:text-xs">Serial</th>
                            <th className="p-2 sm:p-3 text-[10px] sm:text-xs">Product Name</th>
                            <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs">Level</th>
                            <th className="p-2 sm:p-3 text-center text-[10px] sm:text-xs">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                          {isViewMode ? (
                            ((txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ?? [])
                              .filter(l => l.line_type === "CONSUMPTION_RETURN")
                              .map((line, idx) => {
                                const details = (txDetail?.wiwo_header_id as unknown as WiwoHeader)?.details ?? [];
                                const deploymentLines = details.filter(d => d.line_type === "NEW_DEPLOYMENT");
                                const matchedDeployment = deploymentLines[idx];
                                const isSwapped = !!matchedDeployment;
                                const typedLine = line as typeof line & { product_name?: string; cylinder_asset?: CylinderAsset };

                                return (
                                  <Fragment key={idx}>
                                    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                                      <td className="p-2 sm:p-3 font-mono font-bold sticky left-0 bg-white dark:bg-zinc-950 z-10 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-[10px] sm:text-xs">{typedLine.serial_number}</td>
                                      <td className="p-2 sm:p-3 font-semibold text-zinc-700 dark:text-zinc-300 text-[10px] sm:text-xs">
                                        {typedLine.cylinder_asset?.product?.product_name || typedLine.product_name || "LPG Cylinder"}
                                      </td>
                                      <td className="p-2 sm:p-3 text-center">
                                        {(() => {
                                          const capacity = typedLine.cylinder_asset?.product?.unit_of_measurement_count || 50;
                                          const percentage = Math.min(100, Math.max(0, (typedLine.remaining_lpg_kg / capacity) * 100));
                                          const isLow = percentage <= 20;
                                          return (
                                            <div className="flex flex-col items-center gap-1">
                                              <div className="w-16 sm:w-20 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                  className={`h-full rounded-full ${isLow ? 'bg-red-500' : percentage <= 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                  style={{ width: `${percentage}%` }}
                                                />
                                              </div>
                                              <span className={`text-[8px] sm:text-[9px] font-bold ${isLow ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
                                                {percentage.toFixed(0)}% {isLow && '(Needs Swap)'}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="p-2 sm:p-3 text-center">
                                        {isSwapped ? (
                                          <Badge variant="outline" className="border-emerald-255 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                            Swapped
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="border-border text-muted-foreground bg-accent/20 dark:text-muted-foreground text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                            In-Place
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                    <tr className="bg-zinc-50/20 dark:bg-zinc-900/5">
                                      <td colSpan={4} className="p-4 border-l-2 border-border dark:border-zinc-700">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                          <div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Tare Weight</span>
                                            <span className="font-mono text-xs">{line.tare_weight_kg} KG</span>
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Previous Gross KG</span>
                                            <span className="font-mono text-xs">{line.previous_lpg_kg} KG</span>
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Remaining KG</span>
                                            <span className="font-mono text-xs text-muted-foreground">{line.remaining_lpg_kg} KG</span>
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Consumed KG</span>
                                            <span className="font-mono text-xs font-bold text-foreground">{line.consumed_lpg_kg} KG</span>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                    {isSwapped && (
                                      <tr className="bg-zinc-50/40 dark:bg-zinc-900/10">
                                        <td colSpan={4} className="p-4 border-l-2 border-primary bg-zinc-50/30 dark:bg-zinc-900/10">
                                          <div className="flex flex-col sm:flex-row gap-6 text-xs">
                                            <div>
                                              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[10px] mb-0.5">Replacement Cylinder Serial</span>
                                              <span className="font-mono font-bold text-foreground">{matchedDeployment.serial_number}</span>
                                            </div>
                                            <div>
                                              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[10px] mb-0.5">Tare Weight</span>
                                              <span className="font-mono">{matchedDeployment.tare_weight_kg} KG</span>
                                            </div>
                                            <div>
                                              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[10px] mb-0.5">Deployed Gross Weight</span>
                                              <span className="font-mono font-bold text-primary dark:text-emerald-400">{matchedDeployment.previous_lpg_kg} KG</span>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })
                          ) : (
                            calculatedReturnedCylinders.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                  No connected cylinders found for this site. Must run onboarding setup first.
                                </td>
                              </tr>
                            ) : (
                              calculatedReturnedCylinders.map((row) => {
                                return (
                                  <Fragment key={row.id}>
                                    <tr
                                      onClick={() => {
                                        setMobileEditingCylinderId(row.id);
                                      }}
                                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 cursor-pointer transition-colors group"
                                    >
                                      <td className="p-2 sm:p-3 font-mono font-bold sticky left-0 bg-white dark:bg-zinc-950 z-10 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-[10px] sm:text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" />
                                          {row.cylinder_asset?.serial_number}
                                        </div>
                                      </td>
                                      <td className="p-2 sm:p-3 font-semibold text-zinc-700 dark:text-zinc-300 text-[10px] sm:text-xs">
                                        {row.cylinder_asset?.product?.product_name || "LPG Cylinder"}
                                      </td>
                                      <td className="p-2 sm:p-3 text-center">
                                        {(() => {
                                          const capacity = row.cylinder_asset?.product?.unit_of_measurement_count || 50;
                                          const percentage = Math.min(100, Math.max(0, (row.remaining / capacity) * 100));
                                          const isLow = percentage <= 20;
                                          return (
                                            <div className="flex flex-col items-center gap-1">
                                              <div className="w-16 sm:w-20 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                  className={`h-full rounded-full ${isLow ? 'bg-red-500' : percentage <= 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                  style={{ width: `${percentage}%` }}
                                                />
                                              </div>
                                              <span className={`text-[8px] sm:text-[9px] font-bold ${isLow ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
                                                {percentage.toFixed(0)}% {isLow && '(Needs Swap)'}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="p-2 sm:p-3 text-center">
                                        {row.isSwapped ? (
                                          <Badge variant="outline" className="border-violet-250 text-violet-700 bg-violet-55/20 dark:bg-violet-955/20 dark:text-violet-400 text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                            Swapping Out
                                          </Badge>
                                        ) : returnedWeights[row.id] > 0 ? (
                                          <Badge variant="outline" className="border-emerald-250 text-emerald-700 bg-emerald-50 dark:bg-emerald-955/20 dark:text-emerald-400 text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                            Weighed In-Place
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="border-border text-muted-foreground bg-accent/10 text-[9px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                            Active In-Place
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  </Fragment>
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

          {/* Card C: Cylinder Allocations/Deployments for Onboarding setup only */}
          {flowType === "ONBOARDING" && (
            <div className="bg-card/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Truck className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-sm">
                    Baseline Connected Cylinders
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border border-border/80 rounded-xl p-4 bg-white dark:bg-zinc-955/10 text-xs">
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
                      className="bg-primary hover:bg-primary/90 text-white font-bold px-6 shrink-0"
                    >
                      {isValidatingSerial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      {isValidatingSerial ? "Checking..." : "Add"}
                    </Button>
                  </form>
                </div>

                {selectedOnboardCylinders.length > 0 && (
                  <div className="border border-border/80 rounded-xl overflow-hidden text-xs bg-white dark:bg-zinc-955/10 mt-3 shadow-sm">
                    {/* Mobile View (sm:hidden) — AG-CHANGE: custom responsive list layout to eliminate horizontal scrolls */}
                    <div className="block sm:hidden divide-y divide-border/60">
                      {selectedOnboardCylinders.map((cyl, idx) => (
                        <div key={cyl.cylinderAssetId} className="p-3 flex flex-col gap-2 bg-card">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-xs text-foreground truncate">{cyl.serialNumber}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{cyl.productName}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedOnboardCylinders((prev) => prev.filter((c) => c.cylinderAssetId !== cyl.cylinderAssetId))}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50/20 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-dashed border-border/50">
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Tare Weight</span>
                              <span className="font-mono font-bold text-xs text-foreground">{cyl.tareWeight} KG</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Starting Gross (KG)</span>
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={cyl.targetKg}
                                    readOnly={true}
                                    onClick={() => {
                                      setWeighingOnboardIndex(idx);
                                      setOnboardingWeighingGross(cyl.targetKg ? String(cyl.targetKg) : "");
                                      setIsOnboardWeighModalOpen(true);
                                    }}
                                    placeholder="Weigh"
                                    className={`text-xs h-8 text-right font-mono w-full cursor-pointer ${(Number(cyl.targetKg) - cyl.tareWeight > cyl.capacity || (cyl.targetKg !== "" && Number(cyl.targetKg) < cyl.tareWeight)) ? "border-red-500 text-red-500 bg-red-50/10 focus-visible:ring-red-500" : ""
                                      }`}
                                  />
                                  {cyl.targetKg && <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-bold">KG</span>}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setWeighingOnboardIndex(idx);
                                    setOnboardingWeighingGross(cyl.targetKg ? String(cyl.targetKg) : "");
                                    setIsOnboardWeighModalOpen(true);
                                  }}
                                  className={`h-8 w-8 p-0 rounded-lg shrink-0 ${cyl.serialPhotoId && cyl.weightPhotoId ? "border-emerald-250 text-primary bg-emerald-50 dark:bg-emerald-955/20" : ""}`}
                                  title="Setup Weight & Photos"
                                >
                                  <Scale className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {/* AG-CHANGE: Show calculated net weight dynamically below inputs on mobile layout */}
                              {cyl.targetKg ? (
                                <span className="text-[9px] text-muted-foreground block text-right mt-1 w-full pr-9 font-medium">
                                  Net: {(Number(cyl.targetKg) - cyl.tareWeight).toFixed(1)} KG
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop View (hidden sm:block) */}
                    <div className="hidden sm:block">
                      <table className="w-full text-left border-collapse min-w-full table-fixed">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="p-3 sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 whitespace-nowrap w-[155px]">Serial</th>
                            <th className="p-3 whitespace-nowrap">Product Name</th>
                            <th className="p-3 text-right whitespace-nowrap w-[110px]">Tare Weight</th>
                            <th className="p-3 text-right w-[165px] whitespace-nowrap">Gross Weight (KG)</th>
                            {/* AG-CHANGE: Added Net Weight column to the onboarding baseline cylinders table */}
                            <th className="p-3 text-right w-[110px] whitespace-nowrap">Net Weight</th>
                            <th className="p-3 w-12 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                          {selectedOnboardCylinders.map((cyl, idx) => (
                            <tr key={cyl.cylinderAssetId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                              <td className="p-3 sticky left-0 bg-white dark:bg-zinc-955 z-10 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[155px]">
                                <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate w-full" title={cyl.serialNumber}>
                                  {cyl.serialNumber}
                                </div>
                              </td>
                              <td className="p-3 text-muted-foreground">
                                <div className="truncate w-full" title={cyl.productName}>
                                  {cyl.productName}
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-muted-foreground whitespace-nowrap w-[110px]">{cyl.tareWeight} KG</td>
                              <td className="p-3 w-[165px]">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <div className="relative w-24">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={cyl.targetKg}
                                      readOnly={true}
                                      onClick={() => {
                                        setWeighingOnboardIndex(idx);
                                        setOnboardingWeighingGross(cyl.targetKg ? String(cyl.targetKg) : "");
                                        setIsOnboardWeighModalOpen(true);
                                      }}
                                      placeholder="Weigh"
                                      className={`text-xs h-8 text-right font-mono pr-8 cursor-pointer ${(Number(cyl.targetKg) - cyl.tareWeight > cyl.capacity || (cyl.targetKg !== "" && Number(cyl.targetKg) < cyl.tareWeight)) ? "border-red-500 text-red-500 bg-red-50/10 focus-visible:ring-red-500" : ""
                                        }`}
                                    />
                                    {cyl.targetKg && <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-bold">KG</span>}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setWeighingOnboardIndex(idx);
                                      setOnboardingWeighingGross(cyl.targetKg ? String(cyl.targetKg) : "");
                                      setIsOnboardWeighModalOpen(true);
                                    }}
                                    className={`h-8 w-8 p-0 rounded-lg shrink-0 ${cyl.serialPhotoId && cyl.weightPhotoId ? "border-emerald-250 text-primary bg-emerald-50 dark:bg-emerald-955/20" : ""}`}
                                    title="Setup Weight & Photos"
                                  >
                                    <Scale className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                              {/* AG-CHANGE: Show the calculated Net Weight in a dedicated column for onboarding baseline setup */}
                              <td className="p-3 text-right font-mono text-zinc-700 dark:text-zinc-300 font-bold whitespace-nowrap w-[110px]">
                                {cyl.targetKg ? `${(Number(cyl.targetKg) - cyl.tareWeight).toFixed(1)} KG` : "—"}
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
            </div>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          {/* Card D: Summary Card */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-4 sm:p-6 text-white shadow-2xl shadow-violet-500/30 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Gauge className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg">WIWO Billing Summary</h3>
            </div>

            {flowType === "ROUTINE" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Metered Calculation Box */}
                  <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="text-violet-200 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Metered Calc</div>
                    <div className="flex justify-between text-violet-100">
                      <span>KG</span>
                      <span className="font-mono font-bold">{meteredKg.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-violet-100">
                      <span>Gross</span>
                      <span className="font-mono">₱ {(meteredKg * pricePerKg).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-violet-100">
                      <span>VAT</span>
                      <span className="font-mono">₱ {((meteredKg * pricePerKg) - ((meteredKg * pricePerKg) / 1.12)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white border-t border-white/10 pt-1.5 font-bold">
                      <span>Total</span>
                      <span className="font-mono">₱ {(meteredKg * pricePerKg).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* WIWO Calculation Box */}
                  <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="text-violet-200 font-bold mb-1.5 uppercase tracking-wider text-[10px]">WIWO Calc</div>
                    <div className="flex justify-between text-violet-100">
                      <span>KG</span>
                      <span className="font-mono font-bold">{totalWiwoKg.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-violet-100">
                      <span>Gross</span>
                      <span className="font-mono">₱ {(totalWiwoKg * pricePerKg).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-violet-100">
                      <span>VAT</span>
                      <span className="font-mono">₱ {((totalWiwoKg * pricePerKg) - ((totalWiwoKg * pricePerKg) / 1.12)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white border-t border-white/10 pt-1.5 font-bold">
                      <span>Total</span>
                      <span className="font-mono">₱ {(totalWiwoKg * pricePerKg).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-violet-200 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs">
                  <span className="font-semibold">Variance (Difference)</span>
                  <span className="font-mono font-bold">{varianceKg.toFixed(3)} kg</span>
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
                  className={`font-bold text-xs tracking-wider border-none ${finalBillableSource === "METERED"
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

          {/* Card E: Remarks notes (Status removed per user request) */}
          <div className="bg-card/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">

            {flowType === "ROUTINE" && mismatchExists && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Variance Reason (Optional)
                </Label>
                <Select
                  value={isViewMode ? txDetail?.variance_reason_code || "NONE" : varianceReasonCode}
                  onValueChange={(val) => setVarianceReasonCode(val)}
                  disabled={isReadOnly || isViewMode}
                >
                  <SelectTrigger className="w-full text-xs h-9 rounded-xl border border-border bg-white dark:bg-zinc-950 text-left">
                    <SelectValue placeholder="Select Reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-xs">Select Reason...</SelectItem>
                    <SelectItem value="METER_DRIFT" className="text-xs">Meter Calibration Drift</SelectItem>
                    <SelectItem value="PHYSICAL_LEAK" className="text-xs">Physical Leak Detected</SelectItem>
                    <SelectItem value="METER_MALFUNCTION" className="text-xs">Meter Malfunction / Frozen</SelectItem>
                    <SelectItem value="TEMPERATURE_VARIATION" className="text-xs">Temperature / Expansion Difference</SelectItem>
                  </SelectContent>
                </Select>
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
      {/* Form Action Buttons (Moved to bottom) */}
      <div className="flex flex-wrap gap-4 items-center justify-end border-t border-border pt-6 mt-6">
        <Button
          variant="ghost"
          size="default"
          onClick={() => {
            if (isReadOnly) {
              onCancel();
            } else {
              setIsExitWarningOpen(true);
            }
          }}
          className="h-11 px-6 hover:bg-red-50 hover:text-red-600 font-semibold"
        >
          {isReadOnly ? "Close" : "Cancel"}
        </Button>

        {isPosted && (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setIsCancelModalOpen(true)}
            className="h-11 px-6 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all active:scale-95 font-semibold"
          >
            Cancel & Rollback
          </Button>
        )}
        {/* DEV-CHANGE: Hide print button if onboarding */}
        {flowType !== "ONBOARDING" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAutoPrintActive(false);
              setPrintModalOpen(true);
            }}
            className="h-11 px-6 border-zinc-200 text-foreground hover:bg-accent transition-all active:scale-95 font-semibold gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
        )}

        {!isReadOnly && !isViewMode && (
          <Button
            onClick={handleSubmit}
            disabled={loading || (flowType === "ROUTINE" && mismatchExists && !remarks.trim()) || hasNegativeWeightErrors}
            className="h-11 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-violet-500/20 transition-all active:scale-95 text-white font-bold text-sm"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            )}
            Post Validation
          </Button>
        )}
      </div>


      {/* Cancel/Rollback Confirmation Modal */}
      {isCancelModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-955 border border-border max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-200">
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
              <Label className="text-xs font-bold text-muted-foreground">Reason for Cancellation</Label>
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

      {/* Exit Warning Modal */}
      {isExitWarningOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-955 border border-border max-w-sm w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Unsaved Changes
              </h3>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to exit? Any unsaved data or cylinder measurements will be permanently lost.
              </p>
            </div>

            <div className="flex gap-2.5 justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsExitWarningOpen(false)}
                className="text-xs font-bold px-4 h-9"
              >
                No, Keep Editing
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsExitWarningOpen(false);
                  onCancel();
                }}
                className="text-xs font-bold px-4 h-9"
              >
                Yes, Discard Changes
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Draft Transaction Selector Modal */}
      {isDraftModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6">
          <div className="bg-white dark:bg-zinc-950 border border-border w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[88vh] sm:max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary shrink-0" />
                Select Metered Transaction
              </h3>
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/60 border-b border-border shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">From Date</Label>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">To Date</Label>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Search by Site</Label>
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
                          <p className="text-[11px] text-muted-foreground truncate">{tx.customer?.customer_name || tx.customer_code}</p>
                          <p className="text-[10px] text-primary dark:text-violet-400 font-semibold truncate mt-0.5">
                            {(() => { const s = sites.find(st => st.id === tx.lpg_site_id); return s?.site_name || `Site #${tx.lpg_site_id}`; })()}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-primary">{tx.metered_kg} KG</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">{tx.transaction_date}</span>
                        <Button
                          type="button"
                          onClick={() => handleDraftSelect(tx)}
                          className="h-8 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white px-4 rounded-xl cursor-pointer"
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
                <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-muted-foreground border-b border-border sticky top-0">
                  <tr>
                    <th className="p-3 sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10">Tx No</th>
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
                        <td className="p-3 font-mono font-bold text-zinc-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-950 z-10 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{tx.transaction_no}</td>
                        <td className="p-3 text-primary font-semibold truncate max-w-[130px]">
                          {(() => { const s = sites.find(st => st.id === tx.lpg_site_id); return s?.site_name || `Site #${tx.lpg_site_id}`; })()}
                        </td>
                        <td className="p-3 text-muted-foreground truncate max-w-[130px]">{tx.customer?.customer_name || tx.customer_code}</td>
                        <td className="p-3 font-mono">{tx.transaction_date}</td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">{tx.metered_kg} KG</td>
                        <td className="p-3 text-center">
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => handleDraftSelect(tx)}
                            className="bg-primary hover:bg-primary/90 dark:bg-violet-500 dark:hover:bg-violet-600 text-white font-bold px-3.5 py-1 rounded-xl text-[10px] cursor-pointer shadow-sm"
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
            <div className="flex justify-between items-center px-4 py-3 border-t border-border shrink-0">
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

      {/* Replacement Cylinder In Modal */}
      <Dialog
        open={replacementModalIndex !== null}
        onOpenChange={(open) => {
          if (!open) setReplacementModalIndex(null);
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-zinc-950">
          <div className="p-5 border-b border-border">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Cylinder In Weighing
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Verify the incoming cylinder, record its gross weight, and capture both required photos.
            </p>
          </div>

          {replacementModalItem && replacementModalIndex !== null && (
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  New Cylinder Serial
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={replacementModalItem.serialNumber}
                    placeholder="Scan or input serial number..."
                    onChange={(e) => {
                      const serialNumber = e.target.value;
                      setSelectedReplacementCylinders((prev) => {
                        const copy = [...prev];
                        copy[replacementModalIndex] = {
                          ...copy[replacementModalIndex],
                          serialNumber,
                          cylinderAssetId: 0,
                          productName: "",
                          tareWeight: 0,
                          capacity: 0,
                          targetKg: "",
                          serialPhotoId: null,
                          serialPhotoUrl: null,
                          weightPhotoId: null,
                          weightPhotoUrl: null,
                          error: undefined,
                        };
                        return copy;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleValidateReplacementSerial(replacementModalIndex, replacementModalItem.serialNumber);
                      }
                    }}
                    className={replacementModalItem.error ? "border-rose-500" : ""}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleValidateReplacementSerial(replacementModalIndex, replacementModalItem.serialNumber)}
                    disabled={replacementModalItem.isValidating || !replacementModalItem.serialNumber.trim()}
                    className="font-bold"
                  >
                    {replacementModalItem.isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : replacementModalItem.cylinderAssetId ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {replacementModalItem.error && (
                  <p className="text-xs font-semibold text-rose-500">{replacementModalItem.error}</p>
                )}
                {replacementModalItem.cylinderAssetId > 0 && (
                  <p className="text-xs font-semibold text-primary">
                    {replacementModalItem.productName} | Tare {replacementModalItem.tareWeight} KG
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Incoming Gross Weight
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.001"
                    value={replacementModalItem.targetKg}
                    disabled={!replacementModalItem.cylinderAssetId}
                    onChange={(e) => {
                      const value = e.target.value === "" ? "" : Number(e.target.value);
                      setSelectedReplacementCylinders((prev) => {
                        const copy = [...prev];
                        copy[replacementModalIndex] = { ...copy[replacementModalIndex], targetKg: value };
                        return copy;
                      });
                    }}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-muted-foreground">KG</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(["SERIAL", "WEIGHT"] as const).map((photoType) => {
                  const serialPhoto = photoType === "SERIAL";
                  const photoUrl = serialPhoto
                    ? replacementModalItem.serialPhotoUrl
                    : replacementModalItem.weightPhotoUrl;
                  const photoId = serialPhoto
                    ? replacementModalItem.serialPhotoId
                    : replacementModalItem.weightPhotoId;
                  const uploading = serialPhoto
                    ? replacementModalItem.isUploadingSerial
                    : replacementModalItem.isUploadingWeight;

                  return (
                    <label
                      key={photoType}
                      className={`min-h-36 rounded-xl border border-dashed p-3 cursor-pointer flex flex-col items-center justify-center text-center ${photoId ? "border-emerald-400 bg-emerald-50/30" : "border-border dark:border-zinc-700"
                        }`}
                    >
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : photoUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoUrl} alt={`${photoType} evidence`} className="max-h-24 max-w-full object-contain rounded-lg mb-2" />
                          <span className="text-[10px] font-bold text-emerald-700">
                            {serialPhoto ? "Serial photo saved" : "Weight photo saved"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                          <span className="text-xs font-bold">
                            {serialPhoto ? "Capture Serial Photo" : "Capture Scale Photo"}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={!replacementModalItem.cylinderAssetId || uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReplacementFileUpload(replacementModalIndex, file, photoType);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setReplacementModalIndex(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setReplacementModalIndex(null)}
              disabled={
                !replacementModalItem?.cylinderAssetId ||
                !replacementModalItem.targetKg ||
                Number(replacementModalItem.targetKg) < replacementModalItem.tareWeight ||
                !replacementModalItem.serialPhotoId ||
                !replacementModalItem.weightPhotoId ||
                replacementModalItem.isUploadingSerial ||
                replacementModalItem.isUploadingWeight
              }
              className="bg-primary hover:bg-primary/90 text-white font-bold"
            >
              Save Cylinder In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cylinder In-Place Weighing Modal */}
      <Dialog open={isWeighModalOpen} onOpenChange={setIsWeighModalOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-lg p-0 border border-border rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-955 gap-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Cylinder In-Place Weighing
            </DialogTitle>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Selected Cylinder (AG-CHANGE: Render as styled div instead of input to prevent browser autofocus highlight) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cylinder</Label>
              <div className="flex items-center h-10 w-full rounded-md border border-input bg-accent px-3 py-2 text-sm font-mono font-bold text-foreground select-none pointer-events-none">
                {(() => {
                  const cyl = activeSiteCylinders.find(c => c.id === weighingCylinderId);
                  return cyl ? `${cyl.cylinder_asset?.serial_number} (Tare: ${cyl.cylinder_asset?.tare_weight} KG)` : "";
                })()}
              </div>
            </div>

            {weighingCylinderId && (() => {
              const selectedCyl = activeSiteCylinders.find(c => c.id === weighingCylinderId);
              if (!selectedCyl) return null;
              const tare = Number(selectedCyl.cylinder_asset?.tare_weight ?? 0);
              const opening = Number(selectedCyl.previous_lpg_kg ?? 0);
              const currentLpgKg = Number(selectedCyl.current_lpg_kg ?? 0);
              const maxGross = opening;
              const isWeightInvalid = weighingGross ? parseFloat(weighingGross) < tare : false;

              return (
                <>
                  {/* Weight Inputs (Inline) */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Previous Reading (AG-CHANGE: Render as styled div to ensure focus lands on Gross Weight input) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Previous Reading</Label>
                      <div className="relative flex items-center h-10 w-full rounded-md border border-input bg-accent px-3 py-2 text-sm font-mono text-muted-foreground select-none pointer-events-none">
                        <span>{currentLpgKg}</span>
                        <span className="absolute right-3 text-xs text-muted-foreground font-bold">KG</span>
                      </div>
                    </div>

                    {/* Gross Weight input */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Weight</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="Scale gross weight"
                          value={weighingGross}
                          autoFocus
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
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground font-bold">KG</span>
                      </div>
                      {isWeightInvalid && (
                        <span className="text-[11px] text-rose-500 block mt-0.5">Below tare weight of {tare} KG!</span>
                      )}
                    </div>
                  </div>

                  {/* Camera Photo Captures */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Cylinder Serial Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cylinder Serial Photo</Label>
                      <div className="border border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {isUploadingSerial ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                            <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-[10px] text-muted-foreground font-bold">Capture Serial</span>
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
                      <div className="border border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {isUploadingWeight ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                            <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-[10px] text-muted-foreground font-bold">Capture Weight</span>
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
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
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
                setMobileEditingCylinderId(null); // AG-CHANGE: Autoclose the actions modal so that the scanner modal will be next to open
                setScannerError("");
                setScannerInput("");

                // IDS-CHANGE: Do not auto-open the scanner modal if all cylinders have been weighed.
                // If this is a cylinder swap, automatically open the capture cylinder in modal (replacement modal) instead.
                const nextReturnedWeights = {
                  ...returnedWeights,
                  [weighingCylinderId]: parseFloat(weighingGross),
                };
                const allCylsFulfilled = calculatedReturnedCylinders.every(c => {
                  const wt = nextReturnedWeights[c.id];
                  return wt !== undefined && wt !== null && !isNaN(Number(wt)) && Number(wt) > 0;
                });
                
                const repIndex = selectedReplacementCylinders.findIndex(c => c.swappedOutCylinderId === weighingCylinderId);
                if (swappedCylinders[weighingCylinderId] && repIndex !== -1) {
                  setReplacementModalIndex(repIndex);
                } else if (!allCylsFulfilled) {
                  setIsScannerModalOpen(true);
                }
              }}
              className="text-xs font-bold bg-primary hover:bg-primary/90 text-white px-5 h-9"
            >
              Save Weighing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Baseline Cylinder Weighing Modal */}
      {/* AG-CHANGE: Added Onboarding baseline weighing modal dialog */}
      <Dialog open={isOnboardWeighModalOpen} onOpenChange={setIsOnboardWeighModalOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-lg p-0 border border-border rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-955 gap-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Onboarding Baseline Cylinder Setup
            </DialogTitle>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {weighingOnboardIndex !== null && (() => {
              const cyl = selectedOnboardCylinders[weighingOnboardIndex];
              if (!cyl) return null;
              const isWeightInvalid = onboardingWeighingGross ? parseFloat(onboardingWeighingGross) < cyl.tareWeight : false;
              const capacityError = onboardingWeighingGross ? parseFloat(onboardingWeighingGross) - cyl.tareWeight > cyl.capacity : false;

              return (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cylinder</Label>
                    <div className="flex items-center h-10 w-full rounded-md border border-input bg-accent px-3 py-2 text-sm font-mono font-bold text-foreground select-none pointer-events-none">
                      {cyl.serialNumber} (Tare: {cyl.tareWeight} KG | Cap: {cyl.capacity} KG)
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Starting Gross Weight</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Scale gross weight"
                        value={onboardingWeighingGross}
                        autoFocus
                        onChange={(e) => setOnboardingWeighingGross(e.target.value)}
                        className={`pr-8 h-10 text-sm ${isWeightInvalid || capacityError ? "border-rose-500" : ""}`}
                      />
                      <span className="absolute right-3 top-3 text-xs text-muted-foreground font-bold">KG</span>
                    </div>
                    {/* AG-CHANGE: Show calculated net weight dynamically inside onboarding weighing modal */}
                    {onboardingWeighingGross && !isWeightInvalid && !capacityError && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5 animate-in fade-in">
                        Calculated Net Weight: {(parseFloat(onboardingWeighingGross) - cyl.tareWeight).toFixed(1)} KG
                      </span>
                    )}
                    {isWeightInvalid && (
                      <span className="text-[11px] text-rose-500 block mt-0.5">Below tare weight of {cyl.tareWeight} KG!</span>
                    )}
                    {capacityError && (
                      <span className="text-[11px] text-rose-500 block mt-0.5">Net weight exceeds cylinder capacity of {cyl.capacity} KG!</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Cylinder Serial Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cylinder Serial Photo</Label>
                      <div className="border border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {cyl.isUploadingSerial ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        ) : cyl.serialPhotoUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cyl.serialPhotoUrl} alt="Serial Capture" className="max-h-20 object-contain rounded-lg shadow-sm border" />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOnboardCylinders((prev) => {
                                  const copy = [...prev];
                                  copy[weighingOnboardIndex] = {
                                    ...copy[weighingOnboardIndex],
                                    serialPhotoId: null,
                                    serialPhotoUrl: null,
                                  };
                                  return copy;
                                });
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm animate-in fade-in"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center text-center p-2 w-full h-full justify-center">
                            <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-[10px] text-muted-foreground font-bold">Capture Serial</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleOnboardFileUpload(weighingOnboardIndex, f, "SERIAL");
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Scale Weight Photo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scale Weight Photo</Label>
                      <div className="border border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative bg-zinc-50 dark:bg-zinc-900/40">
                        {cyl.isUploadingWeight ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        ) : cyl.weightPhotoUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cyl.weightPhotoUrl} alt="Weight Capture" className="max-h-20 object-contain rounded-lg shadow-sm border" />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOnboardCylinders((prev) => {
                                  const copy = [...prev];
                                  copy[weighingOnboardIndex] = {
                                    ...copy[weighingOnboardIndex],
                                    weightPhotoId: null,
                                    weightPhotoUrl: null,
                                  };
                                  return copy;
                                });
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm animate-in fade-in"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center text-center p-2 w-full h-full justify-center">
                            <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-[10px] text-muted-foreground font-bold">Capture Weight</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleOnboardFileUpload(weighingOnboardIndex, f, "WEIGHT");
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOnboardWeighModalOpen(false)}
              className="text-xs font-bold px-4 h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                weighingOnboardIndex === null ||
                !onboardingWeighingGross ||
                parseFloat(onboardingWeighingGross) < Number(selectedOnboardCylinders[weighingOnboardIndex]?.tareWeight ?? 0) ||
                parseFloat(onboardingWeighingGross) - Number(selectedOnboardCylinders[weighingOnboardIndex]?.tareWeight ?? 0) > Number(selectedOnboardCylinders[weighingOnboardIndex]?.capacity ?? 0) ||
                selectedOnboardCylinders[weighingOnboardIndex]?.isUploadingSerial ||
                selectedOnboardCylinders[weighingOnboardIndex]?.isUploadingWeight ||
                !selectedOnboardCylinders[weighingOnboardIndex]?.serialPhotoId ||
                !selectedOnboardCylinders[weighingOnboardIndex]?.weightPhotoId
              }
              onClick={() => {
                if (weighingOnboardIndex === null) return;
                setSelectedOnboardCylinders((prev) => {
                  const copy = [...prev];
                  copy[weighingOnboardIndex].targetKg = parseFloat(onboardingWeighingGross);
                  return copy;
                });
                setIsOnboardWeighModalOpen(false);
              }}
              className="text-xs font-bold bg-primary hover:bg-primary/90 text-white px-5 h-9"
            >
              Save Weighing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Cylinder Actions Modal */}
      <Dialog open={mobileEditingCylinderId !== null} onOpenChange={(open) => { if (!open) setMobileEditingCylinderId(null); }}>
        {mobileEditingCylinderId && (() => {
          const row = calculatedReturnedCylinders.find(c => c.id === mobileEditingCylinderId);
          if (!row) return null;
          const weightError = row.isSwapped && row.returnedGross > 0 && row.returnedGross < row.tare;
          const hasSerial = attachmentsState.some(a => a.siteCylinderId === row.id && a.attachmentType === "SERIAL_IMAGE");
          const hasWeight = attachmentsState.some(a => a.siteCylinderId === row.id && a.attachmentType === "WEIGHT_IMAGE");
          const repIndex = selectedReplacementCylinders.findIndex(c => c.swappedOutCylinderId === row.id);
          const repItem = repIndex !== -1 ? selectedReplacementCylinders[repIndex] : null;

          return (
            <DialogContent
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              className="max-w-lg w-[92vw] sm:w-full p-6 rounded-2xl bg-white dark:bg-zinc-950 border border-border shadow-2xl gap-0"
            >
              <DialogTitle className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 border-b border-border pb-3">
                <Scale className="h-4 w-4 text-primary" />
                Cylinder Actions: {row.cylinder_asset?.serial_number}
              </DialogTitle>

              <div className="space-y-5 pt-4 max-h-[70vh] overflow-y-auto pr-1">

                <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-border">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Tare Weight</span>
                    <span className="font-mono text-sm">{row.tare} KG</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Previous KG</span>
                    <span className="font-mono text-sm">{row.opening} KG</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Remaining KG</span>
                    <span className="font-mono text-sm text-muted-foreground">{row.remaining} KG</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Consumed KG</span>
                    <span className="font-mono text-sm font-bold text-foreground">{row.consumed} KG</span>
                  </div>
                </div>

                {/* Action Segmented Toggle */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Cylinder Action</Label>
                  <div className="flex bg-accent/80 p-1 rounded-xl w-full border border-border dark:border-zinc-850">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => {
                        setSwappedCylinders((prev) => ({ ...prev, [row.id]: false }));
                        setSelectedReplacementCylinders((prev) =>
                          prev.filter(c => c.swappedOutCylinderId !== row.id)
                        );
                      }}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${!row.isSwapped
                        ? "bg-white dark:bg-zinc-900 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-zinc-700 dark:text-muted-foreground dark:hover:text-zinc-200"
                        }`}
                    >
                      Keep In-Place
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => {
                        setSwappedCylinders((prev) => ({ ...prev, [row.id]: true }));
                        setSelectedReplacementCylinders((prev) => {
                          if (prev.some(c => c.swappedOutCylinderId === row.id)) return prev;
                          return [
                            ...prev,
                            {
                              cylinderAssetId: 0,
                              serialNumber: "",
                              productName: "",
                              tareWeight: 0,
                              capacity: 0,
                              targetKg: "",
                              swappedOutCylinderId: row.id,
                            }
                          ];
                        });
                      }}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${row.isSwapped
                        ? "bg-white dark:bg-zinc-900 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-zinc-700 dark:text-muted-foreground dark:hover:text-zinc-200"
                        }`}
                    >
                      Swap Cylinder
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Gross Weight details */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {row.isSwapped ? "Returned Gross Weight (Weigh-Out)" : "Current Gross Weight"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          step="0.001"
                          value={returnedWeights[row.id] !== undefined ? (returnedWeights[row.id] ?? "") : ""}
                          placeholder={row.isSwapped ? `Max ${row.opening} KG` : "Current Weight"}
                          readOnly={true}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isReadOnly || isViewMode) return;
                            setWeighingCylinderId(row.id);
                            const savedGross = returnedWeights[row.id] !== undefined ? String(returnedWeights[row.id]) : "";
                            setWeighingGross(savedGross);

                            const serialAtt = attachmentsState.find(a => a.siteCylinderId === row.id && a.attachmentType === "SERIAL_IMAGE");
                            const weightAtt = attachmentsState.find(a => a.siteCylinderId === row.id && a.attachmentType === "WEIGHT_IMAGE");
                            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
                            const sId = serialAtt?.directusFileId || null;
                            const wId = weightAtt?.directusFileId || null;

                            setSerialFile(null);
                            setSerialFileUrl(sId ? `${apiBaseUrl}/assets/${sId}` : null);
                            setSerialDirectusId(sId);
                            setWeightFile(null);
                            setWeightFileUrl(wId ? `${apiBaseUrl}/assets/${wId}` : null);
                            setWeightDirectusId(wId);

                            setIsWeighModalOpen(true);
                          }}
                          className={`pr-8 h-9 text-xs cursor-pointer ${weightError ? "border-rose-500" : ""}`}
                        />
                        <span className="absolute right-2 top-2.5 text-[10px] text-muted-foreground font-bold">KG</span>
                      </div>
                      {!isReadOnly && !isViewMode && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWeighingCylinderId(row.id);
                            const savedGross = returnedWeights[row.id] !== undefined ? String(returnedWeights[row.id]) : "";
                            setWeighingGross(savedGross);

                            const serialAtt = attachmentsState.find(a => a.siteCylinderId === row.id && a.attachmentType === "SERIAL_IMAGE");
                            const weightAtt = attachmentsState.find(a => a.siteCylinderId === row.id && a.attachmentType === "WEIGHT_IMAGE");
                            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";
                            const sId = serialAtt?.directusFileId || null;
                            const wId = weightAtt?.directusFileId || null;

                            setSerialFile(null);
                            setSerialFileUrl(sId ? `${apiBaseUrl}/assets/${sId}` : null);
                            setSerialDirectusId(sId);
                            setWeightFile(null);
                            setWeightFileUrl(wId ? `${apiBaseUrl}/assets/${wId}` : null);
                            setWeightDirectusId(wId);

                            setIsWeighModalOpen(true);
                          }}
                          className={`h-9 w-9 rounded-lg shrink-0 ${hasSerial && hasWeight ? "border-emerald-250 text-primary bg-emerald-50 dark:bg-emerald-955/20" : ""}`}
                          title="Upload Photos"
                        >
                          <Scale className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {hasSerial && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-emerald-800 dark:text-emerald-400">
                          Serial: ✓
                        </Badge>
                      )}
                      {hasWeight && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-emerald-800 dark:text-emerald-400">
                          Weight: ✓
                        </Badge>
                      )}
                    </div>
                    {weightError && (
                      <span className="text-[9px] text-rose-500 block mt-0.5 font-semibold">Below Tare weight!</span>
                    )}
                  </div>

                  {/* Replacement cylinder sub-form */}
                  {row.isSwapped && repItem ? (
                    <div className="space-y-3 p-3.5 border border-zinc-150 dark:border-zinc-800/80 rounded-xl bg-zinc-50/40 dark:bg-zinc-950/20 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cylinder In</p>
                          <p className="text-xs font-semibold truncate">
                            {repItem.cylinderAssetId ? repItem.serialNumber : "New cylinder not captured"}
                          </p>
                          {repItem.cylinderAssetId > 0 && (
                            <p className="text-[9px] text-primary">
                              {repItem.targetKg} KG gross
                              {repItem.serialPhotoId && repItem.weightPhotoId ? " | Evidence complete" : " | Evidence required"}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setReplacementModalIndex(repIndex)}
                          className="h-9 shrink-0 text-xs font-bold"
                        >
                          <Scale className="h-3.5 w-3.5" />
                          {repItem.cylinderAssetId ? "Edit Cylinder In" : "Capture Cylinder In"}
                        </Button>
                      </div>
                      <div className="hidden">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Scan / Input New Serial</Label>
                          <div className="flex gap-1.5 items-center w-full">
                            <Input
                              type="text"
                              placeholder="Serial number..."
                              value={repItem.serialNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedReplacementCylinders((prev) => {
                                  const copy = [...prev];
                                  const idx = copy.findIndex(c => c.swappedOutCylinderId === row.id);
                                  if (idx !== -1) {
                                    copy[idx] = {
                                      ...copy[idx],
                                      serialNumber: val,
                                      cylinderAssetId: 0,
                                      productName: "",
                                      tareWeight: 0,
                                      capacity: 0,
                                      error: undefined,
                                    };
                                  }
                                  return copy;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const idx = selectedReplacementCylinders.findIndex(c => c.swappedOutCylinderId === row.id);
                                  if (idx !== -1) {
                                    handleValidateReplacementSerial(idx, repItem.serialNumber);
                                  }
                                }
                              }}
                              className={`text-xs h-8 w-full ${repItem.error ? "border-rose-500" : repItem.cylinderAssetId ? "border-primary bg-emerald-50/10" : ""}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                const idx = selectedReplacementCylinders.findIndex(c => c.swappedOutCylinderId === row.id);
                                if (idx !== -1) {
                                  handleValidateReplacementSerial(idx, repItem.serialNumber);
                                }
                              }}
                              disabled={repItem.isValidating || !repItem.serialNumber.trim()}
                              className="h-8 font-bold text-xs shrink-0"
                            >
                              {repItem.isValidating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : repItem.cylinderAssetId ? (
                                <CheckCircle2 className="h-3 w-3 text-primary" />
                              ) : (
                                "Verify"
                              )}
                            </Button>
                          </div>
                          {repItem.error && (
                            <span className="text-[9px] text-rose-500 block mt-0.5 font-semibold">{repItem.error}</span>
                          )}
                          {repItem.cylinderAssetId > 0 && (
                            <span className="text-[9px] text-primary block mt-0.5 font-semibold">
                              Verified: {repItem.productName} (Tare: {repItem.tareWeight} KG)
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">New Cylinder Gross Weight</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={repItem.targetKg}
                              disabled={!repItem.cylinderAssetId}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val = raw === "" ? "" : parseFloat(raw);
                                setSelectedReplacementCylinders((prev) => {
                                  const copy = [...prev];
                                  const idx = copy.findIndex(c => c.swappedOutCylinderId === row.id);
                                  if (idx !== -1) {
                                    copy[idx].targetKg = val;
                                  }
                                  return copy;
                                });
                              }}
                              placeholder={repItem.cylinderAssetId ? String(repItem.tareWeight + repItem.capacity) : "N/A"}
                              className="text-xs h-8 pr-8"
                            />
                            {repItem.cylinderAssetId > 0 && <span className="absolute right-2 top-2.5 text-[10px] text-muted-foreground font-bold">KG</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(["SERIAL", "WEIGHT"] as const).map((photoType) => {
                            const isSerialPhoto = photoType === "SERIAL";
                            const photoUrl = isSerialPhoto ? repItem.serialPhotoUrl : repItem.weightPhotoUrl;
                            const photoId = isSerialPhoto ? repItem.serialPhotoId : repItem.weightPhotoId;
                            const uploading = isSerialPhoto ? repItem.isUploadingSerial : repItem.isUploadingWeight;
                            return (
                              <label
                                key={photoType}
                                className={`min-h-20 rounded-lg border border-dashed p-2 text-center text-[9px] font-bold cursor-pointer flex flex-col items-center justify-center ${photoId ? "border-emerald-400 text-emerald-700" : "border-border text-muted-foreground"
                                  }`}
                              >
                                {uploading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : photoUrl ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photoUrl} alt={`New cylinder ${photoType.toLowerCase()}`} className="h-12 max-w-full object-contain rounded mb-1" />
                                    {isSerialPhoto ? "Serial photo saved" : "Weight photo saved"}
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mb-1" />
                                    {isSerialPhoto ? "Capture new serial" : "Capture new weight"}
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={!repItem.cylinderAssetId || uploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReplacementFileUpload(repIndex, file, photoType);
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center border border-dashed border-border rounded-xl p-4 text-center text-muted-foreground bg-zinc-50/10 text-[10px]">
                      Cylinder stays in service. No replacement needed.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border mt-5">
                <Button
                  type="button"
                  onClick={() => setMobileEditingCylinderId(null)}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 h-9"
                >
                  Done
                </Button>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      <Dialog open={isScannerModalOpen} onOpenChange={setIsScannerModalOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl p-0 overflow-hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-border">
          <div className="p-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ScanBarcode className="h-4 w-4 text-primary" />
              Scan Cylinder Serial
            </DialogTitle>
          </div>
          <div className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setScannerError("");
                if (!scannerInput.trim()) return;

                const foundRow = calculatedReturnedCylinders.find(
                  c => c.cylinder_asset?.serial_number?.toLowerCase() === scannerInput.trim().toLowerCase()
                );

                if (foundRow) {
                  setMobileEditingCylinderId(foundRow.id);
                  setIsScannerModalOpen(false);
                  setScannerInput("");
                } else {
                  setScannerError("Serial number not found in connected cylinders.");
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Scanner Input</Label>
                <Input
                  type="text"
                  autoFocus
                  placeholder="Scan or type serial..."
                  value={scannerInput}
                  onChange={(e) => {
                    setScannerInput(e.target.value);
                    setScannerError("");
                  }}
                  className={`font-mono text-sm ${scannerError ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                />
                {scannerError && (
                  <p className="text-xs text-rose-500 font-semibold">{scannerError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScannerModalOpen(false)}
                  className="text-xs px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={scannerInput.trim() === ""}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5"
                >
                  Search
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* RULE DEV: 58mm Thermal Printer Receipt Modal */}
      <WiwoThermalReceiptModal
        open={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false);
          setAutoPrintActive(false);
          if (isAfterSubmit) {
            onSuccess();
          }
        }}
        autoPrint={autoPrintActive}
        data={printTxData}
      />
    </div>
  );
}
