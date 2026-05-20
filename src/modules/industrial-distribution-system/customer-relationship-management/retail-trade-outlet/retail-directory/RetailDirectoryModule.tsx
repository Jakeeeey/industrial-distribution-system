"use client";

import React from "react";
import { Store, Users, Map, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useRetailDirectory } from "./hooks/useRetailDirectory";
import { FilterToolbar } from "./components/FilterToolbar";
import { HierarchyTree } from "./components/HierarchyTree";
import { CustomerDetailsPanel } from "./components/CustomerDetailsPanel";

function KPICard({ title, value, icon: Icon, color, gradient, delay }: { title: string, value: number, icon: React.ElementType, color: string, gradient: string, delay: string }) {
  return (
    <Card className={`relative overflow-hidden p-6 shadow-sm border-border/40 hover:shadow-lg transition-all duration-500 group bg-white animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${delay}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-linear-to-br ${gradient} rounded-full -mr-10 -mt-10 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-2xl`} />
      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-4 rounded-2xl ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export default function RetailDirectoryModule() {
  const {
    // customers,
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
    refetch,
    selectedNode,
    setSelectedNode,
  } = useRetailDirectory();

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out max-w-400 mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Retail Directory
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            CRM relationship system for Dealer and Sub-Dealer networks.
          </p>
        </div>

        <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 duration-700">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="shadow-sm font-medium"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Dealers" 
          value={hierarchyState.totalDealers} 
          icon={Store} 
          color="bg-blue-50 text-blue-600 border border-blue-100" 
          gradient="from-blue-400 to-blue-600"
          delay="duration-700 delay-0"
        />
        <KPICard 
          title="Total Sub-Dealers" 
          value={hierarchyState.totalSubDealers} 
          icon={Users} 
          color="bg-purple-50 text-purple-600 border border-purple-100" 
          gradient="from-purple-400 to-purple-600"
          delay="duration-700 delay-100"
        />
        <KPICard 
          title="Total Retail Accounts" 
          value={hierarchyState.totalRetail} 
          icon={Map} 
          color="bg-orange-50 text-orange-600 border border-orange-100" 
          gradient="from-orange-400 to-orange-600"
          delay="duration-700 delay-200"
        />
        <KPICard 
          title="Active Accounts" 
          value={hierarchyState.totalActive} 
          icon={RefreshCw} 
          color="bg-emerald-50 text-emerald-600 border border-emerald-100" 
          gradient="from-emerald-400 to-emerald-600"
          delay="duration-700 delay-300"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-400 fill-mode-both">
        <FilterToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          provinceFilter={provinceFilter}
          setProvinceFilter={setProvinceFilter}
          cityFilter={cityFilter}
          setCityFilter={setCityFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          storeTypeFilter={storeTypeFilter}
          setStoreTypeFilter={setStoreTypeFilter}
          classificationFilter={classificationFilter}
          setClassificationFilter={setClassificationFilter}
          provinces={provinces}
          cities={cities}
          statuses={statuses}
          storeTypes={storeTypes}
          classifications={classifications}
          classificationsMeta={classificationsMeta}
          storeTypesMeta={storeTypesMeta}
          resetFilters={resetFilters}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-380px)] min-h-125 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
        {/* Left Panel: Hierarchy Tree */}
        <Card className="py-0 lg:col-span-4 flex flex-col shadow-sm border-border/60 overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
          <div className="p-4 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" /> Hierarchy Tree
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-destructive text-sm p-4 text-center">
                {error}
              </div>
            ) : (
              <HierarchyTree 
                dealers={hierarchyState.dealers} 
                standaloneSubDealers={hierarchyState.standaloneSubDealers}
                standaloneRetail={hierarchyState.standaloneRetail}
                selectedNode={selectedNode} 
                onSelectNode={setSelectedNode} 
              />
            )}
          </div>
        </Card>

        {/* Right Panel: Customer Details */}
        <Card className="py-0 lg:col-span-8 flex flex-col shadow-sm border-border/60 overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
          <div className="p-4 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Customer Details
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
            <CustomerDetailsPanel node={selectedNode} classificationsMeta={classificationsMeta} storeTypesMeta={storeTypesMeta} />
          </div>
        </Card>
      </div>
    </div>
  );
}