"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type { BranchInfo } from "../type";

interface BranchSelectorProps {
    branches: BranchInfo[];
    selectedBranchId: number | null;
    onSelect: (id: number | null) => void;
    disabled?: boolean;
}

export function BranchSelector({
    branches,
    selectedBranchId,
    onSelect,
    disabled,
}: BranchSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
                value={selectedBranchId !== null ? String(selectedBranchId) : ""}
                onValueChange={(val) => onSelect(val ? Number(val) : null)}
                disabled={disabled}
            >
                <SelectTrigger className="w-[220px]" id="branch-selector">
                    <SelectValue placeholder="Select a branch…" />
                </SelectTrigger>
                <SelectContent>
                    {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                            {b.branch_name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
