"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetLedgerEntry } from "../types";
import { cn } from "@/lib/utils";
import { Cylinder } from "lucide-react";

interface AssetLedgerProps {
  entries: AssetLedgerEntry[];
  totalDeployed: number;
  totalReturned: number;
  isLoading?: boolean;
}

export function AssetLedger({ entries, totalDeployed, totalReturned, isLoading }: AssetLedgerProps) {
  const netMissing = totalDeployed - totalReturned;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Cylinder className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Cylinder Asset Movement</h3>
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          {entries.length} entries
        </Badge>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
            <span className="text-muted-foreground">Deployed:</span>
            <span className="font-bold">{totalDeployed}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-muted-foreground">Returned:</span>
            <span className="font-bold">{totalReturned}</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full inline-block",
                netMissing === 0 ? "bg-emerald-500" : netMissing < 10 ? "bg-yellow-500" : "bg-red-500",
              )}
            />
            <span className="text-muted-foreground">Missing:</span>
            <span
              className={cn(
                "font-bold",
                netMissing === 0 ? "text-emerald-600" : netMissing < 10 ? "text-yellow-600" : "text-red-600",
              )}
            >
              {netMissing}
            </span>
          </span>
        </div>
      </div>

      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 px-4 text-xs font-semibold w-30">Reference</TableHead>
              <TableHead className="h-9 px-4 text-xs font-semibold w-32.5">Date</TableHead>
              <TableHead className="h-9 px-4 text-xs font-semibold text-center">Deployed</TableHead>
              <TableHead className="h-9 px-4 text-xs font-semibold text-center">Returned</TableHead>
              <TableHead className="h-9 px-4 text-xs font-semibold text-center">Net Movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="px-4 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                  <TableCell className="px-4 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                  <TableCell className="px-4 py-3 text-center"><Skeleton className="h-5 w-14 rounded-full mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1 text-muted-foreground">
                    <Cylinder className="h-8 w-8 opacity-30" />
                    <span className="text-sm font-medium">No asset movements found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const net = entry.deployed - entry.returned;
                return (
                  <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-4 py-3 text-xs font-mono font-medium text-muted-foreground">
                      {entry.reference}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {entry.deployed > 0 ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 text-xs font-bold tabular-nums">
                          +{entry.deployed}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {entry.returned > 0 ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs font-bold tabular-nums">
                          -{entry.returned}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          net === 0
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            : net > 0
                            ? "bg-red-500/10 text-red-700 border-red-200"
                            : "bg-emerald-500/10 text-emerald-700 border-emerald-200",
                        )}
                      >
                        {net > 0 ? `+${net}` : net}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
