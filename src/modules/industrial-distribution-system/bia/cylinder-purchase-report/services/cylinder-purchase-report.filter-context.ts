import type {
  AppliedFilterContext,
  ReportLookupOption,
  ReportLookupType,
} from "../types/cylinder-purchase-report.types.ts";

export function formatReportLookupLabel(option: ReportLookupOption): string {
  const label = option.label.trim();
  const code = option.code?.trim();
  return code && code !== label ? `${label} (${code})` : label;
}

function positiveInteger(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function applyReportLookupSelection(
  filters: AppliedFilterContext,
  type: ReportLookupType,
  option?: ReportLookupOption,
): AppliedFilterContext {
  const next = { ...filters };
  const label = option ? formatReportLookupLabel(option) : undefined;

  switch (type) {
    case "customers": {
      delete next.customerCode;
      delete next.customerLabel;
      const customerCode = option?.value.trim();
      if (customerCode) {
        next.customerCode = customerCode;
        next.customerLabel = label;
      }
      return next;
    }
    case "products": {
      delete next.productId;
      delete next.productLabel;
      const productId = option ? positiveInteger(option.value) : undefined;
      if (productId !== undefined) {
        next.productId = productId;
        next.productLabel = label;
      }
      return next;
    }
    case "branches": {
      delete next.branchId;
      delete next.branchLabel;
      const branchId = option ? positiveInteger(option.value) : undefined;
      if (branchId !== undefined) {
        next.branchId = branchId;
        next.branchLabel = label;
      }
      return next;
    }
    case "salespeople": {
      delete next.salesmanId;
      delete next.salespersonLabel;
      const salesmanId = option ? positiveInteger(option.value) : undefined;
      if (salesmanId !== undefined) {
        next.salesmanId = salesmanId;
        next.salespersonLabel = label;
      }
      return next;
    }
  }
}
