// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderDepositSwapFilters.tsx
// ==============================================================================
// Multi-dimensional Filter Bar for Cylinder Deposit and Swap Report.
// Enhanced with Shadcn SearchableSelect comboboxes for:
// - Branch: Filters by active branches (isActive = 1)
// - Product / Size: Filters by serialized products (is_serialized = 1), displaying description
// - Customer: Searchable commercial & retail accounts
// - Ownership filter removed as per user instruction
// - Date range with cutoff parameters
// Includes client-side caching to prevent unnecessary Directus re-fetches.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Filter, RotateCcw, Calendar, Building2, User, Package } from "lucide-react";
// AG-COMMENT: Replaced generic select with SmoothSearchableSelect featuring Framer Motion
// transitions, smooth chevron rotation, and search filtering
import { SmoothSearchableSelect } from "./SmoothSearchableSelect";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";

export function CylinderDepositSwapFilters() {
  const { filters, setFilters, lookups, isLoading } = useCylinderDepositSwapReport();

  // Temporary local draft state for responsive input before committing via Apply button
  const [localStartDate, setLocalStartDate] = React.useState(filters.startDate);
  const [localEndDate, setLocalEndDate] = React.useState(filters.endDate);
  const [localBranchId, setLocalBranchId] = React.useState<number | "">(filters.branchId || "");
  const [localCustomerCode, setLocalCustomerCode] = React.useState(filters.customerCode || "");
  const [localProductId, setLocalProductId] = React.useState<number | "">(filters.productId || "");

  // Keep local draft in sync if external filters change
  React.useEffect(() => {
    setLocalStartDate(filters.startDate);
    setLocalEndDate(filters.endDate);
    setLocalBranchId(filters.branchId || "");
    setLocalCustomerCode(filters.customerCode || "");
    setLocalProductId(filters.productId || "");
  }, [filters]);

  // AG-COMMENT: Strictly filter dropdown options to Industrial Division branches (division_id = 1).
  // Excludes non-industrial branches (e.g., CENTRAL PANGASINAN CHARIOT - 3, BENGUET-VAN, etc.).
  const INDUSTRIAL_BRANCH_IDS = React.useMemo(() => new Set(["196", "197", "278", "279", "280"]), []);

  // Memoized SearchableSelect Options
  // 1. Branch Options (Only active Industrial Division branches)
  const branchOptions = React.useMemo(() => {
    const validBranches = (lookups?.branches || []).filter((b) => {
      if (b.division_id != null && (b.division_id as unknown) !== "") {
        return Number(b.division_id) === 1;
      }
      return INDUSTRIAL_BRANCH_IDS.has(String(b.id));
    });

    return [
      { value: "all", label: "All Branches" },
      ...validBranches.map((b) => ({
        value: String(b.id),
        label: b.branch_name,
      })),
    ];
  }, [lookups?.branches, INDUSTRIAL_BRANCH_IDS]);

  // 2. Product Options (Serialized products only, displaying description instead of product_name)
  const productOptions = React.useMemo(() => {
    return [
      { value: "all", label: "All Products" },
      ...(lookups?.products || []).map((p) => {
        const displayLabel = p.description?.trim() ? p.description : p.product_name;
        return {
          value: String(p.product_id),
          label: displayLabel,
        };
      }),
    ];
  }, [lookups?.products]);

  // 3. Customer Options (Searchable accounts)
  const customerOptions = React.useMemo(() => {
    return [
      { value: "all", label: "All Customers" },
      ...(lookups?.customers || []).map((c) => ({
        value: c.customer_code,
        label: `${c.customer_name}${c.store_name ? ` (${c.store_name})` : ""}`,
      })),
    ];
  }, [lookups?.customers]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({
      ...prev,
      startDate: localStartDate,
      endDate: localEndDate,
      branchId: localBranchId,
      customerCode: localCustomerCode || undefined,
      productId: localProductId,
    }));
  };

  const handleReset = () => {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const defaultEnd = now.toISOString().split("T")[0];

    setLocalStartDate(defaultStart);
    setLocalEndDate(defaultEnd);
    setLocalBranchId("");
    setLocalCustomerCode("");
    setLocalProductId("");

    setFilters((prev) => ({
      ...prev,
      startDate: defaultStart,
      endDate: defaultEnd,
      branchId: "",
      customerCode: undefined,
      productId: "",
    }));
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleApply}
      className="rounded-xl border bg-card p-4 shadow-2xs transition-all text-card-foreground"
    >
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" />
          <span>Report Parameters & Cutoff Filters</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 items-end">
        {/* Start Date */}
        <div className="lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Start Date</span>
          </label>
          <input
            type="date"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring h-[32px]"
            required
          />
        </div>

        {/* End Date */}
        <div className="lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>End Date</span>
          </label>
          <input
            type="date"
            value={localEndDate}
            onChange={(e) => setLocalEndDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring h-[32px]"
            required
          />
        </div>

        {/* Branch (Searchable Shadcn UI) */}
        <div className="lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>Branch</span>
          </label>
          <SmoothSearchableSelect
            options={branchOptions}
            value={localBranchId === "" ? "all" : String(localBranchId)}
            onValueChange={(val) => setLocalBranchId(val === "all" ? "" : Number(val))}
            placeholder="All Branches"
            className="h-[32px] text-xs font-normal border-input bg-background shadow-xs justify-between truncate"
          />
        </div>

        {/* Customer Lookup (Searchable Shadcn UI) */}
        <div className="lg:col-span-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>Customer</span>
          </label>
          <SmoothSearchableSelect
            options={customerOptions}
            value={localCustomerCode ? localCustomerCode : "all"}
            onValueChange={(val) => setLocalCustomerCode(val === "all" ? "" : val)}
            placeholder="All Customers"
            className="h-[32px] text-xs font-normal border-input bg-background shadow-xs justify-between truncate"
          />
        </div>

        {/* Product / Size (Searchable Shadcn UI with description display) */}
        <div className="lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            <span>Product / Size</span>
          </label>
          <SmoothSearchableSelect
            options={productOptions}
            value={localProductId === "" ? "all" : String(localProductId)}
            onValueChange={(val) => setLocalProductId(val === "all" ? "" : Number(val))}
            placeholder="All Products"
            className="h-[32px] text-xs font-normal border-input bg-background shadow-xs justify-between truncate"
          />
        </div>

        {/* Apply Action Button */}
        <div className="lg:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus:outline-hidden disabled:opacity-50 transition-colors h-[32px] cursor-pointer"
          >
            {isLoading ? "Filtering..." : "Apply"}
          </button>
        </div>
      </div>
    </motion.form>
  );
}
