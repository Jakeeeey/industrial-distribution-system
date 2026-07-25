"use client";

import { Search } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportTableSearchProps {
  disabled: boolean;
  label: string;
  onValueChange(value: string): void;
  placeholder: string;
  value: string;
}

export function ReportTableSearch({
  disabled,
  label,
  onValueChange,
  placeholder,
  value,
}: ReportTableSearchProps): React.ReactElement {
  const inputId = React.useId();

  return (
    <div className="border-b bg-muted/5 p-3 sm:px-4">
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          className="bg-background pl-9"
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </div>
    </div>
  );
}
