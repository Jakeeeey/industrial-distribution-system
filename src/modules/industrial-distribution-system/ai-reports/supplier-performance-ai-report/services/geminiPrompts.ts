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
The user is an executive interrogating the active supplier performance dataset.
CRITICAL CONSTRAINT: You MUST answer the user's inquiry strictly in 1 to 2 sentences maximum.
Your answer must be brief, highly accurate, and contain concrete figures from the dataset (such as vendor names, OTIF %, or RTS counts).
Do not use markdown headers, asterisks, bullet points, or introductory conversational filler. Be clear, direct, and actionable.`;
    }

    if (tierSlug === 'basic') {
        return `${baseDirectives}
Current Tier: BASIC
Your JSON output MUST adhere to this exact structure:
{
  "summary": "Strictly 1 to 2 sentences describing enterprise OTIF and defect posture.",
  "keyExposures": [
    "Exposure 1: 1 sentence citing vendor name and exact metric",
    "Exposure 2: 1 sentence citing vendor name and exact metric"
  ],
  "strategicActions": [
    "Action 1: 1 sentence stating concrete procurement follow-up",
    "Action 2: 1 sentence stating concrete procurement follow-up"
  ]
}
Constraints: Strictly 1 to 2 sentences per field. No lengthy filler prose.`;
    }

    if (tierSlug === 'pro') {
        return `${baseDirectives}
Current Tier: PRO
Provide root-cause insights correlating delayed orders with split receipts and RTS defect item remarks.
All fields must be strictly 1 to 2 sentences maximum. Mention exact numbers and vendor names.
Return JSON with "summary" (1-2 sentences), "keyExposures" (2 items, 1 sentence each), and "strategicActions" (2 items, 1 sentence each).`;
    }

    // Tier 3: Executive Strategic Pillars
    return `${baseDirectives}
Current Tier: EXECUTIVE STRATEGIC
Deliver a high-impact, ultra-concise C-Suite briefing structured around 3 Strategic Pillars.
CRITICAL EXECUTIVE CONSTRAINT:
1. Every field in the JSON (summary, each pillar's findings, each key exposure, and each strategic action) MUST BE STRICTLY 1 TO 2 SENTENCES MAXIMUM.
2. Information must be brief, highly accurate, and detailed with exact numbers (percentages, order counts, return quantities, vendor names).
3. Absolutely no lengthy paragraphs, no filler prose.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "Strictly 1 to 2 sentences synthesizing the overall risk posture and enterprise OTIF.",
  "executivePillars": [
    {
      "pillar": "Commercial & Margin Integrity",
      "status": "CRITICAL" | "MODERATE" | "STABLE",
      "findings": "Strictly 1 to 2 sentences analyzing pricing compliance and cost variances with exact figures."
    },
    {
      "pillar": "Supply Continuity & Logistics Friction",
      "status": "CRITICAL" | "MODERATE" | "STABLE",
      "findings": "Strictly 1 to 2 sentences analyzing OTIF delivery failures and split shipment drag with exact figures."
    },
    {
      "pillar": "Vendor Governance & QBR Leverage",
      "status": "ACTION_REQUIRED",
      "findings": "Strictly 1 to 2 sentences detailing contractual probation or negotiation leverage."
    }
  ],
  "keyExposures": [
    "Strictly 1 sentence naming high-risk supplier and exact metric.",
    "Strictly 1 sentence naming high-risk supplier and exact metric."
  ],
  "strategicActions": [
    "Strictly 1 sentence specifying exact human procurement intervention.",
    "Strictly 1 sentence specifying exact human procurement intervention."
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

Provide an ultra-concise, accurate executive answer strictly in 1 to 2 sentences without headers, asterisks, or fluff. Include exact figures from the dataset.
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
