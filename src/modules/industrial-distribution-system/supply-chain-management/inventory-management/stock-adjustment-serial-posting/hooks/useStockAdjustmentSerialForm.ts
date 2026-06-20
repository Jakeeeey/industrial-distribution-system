"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  StockAdjustmentDetail,
  StockAdjustmentFormValues,
  StockAdjustmentProduct,
  SelectionBranch,
  SelectionSupplier
} from "../types/stock-adjustment-serial.schema";

/**
 * Dedicated hook for the Stock Adjustment Form.
 *
 * This hook only fetches data the form actually needs (products, branches,
 * serial status) and avoids re-fetching the adjustment list, which is
 * only relevant to the list view.
 */
export function useStockAdjustmentSerialForm() {
  const [branches, setBranches] = useState<SelectionBranch[]>([]);
  const [suppliers, setSuppliers] = useState<SelectionSupplier[]>([]);
  const [products, setProducts] = useState<StockAdjustmentProduct[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);
  const [isSerialLoading, setIsSerialLoading] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [serialProductIds, setSerialProductIds] = useState<Set<number>>(new Set());
  const [inventoryMap, setInventoryMap] = useState<Map<number, number>>(new Map());

  // Track whether initial product + branch fetch has completed
  const hasFetchedInitialData = useRef(false);

  // ── Branches (fetch once) ──────────────────────────────────────────
  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/ids/scm/inventory-management/stock-adjustment-serial-posting/branches");
      const result = await response.json();
      if (result.data) setBranches(result.data);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  }, []);

  // ── Products (lazy, debounce-ready) ────────────────────────────────
  const fetchProducts = useCallback(async (search?: string) => {
    setIsProductsLoading(true);
    try {
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/products${search ? `?search=${search}` : ""}`
      );
      const result = await response.json();
      setProducts(result.data || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setIsProductsLoading(false);
    }
  }, []);

  // ── Suppliers (fetch once) ────────────────────────────────────────
  const fetchSuppliers = useCallback(async () => {
    setIsSuppliersLoading(true);
    try {
      const response = await fetch("/api/ids/scm/inventory-management/stock-adjustment-serial-posting/suppliers");
      const result = await response.json();
      if (result.data) setSuppliers(result.data);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    } finally {
      setIsSuppliersLoading(false);
    }
  }, []);

  // ── Products by supplier ─────────────────────────────────────────
  const fetchProductsBySupplier = useCallback(async (supplierId: number, search?: string) => {
    setIsProductsLoading(true);
    setProducts([]); // Clear previous supplier's products
    try {
      const params = new URLSearchParams();
      params.set("supplierId", String(supplierId));
      if (search) params.set("search", search);
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/products?${params.toString()}`
      );
      const result = await response.json();
      setProducts(result.data || []);
    } catch (err) {
      console.error("Failed to fetch products by supplier:", err);
    } finally {
      setIsProductsLoading(false);
    }
  }, []);

  // ── Serial branch data ────────────────────────────────────────────
  const fetchBranchSerialData = useCallback(async (branchId: number) => {
    setIsSerialLoading(true);
    try {
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/serial-products?branchId=${branchId}`
      );
      if (!response.ok) return;
      const result = await response.json();
      const ids = new Set<number>(
        (result.products || []).map((p: { productId?: number; product_id?: number }) => Number(p.productId || p.product_id))
      );
      setSerialProductIds(ids);
    } catch (err) {
      console.error("Failed to fetch branch Serial data:", err);
    } finally {
      setIsSerialLoading(false);
    }
  }, []);

  // ── Branch inventory (pre-fetch once per branch) ──────────────────
  const fetchBranchInventory = useCallback(async (branchId: number) => {
    setIsInventoryLoading(true);
    try {
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/branch-inventory?branchId=${branchId}`
      );
      if (!response.ok) return;
      const result = await response.json();
      const map = new Map<number, number>();
      (result.inventory || []).forEach((item: { product_id: number; running_inventory?: number }) => {
        map.set(Number(item.product_id), Number(item.running_inventory || 0));
      });
      setInventoryMap(map);
    } catch (err) {
      console.error("Failed to fetch branch inventory:", err);
    } finally {
      setIsInventoryLoading(false);
    }
  }, []);

  // ── Fetch a single adjustment for edit mode ───────────────────────
  const fetchById = useCallback(async (id: number): Promise<StockAdjustmentDetail> => {
    const response = await fetch(`/api/ids/scm/inventory-management/stock-adjustment-serial-posting/${id}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.data;
  }, []);

  // ── Per-product helpers (called on product select) ────────────────
  const fetchInventory = useCallback(async (productId: number, branchId: number): Promise<number> => {
    try {
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/inventory?productId=${productId}&branchId=${branchId}`
      );
      if (!response.ok) return 0;
      const result = await response.json();
      return result.currentStock || 0;
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
      return 0;
    }
  }, []);

  const checkSerial = useCallback(async (productId: number, branchId: number): Promise<Record<string, unknown> | null> => {
    try {
      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/check-serial?productId=${productId}&branchId=${branchId}`
      );
      if (!response.ok) return null;
      const result = await response.json();
      return result.serialData;
    } catch (err) {
      console.error("Failed to check Serial:", err);
      return null;
    }
  }, []);

  const validateSerialAvailability = useCallback(async (serial: string, branchId?: number): Promise<{ exists: boolean; location?: string }> => {
    try {
      const params = new URLSearchParams();
      params.set("serial", serial);
      if (branchId) params.set("branchId", String(branchId));

      const response = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-posting/check-available-serial?${params.toString()}`
      );
      if (!response.ok) return { exists: false };
      const result = await response.json();
      return { exists: !!result.exists, location: result.location };
    } catch (err) {
      console.error("Failed to validate Serial availability:", err);
      return { exists: false };
    }
  }, []);

  const fetchNextDocNo = useCallback(async (type: "IN" | "OUT"): Promise<string> => {
    try {
      const response = await fetch(`/api/ids/scm/inventory-management/stock-adjustment-serial-posting/next-doc-no?type=${type}`);
      const result = await response.json();
      return result.doc_no;
    } catch (err) {
      console.error("Failed to fetch next doc no:", err);
      return `SA${type}-${new Date().getFullYear()}-001`;
    }
  }, []);

  // ── Create / Update ───────────────────────────────────────────────
  const createAdjustment = useCallback(async (values: StockAdjustmentFormValues) => {
    const response = await fetch("/api/ids/scm/inventory-management/stock-adjustment-serial-posting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        header: {
          doc_no: values.doc_no,
          branch_id: values.branch_id,
          type: values.type,
          remarks: values.remarks,
          supplier_id: values.supplier_id,
          amount: values.items.reduce(
            (acc, item) => acc + item.quantity * (item.cost_per_unit || 0),
            0
          ),
          stock_adjustment_attachment: values.stock_adjustment_attachment,
        },
        items: values.items,
      }),
    });
    const result = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
    if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status})`);
    return result.data;
  }, []);

  const updateAdjustment = useCallback(async (id: number, values: StockAdjustmentFormValues) => {
    const response = await fetch(`/api/ids/scm/inventory-management/stock-adjustment-serial-posting/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        header: {
          doc_no: values.doc_no,
          branch_id: values.branch_id,
          type: values.type,
          remarks: values.remarks,
          supplier_id: values.supplier_id,
          amount: values.items.reduce(
            (acc, item) => acc + item.quantity * (item.cost_per_unit || 0),
            0
          ),
          stock_adjustment_attachment: values.stock_adjustment_attachment,
        },
        items: values.items,
      }),
    });
    const result = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
    if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status})`);
    return result.data;
  }, []);

  const deleteAdjustment = useCallback(async (id: number) => {
    const response = await fetch(`/api/ids/scm/inventory-management/stock-adjustment-serial-posting/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  }, []);

  const postAdjustment = useCallback(async (id: number) => {
    const response = await fetch(`/api/ids/scm/inventory-management/stock-adjustment-serial-posting/${id}/post`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
    if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status})`);
    return result.data;
  }, []);

  // ── Initial data fetch (branches + suppliers, once) ────────────────
  useEffect(() => {
    if (!hasFetchedInitialData.current) {
      hasFetchedInitialData.current = true;
      fetchBranches();
      fetchSuppliers();
    }
  }, [fetchBranches, fetchSuppliers]);

  return {
    branches,
    suppliers,
    products,
    isProductsLoading,
    isSuppliersLoading,
    isSerialLoading,
    isInventoryLoading,
    serialProductIds,
    inventoryMap,
    fetchById,
    fetchProducts,
    fetchProductsBySupplier,
    fetchBranchSerialData,
    fetchBranchInventory,
    fetchInventory,
    checkSerial,
    validateSerialAvailability,
    fetchNextDocNo,
    createAdjustment,
    updateAdjustment,
    postAdjustment,
    deleteAdjustment,
  };
}
