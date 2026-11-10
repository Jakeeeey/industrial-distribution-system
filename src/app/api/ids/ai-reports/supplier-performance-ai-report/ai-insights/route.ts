/**
 * Gemini AI Insights API Route for Supplier Performance
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Automatic retry on 503/429
 * - Fallback to gemini-2.5-flash-lite
 * - Deterministic rule-based analytical engine as ultimate zero-crash fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AiTierSlug, SupplierSummaryRow, ReportExecutiveKPIs, AiInsightResponse } from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/types';
import { getSystemInstructionForTier, constructAnalysisPrompt } from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

/**
 * Cleanly parses JSON even if the LLM wraps it in markdown code blocks
 */
function parseJsonSafe(text: string): { summary?: string; keyExposures?: string[]; strategicActions?: string[]; negotiationNotes?: string[] } | null {
    try {
        const cleaned = text
            .replace(/^```json/im, '')
            .replace(/^```/im, '')
            .replace(/```$/im, '')
            .trim();
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

/**
 * Deterministic offline fallback engine
 * Computes exact, high-quality analytical findings directly from empirical data
 */
function generateDeterministicInsights(
    tierSlug: AiTierSlug,
    kpis: ReportExecutiveKPIs,
    suppliers: SupplierSummaryRow[]
): AiInsightResponse {
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

    const summary = `Currently, enterprise supplier fulfillment stands at ${otifStr} OTIF across ${kpis.totalSuppliersEvaluated} evaluated vendors, with an average rejection rate of ${rejStr}. A total of ${kpis.highRiskVendorsCount} supplier(s) exhibit active delivery delays or return-to-supplier flags. Active quality review and delivery reconciliation processes are in place.`;

    const keyExposures: string[] = [];
    if (bottomSuppliers.length > 0) {
        const b = bottomSuppliers[0];
        keyExposures.push(`Delivery Deficit: ${b.supplierName} achieved only ${b.otifPercentage}% OTIF (${b.onTimeOrders}/${b.totalOrdersDue} on-time orders).`);
    } else {
        keyExposures.push('Fulfillment Integrity: No severe delivery delays detected in the evaluated period.');
    }

    if (highestRtsSupplier) {
        keyExposures.push(`Quality Return Volume: ${highestRtsSupplier.supplierName} accounts for ${highestRtsSupplier.rtsCount} Return-To-Supplier (RTS) events with a ${highestRtsSupplier.rejectionRatePercentage}% return rate.`);
    } else {
        keyExposures.push('Quality Stability: Zero Return-To-Supplier (RTS) events recorded across active receiving lines.');
    }

    if (highVarianceSuppliers.length > 0) {
        const v = highVarianceSuppliers[0];
        keyExposures.push(`Cost Discrepancy: ${v.supplierName} exhibits a +${v.averageCostVariancePercentage}% unit cost variance over approved purchase price.`);
    } else {
        keyExposures.push('Price Compliance: Invoiced costs align strictly with approved purchase contract orders.');
    }

    const strategicActions: string[] = [
        'Initiate structured delivery reconciliation with vendors holding OTIF scores below the 80% enterprise threshold.',
        'Verify pending credit memo deductions with Accounts Payable for all posted Return-To-Supplier (RTS) shipments.',
        'Implement a mandatory 3-day buffer on purchase order lead times for vendors with frequent split deliveries.',
    ];

    return {
        tierSlug,
        tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
        model: 'Rule-Based Deterministic Engine (Offline/Spike Protection)',
        summary,
        keyExposures,
        strategicActions,
        isFallback: true,
        disclaimer: 'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
    };
}

export async function POST(req: NextRequest) {
    let tierSlug: AiTierSlug = 'basic';
    let kpis: ReportExecutiveKPIs | null = null;
    let suppliers: SupplierSummaryRow[] = [];

    try {
        const body = await req.json().catch(() => ({}));
        kpis = body.kpis;
        suppliers = body.suppliers || [];
        tierSlug = body.tierSlug || 'basic';

        if (!kpis || !Array.isArray(suppliers)) {
            return NextResponse.json({ error: 'Invalid payload: kpis and suppliers are required.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[Gemini AI] No GEMINI_API_KEY set. Falling back to deterministic engine.');
            return NextResponse.json(generateDeterministicInsights(tierSlug, kpis, suppliers));
        }

        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = getSystemInstructionForTier(tierSlug);
        const userPrompt = constructAnalysisPrompt(tierSlug, kpis, suppliers);

        // Attempt 1: Primary Model (from env, e.g. gemini-3.1-flash-lite)
        let rawText = '';
        let usedModel = PRIMARY_MODEL;

        try {
            const result = await ai.models.generateContent({
                model: PRIMARY_MODEL,
                contents: userPrompt,
                config: {
                    systemInstruction,
                    temperature: 0.2,
                },
            });
            rawText = result.text || '';
        } catch (primaryErr: unknown) {
            console.warn(`[Gemini AI] Primary model ${PRIMARY_MODEL} failed:`, primaryErr);
            // Wait 1000ms backoff before Attempt 2
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Attempt 2: Fallback Model (gemini-2.5-flash-lite)
            usedModel = FALLBACK_MODEL;
            console.info(`[Gemini AI] Retrying with fallback model: ${FALLBACK_MODEL}...`);
            const fallbackResult = await ai.models.generateContent({
                model: FALLBACK_MODEL,
                contents: userPrompt,
                config: {
                    systemInstruction,
                    temperature: 0.2,
                },
            });
            rawText = fallbackResult.text || '';
        }

        const parsedJson = parseJsonSafe(rawText);

        if (parsedJson && parsedJson.summary && Array.isArray(parsedJson.keyExposures)) {
            const responsePayload: AiInsightResponse = {
                tierSlug,
                tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                model: usedModel,
                summary: parsedJson.summary,
                keyExposures: parsedJson.keyExposures.slice(0, 3),
                strategicActions: Array.isArray(parsedJson.strategicActions) ? parsedJson.strategicActions.slice(0, 3) : [],
                negotiationNotes: parsedJson.negotiationNotes,
                isFallback: false,
                disclaimer: 'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
            };
            return NextResponse.json(responsePayload);
        }

        // If JSON parsing of Gemini output did not yield the expected keys, build clean structured view
        return NextResponse.json({
            tierSlug,
            tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
            model: usedModel,
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
            isFallback: false,
            disclaimer: 'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
        });
    } catch (finalErr: unknown) {
        console.error('[Gemini AI] Both remote attempts failed. Triggering deterministic engine:', finalErr);
        if (kpis) {
            return NextResponse.json(generateDeterministicInsights(tierSlug, kpis, suppliers));
        }
        return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
    }
}
