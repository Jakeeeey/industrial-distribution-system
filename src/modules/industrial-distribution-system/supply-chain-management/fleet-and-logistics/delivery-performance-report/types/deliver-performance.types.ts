// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/types/deliver-performance.types.ts
// ==============================================================================
// Delivery Performance Report - TypeScript Interfaces & Types
// Covers reporting records, KPI metrics, chart datasets, and lookups.
// ==============================================================================

export type DeliveryFulfillmentStatus =
  | "Fulfilled"
  | "Fulfilled With Returns"
  | "Not Fulfilled"
  | "Fulfilled With Concerns";

export interface DeliveryRecordItem {
  id: number; // post_dispatch_invoices id
  planId: number; // post_dispatch_plan id
  waybillNo: string; // post_dispatch_plan doc_no
  invoiceId: number; // sales_invoice invoice_id
  invoiceNo: string; // sales_invoice invoice_no
  dispatchDate: string; // sales_invoice dispatch_date or plan time_of_dispatch
  arrivalDate: string | null; // post_dispatch_plan time_of_arrival
  customerCode: string; // customer code
  customerName: string; // customer name / store name
  branchId: number | null; // branches id
  branchName: string; // branch name
  driverId: number | null; // user user_id
  driverName: string; // driver full name
  status: DeliveryFulfillmentStatus;
  isCleared: boolean;
  remarks: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  totalQuantity: number;
  totalDistance: number;
  isOnTime: boolean;
}

export interface DeliverPerformanceKPIs {
  totalDeliveries: number;
  fulfilledCount: number;
  fulfilledWithConcernsCount: number;
  fulfilledWithReturnsCount: number;
  notFulfilledCount: number;
  fulfillmentRate: number; // percentage
  onTimeRate: number; // percentage
  totalNetAmount: number;
  totalQuantity: number;
  totalDistance: number;
}

export interface DeliveryTrendPoint {
  date: string;
  label: string;
  fulfilled: number;
  withConcerns: number;
  withReturns: number;
  notFulfilled: number;
  totalDeliveries: number;
  totalNetAmount: number;
}

export interface DeliveryStatusSlice {
  name: string;
  status: DeliveryFulfillmentStatus;
  count: number;
  percentage: number;
  color: string;
}

export interface DriverPerformanceSummary {
  driverId: number;
  driverName: string;
  totalTrips: number;
  fulfilledCount: number;
  failedCount: number;
  fulfillmentRate: number;
  totalAmount: number;
}

export interface DeliverPerformanceCharts {
  trends: DeliveryTrendPoint[];
  statusDistribution: DeliveryStatusSlice[];
  topDrivers: DriverPerformanceSummary[];
}

export interface DeliverPerformanceLookups {
  branches: Array<{ id: number; branch_code: string; branch_name: string }>;
  customers: Array<{ customer_code: string; customer_name: string; store_name: string }>;
  drivers: Array<{ user_id: number; name: string }>;
  statuses: DeliveryFulfillmentStatus[];
}

export interface DeliverPerformanceResponse {
  kpis: DeliverPerformanceKPIs;
  charts: DeliverPerformanceCharts;
  records: DeliveryRecordItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

