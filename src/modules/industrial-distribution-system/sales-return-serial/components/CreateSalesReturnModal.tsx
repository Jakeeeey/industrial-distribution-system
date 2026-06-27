"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  FileText,
  User,
  Calculator,
  CheckCircle,
  ScanLine,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

import {
  SalesReturnItem,
  API_LineDiscount,
  API_SalesReturnType,
  InvoiceOption,
  PriceTypeOption,
} from "../types/sales-return.types";

// Import Child Modal
import { ProductLookupModal } from "./ProductLookupModal";
import { BulkRegisterModal } from "./BulkRegisterModal";
// Import Provider & Types
import {
  SalesReturnProvider,
  SalesmanOption,
  CustomerOption,
  BranchOption,
  Product,
} from "../providers/fetchProviders";
import { resolveFinalDiscount } from "../services/sales-return.helpers";

import { useSearchParams } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// --- OPTIMIZED SUB-COMPONENTS TO PREVENT LAG ---
const SerialInputSection = React.memo(({ onAdd, disabled }: { onAdd: (val: string) => void; disabled: boolean }) => {
  const [localValue, setLocalValue] = useState("");
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && localValue.trim()) {
      onAdd(localValue.trim());
      setLocalValue("");
    }
  };
  return (
    <div className="relative group">
      <Input
        className="h-9 w-64 pl-10 pr-10 text-sm font-mono border-primary/30 focus:ring-primary/20"
        placeholder="Type serial and press Enter..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
      {disabled ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
      ) : (
        <Plus
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary cursor-pointer"
          onClick={() => {
            if (localValue.trim()) {
              onAdd(localValue.trim());
              setLocalValue("");
            }
          }}
        />
      )}
    </div>
  );
});
SerialInputSection.displayName = "SerialInputSection";

const RemarksInputSection = React.memo(({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onChange(localValue)}
      className="resize-none h-24 border-border focus:border-primary focus:bg-background"
      placeholder="Add any notes regarding this return..."
    />
  );
});
RemarksInputSection.displayName = "RemarksInputSection";

const ReasonInputSection = React.memo(({ value, onChange, disabled }: { value: string; onChange: (val: string) => void; disabled?: boolean }) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Input
      className="h-8"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onChange(localValue)}
      disabled={disabled}
    />
  );

});
ReasonInputSection.displayName = "ReasonInputSection";

export function CreateSalesReturnModal({ isOpen, onClose, onSuccess }: Props) {
  const searchParams = useSearchParams();
  const fromClearance = searchParams.get("fromClearance");
  // --- 1. FORM STATE ---
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [selectedSalesmanId, setSelectedSalesmanId] = useState("");
  const [salesmanCode, setSalesmanCode] = useState("");
  const [branchName, setBranchName] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerCode, setCustomerCode] = useState("");

  const [priceType, setPriceType] = useState("A");

  const [isThirdParty, setIsThirdParty] = useState(false);
  // Success Modal State
  const [isSuccessOpen, setSuccessOpen] = useState(false);
  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI State for Validation
  const [returnTypeError, setReturnTypeError] = useState(false);
  const [orderError, setOrderError] = useState(false);
  const [invoiceError, setInvoiceError] = useState(false);
  const [salesmanError, setSalesmanError] = useState(false);
  const [customerError, setCustomerError] = useState(false);

  // Bottom Form Fields
  const [orderNo, setOrderNo] = useState("");

  // INVOICE STATE
  const [invoiceNo, setInvoiceNo] = useState("");
  const [appliedInvoiceId, setAppliedInvoiceId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");

  // --- 2. DATA LISTS ---
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [lineDiscountOptions, setLineDiscountOptions] = useState<
    API_LineDiscount[]
  >([]);
  const [returnTypeOptions, setReturnTypeOptions] = useState<
    API_SalesReturnType[]
  >([]);
  const [priceTypeOptions, setPriceTypeOptions] = useState<PriceTypeOption[]>([]);

  // INVOICE DATA LIST & DROPDOWN STATE
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const invoiceWrapperRef = useRef<HTMLDivElement>(null);

  // ORDER NO DROPDOWN STATE
  const [orderSearch, setOrderSearch] = useState("");
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const orderWrapperRef = useRef<HTMLDivElement>(null);

  // LOADING STATES
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // --- SERIAL STATE ---
  const [isValidatingSerial, setIsValidatingSerial] = useState(false);
  const [unregisteredSerialsMap, setUnregisteredSerialsMap] = useState<Record<string, string[]>>({});
  const [isBulkRegisterOpen, setIsBulkRegisterOpen] = useState(false);

  // --- 3. CART STATE ---
  const [items, setItems] = useState<SalesReturnItem[]>([]);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // --- PRODUCT SEARCH STATE ---
  const [productSearch, setProductSearch] = useState("");
  const [serialSearch, setSerialSearch] = useState("");
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // --- 5. BRANCH LOCK STATE ---
  const [lockedBranchId, setLockedBranchId] = useState<number | null>(null);

  useEffect(() => {
    const hasSerials = items.some((i) => i.serialNumbers && i.serialNumbers.length > 0);
    if (!hasSerials) {
      setLockedBranchId(null);
    } else if (lockedBranchId === null && selectedSalesmanId) {
      const salesman = salesmen.find((s) => s.id.toString() === selectedSalesmanId);
      if (salesman && salesman.branchId) {
        setLockedBranchId(salesman.branchId);
      }
    }
  }, [items, selectedSalesmanId, salesmen, lockedBranchId]);

  const currentSalesmanObj = salesmen.find((s) => s.id.toString() === selectedSalesmanId);
  const currentBranchId = currentSalesmanObj?.branchId || null;
  const isBranchLockedError = lockedBranchId !== null && currentBranchId !== null && lockedBranchId !== currentBranchId;

  const handleClearItems = () => {
    setItems([]);
    setLockedBranchId(null);
    if (currentBranchId) {
      setLockedBranchId(currentBranchId);
    }
    toast.info("All items cleared. You may now add items for the new branch.");
  };

  // --- 4. SEARCHABLE DROPDOWN STATES ---
  const [isSalesmanOpen, setIsSalesmanOpen] = useState(false);
  const [salesmanSearch, setSalesmanSearch] = useState("");
  const salesmanWrapperRef = useRef<HTMLDivElement>(null);

  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const customerWrapperRef = useRef<HTMLDivElement>(null);

  /**
   * Resolves the correct unit price based on the selected salesman's priceType.
   */
  const resolvePrice = (product: SalesReturnItem | Record<string, unknown>, currentPriceType: string): number => {
    const key = `price${currentPriceType}`;
    const productRecord = product as Record<string, unknown>;
    const price = Number(productRecord[key]) || Number(productRecord.priceA) || Number(productRecord.unitPrice) || 0;
    return Math.round(price * 100) / 100;
  };

  // Effect to automatically update discounts when Customer changes
  useEffect(() => {
    if (items.length > 0 && customerCode) {
      const updateDiscounts = async () => {
        try {
          const catalog = await SalesReturnProvider.getFullCatalog(customerCode);

          setItems((prevItems) =>
            prevItems.map((item) => {
              const productInfo = catalog.products?.find((p: Product) => p.product_id === Number(item.productId));
              if (!productInfo) return item;

              const newDiscountType = resolveFinalDiscount(
                productInfo,
                customerCode,
                catalog
              );

              let newDiscountAmt = 0;
              if (newDiscountType) {
                const selectedOption = lineDiscountOptions.find(
                  (d) => d.id.toString() === newDiscountType?.toString(),
                );
                if (selectedOption) {
                  const percentage = parseFloat(selectedOption.total_percent) || 0;
                  newDiscountAmt = Math.round((item.grossAmount || 0) * (percentage / 100) * 100) / 100;
                }
              }

              return {
                ...item,
                discountType: newDiscountType,
                discountAmount: newDiscountAmt,
                totalAmount: Math.round(((item.grossAmount || 0) - newDiscountAmt) * 100) / 100,
              };
            })
          );
        } catch (error) {
          console.error("Failed to update discounts on customer change", error);
        }
      };
      updateDiscounts();
    }
  }, [customerCode, lineDiscountOptions, items.length]);

  const handleSelectSalesman = useCallback((salesman: SalesmanOption) => {
    const hasSerials = items.some((i) => i.serialNumbers && i.serialNumbers.length > 0);
    if (hasSerials && lockedBranchId !== null && lockedBranchId !== salesman.branchId) {
      toast.error("Current items are not registered to this branch. Change to the appropriate Branch to proceed.", { duration: 5000 });
    }

    setSelectedSalesmanId(salesman.id.toString());
    setSalesmanSearch(salesman.name);
    setSalesmanCode(salesman.code);
    setPriceType(salesman.priceType || "A");
    const linkedBranch = branches.find((b) => b.id === salesman.branchId);
    setBranchName(linkedBranch ? linkedBranch.name : "");
    setIsSalesmanOpen(false);
    setSalesmanError(false);
    setOrderNo("");
    setOrderSearch("");
    setInvoiceNo("");
    setInvoiceSearch("");
  }, [items, lockedBranchId, branches]);

  const handleSelectCustomer = useCallback((customer: CustomerOption) => {
    setSelectedCustomerId(customer.id.toString());
    setCustomerSearch(customer.name);
    setCustomerCode(customer.code || "");
    setIsCustomerOpen(false);
    setCustomerError(false);
    setOrderNo("");
    setOrderSearch("");
    setInvoiceNo("");
    setInvoiceSearch("");
  }, []);

  /**
   * Manual Serial Entry Handler
   */
  const handleAddSerial = async (serialVal?: string) => {
    const serial = (serialVal || "").trim().toUpperCase();
    if (!serial) return;

    const selectedSalesmanObj = salesmen.find(s => s.id.toString() === selectedSalesmanId);
    if (!selectedSalesmanObj) {
      toast.error("Missing Salesman", { description: "Please select a Salesman before adding serials." });
      return;
    }

    const branchId = selectedSalesmanObj.branchId;
    if (!branchId) {
      toast.error("Branch Assignment", { description: "The selected salesman has no branch assigned." });
      return;
    }

    if (selectedRowIndex === null) {
      toast.warning("Selection Required", { description: "Please select a product row from the table before adding serial." });
      return;
    }

    const selectedRow = items[selectedRowIndex];
    if (!selectedRow) return;

    // 1. Session Check (Global within Modal)
    const isGlobalSessionDuplicate = items.some((item) => 
      item.serialNumbers?.some(sn => (typeof sn === "string" ? sn.toUpperCase() : sn.serialNumber.toUpperCase()) === serial)
    ) || Object.values(unregisteredSerialsMap).some(serials => serials.some(sn => sn.toUpperCase() === serial));
    if (isGlobalSessionDuplicate) {
      toast.error("Duplicate Serial", { description: `Serial "${serial}" is already added to this return session.` });
      return;
    }

    setIsValidatingSerial(true);

    try {
      // 2. Database Check (Already Returned)
      const dupCheck = await SalesReturnProvider.checkSerialDuplicate(serial);
      if (dupCheck.isDuplicate) {
        toast.error("Already Returned", { 
          description: `Serial "${serial}" was already returned in Transaction #${dupCheck.returnNo}` 
        });
        return;
      }

      const finalBranchId = Number(branchId) || 0;
      const result = await SalesReturnProvider.checkSerialOnHand(serial, finalBranchId, Number(selectedRow.productId || selectedRow.product_id));
      
      if (result && result.isOnInventory) {
        toast.error("Serial Number already in stock");
        return;
      }

      if (result && result.isUnregistered) {
        const rowTempId = selectedRow.tempId;
        if (rowTempId) {
          setUnregisteredSerialsMap((prev) => {
            const currentSerials = prev[rowTempId] || [];
            if (currentSerials.includes(serial)) return prev;
            return {
              ...prev,
              [rowTempId]: [...currentSerials, serial],
            };
          });
        }
        toast.info(`Serial ${serial} is unregistered. Please register it.`);
        return;
      }

      setItems((prev) => {
        // Final Session Check (Race Condition Protection)
        const exists = prev.some((item) => 
          item.serialNumbers?.some(sn => (typeof sn === "string" ? sn.toUpperCase() : sn.serialNumber.toUpperCase()) === serial)
        );
        if (exists) {
          toast.warning("Serial Number already added");
          return prev;
        }

        const next = [...prev];
        const row = next[selectedRowIndex];
        if (!row) return prev;

        const serialObj = {
          serialNumber: serial,
          cylinderCondition: "GOOD",
          tareWeight: 0,
          expirationDate: "",
          remarks: "",
        };

        const newSerials = [...(row.serialNumbers || []), serialObj];
        const newQty = newSerials.length;
        const unitPrice = Number(row.unitPrice) || 0;
        const grossAmount = Math.round(unitPrice * newQty * 100) / 100;
        
        let discountAmt = 0;
        if (row.discountType) {
          const opt = lineDiscountOptions.find(d => d.id.toString() === row.discountType?.toString());
          if (opt) {
            const percentage = parseFloat(opt.total_percent) || 0;
            discountAmt = Math.round(grossAmount * (percentage / 100) * 100) / 100;
          }
        }

        next[selectedRowIndex] = {
          ...row,
          serialNumbers: newSerials,
          quantity: newQty,
          grossAmount,
          discountAmount: discountAmt,
          totalAmount: Math.round((grossAmount - discountAmt) * 100) / 100,
        };
        return next;
      });

      toast.success("Serial Added", { description: `Serial ${serial} successfully tagged for ${items[selectedRowIndex].description}` });
    } catch (err: unknown) {
      toast.error("Validation Failed", { description: (err as Error).message || "An unexpected error occurred." });
    } finally {
      setIsValidatingSerial(false);
    }
  };

  // --- 5. INITIAL LOAD ---
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        setIsLoadingForm(true);
        try {
          const [
            salesmenData,
            customersData,
            branchesData,
            lineDiscountData,
            returnTypesData,
            priceTypesData,
          ] = await Promise.all([
            SalesReturnProvider.getFormSalesmen(),
            SalesReturnProvider.getFormCustomers(),
            SalesReturnProvider.getFormBranches(),
            SalesReturnProvider.getLineDiscounts(),
            SalesReturnProvider.getSalesReturnTypes(),
            SalesReturnProvider.getPriceTypes(),
          ]);
          setSalesmen(salesmenData);
          setCustomers(customersData);
          setBranches(branchesData);
          setLineDiscountOptions(lineDiscountData);
          setReturnTypeOptions(returnTypesData);
          setPriceTypeOptions(priceTypesData);
        } catch (error) {
          console.error("Failed to load form data", error);
        } finally {
          setIsLoadingForm(false);
        }
      };
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (items.length > 0) {
      setItems((prevItems) =>
        prevItems.map((item) => {
          const basePrice = resolvePrice(item, priceType);
          const newUnitPrice = basePrice;
          const newGross = Math.round(item.quantity * newUnitPrice * 100) / 100;
          let newDiscountAmt = 0;
          if (item.discountType) {
            const selectedOption = lineDiscountOptions.find(
              (d) => d.id.toString() === item.discountType?.toString(),
            );
            if (selectedOption) {
              const percentage = parseFloat(selectedOption.total_percent) || 0;
              newDiscountAmt = Math.round(newGross * (percentage / 100) * 100) / 100;
            }
          }
          return {
            ...item,
            unitPrice: newUnitPrice,
            grossAmount: newGross,
            discountAmount: newDiscountAmt,
            totalAmount: Math.round((newGross - newDiscountAmt) * 100) / 100,
          };
        })
      );
    }
  }, [priceType, lineDiscountOptions, items.length]);

  useEffect(() => {
    if (isOpen && fromClearance === "true" && customers.length > 0) {
      const storedData = localStorage.getItem('scm_dispatch_return_data');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          const foundCustomer = customers.find(c =>
            (data.customerCode && c.code === data.customerCode) ||
            (data.customerName && c.name === data.customerName)
          );
          if (foundCustomer) handleSelectCustomer(foundCustomer);
          const foundSalesman = salesmen.find(s =>
            (data.salesmanId && s.id === data.salesmanId) ||
            (data.salesmanCode && s.code === data.salesmanCode) ||
            (data.salesmanName && s.name === data.salesmanName)
          );
          if (foundSalesman) handleSelectSalesman(foundSalesman);
          setInvoiceNo(data.invoiceNo || "");
          setInvoiceSearch(data.invoiceNo || "");
          setOrderNo(data.orderNo || "");
          setOrderSearch(data.orderNo || "");
          setRemarks(data.remarks || "");
          if (data.branchName) setBranchName(data.branchName);
          localStorage.removeItem('scm_dispatch_return_data');
          const url = new URL(window.location.href);
          url.searchParams.delete('fromClearance');
          window.history.replaceState({}, '', url.toString());
        } catch (e) {
          console.error("Failed to parse clearance return data", e);
        }
      }
    }
  }, [isOpen, fromClearance, customers, salesmen, handleSelectCustomer, handleSelectSalesman]);

  useEffect(() => {
    if (selectedSalesmanId && customerCode) {
      const fetchInv = async () => {
        setIsLoadingInvoices(true);
        try {
          const data = await SalesReturnProvider.getInvoiceReturnList(
            selectedSalesmanId,
            customerCode,
          );
          setInvoiceOptions(data);
        } catch (error) {
          console.error("Failed to fetch invoices", error);
          setInvoiceOptions([]);
        } finally {
          setIsLoadingInvoices(false);
        }
      };
      fetchInv();
    } else {
      setInvoiceOptions([]);
    }
  }, [selectedSalesmanId, customerCode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (salesmanWrapperRef.current && !salesmanWrapperRef.current.contains(target)) {
        setIsSalesmanOpen(false);
        const found = salesmen.find((s) => s.id.toString() === selectedSalesmanId);
        if (found) setSalesmanSearch(found.name);
      }
      if (customerWrapperRef.current && !customerWrapperRef.current.contains(target)) {
        setIsCustomerOpen(false);
        const found = customers.find((c) => c.id.toString() === selectedCustomerId);
        if (found) setCustomerSearch(found.name);
      }
      if (invoiceWrapperRef.current && !invoiceWrapperRef.current.contains(target)) setIsInvoiceOpen(false);
      if (orderWrapperRef.current && !orderWrapperRef.current.contains(target)) setIsOrderOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSalesmanId, salesmen, selectedCustomerId, customers]);

  const resetForm = () => {
    setSalesmanError(false);
    setCustomerError(false);
    setItems([]);
    setReturnDate(new Date().toISOString().split("T")[0]);
    setSelectedSalesmanId("");
    setSalesmanSearch("");
    setSalesmanCode("");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setCustomerCode("");
    setBranchName("");
    setPriceType("A");
    setRemarks("");
    setOrderNo("");
    setInvoiceOptions([]);
    setUnregisteredSerialsMap({});
    setSelectedRowIndex(null);
    setProductSearch("");
    setSerialSearch("");
    setInvoiceSearch("");
    setOrderSearch("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const filteredSalesmen = salesmen.filter((s) => s.name.toLowerCase().includes(salesmanSearch.toLowerCase()));
  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  const filteredInvoices = invoiceOptions.filter((inv) => inv.invoice_no.toLowerCase().includes(invoiceSearch.toLowerCase()));
  const filteredOrders = invoiceOptions.filter((inv) => inv.order_id.toLowerCase().includes(orderSearch.toLowerCase()));

  const handleOpenProductLookup = () => {
    setSalesmanError(false);
    setCustomerError(false);
    if (!returnDate) { toast.error("Please select a Return Date."); return; }
    if (!selectedSalesmanId) {
      setSalesmanError(true);
      salesmanWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a Salesman.");
      return;
    }
    if (!selectedCustomerId) {
      setCustomerError(true);
      customerWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a Customer.");
      return;
    }
    setIsProductLookupOpen(true);
  };

  const handleCreateReturn = () => {
    setReturnTypeError(false);
    setOrderError(false);
    setInvoiceError(false);
    setSalesmanError(false);
    setCustomerError(false);

    if (!returnDate) { toast.error("Return Date is required."); return; }
    if (!selectedSalesmanId) {
      setSalesmanError(true);
      salesmanWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Salesman is required.");
      return;
    }
    if (!selectedCustomerId) {
      setCustomerError(true);
      customerWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Customer is required.");
      return;
    }
    if (items.length === 0) {
      productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please add at least one product.");
      return;
    }
    if (isBranchLockedError) { toast.error("Invalid Branch."); return; }
    if (!orderNo.trim()) {
      setOrderError(true);
      orderWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Order No. is required.");
      return;
    }
    if (!invoiceNo.trim()) {
      setInvoiceError(true);
      invoiceWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Invoice No. is required.");
      return;
    }

    const zeroQtyIndex = items.findIndex((item) => !item.quantity || item.quantity <= 0);
    if (zeroQtyIndex !== -1) {
      const zeroQtyCardEl = cardRefs.current.get(zeroQtyIndex);
      if (zeroQtyCardEl) {
        zeroQtyCardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSelectedRowIndex(zeroQtyIndex);
      toast.error("Item quantity is required.", { description: `"${items[zeroQtyIndex].description}" has no quantity. Please add at least one serial number.` });
      return;
    }

    const invalidItemIndex = items.findIndex((item) => !item.returnType || item.returnType === "");
    if (invalidItemIndex !== -1) {
      setReturnTypeError(true);
      const invalidCardEl = cardRefs.current.get(invalidItemIndex);
      if (invalidCardEl) {
        invalidCardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.error("Please select a Return Type for all items.");
      return;
    }

    // Success! Open confirmation modal before proceeding
    setIsCreateConfirmOpen(true);
  };

  const handleConfirmCreate = async () => {
    try {
      setIsSubmitting(true);
      setIsCreateConfirmOpen(false);
      const selectedSalesmanObj = salesmen.find((s) => s.id.toString() === selectedSalesmanId);
      const branchId = selectedSalesmanObj ? selectedSalesmanObj.branchId : null;

      const payload = {
        invoiceNo,
        orderNo,
        customerCode: customerCode,
        salesmanId: Number(selectedSalesmanId),
        salesmanCode: salesmanCode,
        branchId: branchId ?? undefined,
        isThirdParty,
        totalAmount: totalNet,
        returnDate,
        priceType,
        remarks,
        items: items,
        appliedInvoiceId: appliedInvoiceId,
      };

      await SalesReturnProvider.submitReturn(payload);
      toast.success("Transaction Success", { description: "Sales return record has been successfully created." });
      setSuccessOpen(true);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Submission Failed", { description: (err as Error).message || "An error occurred while creating the sales return." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalize = () => {
    setSuccessOpen(false);
    if (onSuccess) onSuccess();
    handleClose();
  };

  const handleAddProducts = (newItems: Partial<SalesReturnItem>[]) => {
    setItems(() => {
      return newItems.map((item) => {
        const rawId = item.product_id || item.productId || item.id;
        const productId = Number(rawId);
        const unit = item.unit || "Pcs";
        const unitPrice = Math.round(Number(item.unitPrice || 0) * 100) / 100;
        
        const isSerialized = item.isSerialized === 1 || item.isSerialized === true;
        const quantity = 0;
        const grossAmount = 0;
        
        let discAmt = 0;
        if (item.discountType) {
          const opt = lineDiscountOptions.find((d) => d.id.toString() === item.discountType?.toString());
          if (opt) discAmt = Math.round(grossAmount * (parseFloat(opt.total_percent) / 100) * 100) / 100;
        }
        
        return {
          ...item,
          productId,
          code: item.code || "N/A",
          description: item.description || "Unknown Item",
          unit,
          quantity,
          unitPrice,
          grossAmount,
          discountType: item.discountType || "",
          discountAmount: discAmt,
          totalAmount: Math.round((grossAmount - discAmt) * 100) / 100,
          reason: item.reason || "",
          returnType: item.returnType || "",
          serialNumbers: item.serialNumbers || [],
          isSerialized: isSerialized,
        } as SalesReturnItem;
      });
    });
  };

  const handleItemChange = (index: number, field: keyof SalesReturnItem, value: SalesReturnItem[keyof SalesReturnItem]) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value } as SalesReturnItem;
      if (field === "quantity" || field === "unitPrice") {
        item.grossAmount = Math.round(item.quantity * item.unitPrice * 100) / 100;
        if (item.discountType) {
          const opt = lineDiscountOptions.find(d => d.id.toString() === item.discountType?.toString());
          if (opt) item.discountAmount = Math.round(item.grossAmount * (parseFloat(opt.total_percent) / 100) * 100) / 100;
        }
      }
      if (field === "discountType") {
        if (!value) { item.discountAmount = 0; }
        else {
          const opt = lineDiscountOptions.find(d => d.id.toString() === value.toString());
          if (opt) item.discountAmount = Math.round(item.grossAmount * (parseFloat(opt.total_percent) / 100) * 100) / 100;
        }
      }
      item.totalAmount = Math.round((item.grossAmount - item.discountAmount) * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  const totalGross = Math.round(items.reduce((sum, i) => sum + (i.grossAmount || 0), 0) * 100) / 100;
  const totalDiscount = Math.round(items.reduce((sum, i) => sum + (i.discountAmount || 0), 0) * 100) / 100;
  const totalNet = Math.round(items.reduce((sum, i) => sum + i.totalAmount, 0) * 100) / 100;

  const activeTempId = (selectedRowIndex !== null && items[selectedRowIndex]?.tempId) || "";
  const currentUnregisteredSerials = activeTempId ? (unregisteredSerialsMap[activeTempId] || []) : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-300">
      <div className="bg-background w-full h-full md:max-w-[1300px] md:h-[95vh] md:rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-300 ease-out">
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Create Sales Return</h2>
              <p className="text-xs text-muted-foreground">Fill in the details below to process a return</p>
            </div>
          </div>
          <button onClick={handleClose} className="bg-destructive hover:bg-destructive text-white p-2 rounded-md shadow-sm transition-all duration-200 active:scale-95 flex items-center justify-center"><X className="h-5 w-5" /></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="bg-background p-5 rounded-lg border border-border shadow-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-lg"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <div className="space-y-1.5 relative" ref={salesmanWrapperRef}>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Salesman <span className="text-destructive">*</span></label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                    <input
                      type="text"
                      className={cn(
                        "w-full h-9 border rounded-md text-sm pl-9 pr-8 bg-background outline-none focus:ring-2 shadow-sm",
                        salesmanError
                          ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                          : "border-border focus:border-primary"
                      )}
                      placeholder="Search Salesman..."
                      value={salesmanSearch}
                      onChange={e => { setSalesmanSearch(e.target.value); setIsSalesmanOpen(true); }}
                      onFocus={() => setIsSalesmanOpen(true)}
                    />
                    <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
                {isSalesmanOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 w-full z-20 bg-background border border-border rounded-md shadow-xl max-h-60 overflow-y-auto font-medium">
                    {filteredSalesmen.map(s => <div key={s.id} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary/10 text-foreground" onClick={() => handleSelectSalesman(s)}>{s.name}</div>)}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Salesman Code</label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <div className="h-9 w-full bg-muted/20 border border-border rounded-md px-3 flex items-center text-sm font-medium text-foreground italic shadow-sm">{salesmanCode || "-"}</div>
                )}
              </div>
              <div className="space-y-1.5 relative" ref={customerWrapperRef}>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Customer <span className="text-destructive">*</span></label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                    <input
                      type="text"
                      className={cn(
                        "w-full h-9 border rounded-md text-sm pl-9 pr-8 bg-background outline-none focus:ring-2 shadow-sm",
                        customerError
                          ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                          : "border-border focus:border-primary"
                      )}
                      placeholder="Search Customer..."
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setIsCustomerOpen(true); }}
                      onFocus={() => setIsCustomerOpen(true)}
                    />
                    <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
                {isCustomerOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 w-full z-20 bg-background border border-border rounded-md shadow-xl max-h-60 overflow-y-auto font-medium">
                    {filteredCustomers.map(c => <div key={c.id} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary/10 text-foreground" onClick={() => handleSelectCustomer(c)}><div className="flex flex-col"><span>{c.name}</span><span className="text-[10px] text-muted-foreground font-mono">{c.code}</span></div></div>)}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Customer Code</label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <div className="h-9 w-full bg-muted/20 border border-border rounded-md px-3 flex items-center text-sm font-medium text-foreground italic shadow-sm">{customerCode || "-"}</div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Branch</label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <div className="h-9 w-full bg-muted/20 border border-border rounded-md px-3 flex items-center text-sm font-medium text-foreground italic shadow-sm overflow-hidden" title={branchName || "-"}>
                    <span className="truncate">{branchName || "-"}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Return Date <span className="text-destructive">*</span></label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="h-9 w-full bg-background border-border shadow-sm text-sm" />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Received Date</label>
                <div className="h-9 w-full bg-muted/20 border border-border rounded-md px-3 flex items-center text-sm font-medium text-muted-foreground italic shadow-sm opacity-60 overflow-hidden" title="Auto-generated">
                  <span className="truncate">(Auto-generated)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Price Type <span className="text-destructive">*</span></label>
                {isLoadingForm ? (
                  <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                ) : (
                  <Select value={priceType} onValueChange={setPriceType}>
                    <SelectTrigger className="w-full h-9 border-border bg-background shadow-sm text-sm"><SelectValue placeholder="Select Price Type" /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {priceTypeOptions.map(pt => <SelectItem key={pt.price_type_id} value={pt.price_type_name}>Type {pt.price_type_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center space-x-2 pt-2 col-span-1 sm:col-span-2 lg:col-span-4 translate-y-2">
                <Checkbox id="create-isThirdParty" checked={isThirdParty} onCheckedChange={c => setIsThirdParty(c as boolean)} className="data-[state=checked]:bg-primary border-border" />
                <label htmlFor="create-isThirdParty" className="text-sm font-medium text-foreground cursor-pointer select-none">Third Party Transaction</label>
              </div>
            </div>
          </div>

          <div ref={productsSectionRef} className="bg-background rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-5 py-4 bg-background border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2"><div className="bg-primary/10 p-1.5 rounded text-primary"><Calculator className="h-4 w-4" /></div>Products Summary <Badge variant="outline" className="ml-1 text-xs font-bold">{items.length}</Badge></h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    className="h-9 pl-9 pr-3 w-full sm:w-48 text-sm border-border"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      // Auto-scroll to first match
                      if (e.target.value.trim()) {
                        const query = e.target.value.toLowerCase();
                        const matchIdx = items.findIndex(item =>
                          item.description.toLowerCase().includes(query) ||
                          item.code.toLowerCase().includes(query)
                        );
                        if (matchIdx !== -1) {
                          const el = cardRefs.current.get(matchIdx);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }
                    }}
                  />
                </div>
                <Button size="sm" onClick={handleOpenProductLookup} className="bg-primary hover:bg-primary text-white shadow-primary/20 shadow-md h-9 shrink-0"><Plus className="h-4 w-4 mr-1.5" /> Add Product</Button>
                {isBranchLockedError && <Button size="sm" variant="destructive" onClick={handleClearItems} className="shadow-md h-9 gap-2 shrink-0">Clear All Items</Button>}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-3 bg-muted/20">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No items added yet.</p>
                  <span className="text-xs text-muted-foreground">Click &ldquo;Add Product&rdquo; to browse catalog.</span>
                </div>
              ) : items.map((item, idx) => {
                const isSearchMatch = productSearch.trim() !== "" && (
                  item.description.toLowerCase().includes(productSearch.toLowerCase()) ||
                  item.code.toLowerCase().includes(productSearch.toLowerCase())
                );
                return (
                  <div
                    key={idx}
                    ref={(el) => { if (el) cardRefs.current.set(idx, el); else cardRefs.current.delete(idx); }}
                    onClick={() => setSelectedRowIndex(idx)}
                    className={cn(
                      "bg-background border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group",
                      selectedRowIndex === idx && "ring-2 ring-primary border-primary",
                      isSearchMatch && selectedRowIndex !== idx && "ring-2 ring-amber-400/60 border-amber-400 bg-amber-50/10",
                      returnTypeError && (!item.returnType || item.returnType === "") && "ring-2 ring-destructive border-destructive",
                      !isSearchMatch && selectedRowIndex !== idx && "border-border"
                    )}
                  >
                    {/* Main Grid: Columns 1 to 5 */}
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Column 1: Product Name & Code */}
                      <div className="col-span-12 md:col-span-4 min-w-0">
                        <div className="flex items-start gap-2">
                          {selectedRowIndex === idx ? (
                            <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)] animate-pulse shrink-0" />
                          ) : (
                            <div className="w-2 h-2 mt-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{item.description}</h4>
                            <span className="text-[11px] text-muted-foreground font-mono">Code: {item.code}</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Quantity & Unit */}
                      <div className="col-span-4 md:col-span-2 flex flex-col items-center justify-center gap-1">
                        <Badge variant="outline" className="font-bold min-w-[40px] flex justify-center border-primary/40 bg-primary/10 text-primary shadow-sm">
                          {item.quantity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">({item.unit})</span>
                      </div>

                      {/* Column 3: Gross, Disc Type, Disc Amount */}
                      <div className="col-span-8 md:col-span-3 flex flex-col items-start text-left gap-1">
                        <span className="text-xs text-muted-foreground">Gross: <span className="font-mono font-semibold">₱{item.grossAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground">Disc:</span>
                          <span className="text-xs text-destructive font-mono font-semibold">-₱{item.discountAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <SearchableSelect
                            value={item.discountType?.toString() || "none"}
                            onValueChange={val => handleItemChange(idx, "discountType", val === "none" ? "" : val)}
                            options={[{ value: "none", label: "None" }, ...lineDiscountOptions.map(opt => ({ value: opt.id.toString(), label: opt.discount_type }))]}
                            placeholder="Disc"
                            className="h-6 w-20 px-1.5 text-[10px] border-border bg-background"
                          />
                        </div>
                      </div>

                      {/* Column 4: Net Amount */}
                      <div className="col-span-10 md:col-span-2 text-right md:pl-3 md:border-l border-border flex flex-col items-end">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Net Amount</span>
                        <span className="text-base font-bold text-foreground tabular-nums">₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      {/* Column 5: Trash (Delete) */}
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); setItems(prev => prev.filter((_, i) => i !== idx)); if (selectedRowIndex === idx) setSelectedRowIndex(null); }}
                          className="bg-destructive/10 hover:bg-destructive text-destructive hover:text-white h-8 w-8 rounded-md flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Section: Return Type + Reason */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 pt-3 border-t border-border">
                      <div className="md:col-span-5 flex items-center gap-2 w-full">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Return Type:</span>
                        <SearchableSelect
                          value={item.returnType || ""}
                          onValueChange={val => { handleItemChange(idx, "returnType", val); setReturnTypeError(false); }}
                          options={returnTypeOptions.map(t => ({ value: t.type_name, label: t.type_name }))}
                          placeholder="Select type"
                          className={cn("h-8 text-sm px-2 flex-1", returnTypeError && (!item.returnType || item.returnType === "") && "border-destructive ring-1 ring-destructive/30 bg-destructive/5 text-destructive")}
                        />
                      </div>
                      <div className="md:col-span-7 flex items-center gap-2 w-full">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Reason:</span>
                        <div className="flex-1">
                          <ReasonInputSection value={item.reason || ""} onChange={val => handleItemChange(idx, "reason", val)} />
                        </div>
                      </div>
                    </div>

                    {/* Serial Management Collapsible */}
                    {selectedRowIndex === idx && (
                      <div onClick={e => e.stopPropagation()} className="mt-4 pt-4 border-t border-primary/25 bg-background rounded-lg border-2 border-primary/20 shadow-sm p-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Unregistered Serials Alert Banner */}
                        {currentUnregisteredSerials.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-amber-500 rounded-lg text-white font-bold text-xs shrink-0">
                                ⚠️
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-amber-900 dark:text-amber-400">{currentUnregisteredSerials.length} UNREGISTERED SERIALS</h5>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {currentUnregisteredSerials.map((sn: string) => (
                                    <Badge key={sn} variant="outline" className="bg-amber-100/80 border-amber-300 text-amber-800 flex items-center gap-1 py-0.5 px-2 font-mono text-[10px]">
                                      {sn}
                                      <X className="h-3 w-3 cursor-pointer text-amber-600 hover:text-amber-900" onClick={() => {
                                        const rowTempId = item.tempId;
                                        if (rowTempId) {
                                          const key = rowTempId;
                                          setUnregisteredSerialsMap(prev => {
                                            const currentSerials = prev[key] || [];
                                            return {
                                              ...prev,
                                              [key]: currentSerials.filter(s => s !== sn)
                                            };
                                          });
                                        }
                                      }} />
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <Button onClick={() => setIsBulkRegisterOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-9 px-4 shrink-0">
                              REGISTER ALL
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                          <h4 className="font-bold text-foreground flex items-center gap-2 text-base shrink-0"><div className="bg-emerald-500/10 p-1.5 rounded text-emerald-600"><ScanLine className="h-5 w-5" /></div>Serial Management</h4>
                          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            {/* Serial Search Input */}
                            <div className="relative w-full sm:w-48">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search serials..."
                                className="h-8 pl-9 pr-3 text-xs border-border bg-background"
                                value={serialSearch}
                                onChange={(e) => setSerialSearch(e.target.value)}
                              />
                            </div>
                            <SerialInputSection onAdd={(serial) => handleAddSerial(serial)} disabled={isValidatingSerial} />
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 font-bold shrink-0">{item.serialNumbers?.length || 0} TOTAL</Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-40 overflow-y-auto p-1">
                          {(item.serialNumbers || [])
                            .filter(sobj => {
                              const sn = typeof sobj === "string" ? sobj : sobj.serialNumber;
                              return sn.toLowerCase().includes(serialSearch.toLowerCase());
                            })
                            .map(sobj => {
                              const sn = typeof sobj === "string" ? sobj : sobj.serialNumber;
                              return (
                                <div key={sn} className="flex items-center justify-between bg-muted/20 border border-border px-3 py-2 rounded-md hover:border-primary/30 transition-all group hover:shadow-sm">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-mono font-bold text-foreground truncate">{sn}</span>
                                    {typeof sobj !== "string" && sobj.cylinderCondition && (
                                      <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{sobj.cylinderCondition}</span>
                                    )}
                                  </div>
                                  <button onClick={() => {
                                    setItems(prev => {
                                      const next = [...prev];
                                      const row = next[idx];
                                      const newSerials = row.serialNumbers!.filter(s => {
                                        const sVal = typeof s === "string" ? s : s.serialNumber;
                                        return sVal !== sn;
                                      });
                                      const newQty = newSerials.length;
                                      const gross = Math.round(row.unitPrice * newQty * 100) / 100;
                                      let discAmt = 0;
                                      if (row.discountType) {
                                        const opt = lineDiscountOptions.find(d => d.id.toString() === row.discountType?.toString());
                                        if (opt) discAmt = Math.round(gross * (parseFloat(opt.total_percent) / 100) * 100) / 100;
                                      }
                                      next[idx] = { 
                                        ...row, 
                                        serialNumbers: newSerials, 
                                        quantity: newQty, 
                                        grossAmount: gross, 
                                        discountAmount: discAmt, 
                                        totalAmount: Math.round((gross - discAmt) * 100) / 100 
                                      };
                                      return next;
                                    });
                                  }} className="p-1 text-destructive/50 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                                </div>
                              );
                            })}
                          {(item.serialNumbers || []).filter(sobj => {
                            const sn = typeof sobj === "string" ? sobj : sobj.serialNumber;
                            return sn.toLowerCase().includes(serialSearch.toLowerCase());
                          }).length === 0 && (
                            <div className="col-span-full py-8 text-center border border-dashed rounded-lg text-muted-foreground italic">
                              {serialSearch ? "No matching serial numbers found." : "No serial numbers entered yet."}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            <div className="space-y-4 bg-background p-5 rounded-lg border border-border shadow-sm h-full">
              <h4 className="font-bold text-foreground text-sm mb-2">Additional Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5" ref={orderWrapperRef}>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Order No. <span className="text-destructive">*</span></label>
                  {isLoadingInvoices ? (
                    <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                  ) : (
                    <div className="relative group">
                      <input type="text" className={cn("w-full h-9 border rounded-md text-sm px-3 pr-8 bg-background outline-none transition-all shadow-sm", orderError ? "border-destructive bg-destructive/5 ring-1 ring-destructive" : "border-border focus:ring-2 focus:border-primary")} placeholder="Search Order No..." value={orderSearch || orderNo} onChange={e => { setOrderSearch(e.target.value); setOrderNo(e.target.value); setIsOrderOpen(true); }} onFocus={() => setIsOrderOpen(true)} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      {isOrderOpen && (
                        <div className="absolute bottom-[calc(100%+4px)] left-0 w-full z-50 bg-background border border-border rounded-md shadow-xl max-h-48 overflow-y-auto divide-y">
                          <div className="px-3 py-2 text-xs font-medium cursor-pointer hover:bg-destructive/10 text-destructive flex items-center gap-2" onClick={() => { setOrderNo(""); setOrderSearch(""); setAppliedInvoiceId(null); setIsOrderOpen(false); }}><X className="h-3 w-3" /> Clear Selection</div>
                          {filteredOrders.map(inv => <div key={inv.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 text-foreground" onClick={() => { setOrderNo(inv.order_id); setOrderSearch(inv.order_id); setInvoiceNo(inv.invoice_no); setInvoiceSearch(inv.invoice_no); setAppliedInvoiceId(Number(inv.id)); setIsOrderOpen(false); }}><div className="flex flex-col"><span className="font-medium">{inv.order_id}</span><span className="text-[10px] text-muted-foreground">Invoice: {inv.invoice_no}</span></div></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5" ref={invoiceWrapperRef}>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Invoice No. <span className="text-destructive">*</span></label>
                  {isLoadingInvoices ? (
                    <div className="h-9 w-full bg-muted animate-pulse rounded-md border border-border"></div>
                  ) : (
                    <div className="relative group">
                      <input type="text" className={cn("w-full h-9 border rounded-md text-sm px-3 pr-8 bg-background outline-none transition-all shadow-sm", invoiceError ? "border-destructive bg-destructive/5 ring-1 ring-destructive" : "border-border focus:ring-2 focus:border-primary")} placeholder="Search Invoice No..." value={invoiceSearch || invoiceNo} onChange={e => { setInvoiceSearch(e.target.value); setInvoiceNo(e.target.value); setIsInvoiceOpen(true); }} onFocus={() => setIsInvoiceOpen(true)} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      {isInvoiceOpen && (
                        <div className="absolute bottom-[calc(100%+4px)] left-0 w-full z-50 bg-background border border-border rounded-md shadow-xl max-h-48 overflow-y-auto divide-y">
                          <div className="px-3 py-2 text-xs font-medium cursor-pointer hover:bg-destructive/10 text-destructive flex items-center gap-2" onClick={() => { setInvoiceNo(""); setInvoiceSearch(""); setAppliedInvoiceId(null); setIsInvoiceOpen(false); }}><X className="h-3 w-3" /> Clear Selection</div>
                          {filteredInvoices.map(inv => <div key={inv.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 text-foreground" onClick={() => { setInvoiceNo(inv.invoice_no); setInvoiceSearch(inv.invoice_no); setOrderNo(inv.order_id); setOrderSearch(inv.order_id); setAppliedInvoiceId(Number(inv.id)); setIsInvoiceOpen(false); }}><div className="flex flex-col"><span className="font-medium">{inv.invoice_no}</span><span className="text-[10px] text-muted-foreground">Order: {inv.order_id}</span></div></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Remarks</label><RemarksInputSection value={remarks} onChange={setRemarks} /></div>
            </div>

            <div className="bg-background rounded-lg border border-border p-0 shadow-sm overflow-hidden h-fit">
              <div className="p-4 bg-muted/30 border-b border-border"><h4 className="font-bold text-foreground">Financial Summary</h4></div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center text-sm text-muted-foreground"><span>Total Gross Amount</span><span className="font-medium text-foreground tabular-nums">₱{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between items-center text-sm text-destructive"><span>Total Discount</span><span className="font-medium tabular-nums">- ₱{totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="h-px bg-border my-2"></div>
                <div className="flex justify-between items-center"><span className="font-black text-foreground">Total Net Amount</span><span className="text-2xl font-black text-primary tabular-nums">₱{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-background flex justify-between items-center">
          <Button variant="outline" onClick={handleClose} className="h-10 px-6 font-semibold border-border hover:bg-muted transition-colors">Cancel</Button>
          <div className="flex items-center gap-3">
            <Button onClick={handleCreateReturn} disabled={isSubmitting} className="h-11 px-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2">{isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : <><Save className="h-5 w-5" /> Process Sales Return</>}</Button>
          </div>
        </div>
      </div>

      <ProductLookupModal isOpen={isProductLookupOpen} onClose={() => setIsProductLookupOpen(false)} onConfirm={handleAddProducts} preselectedItems={items} priceType={priceType} customerCode={customerCode} />

      <BulkRegisterModal
        open={isBulkRegisterOpen}
        onOpenChange={setIsBulkRegisterOpen}
        serials={currentUnregisteredSerials}
        productId={selectedRowIndex !== null ? Number(items[selectedRowIndex]?.productId || items[selectedRowIndex]?.product_id || 0) : 0}
        branchId={Number(currentBranchId || lockedBranchId || 0)}
        onSuccess={(registeredSerials) => {
          setItems((prev) => {
            const idx = selectedRowIndex;
            if (idx === null) return prev;
            const next = [...prev];
            const row = next[idx];
            if (!row) return prev;
            
            const newSerials = [...(row.serialNumbers || []), ...registeredSerials];
            const newQty = newSerials.length;
            const unitPrice = Number(row.unitPrice) || 0;
            const grossAmount = Math.round(unitPrice * newQty * 100) / 100;
            
            let discountAmt = 0;
            if (row.discountType) {
              const opt = lineDiscountOptions.find(d => d.id.toString() === row.discountType?.toString());
              if (opt) discountAmt = Math.round(grossAmount * (parseFloat(opt.total_percent) / 100) * 100) / 100;
            }
            
            next[idx] = {
              ...row,
              serialNumbers: newSerials,
              quantity: newQty,
              grossAmount,
              discountAmount: discountAmt,
              totalAmount: Math.round((grossAmount - discountAmt) * 100) / 100,
            };
            return next;
          });
          const rowTempId = selectedRowIndex !== null ? items[selectedRowIndex]?.tempId : null;
          if (rowTempId) {
            setUnregisteredSerialsMap((prev) => {
              const nextMap = { ...prev };
              delete nextMap[rowTempId];
              return nextMap;
            });
          }
          toast.success("All cylinders registered and added to list");
        }}
      />

      <Dialog open={isCreateConfirmOpen} onOpenChange={setIsCreateConfirmOpen}>
        <DialogContent className="max-w-[400px] text-center p-8 bg-background border-border rounded-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-primary/10 p-4 rounded-full text-primary animate-pulse"><Save className="h-12 w-12" /></div>
            <DialogTitle className="text-2xl font-bold text-foreground">Confirm Process</DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">Are you sure you want to process this sales return? This action will update inventory.</p>
            <div className="grid grid-cols-2 gap-3 w-full mt-4">
              <Button variant="outline" onClick={() => setIsCreateConfirmOpen(false)} className="h-11 font-semibold">Cancel</Button>
              <Button onClick={handleConfirmCreate} disabled={isSubmitting} className="h-11 bg-primary hover:bg-primary/90 text-white font-bold">{isSubmitting ? "Processing..." : "Confirm & Process"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-[400px] text-center p-8 bg-background border-border rounded-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-emerald-100 dark:bg-emerald-500/10 p-4 rounded-full text-emerald-600 dark:text-emerald-400 animate-bounce"><CheckCircle className="h-12 w-12" /></div>
            <DialogTitle className="text-2xl font-bold text-foreground">Return Created!</DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">The sales return has been successfully recorded in the system inventory.</p>
            <Button onClick={handleFinalize} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 mt-2">Close & Finish</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
