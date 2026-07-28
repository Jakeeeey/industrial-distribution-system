"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatReportLookupLabel } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.filter-context";
import type { ReportLookupOption } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

interface ReportSearchLookupInputProps {
  id: string;
  label: string;
  onValueChange(value: string): void;
  options: ReportLookupOption[];
  placeholder: string;
  value: string;
  disabled?: boolean;
  allOptionLabel?: string;
}

// Development comment: Converted native HTML datalist to shadcn global SearchableSelect combobox component.
export function ReportSearchLookupInput({
  id,
  label,
  onValueChange,
  options,
  placeholder,
  value,
  disabled = false,
  allOptionLabel,
}: ReportSearchLookupInputProps): React.ReactElement {
  const formattedOptions = React.useMemo(() => {
    const list = options.map((option) => ({
      value: option.value,
      label: formatReportLookupLabel(option),
    }));
    if (allOptionLabel) {
      return [{ value: "all", label: allOptionLabel }, ...list];
    }
    return list;
  }, [options, allOptionLabel]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <SearchableSelect
        options={formattedOptions}
        value={value || (allOptionLabel ? "all" : "")}
        onValueChange={onValueChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full justify-between"
      />
    </div>
  );
}

