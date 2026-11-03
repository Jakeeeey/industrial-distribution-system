// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.aggregation.ts
// ==============================================================================
// Delivery Performance Report - Data Aggregation Service
// Computes executive KPIs, daily fulfillment trends, driver ranking performance,
// and formatted delivery audit rows.
// ==============================================================================

import type {
  DeliveryRecordItem,
  DeliverPerformanceKPIs,
  DeliverPerformanceCharts,
  DeliveryTrendPoint,
  DeliveryStatusSlice,
  DriverPerformanceSummary,
  DeliveryFulfillmentStatus,
} from "../types/deliver-performance.types";
import type { DeliverPerformanceFilterInput } from "../types/deliver-performance.schema";

interface RawAggParams {
  salesInvoices: Array<{
    invoice_id: number;
    invoice_no: string;
    customer_code: string;
    branch_id: number;
    dispatch_date: string;
    total_amount: number;
    gross_amount: number;
    discount_amount: number;
    net_amount: number;
    transaction_status: string;
  }>;
  pdis: Array<{
    id: number;
    post_dispatch_plan_id: number;
    invoice_id: number;
    status: string;
    isCleared: number;
    remarks: string | null;
  }>;
  plans: Array<{
    id: number;
    doc_no: string;
    driver_id: number;
    vehicle_id: number;
    starting_point: number;
    total_distance: number;
    status: string;
    time_of_dispatch: string | null;
    time_of_arrival: string | null;
    estimated_time_of_arrival: string | null;
  }>;
  details: Array<{
    detail_id: number;
    invoice_no: number;
    product_id: number;
    quantity: number;
  }>;
  lookups: {
    branches: Array<{ id: number; branch_code: string; branch_name: string }>;
    customers: Array<{ customer_code: string; customer_name: string; store_name: string }>;
    drivers: Array<{ user_id: number; name: string }>;
  };
  filters: DeliverPerformanceFilterInput;
}

export function aggregateDeliveryPerformanceData(params: RawAggParams) {
  const { salesInvoices, pdis, plans, details, lookups, filters } = params;

  // Build Lookup Dictionaries
  const branchMap = new Map<number, string>();
  lookups.branches.forEach((b) => branchMap.set(b.id, b.branch_name));

  const customerMap = new Map<string, string>();
  lookups.customers.forEach((c) =>
    customerMap.set(c.customer_code, c.store_name || c.customer_name || c.customer_code)
  );

  const driverMap = new Map<number, string>();
  lookups.drivers.forEach((d) => driverMap.set(d.user_id, d.name));

  const planMap = new Map<number, (typeof plans)[0]>();
  plans.forEach((p) => planMap.set(p.id, p));

  const detailsQtyMap = new Map<number, number>();
  details.forEach((d) => {
    const prev = detailsQtyMap.get(d.invoice_no) || 0;
    detailsQtyMap.set(d.invoice_no, prev + Number(d.quantity || 0));
  });

  // Map pdis by invoice_id
  const pdiMap = new Map<number, (typeof pdis)[0]>();
  pdis.forEach((pdi) => {
    if (pdi.invoice_id) pdiMap.set(pdi.invoice_id, pdi);
  });

  // 1. Construct unified DeliveryRecordItem records
  const allRecords: DeliveryRecordItem[] = salesInvoices.map((inv) => {
    const pdi = pdiMap.get(inv.invoice_id);
    const plan = pdi ? planMap.get(pdi.post_dispatch_plan_id) : undefined;

    let status: DeliveryFulfillmentStatus = "Not Fulfilled";
    if (pdi?.status) {
      if (
        pdi.status === "Fulfilled" ||
        pdi.status === "Fulfilled With Concerns" ||
        pdi.status === "Fulfilled With Returns" ||
        pdi.status === "Not Fulfilled"
      ) {
        status = pdi.status;
      }
    }

    const arrivalDate = plan?.time_of_arrival || null;
    const estimatedArrival = plan?.estimated_time_of_arrival || null;
    let isOnTime = true;
    if (arrivalDate && estimatedArrival) {
      isOnTime = new Date(arrivalDate) <= new Date(estimatedArrival);
    }

    const driverName = plan?.driver_id ? driverMap.get(plan.driver_id) || `Driver #${plan.driver_id}` : "Unassigned";

    return {
      id: pdi?.id || inv.invoice_id,
      planId: plan?.id || 0,
      waybillNo: plan?.doc_no || "N/A",
      invoiceId: inv.invoice_id,
      invoiceNo: inv.invoice_no || `INV-${inv.invoice_id}`,
      dispatchDate: inv.dispatch_date ? inv.dispatch_date.split("T")[0] : "N/A",
      arrivalDate: arrivalDate ? arrivalDate.split("T")[0] : null,
      customerCode: inv.customer_code || "N/A",
      customerName: customerMap.get(inv.customer_code) || inv.customer_code || "Unknown Customer",
      branchId: inv.branch_id || (plan?.starting_point ?? null),
      branchName: branchMap.get(inv.branch_id) || "Main Branch",
      driverId: plan?.driver_id || null,
      driverName,
      status,
      isCleared: Boolean(pdi?.isCleared),
      remarks: pdi?.remarks || null,
      grossAmount: Number(inv.gross_amount || inv.total_amount || 0),
      discountAmount: Number(inv.discount_amount || 0),
      netAmount: Number(inv.net_amount || inv.total_amount || 0),
      totalQuantity: detailsQtyMap.get(inv.invoice_id) || 0,
      totalDistance: Number(plan?.total_distance || 0),
      isOnTime,
    };
  });

  // 2. Client-side filtering pass (for search keywords, status filter, driver filter)
  let filteredRecords = allRecords;

  if (filters.status && filters.status !== "all") {
    filteredRecords = filteredRecords.filter((r) => r.status === filters.status);
  }

  if (filters.driverId && filters.driverId !== "all") {
    const dId = Number(filters.driverId);
    filteredRecords = filteredRecords.filter((r) => r.driverId === dId);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filteredRecords = filteredRecords.filter(
      (r) =>
        r.waybillNo.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        (r.remarks && r.remarks.toLowerCase().includes(q))
    );
  }

  // 3. Compute High-Level KPIs
  const totalDeliveries = filteredRecords.length;
  let fulfilledCount = 0;
  let fulfilledWithConcernsCount = 0;
  let fulfilledWithReturnsCount = 0;
  let notFulfilledCount = 0;
  let onTimeDeliveries = 0;
  let totalNetAmount = 0;
  let totalQuantity = 0;
  let totalDistance = 0;

  filteredRecords.forEach((r) => {
    totalNetAmount += r.netAmount;
    totalQuantity += r.totalQuantity;
    totalDistance += r.totalDistance;

    if (r.status === "Fulfilled") fulfilledCount++;
    else if (r.status === "Fulfilled With Concerns") fulfilledWithConcernsCount++;
    else if (r.status === "Fulfilled With Returns") fulfilledWithReturnsCount++;
    else if (r.status === "Not Fulfilled") notFulfilledCount++;

    if (r.isOnTime && r.status !== "Not Fulfilled") onTimeDeliveries++;
  });

  const totalSuccessful = fulfilledCount + fulfilledWithConcernsCount + fulfilledWithReturnsCount;
  const fulfillmentRate = totalDeliveries > 0 ? Number(((fulfilledCount / totalDeliveries) * 100).toFixed(1)) : 0;
  const onTimeRate = totalSuccessful > 0 ? Number(((onTimeDeliveries / totalSuccessful) * 100).toFixed(1)) : 100;

  const kpis: DeliverPerformanceKPIs = {
    totalDeliveries,
    fulfilledCount,
    fulfilledWithConcernsCount,
    fulfilledWithReturnsCount,
    notFulfilledCount,
    fulfillmentRate,
    onTimeRate,
    totalNetAmount,
    totalQuantity,
    totalDistance,
  };

  // 4. Compute Daily / Temporal Trends
  const trendMap = new Map<string, DeliveryTrendPoint>();
  filteredRecords.forEach((r) => {
    const dateKey = r.dispatchDate !== "N/A" ? r.dispatchDate : "Undated";
    let entry = trendMap.get(dateKey);
    if (!entry) {
      entry = {
        date: dateKey,
        label: dateKey,
        fulfilled: 0,
        withConcerns: 0,
        withReturns: 0,
        notFulfilled: 0,
        totalDeliveries: 0,
        totalNetAmount: 0,
      };
      trendMap.set(dateKey, entry);
    }
    entry.totalDeliveries++;
    entry.totalNetAmount += r.netAmount;

    if (r.status === "Fulfilled") entry.fulfilled++;
    else if (r.status === "Fulfilled With Concerns") entry.withConcerns++;
    else if (r.status === "Fulfilled With Returns") entry.withReturns++;
    else if (r.status === "Not Fulfilled") entry.notFulfilled++;
  });

  const trends: DeliveryTrendPoint[] = Array.from(trendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 5. Compute Status Distribution
  const statusDistribution: DeliveryStatusSlice[] = [
    {
      name: "Fulfilled",
      status: "Fulfilled",
      count: fulfilledCount,
      percentage: totalDeliveries ? Number(((fulfilledCount / totalDeliveries) * 100).toFixed(1)) : 0,
      color: "#10b981", // Emerald
    },
    {
      name: "With Concerns",
      status: "Fulfilled With Concerns",
      count: fulfilledWithConcernsCount,
      percentage: totalDeliveries ? Number(((fulfilledWithConcernsCount / totalDeliveries) * 100).toFixed(1)) : 0,
      color: "#f59e0b", // Amber
    },
    {
      name: "With Returns",
      status: "Fulfilled With Returns",
      count: fulfilledWithReturnsCount,
      percentage: totalDeliveries ? Number(((fulfilledWithReturnsCount / totalDeliveries) * 100).toFixed(1)) : 0,
      color: "#6366f1", // Indigo
    },
    {
      name: "Not Fulfilled",
      status: "Not Fulfilled",
      count: notFulfilledCount,
      percentage: totalDeliveries ? Number(((notFulfilledCount / totalDeliveries) * 100).toFixed(1)) : 0,
      color: "#f43f5e", // Rose
    },
  ];

  // 6. Compute Driver Performance Rankings
  const driverStatMap = new Map<number, DriverPerformanceSummary>();
  filteredRecords.forEach((r) => {
    if (!r.driverId) return;
    let dStat = driverStatMap.get(r.driverId);
    if (!dStat) {
      dStat = {
        driverId: r.driverId,
        driverName: r.driverName,
        totalTrips: 0,
        fulfilledCount: 0,
        failedCount: 0,
        fulfillmentRate: 0,
        totalAmount: 0,
      };
      driverStatMap.set(r.driverId, dStat);
    }
    dStat.totalTrips++;
    dStat.totalAmount += r.netAmount;
    if (r.status === "Fulfilled") dStat.fulfilledCount++;
    else if (r.status === "Not Fulfilled") dStat.failedCount++;
  });

  const topDrivers: DriverPerformanceSummary[] = Array.from(driverStatMap.values())
    .map((d) => ({
      ...d,
      fulfillmentRate: d.totalTrips > 0 ? Number(((d.fulfilledCount / d.totalTrips) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalTrips - a.totalTrips)
    .slice(0, 5);

  const charts: DeliverPerformanceCharts = {
    trends,
    statusDistribution,
    topDrivers,
  };

  // 7. Paginated Records
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

  return {
    kpis,
    charts,
    records: paginatedRecords,
    pagination: {
      page,
      pageSize,
      totalRecords,
      totalPages,
    },
  };
}

