/**
 * Gemini Prompt Templates & Tier System Instructions
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Configured to generate structured insight across:
 * - Basic: 1 Summary Paragraph + 3 Key Exposures & Risks + 3 Strategic Actions
 * - Pro: Root-cause diagnosis (split receipts vs defects) and lead-time trend analysis
 * - Executive: Strategic supplier negotiation battlecards and contractual leverage points
 */

import { AiTierSlug, SupplierSummaryRow, ReportExecutiveKPIs } from '../types';

export function getSystemInstructionForTier(tierSlug: AiTierSlug): string {
    const baseDirectives = `
You are an expert AI Procurement and Supply Chain Analyst for an industrial distribution enterprise (IDS).
Strict Operating Constraints:
1. All recommendations are purely advisory and strictly require human review.
2. Never suggest unauthorized transaction postings or policy modifications.
3. Base all conclusions strictly on the provided empirical metrics. Do not fabricate order numbers or data points.
4. Output your response as a valid JSON object matching the requested schema. Do NOT include markdown code blocks around the JSON if possible, or use standard json formatting.
`;

    if (tierSlug === 'basic') {
        return `${baseDirectives}
Current Tier: BASIC
Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 concise executive paragraph describing the overall supplier performance status, enterprise OTIF percentage, rejection rates, and reliability posture.",
  "keyExposures": [
    "Exposure/Risk 1: Concrete observation with supplier name and specific metric",
    "Exposure/Risk 2: Concrete observation with supplier name and specific metric",
    "Exposure/Risk 3: Concrete observation with supplier name and specific metric"
  ],
  "strategicActions": [
    "Action 1: Immediate practical follow-up for procurement officer",
    "Action 2: Follow-up regarding RTS returns or uninspected deliveries",
    "Action 3: Actionable recommendation regarding order buffer or vendor review"
  ]
}
Constraints: Exactly 3 items in keyExposures and exactly 3 items in strategicActions.`;
    }

    if (tierSlug === 'pro') {
        return `${baseDirectives}
Current Tier: PRO
Include root-cause diagnosis correlating delayed orders with split receipts and RTS defect item remarks.
Return JSON with "summary", "keyExposures" (3 items), and "strategicActions" (3 items), with root-cause diagnostic depth.`;
    }

    return `${baseDirectives}
Current Tier: EXECUTIVE
Include strategic vendor negotiation leverage points, contractual terms adjustments, and procurement review committee notes.
Return JSON with "summary", "keyExposures" (3 items), "strategicActions" (3 items), and optional "negotiationNotes" (3 items).`;
}

export function constructAnalysisPrompt(
    tierSlug: AiTierSlug,
    kpis: ReportExecutiveKPIs,
    suppliers: SupplierSummaryRow[]
): string {
    // Sanitize supplier data (no PII or bank credentials)
    const sanitizedSupplierData = suppliers.slice(0, 30).map((s) => ({
        id: s.supplierId,
        name: s.supplierName,
        otif: s.otifPercentage !== null ? `${s.otifPercentage}%` : 'N/A',
        ordersDue: s.totalOrdersDue,
        onTime: s.onTimeOrders,
        inFull: s.inFullOrders,
        rejectionRate: s.rejectionRatePercentage !== null ? `${s.rejectionRatePercentage}%` : '0%',
        costVariance: s.averageCostVariancePercentage !== null ? `${s.averageCostVariancePercentage}%` : '0%',
        rtsCount: s.rtsCount,
        splitDeliveries: s.splitDeliveryCount,
        sampleRtsRemarks: s.rtsRemarks.slice(0, 3),
        riskLevel: s.riskLevel,
        riskDrivers: s.riskDrivers,
    }));

    return `
Analyze the following Industrial Distribution System (IDS) Supplier Performance Report:

Summary Metrics:
- Total Evaluated Suppliers: ${kpis.totalSuppliersEvaluated}
- Average Enterprise OTIF: ${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}
- Average Enterprise Rejection Rate: ${kpis.averageRejectionRate !== null ? `${kpis.averageRejectionRate}%` : '0%'}
- High-Risk Suppliers: ${kpis.highRiskVendorsCount}
- Total RTS Returns Logged: ${kpis.totalRtsReturns}

Supplier Performance Data:
${JSON.stringify(sanitizedSupplierData, null, 2)}

Generate the ${tierSlug.toUpperCase()} tier JSON response with summary, keyExposures (3 bullets), and strategicActions (3 bullets).
`;
}
