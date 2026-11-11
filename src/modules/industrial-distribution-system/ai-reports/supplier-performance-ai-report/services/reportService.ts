/**
 * Client service for Supplier Performance Report & AI Insights
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

import {
    SupplierPerformanceFilter,
    SupplierPerformanceReportPayload,
    AiInsightResponse,
    AiTierSlug,
} from '../types';

export async function fetchSupplierPerformanceData(
    filter: SupplierPerformanceFilter
): Promise<SupplierPerformanceReportPayload> {
    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.branchId) params.append('branchId', String(filter.branchId));
    if (filter.supplierId) params.append('supplierId', String(filter.supplierId));

    const res = await fetch(`/api/ids/ai-reports/supplier-performance-ai-report?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to fetch supplier performance data');
    }

    return res.json();
}

export async function generateGeminiInsights(
    reportData: SupplierPerformanceReportPayload,
    tierSlug: AiTierSlug,
    userQuery?: string
): Promise<AiInsightResponse> {
    const res = await fetch('/api/ids/ai-reports/supplier-performance-ai-report/ai-insights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            kpis: reportData.kpis,
            suppliers: reportData.suppliers,
            tierSlug,
            userQuery,
        }),
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to process AI insights');
    }

    return res.json();
}

export async function fetchBranchesList(): Promise<Array<{ id: number; branch_name: string }>> {
    try {
        const res = await fetch('/api/ids/ai-reports/supplier-performance-ai-report/branches', {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

export async function fetchCompanyPdfData(): Promise<Record<string, any> | null> {
    try {
        const res = await fetch('/api/pdf/company', {
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data?.[0] || null;
    } catch {
        return null;
    }
}
