"use client";

import React, { memo } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Info, MoreHorizontal, Pencil } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CustomerWithRelations } from "../types";

interface CustomerRowProps {
  customer: CustomerWithRelations;
  classificationLabel: string;
  activeDepositsLabel?: string | null;
  onEdit: (customer: CustomerWithRelations) => void;
  onChangeStatus?: (customer: CustomerWithRelations, status: string) => void;
}

export const CustomerRow = memo(function CustomerRow({
  customer,
  classificationLabel,
  activeDepositsLabel,
  onEdit,
  onChangeStatus,
}: CustomerRowProps) {
  const router = useRouter();

  const handleViewHistory = () => {
    const code = customer.customer_code || String(customer.id);
    router.push(
      `/ids/crm/customer-management/customer-history?customerId=${encodeURIComponent(code)}`,
    );
  };
  const address =
    [customer.brgy, customer.city, customer.province]
      .filter(Boolean)
      .join(", ") || "—";
  const tierLabel = classificationLabel || "Unclassified";
  const depositLabel = (activeDepositsLabel || "").trim();
  const rawStatus =
    (
      customer as CustomerWithRelations & {
        status?: string;
        profile_status?: string;
      }
    ).status ?? customer.profile_status;
  const statusLabel = String(rawStatus || "Undefined");
  const statusKey = statusLabel.toLowerCase();
  const currentStatusValue = statusKey.includes("active")
    ? "ACTIVE"
    : statusKey.includes("suspend")
      ? "SUSPENDED"
      : statusKey.includes("archive")
        ? "ARCHIVE"
        : "DRAFT";
  const PROFILE_STATUS_OPTIONS = ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVE"];

  const tierClasses = cn(
    "text-[10px] font-semibold px-2 py-0.5",
    tierLabel.toLowerCase().includes("walk") &&
      "bg-blue-100 text-blue-700 border-blue-200",
    tierLabel.toLowerCase().includes("commercial") &&
      "bg-emerald-100 text-emerald-700 border-emerald-200",
    tierLabel.toLowerCase().includes("retail") &&
      "bg-orange-100 text-orange-700 border-orange-200",
    tierLabel.toLowerCase().includes("residential") &&
      "bg-purple-100 text-purple-700 border-purple-200",
    tierLabel.toLowerCase().includes("dealer") &&
      "bg-indigo-100 text-indigo-700 border-indigo-200",
    !tierLabel.toLowerCase().includes("walk") &&
      !tierLabel.toLowerCase().includes("commercial") &&
      !tierLabel.toLowerCase().includes("retail") &&
      !tierLabel.toLowerCase().includes("residential") &&
      !tierLabel.toLowerCase().includes("dealer") &&
      "bg-muted text-muted-foreground border-border",
  );

  const statusClasses = cn(
    "text-[10px] font-semibold px-2 py-0.5",
    statusKey.includes("active") &&
      "bg-emerald-100 text-emerald-700 border-emerald-200",
    statusKey.includes("draft") &&
      "bg-amber-100 text-amber-700 border-amber-200",
    statusKey.includes("suspend") && "bg-red-100 text-red-700 border-red-200",
    statusKey.includes("archiv") &&
      "bg-slate-100 text-slate-600 border-slate-200",
    !statusKey.includes("active") &&
      !statusKey.includes("draft") &&
      !statusKey.includes("suspend") &&
      !statusKey.includes("archiv") &&
      "bg-muted text-muted-foreground border-border",
  );

  return (
    <TableRow className="hover:bg-muted/40 transition-all duration-200 group animate-in fade-in slide-in-from-bottom-1 hover:scale-[1.002] active:scale-[0.998] cursor-default">
      <TableCell className="px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                statusKey.includes("active") && "bg-emerald-500",
                statusKey.includes("draft") && "bg-amber-500",
                statusKey.includes("suspend") && "bg-red-500",
                statusKey.includes("archiv") && "bg-slate-400",
                !statusKey.includes("active") &&
                  !statusKey.includes("draft") &&
                  !statusKey.includes("suspend") &&
                  !statusKey.includes("archiv") &&
                  "bg-muted-foreground",
              )}
            />
            <span className="font-semibold text-sm leading-tight text-foreground">
              {customer.customer_name}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            {customer.customer_code || "—"}
            {customer.store_name &&
            customer.store_name !== customer.customer_name
              ? ` • ${customer.store_name}`
              : ""}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3">
        <Badge variant="outline" className={tierClasses}>
          {tierLabel.toUpperCase()}
        </Badge>
      </TableCell>

      <TableCell className="px-4 py-3">
        <Badge variant="outline" className={statusClasses}>
          {statusLabel.toUpperCase()}
        </Badge>
      </TableCell>

      <TableCell className="px-4 py-3">
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-foreground">
            {customer.contact_number || "—"}
          </span>
          {customer.customer_email && (
            <span className="text-[11px] text-muted-foreground truncate max-w-45">
              {customer.customer_email}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-xs text-muted-foreground max-w-30 truncate cursor-help">
              {address}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{address}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="px-4 py-3">
        {depositLabel ? (
          <Badge
            variant="outline"
            className="text-[10px] font-semibold px-2 py-0.5"
          >
            {depositLabel}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">None</span>
        )}
      </TableCell>
      <TableCell className="text-right px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100"
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(customer)}>
              <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewHistory}>
              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
              View Customer History
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={!onChangeStatus}>
                <Info className="mr-2 h-4 w-4 text-muted-foreground" />
                Change Profile Status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuRadioGroup
                  value={currentStatusValue}
                  onValueChange={(value) => onChangeStatus?.(customer, value)}
                >
                  {PROFILE_STATUS_OPTIONS.map((status) => (
                    <DropdownMenuRadioItem key={status} value={status}>
                      {status}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
