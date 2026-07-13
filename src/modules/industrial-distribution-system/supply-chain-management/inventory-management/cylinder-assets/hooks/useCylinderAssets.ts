"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { CylinderAsset } from "../types";

export function useCylinderAssets() {
  const [data, setData] = useState<CylinderAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branchId, setBranchId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [productId, setProductId] = useState<number | undefined>();
  const [condition, setCondition] = useState<string | undefined>();
  const [expirationStatus, setExpirationStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [globalStats, setGlobalStats] = useState({ available: 0, withCustomer: 0, expired: 0, nearExpiration: 0, total: 0 });
  const [sortBy, setBy] = useState<string>("id");
  const [sortOrder, setOrder] = useState<"ASC" | "DESC">("DESC");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchId, status, productId, condition, expirationStatus, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.set("search", debouncedSearch);
      if (branchId) queryParams.set("branchId", String(branchId));
      if (status && status !== "ALL") queryParams.set("status", status);
      if (productId) queryParams.set("productId", String(productId));
      if (condition && condition !== "ALL") queryParams.set("condition", condition);
      if (expirationStatus && expirationStatus !== "ALL") queryParams.set("expirationStatus", expirationStatus);

      const sortValue = sortOrder === "DESC" ? `-${sortBy}` : sortBy;
      queryParams.set("sort", sortValue);
      queryParams.set("page", String(page));
      queryParams.set("limit", String(pageSize));

      const [dataRes, statsRes] = await Promise.all([
        fetch(`/api/ids/scm/inventory-management/cylinder-assets?${queryParams.toString()}`),
        fetch(`/api/ids/scm/inventory-management/cylinder-assets/stats?${queryParams.toString()}`)
      ]);
      
      const [result, statsResult] = await Promise.all([
        dataRes.json(),
        statsRes.json()
      ]);

      if (result.error) throw new Error(result.error);
      setData(result.data || []);
      setTotal(result.total || 0);
      if (statsResult.data) {
        setGlobalStats(statsResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      toast.error("Failed to load cylinder assets");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, branchId, status, productId, condition, expirationStatus, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createAsset = async (payload: Partial<CylinderAsset>) => {
    try {
      const response = await fetch(`/api/ids/scm/inventory-management/cylinder-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      toast.success("Cylinder asset created successfully");
      await refresh();
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create asset";
      if (errorMessage.toLowerCase().includes("duplicate") || errorMessage.toLowerCase().includes("unique")) {
        toast.error("The serial is already added");
      } else {
        toast.error(errorMessage);
      }
      throw err;
    }
  };

  const createBulkAssets = async (payloads: Partial<CylinderAsset>[]) => {
    try {
      const response = await fetch(`/api/ids/scm/inventory-management/cylinder-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      const count = Array.isArray(result.data) ? result.data.length : payloads.length;
      toast.success(`${count} cylinder asset${count > 1 ? "s" : ""} registered successfully`);
      await refresh();
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to register assets";
      if (errorMessage.toLowerCase().includes("duplicate") || errorMessage.toLowerCase().includes("unique")) {
        toast.error("The serial is already added");
      } else {
        toast.error(errorMessage);
      }
      throw err;
    }
  };

  const updateAsset = async (id: number, payload: Partial<CylinderAsset>) => {
    try {
      const response = await fetch(`/api/ids/scm/inventory-management/cylinder-assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      toast.success("Cylinder asset updated successfully");
      await refresh();
      return result.data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset");
      throw err;
    }
  };

  const deleteAsset = async (id: number) => {
    try {
      const response = await fetch(`/api/ids/scm/inventory-management/cylinder-assets/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      toast.success("Cylinder asset deleted successfully");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete asset");
      throw err;
    }
  };

  return {
    data,
    globalStats,
    isLoading,
    error,
    refresh,
    createAsset,
    createBulkAssets,
    updateAsset,
    deleteAsset,
    filters: {
      search, setSearch,
      branchId, setBranchId,
      status, setStatus,
      productId, setProductId,
      condition, setCondition,
      expirationStatus, setExpirationStatus,
    },
    pagination: {
      page, setPage,
      pageSize, setPageSize,
      total,
    },
    sorting: {
      sortBy,
      sortOrder,
      toggleSort: (field: string) => {
        if (sortBy === field) {
          setOrder(sortOrder === "ASC" ? "DESC" : "ASC");
        } else {
          setBy(field);
          setOrder("ASC");
        }
      }
    }
  };
}
