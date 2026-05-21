"use client";

import React, { useState } from "react";
import { useCustomers } from "./hooks/useCustomers";
import { CustomerTable } from "./components/CustomerTable";
import { RecentWalkInTransactionsTable } from "./components/RecentWalkInTransactionsTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, RefreshCw, UserPlus } from "lucide-react";
import { Customer, CustomerWithRelations } from "./types";
import {
  CustomerFormSheet,
  type CustomerFormValues,
} from "./components/CustomerFormSheet";
import { useWalkInTransactions } from "./hooks/useWalkInTransactions";

export default function CustomerRegistration() {
  const {
    customers,
    isLoading,
    isError,
    error,
    metadata,
    page,
    pageSize,
    searchQuery,
    statusFilter,
    storeTypeFilter, // 🚀 Extracted new state
    classificationFilter, // 🚀 Extracted new state
   
    setPage,
    setPageSize,
    setSearchQuery,
    setStatusFilter,
    setStoreTypeFilter, // 🚀 Extracted new setter
    setClassificationFilter, // 🚀 Extracted new setter
    refetch,
    createCustomer,
    updateCustomer,
  } = useCustomers();

  const {
    transactions,
    isLoading: isWalkInLoading,
    error: walkInError,
    refetch: refetchWalkIns,
  } = useWalkInTransactions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerWithRelations | null>(null);
  const [defaultDialogTab, setDefaultDialogTab] = useState<string>("basic");

  const handleCreate = async (data: Partial<Customer>) => {
    await createCustomer(data);
  };

  const handleUpdate = async (id: number, data: Partial<Customer>) => {
    await updateCustomer(id, data);
  };

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setDefaultDialogTab("basic");
    setIsDialogOpen(true);
  };

  const handleEdit = (customer: CustomerWithRelations) => {
    setSelectedCustomer(customer);
    setDefaultDialogTab("basic");
    setIsDialogOpen(true);
  };

  const handleChangeStatus = async (
    customer: CustomerWithRelations,
    status: string,
  ) => {
    await handleUpdate(customer.id, { status: status as Customer["status"] });
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchWalkIns()]);
  };

  // 🚀 SHADCN-STYLE ERROR STATE
  if (isError) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold tracking-tight">
            Connection Error
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span className="text-sm">
              Failed to load customers:{" "}
              {error?.message ||
                "An unexpected error occurred while fetching data."}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="w-full sm:w-auto bg-background hover:bg-muted text-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Connection
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    // 🚀 STANDARD SHADCN DASHBOARD LAYOUT
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Customer Directory
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage categorized profiles and deposits.
          </p>
        </div>
        <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 duration-700">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="shadow-sm"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={handleAddNew} className="shadow-sm">
            <UserPlus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      {/* MAIN CONTENT */}
      <div className="w-full">
        <CustomerTable
          data={customers}
          isLoading={isLoading}
          metadata={metadata}
          page={page}
          pageSize={pageSize}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          storeTypeFilter={storeTypeFilter} // 🚀 Passed to Table
          classificationFilter={classificationFilter} // 🚀 Passed to Table
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          onStoreTypeChange={setStoreTypeFilter} // 🚀 Passed to Table
          onClassificationChange={setClassificationFilter} // 🚀 Passed to Table
          onEdit={handleEdit}
          onChangeStatus={handleChangeStatus}
        />
      </div>

      <Separator className="my-2" />

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
        <RecentWalkInTransactionsTable
          items={transactions}
          isLoading={isWalkInLoading}
          error={walkInError}
          onRetry={refetchWalkIns}
        />
      </div>

      <CustomerFormSheet
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customer={selectedCustomer}
        onSubmit={async (data: CustomerFormValues) => {
          if (selectedCustomer) {
            await handleUpdate(
              selectedCustomer.id,
              data as Partial<CustomerWithRelations>,
            );
          } else {
            await handleCreate(data as Partial<CustomerWithRelations>);
          }
        }}
        defaultTab={defaultDialogTab}
      />
    </div>
  );
}
