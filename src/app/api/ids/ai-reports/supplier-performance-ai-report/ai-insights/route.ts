/**
 * Gemini AI Insights API Route for Supplier Performance
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization)
 * - Executive 3-Pillar C-Suite parsing and structured Interactive Q&A
 * - Rule-based zero-crash deterministic fallback guarantee
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    SupplierSummaryRow,
    ReportExecutiveKPIs,
    AiInsightResponse,
    ExecutivePillar,
} from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/types';
import {
    getDomainSystemInstructionForTier,
    constructAnalysisPrompt,
} from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiInsightsRequestBody {
    kpis: ReportExecutiveKPIs;
    suppliers: SupplierSummaryRow[];
    tierSlug?: AiTierSlug;
    userQuery?: string;
}

/**
 * Deterministic offline fallback engine
 * Produces accurate C-suite findings directly from SQL metrics during outages
 */
function runDeterministicFallback(
    payload: { kpis: ReportExecutiveKPIs; suppliers: SupplierSummaryRow[]; userQuery?: string },
    tier: TierPolicy
): AiInsightResponse {
    const { kpis, suppliers, userQuery } = payload;

    const bottomSuppliers = [...suppliers]
        .filter((s) => s.totalOrdersDue > 0 && s.otifPercentage !== null)
        .sort((a, b) => (a.otifPercentage ?? 0) - (b.otifPercentage ?? 0))
        .slice(0, 3);

    const highestRtsSupplier = [...suppliers]
        .filter((s) => s.rtsCount > 0)
        .sort((a, b) => b.rtsCount - a.rtsCount)[0];

    const highVarianceSuppliers = [...suppliers]
        .filter((s) => (s.averageCostVariancePercentage ?? 0) > 0)
        .sort((a, b) => (b.averageCostVariancePercentage ?? 0) - (a.averageCostVariancePercentage ?? 0));

    const otifStr = kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A';
    const rejStr = kpis.averageRejectionRate !== null ? `${kpis.averageRejectionRate}%` : '0.00%';

    const summary = `Enterprise supplier fulfillment stands at ${otifStr} OTIF across ${kpis.totalSuppliersEvaluated} evaluated vendors with an average rejection rate of ${rejStr}. A critical concentration of risk is detected: ${kpis.highRiskVendorsCount} supplier(s) currently trigger elevated quality, delivery delay, or cost escalation thresholds requiring strategic intervention.`;

    const executivePillars: ExecutivePillar[] = [
        {
            pillar: 'Commercial & Margin Integrity',
            status: highVarianceSuppliers.length > 0 ? 'CRITICAL' : 'STABLE',
            findings: highVarianceSuppliers.length > 0
                ? `${highVarianceSuppliers[0].supplierName} exhibits a +${highVarianceSuppliers[0].averageCostVariancePercentage}% unit cost variance. Ensure pending credit memos match RTS batches.`
                : 'Unit prices across all received batches comply with contracted and approved purchase order values.',
        },
        {
            pillar: 'Supply Continuity & Logistics Friction',
            status: bottomSuppliers.some((s) => (s.otifPercentage || 0) < 60) ? 'CRITICAL' : 'MODERATE',
            findings: bottomSuppliers.length > 0
                ? `${bottomSuppliers[0].supplierName} delivered only ${bottomSuppliers[0].otifPercentage}% on-time orders (${bottomSuppliers[0].onTimeOrders}/${bottomSuppliers[0].totalOrdersDue} shipments).`
                : 'Fulfillment timelines remain stable across active delivery windows.',
        },
        {
            pillar: 'Vendor Governance & QBR Leverage',
            status: 'ACTION_REQUIRED',
            findings: highestRtsSupplier
                ? `Mandate a formal Corrective Action Plan (CAPA) for ${highestRtsSupplier.supplierName} citing ${highestRtsSupplier.rtsCount} return events (${highestRtsSupplier.rejectionRatePercentage}% rejection rate).`
                : 'Maintain standard quarterly reviews and lead-time monitoring.',
        },
    ];

    const keyExposures: string[] = [
        `Delivery Deficit: ${bottomSuppliers[0]?.supplierName || 'Vendors'} achieved only ${bottomSuppliers[0]?.otifPercentage ?? 0}% OTIF compliance.`,
        `Quality Drag: ${highestRtsSupplier?.supplierName || 'Vendors'} accounts for ${highestRtsSupplier?.rtsCount || 0} RTS return documents.`,
        `Commercial Variance: ${highVarianceSuppliers[0]?.supplierName || 'Vendors'} exhibits price variances exceeding budget tolerances.`,
    ];

    const strategicActions: string[] = [
        'Enforce 10-business-day Corrective Action Plan (CAPA) mandates on all high-risk vendors.',
        'Hold pending finance disbursements for suppliers with unallocated RTS return quantities.',
        'Mandate strict in-full shipment delivery terms to eliminate split delivery administrative friction.',
    ];

    let qaAnswer: string | undefined = undefined;
    if (userQuery) {
        qaAnswer = `### Offline Analytical Assessment
*Note: AI Copilot is operating under rule-based offline mode. Based on live empirical database records:*

1. **Primary Operational Exposure**:
   - Bottom vendor: **${bottomSuppliers[0]?.supplierName || 'None'}** (${bottomSuppliers[0]?.otifPercentage ?? 'N/A'}% OTIF, ${bottomSuppliers[0]?.totalOrdersDue || 0} orders due).

2. **Quality & Defect Volume**:
   - Highest return rate: **${highestRtsSupplier?.supplierName || 'None'}** (${highestRtsSupplier?.rtsCount || 0} RTS documents, ${highestRtsSupplier?.rejectionRatePercentage || 0}% rejection rate).

3. **Recommended C-Level Action**:
   - Enforce contractual liquidated damages or 5-day lead-time buffers before approving purchase agreement renewals.`;
    }

    return {
        tierSlug: tier.slug as AiTierSlug,
        tierName: tier.name,
        model: 'Rule-Based Deterministic Engine (Offline)',
        summary,
        executivePillars,
        keyExposures,
        strategicActions,
        userQuery,
        qaAnswer,
        isFallback: true,
        disclaimer: 'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
    };
}

export async function POST(req: NextRequest) {
    try {
        const body: AiInsightsRequestBody = await req.json().catch(() => ({}));
        const { kpis, suppliers, tierSlug = 'basic', userQuery } = body;

        if (!kpis || !Array.isArray(suppliers)) {
            return NextResponse.json({ error: 'Invalid payload: kpis and suppliers are required.' }, { status: 400 });
        }

        // Sanitize any user inquiry using PII redaction (GDPR Dual-Pass)
        const sanitizedUserQuery = userQuery ? redactPiiFromString(userQuery.trim()) : undefined;
        const isCustomQuery = Boolean(sanitizedUserQuery && tierSlug === 'executive');

        // Centralized Core AI Execution
        const coreResponse = await runCoreAiAnalysis<
            { kpis: ReportExecutiveKPIs; suppliers: SupplierSummaryRow[]; userQuery?: string },
            AiInsightResponse
        >(
            {
                moduleName: 'supplier-performance-ai-report',
                tierSlug: tierSlug as GlobalAiTierSlug,
                payload: { kpis, suppliers, userQuery: sanitizedUserQuery },
                domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug, isCustomQuery),
                buildPrompt: (data) =>
                    constructAnalysisPrompt(tierSlug, data.kpis, data.suppliers, data.userQuery),
                fallbackEngine: (data, tier) => runDeterministicFallback(data, tier),
                parseResponse: (rawText: string) => {
                    if (isCustomQuery) {
                        return {
                            tierSlug,
                            tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: '',
                            keyExposures: [],
                            strategicActions: [],
                            userQuery: sanitizedUserQuery,
                            qaAnswer: rawText,
                            disclaimer:
                                'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                        };
                    }

                    const parsedJson = parseJsonSafe<Partial<AiInsightResponse>>(rawText);
                    if (parsedJson && parsedJson.summary) {
                        return {
                            tierSlug,
                            tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: parsedJson.summary,
                            executivePillars: Array.isArray(parsedJson.executivePillars)
                                ? (parsedJson.executivePillars as ExecutivePillar[])
                                : undefined,
                            keyExposures: Array.isArray(parsedJson.keyExposures)
                                ? parsedJson.keyExposures.slice(0, 3)
                                : [],
                            strategicActions: Array.isArray(parsedJson.strategicActions)
                                ? parsedJson.strategicActions.slice(0, 3)
                                : [],
                            negotiationNotes: parsedJson.negotiationNotes,
                            disclaimer:
                                'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                        };
                    }

                    // Fallback structured mapping
                    return {
                        tierSlug,
                        tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                        summary: rawText.slice(0, 400),
                        keyExposures: [
                            `Evaluated ${kpis.totalSuppliersEvaluated} active vendor delivery cycles.`,
                            `Enterprise OTIF fulfillment recorded at ${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}.`,
                            `${kpis.highRiskVendorsCount} vendor(s) identified with high return or late delivery risk.`,
                        ],
                        strategicActions: [
                            'Review open PO lines with flagged high-risk suppliers.',
                            'Cross-check Return-to-Supplier item remarks with warehouse receiving.',
                            'Schedule vendor quarterly review before purchase agreement renewal.',
                        ],
                        disclaimer:
                            'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                    };
                },
                sanitization: {
                    maxItemsCap: 30, // Data Minimization GDPR Art. 5
                    stripSensitiveKeys: true,
                    redactPii: true,
                },
            },
            tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1
        );

        const responsePayload: AiInsightResponse = {
            ...coreResponse.data,
            model: coreResponse.governance.modelUsed,
            isFallback: coreResponse.governance.isFallback,
            governance: coreResponse.governance,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown AI generation error';
        console.error('[SupplierPerformance AI Route Error]:', errorMsg);
        return NextResponse.json({ error: 'Failed to process AI request', details: errorMsg }, { status: 500 });
    }
}
