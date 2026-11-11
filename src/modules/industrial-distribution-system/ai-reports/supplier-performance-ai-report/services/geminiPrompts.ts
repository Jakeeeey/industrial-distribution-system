/**
 * Gemini Prompt Templates & Tier System Instructions
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Upgraded Executive Overview to 3 C-Suite Strategic Pillars (Commercial, Logistics, Negotiation)
 * - Enhanced interactive Q&A prompts with rich structured Markdown formatting directives
 */

import { AiTierSlug, SupplierSummaryRow, ReportExecutiveKPIs } from '../types';

export function getDomainSystemInstructionForTier(tierSlug: AiTierSlug, isCustomQuery: boolean = false): string {
    const baseDirectives = `
You are an expert Chief Procurement Officer (CPO) and Supply Chain Strategy Advisor for an industrial distribution enterprise (IDS).
Strict Operating Constraints:
1. All recommendations are purely advisory and strictly require human review before operational changes are enacted.
2. Base all conclusions strictly on the provided empirical metrics. Do not fabricate order numbers, vendors, or data points.
3. Structure your response with clean formatting. Use standard Markdown headings and bullet points. Never include raw markdown fence markers or excessive empty whitespace.
`;

    if (isCustomQuery) {
        return `${baseDirectives}
Mode: EXECUTIVE CONVERSATIONAL COPILOT
The user is an executive interrogating the supplier performance dataset.
Answer the user's specific inquiry thoroughly with executive-level clarity.
Cite exact vendor names, OTIF fulfillment percentages, RTS defect volumes, and cost variances from the data.
Structure your answer with:
- **Direct Answer Summary**: 1 concise takeaway answering the question.
- **Empirical Findings**: Bulleted specifics citing exact numbers from the dataset.
- **Actionable C-Suite Next Steps**: Concrete contractual or operational follow-ups.`;
    }

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

    // Tier 3: Executive Strategic Pillars
    return `${baseDirectives}
Current Tier: EXECUTIVE STRATEGIC
Deliver a high-impact C-Suite briefing structured around 3 Strategic Pillars.
Your JSON output MUST adhere to this exact structure:
{
  "summary": "High-impact executive brief synthesizing the strategic risk posture of the vendor portfolio, margin leakage, and systemic operational friction.",
  "executivePillars": [
    {
      "pillar": "Commercial & Margin Integrity",
      "status": "CRITICAL" | "MODERATE" | "STABLE",
      "findings": "Analysis of pricing compliance, cost variances, and financial exposure from RTS credit memos."
    },
    {
      "pillar": "Supply Continuity & Logistics Friction",
      "status": "CRITICAL" | "MODERATE" | "STABLE",
      "findings": "Analysis of systemic OTIF delivery failures, split shipment friction, and lead-time delays."
    },
    {
      "pillar": "Vendor Governance & QBR Leverage",
      "status": "ACTION_REQUIRED",
      "findings": "Concrete negotiation leverage points, contractual penalties (e.g. liquidated damages/rebates), and vendor probation plans."
    }
  ],
  "keyExposures": [
    "Commercial Risk: Specific supplier with cost variance or financial drag",
    "Delivery Deficit: Specific supplier with chronic late deliveries",
    "Quality Vulnerability: Specific supplier with severe RTS defect volume"
  ],
  "strategicActions": [
    "C-Suite Intervention: Notice to Cure and CAPA mandate for bottom performers",
    "Logistics Directive: Strict in-full shipping terms to stop split delivery drag",
    "Commercial Strategy: Pending voucher holds and QBR penalty enforcement"
  ]
}`;
}

export function constructAnalysisPrompt(
    tierSlug: AiTierSlug,
    kpis: ReportExecutiveKPIs,
    suppliers: SupplierSummaryRow[],
    userQuery?: string
): string {
    // Sanitize supplier data (Data Minimization GDPR Art. 5)
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

    if (userQuery && userQuery.trim()) {
        return `
The executive has submitted the following inquiry regarding the active supplier performance dataset:
"${userQuery.trim()}"

Summary Metrics:
- Total Evaluated Suppliers: ${kpis.totalSuppliersEvaluated}
- Average Enterprise OTIF: ${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}
- Average Enterprise Rejection Rate: ${kpis.averageRejectionRate !== null ? `${kpis.averageRejectionRate}%` : '0%'}
- High-Risk Suppliers: ${kpis.highRiskVendorsCount}
- Total RTS Returns Logged: ${kpis.totalRtsReturns}

Active Supplier Performance Data:
${JSON.stringify(sanitizedSupplierData, null, 2)}

Provide an executive, formatted answer addressing this inquiry directly.
`;
    }

    return `
Analyze the following Industrial Distribution System (IDS) Supplier Performance Report:

Summary Metrics:
- Total Evaluated Suppliers: ${kpis.totalSuppliersEvaluated}
- Average Enterprise OTIF: ${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}
- Average Enterprise Rejection Rate: ${kpis.averageRejectionRate !== null ? `${kpis.averageRejectionRate}%` : '0%'}
- High-Risk Suppliers: ${kpis.highRiskVendorsCount}
- Total RTS Returns Logged: ${kpis.totalRtsReturns}

Active Supplier Performance Data:
${JSON.stringify(sanitizedSupplierData, null, 2)}

Generate the ${tierSlug.toUpperCase()} JSON response adhering strictly to the instructed structure.
`;
}
