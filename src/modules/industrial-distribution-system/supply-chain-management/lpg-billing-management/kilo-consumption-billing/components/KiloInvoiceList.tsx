"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useKiloInvoiceList } from "../hooks/useKiloConsumption";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, React.ReactNode> = {
  DRAFT: (
    <Badge className="bg-zinc-100 text-zinc-700 border-none text-[10px] font-bold uppercase tracking-wider">
      Draft
    </Badge>
  ),
  POSTED: (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] font-bold uppercase tracking-wider">
      Posted
    </Badge>
  ),
  CANCELLED: (
    <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
      Cancelled
    </Badge>
  ),
};

export function KiloInvoiceList() {
  const [search, setSearch] = useState("");
  const { rows, total, loading, params, setParams, refresh } = useKiloInvoiceList();

  const handleSearch = (v: string) => {
    setSearch(v);
    setParams((p) => ({ ...p, search: v, page: 1 }));
  };

  const limit = params.limit ?? 10;
  const page = params.page ?? 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="kilo-invoice-search"
            placeholder="Search invoice no or customer..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={refresh}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-white/20 dark:border-zinc-800/50">
              <TableHead>Invoice No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Billable KG</TableHead>
              <TableHead className="text-right">Price/KG</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-14 animate-pulse">
                      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : rows.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 opacity-20" />
                        No invoices found.
                      </div>
                    </TableCell>
                  </TableRow>
                )
              : rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors border-white/20 dark:border-zinc-800/50"
                  >
                    <TableCell className="font-mono font-bold text-orange-600">
                      {row.invoice_no}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.invoice_date
                        ? format(new Date(row.invoice_date), "MMM dd, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.customer?.customer_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {row.customer_code}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.site?.site_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.billable_kg != null
                        ? <><span className="font-bold">{Number(row.billable_kg).toFixed(3)}</span> <span className="text-[10px] text-muted-foreground">kg</span></>
                        : "—"
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ₱ {Number(row.price_per_kg).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-zinc-900 dark:text-white">
                      ₱ {Number(row.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      {STATUS_BADGE[row.status] ?? <Badge variant="outline">{row.status}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {total > limit && (
          <div className="p-4 border-t border-white/20 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-xs text-muted-foreground">
              Showing {rows.length} of {total} results
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                className="h-8"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                className="h-8"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
