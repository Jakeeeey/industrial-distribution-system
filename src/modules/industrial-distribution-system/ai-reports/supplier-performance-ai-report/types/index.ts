/**
 * TypeScript definitions for Supplier Performance AI Report Module
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

export type AiTierSlug = 'basic' | 'pro' | 'executive';

export interface AiTierInfo {
    id: number;
    slug: AiTierSlug;
    name: string;
    tierLevel: number;
    description: string;
}

export interface SupplierPerformanceFilter {
    startDate?: string;
    endDate?: string;
    branchId?: number | string;
    supplierId?: number | string;
}

export interface RtsLogEntry {
    docNo: string;
    date: string;
    quantity: number;
    reason: string;
}

export interface SupplierSummaryRow {
    supplierId: number;
    supplierName: string;
    contactPerson: string | null;
    paymentTerms: string | null;
    deliveryTerms: string | null;
    // Core KPIs
    totalOrdersDue: number;
    onTimeOrders: number;
    inFullOrders: number;
    otifOrders: number;
    otifPercentage: number | null; // null if totalOrdersDue === 0
    totalReceivedQuantity: number;
    totalReturnedQuantity: number;
    rejectionRatePercentage: number | null; // null if totalReceivedQuantity === 0
    averageCostVariancePercentage: number | null;
    // Qualitative / Evidence counts
    rtsCount: number;
    splitDeliveryCount: number;
    rtsRemarks: string[];
    rtsLogs: RtsLogEntry[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskDrivers: string[];
}

export interface ReportExecutiveKPIs {
    totalSuppliersEvaluated: number;
    averageOtifRate: number | null;
    averageRejectionRate: number | null;
    highRiskVendorsCount: number;
    totalRtsReturns: number;
    dataFreshnessTimestamp: string;
}

export interface SupplierPerformanceReportPayload {
    filter: SupplierPerformanceFilter;
    kpis: ReportExecutiveKPIs;
    suppliers: SupplierSummaryRow[];
    userTier: {
        tierLevel: number;
        tierSlug: AiTierSlug;
        tierName: string;
    };
}

export interface AiInsightResponse {
    tierSlug: AiTierSlug;
    tierName: string;
    model: string;
    summary: string;
    keyExposures: string[];
    strategicActions: string[];
    negotiationNotes?: string[];
    disclaimer: string;
    isFallback?: boolean;
}
