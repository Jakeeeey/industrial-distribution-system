// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.service.ts
// ==============================================================================
// Delivery Performance Report - Service Coordinator
// Coordinates repository calls, aggregation logic, and filter resolution.
// ==============================================================================

import type { DeliverPerformanceFilterInput } from "../types/deliver-performance.schema";
import type { DeliverPerformanceResponse, DeliverPerformanceLookups } from "../types/deliver-performance.types";
import {
  repoFetchLookups,
  repoFetchSalesInvoices,
  repoFetchPostDispatchInvoices,
  repoFetchPostDispatchPlans,
  repoFetchInvoiceDetails,
} from "./deliver-performance.repo";
import { aggregateDeliveryPerformanceData } from "./deliver-performance.aggregation";

export async function fetchDeliverPerformanceLookups(): Promise<DeliverPerformanceLookups> {
  const lookups = await repoFetchLookups();
  return {
    branches: lookups.branches,
    customers: lookups.customers,
    drivers: lookups.drivers,
    statuses: [...lookups.statuses],
  };
}

export async function fetchDeliverPerformanceReport(
  filters: DeliverPerformanceFilterInput
): Promise<DeliverPerformanceResponse> {
  // 1. Fetch lookups for label mapping
  const lookups = await repoFetchLookups();

  // 2. Fetch sales invoices in range
  const salesInvoices = await repoFetchSalesInvoices({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchId: filters.branchId,
    customerCode: filters.customerCode,
  });

  if (!salesInvoices.length) {
    return {
      kpis: {
        totalDeliveries: 0,
        fulfilledCount: 0,
        fulfilledWithConcernsCount: 0,
        fulfilledWithReturnsCount: 0,
        notFulfilledCount: 0,
        fulfillmentRate: 0,
        onTimeRate: 100,
        totalNetAmount: 0,
        totalQuantity: 0,
        totalDistance: 0,
      },
      charts: {
        trends: [],
        statusDistribution: [],
        topDrivers: [],
      },
      records: [],
      pagination: {
        page: 1,
        pageSize: filters.pageSize || 20,
        totalRecords: 0,
        totalPages: 1,
      },
    };
  }

  const invoiceIds = salesInvoices.map((s) => s.invoice_id);

  // 3. Concurrently fetch delivery invoices and line details
  const [pdis, details] = await Promise.all([
    repoFetchPostDispatchInvoices(invoiceIds),
    repoFetchInvoiceDetails(invoiceIds),
  ]);

  // 4. Fetch trip plans from unique post_dispatch_plan_ids
  const planIds = Array.from(
    new Set(pdis.map((p) => p.post_dispatch_plan_id).filter(Boolean))
  );
  const plans = await repoFetchPostDispatchPlans(planIds);

  // 5. Aggregate metrics
  return aggregateDeliveryPerformanceData({
    salesInvoices,
    pdis,
    plans,
    details,
    lookups,
    filters,
  });
}

