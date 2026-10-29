// ============================================================
// customer-incentive.export-model.ts
// Turns the report envelope into the tabular shape both exports render.
// Kept separate from the writers so the column set is unit-testable and the
// Excel and PDF outputs can never drift apart.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerIncentiveReportResponse,
} from "../types/customer-incentive.types";
import { CLAIM_STATUS_LABELS } from "../types/customer-incentive.types";
import { eligibleSizeLabel, round2 } from "./customer-incentive.helpers";

export type ReportExportCell = string | number | null;

export interface ReportExportSection {
  title: string;
  columns: string[];
  rows: ReportExportCell[][];
}

export interface FilterContextItem {
  label: string;
  value: string;
}

/**
 * The applied window, echoed so a recipient always knows what produced the
 * numbers. Labels come from the filter bar, never from a query. A multi-pick is
 * written out in full rather than counted, because whoever receives the file
 * cannot open the picker to see what "5 customers" covered.
 */
export function buildReportFilterContext(
  filters: AppliedFilterContext
): FilterContextItem[] {
  const items: FilterContextItem[] = [
    { label: "Period From", value: filters.startDate },
    { label: "Period To (cutoff)", value: filters.endDate },
    { label: "Eligible cylinder size", value: eligibleSizeLabel(filters) },
  ];

  const scope = (
    labels: string[] | undefined,
    ids: readonly (number | string)[] | undefined,
    idToText: (id: number | string) => string
  ): string | null => {
    if (labels?.length) return labels.join(", ");
    if (!ids?.length) return null;
    return ids.map(idToText).join(", ");
  };

  const named: [string, string[] | undefined, readonly (number | string)[] | undefined, (id: number | string) => string][] = [
    ["Customers", filters.customerLabels, filters.customerCodes, (id) => String(id)],
    ["Branches", filters.branchLabels, filters.branchIds, (id) => `Branch ${id}`],
    ["Salesmen", filters.salesmanLabels, filters.salesmanIds, (id) => `Salesman ${id}`],
    [
      "Classifications",
      filters.classificationLabels,
      filters.classificationIds,
      (id) => `Classification ${id}`,
    ],
  ];
  for (const [label, labels, ids, idToText] of named) {
    const value = scope(labels, ids, idToText);
    if (value) items.push({ label, value });
  }
  if (filters.claimStatus) {
    items.push({ label: "Claim status", value: CLAIM_STATUS_LABELS[filters.claimStatus] });
  }
  return items;
}

export function buildReportExportSections(
  report: CustomerIncentiveReportResponse
): ReportExportSection[] {
  const sizeKg =
    (report.filters.categoryIds?.length ?? 0) > 0
      ? eligibleSizeLabel(report.filters)
      : report.filters.sizeKg
        ? `${report.filters.sizeKg} kg`
        : "All sizes";

  const rows: ReportExportSection = {
    title: "Incentive by customer",
    columns: [
      "Customer code",
      "Customer",
      "Store",
      "Classification",
      "Branch",
      "Eligible size kg",
      "Gross units",
      "Returned units",
      "Eligible units",
      "Eligible kg",
      "Recorded ₱/kg",
      "Earned ₱",
      "Return adjustments ₱",
      "Claims",
      "Approved ₱",
      "Released ₱",
      "Outstanding ₱",
      "Variance ₱",
      "Implied ₱/kg",
      "Claim status",
      "Memo no.",
      "Payment ref.",
      "Exceptions",
    ],
    rows: report.rows.map((row) => [
      row.customerCode,
      row.customerName,
      row.storeName,
      row.classificationName,
      row.branchNames.join(", "),
      sizeKg,
      row.grossUnits,
      row.returnedUnits,
      row.eligibleUnits,
      row.eligibleKg,
      row.ratePerKg,
      row.earnedAmount,
      row.adjustmentAmount,
      row.claimCount,
      row.approvedAmount,
      row.releasedAmount,
      row.outstandingAmount,
      row.varianceAmount,
      row.impliedRatePerKg,
      row.statusLabel,
      row.memoNumbers.join(", "),
      row.paymentReferences.join(", "),
      row.exceptionCodes.join(", "),
    ]),
  };

  const evidence: ReportExportSection = {
    title: "Eligible volume detail",
    columns: [
      "Customer",
      "Branch",
      "Product code",
      "Product",
      "Size kg",
      "Gross units",
      "Returned units",
      "Eligible units",
      "Eligible kg",
      "Recorded ₱/kg",
      "Earned ₱",
      "Adjustments ₱",
      "Invoices",
      "Returns",
      "Salesmen",
    ],
    rows: report.rows.flatMap((row) =>
      row.evidence.map((item) => [
        row.customerName,
        item.branchName,
        item.productCode,
        item.productName,
        item.sizeKg,
        item.grossUnits,
        item.returnedUnits,
        item.eligibleUnits,
        item.eligibleKg,
        item.ratePerKg,
        item.earnedAmount,
        item.adjustmentAmount,
        item.invoiceCount,
        item.returnCount,
        item.salesmanNames.join(", "),
      ])
    ),
  };

  const claims: ReportExportSection = {
    title: "Claims (customer memos)",
    columns: [
      "Memo no.",
      "Claim status",
      "Approved ₱",
      "Released ₱",
      "Outstanding ₱",
      "Created",
      "Updated",
      "GL account",
      "Payment reference",
      "Review reason",
    ],
    rows: report.claims.map((claim) => [
      claim.memoNumber,
      claim.statusLabel,
      claim.approvedAmount,
      claim.releasedAmount,
      round2(Math.max(0, claim.approvedAmount - claim.releasedAmount)),
      claim.createdAt,
      claim.updatedAt,
      claim.accountTitle,
      claim.paymentReferences.join(", "),
      claim.reason,
    ]),
  };

  const exceptions: ReportExportSection = {
    title: "Data exceptions",
    columns: ["Code", "Severity", "Customer", "Reference type", "Reference no.", "Amount ₱", "Detail"],
    rows: report.exceptions.map((item) => [
      item.code,
      item.severity,
      item.customerName,
      item.referenceType,
      item.referenceNo,
      item.amount,
      item.detail,
    ]),
  };

  return [rows, evidence, claims, exceptions];
}
