import { useState, useEffect, useMemo, useCallback } from "react";
import { CustomerRecord, RetailDirectoryState, SelectedNode, DealerNode } from "../types";
import { buildHierarchy } from "../utils/hierarchy";
import * as provider from "../providers/fetchprovider";

export function useRetailDirectory() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [classificationsMeta, setClassificationsMeta] = useState<Record<string, string>>({});
  const [storeTypesMeta, setStoreTypesMeta] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);

  const [provinceFilter, setProvinceFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeTypeFilter, setStoreTypeFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [customersData, classData, storeData] = await Promise.all([
        provider.fetchCustomers(),
        provider.fetchClassifications(),
        provider.fetchStoreTypes()
      ]);

      const classMap: Record<string, string> = {};
      classData.forEach((c: Record<string, unknown>) => { 
        classMap[String(c.id)] = String(c.classification_name); 
      });
      setClassificationsMeta(classMap);

      const storeMap: Record<string, string> = {};
      storeData.forEach((s: Record<string, unknown>) => { 
        storeMap[String(s.id)] = String(s.store_type); 
      });
      setStoreTypesMeta(storeMap);

      setCustomers(customersData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred");
      } else {
        setError("An error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rawHierarchy = useMemo(() => buildHierarchy(customers), [customers]);

  const matchesFilters = useCallback((c: CustomerRecord) => {
    const matchesSearch = searchQuery === "" || 
      (c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesProvince = provinceFilter === "all" || c.province === provinceFilter;
    const matchesCity = cityFilter === "all" || c.city === cityFilter;
    const matchesStatus = statusFilter === "all" || String(c.status).toUpperCase() === statusFilter.toUpperCase();
    const matchesStoreType = storeTypeFilter === "all" || String(c.store_type) === storeTypeFilter;
    const matchesClassification = classificationFilter === "all" || String(c.classification) === classificationFilter;

    return matchesSearch && matchesProvince && matchesCity && matchesStatus && matchesStoreType && matchesClassification;
  }, [searchQuery, provinceFilter, cityFilter, statusFilter, storeTypeFilter, classificationFilter]);

  const hierarchyState: RetailDirectoryState = useMemo(() => {
    const filteredDealers: DealerNode[] = [];
    
    for (const dealer of rawHierarchy.dealers) {
      const dealerMatches = matchesFilters(dealer);
      const matchingSubDealers = dealer.subDealers.filter(sub => matchesFilters(sub));
      
      if (dealerMatches || matchingSubDealers.length > 0) {
        filteredDealers.push({
          ...dealer,
          subDealers: matchingSubDealers,
          linkedSubDealerCount: matchingSubDealers.length
        });
      }
    }

    const filteredStandaloneSubDealers = rawHierarchy.standaloneSubDealers.filter(sub => matchesFilters(sub));
    const filteredStandaloneRetail = rawHierarchy.standaloneRetail.filter(r => matchesFilters(r));

    const filteredCount = filteredDealers.length + filteredStandaloneSubDealers.length + filteredStandaloneRetail.length;

    return {
      dealers: filteredDealers,
      standaloneSubDealers: filteredStandaloneSubDealers,
      standaloneRetail: filteredStandaloneRetail,
      filteredCount,
      totalDealers: rawHierarchy.totalDealers,
      totalSubDealers: rawHierarchy.totalSubDealers,
      totalRetail: rawHierarchy.totalRetail,
      totalActive: rawHierarchy.totalActive,
    };
  }, [rawHierarchy, matchesFilters]);

  useEffect(() => {
    if (selectedNode) {
      let found = false;
      for (const d of hierarchyState.dealers) {
        if (d.id === selectedNode.id) { found = true; break; }
        for (const s of d.subDealers) {
          if (s.id === selectedNode.id) { found = true; break; }
        }
        if (found) break;
      }
      if (!found) {
        for (const s of hierarchyState.standaloneSubDealers) {
          if (s.id === selectedNode.id) { found = true; break; }
        }
      }
      if (!found) {
        for (const r of hierarchyState.standaloneRetail) {
          if (r.id === selectedNode.id) { found = true; break; }
        }
      }
      
      if (!found) {
        setSelectedNode(null);
      }
    }
  }, [hierarchyState, selectedNode]);

  const provinces = useMemo(() => Array.from(new Set(customers.map(c => c.province).filter(Boolean))), [customers]);
  const cities = useMemo(() => Array.from(new Set(customers.map(c => c.city).filter(Boolean))), [customers]);
  const statuses = useMemo(() => Array.from(new Set(customers.map(c => String(c.status).toUpperCase()).filter(Boolean))), [customers]);
  const storeTypes = useMemo(() => Array.from(new Set(customers.map(c => c.store_type).filter(Boolean))), [customers]);
  const classifications = useMemo(() => Array.from(new Set(customers.map(c => c.classification).filter(Boolean))), [customers]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setProvinceFilter("all");
    setCityFilter("all");
    setStatusFilter("all");
    setStoreTypeFilter("all");
    setClassificationFilter("all");
    setSelectedNode(null);
  }, []);

  return {
    customers,
    hierarchyState,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    provinceFilter,
    setProvinceFilter,
    cityFilter,
    setCityFilter,
    statusFilter,
    setStatusFilter,
    storeTypeFilter,
    setStoreTypeFilter,
    classificationFilter,
    setClassificationFilter,
    provinces,
    cities,
    statuses,
    storeTypes,
    classifications,
    classificationsMeta,
    storeTypesMeta,
    resetFilters,
    refetch: fetchData,
    selectedNode,
    setSelectedNode
  };
}
