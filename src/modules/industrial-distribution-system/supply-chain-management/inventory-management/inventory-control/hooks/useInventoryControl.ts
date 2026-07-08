// src/modules/.../inventory-control/hooks/useInventoryControl.ts
"use client";

import { useCallback, useRef, useState } from "react";
import {
  fetchBranches,
  fetchCategories,
  fetchProducts,
  fetchSerialOnhand,
} from "../providers/fetchprovider";
import {
  computeSummary,
  enrichSerials,
  groupByCategory,
} from "../utils/grouping";
import type {
  BranchInfo,
  CategoryGroup,
  EnrichedSerial,
  InventorySummary,
  PrintOptions,
  ProductGroup,
  ViewMode,
} from "../type";

interface UseInventoryControlReturn {
  // Branch
  branches: BranchInfo[];
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number | null) => void;

  // Data
  categoryGroups: CategoryGroup[];
  summary: InventorySummary;
  loading: boolean;
  error: string | null;

  // Modal
  selectedProduct: ProductGroup | null;
  openModal: (product: ProductGroup, filter?: "available" | "empty") => void;
  initialStockFilter: "available" | "empty" | null;
  closeModal: () => void;

  // View within modal
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredSerials: EnrichedSerial[];

  // Print
  printOptions: PrintOptions;
  setPrintOptions: (opts: Partial<PrintOptions>) => void;
  showPrintOptions: boolean;
  setShowPrintOptions: (v: boolean) => void;
  printRef: React.RefObject<HTMLDivElement | null>;

  // Actions
  loadData: (branchId: number) => Promise<void>;
  initBranches: () => Promise<void>;
}

const DEFAULT_SUMMARY: InventorySummary = {
  totalProducts: 0,
  totalFull: 0,
  totalEmpty: 0,
  grandTotal: 0,
};

const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  mode: "serial",
  paperSize: "A4",
  orientation: "portrait",
  columns: 3,
  cardDisplay: {
    showBarcodeNumber: true,
    showSerialNumber: true,
    showProductName: true,
    showStatusBadge: false,
  },
};

export function useInventoryControl(): UseInventoryControlReturn {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(
    196,
  );

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [summary, setSummary] = useState<InventorySummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductGroup | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("serial");
  const [searchQuery, setSearchQuery] = useState("");

  const [printOptions, setPrintOptionsState] = useState<PrintOptions>(
    DEFAULT_PRINT_OPTIONS,
  );
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const initBranches = useCallback(async () => {
    try {
      const data = await fetchBranches();
      setBranches(data);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  }, []);

  const loadData = useCallback(async (branchId: number) => {
    setLoading(true);
    setError(null);
    setCategoryGroups([]);
    setSummary(DEFAULT_SUMMARY);

    try {
      const [serials, products, categories] = await Promise.all([
        fetchSerialOnhand(branchId),
        fetchProducts(),
        fetchCategories(),
      ]);

      const enriched = enrichSerials(serials, products, categories);
      const groups = groupByCategory(enriched);
      const kpis = computeSummary(groups);

      setCategoryGroups(groups);
      setSummary(kpis);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load inventory data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const setSelectedBranchId = useCallback(
    (id: number | null) => {
      setSelectedBranchIdState(id);
      if (id !== null) {
        loadData(id);
      }
    },
    [loadData],
  );

  const [initialStockFilter, setInitialStockFilter] = useState<
    "available" | "empty" | null
  >(null);

  const openModal = useCallback(
    (product: ProductGroup, filter?: "available" | "empty") => {
      setSelectedProduct(product);
      setViewMode("serial");
      // Do not clear the search query when opening the modal — preserve current filter
      setShowPrintOptions(false);
      setInitialStockFilter(filter ?? null);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setSelectedProduct(null);
    setSearchQuery("");
    setShowPrintOptions(false);
  }, []);

  const setPrintOptions = useCallback((opts: Partial<PrintOptions>) => {
    setPrintOptionsState((prev) => ({ ...prev, ...opts }));
  }, []);

  // Client-side search filtering
  // Dev-rule: Modal searchbar filters by serials only as per instructions
  const filteredSerials: EnrichedSerial[] = selectedProduct
    ? selectedProduct.serials.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return s.serialNumber.toLowerCase().includes(q);
    })
    : [];

  return {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    categoryGroups,
    summary,
    loading,
    error,
    selectedProduct,
    openModal,
    initialStockFilter,
    closeModal,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filteredSerials,
    printOptions,
    setPrintOptions,
    showPrintOptions,
    setShowPrintOptions,
    printRef,
    loadData,
    initBranches,
  };
}
