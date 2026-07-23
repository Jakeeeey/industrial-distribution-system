"use client";

import { Search } from "lucide-react";
import type * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatReportLookupLabel } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.filter-context";
import type { ReportLookupOption } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

interface ReportSearchLookupInputProps {
  id: string;
  label: string;
  onValueChange(value: string): void;
  options: ReportLookupOption[];
  placeholder: string;
  value: string;
}

export function ReportSearchLookupInput({
  id,
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: ReportSearchLookupInputProps): React.ReactElement {
  const optionsId = `${id}-options`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          list={optionsId}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-8"
        />
        <datalist id={optionsId}>
          {options.map((option) => (
            <option
              key={option.value}
              value={formatReportLookupLabel(option)}
            />
          ))}
        </datalist>
      </div>
    </div>
  );
}
