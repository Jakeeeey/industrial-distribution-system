"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Filter,
  MoreHorizontal
} from "lucide-react";
import { ConsumptionBilling } from "../types";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface Props {
  onEdit: (id: number) => void;
  onCreate: () => void;
}

export function LpgBillingList({ onEdit, onCreate }: Props) {
  const [billings, setBillings] = useState<ConsumptionBilling[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const fetchBillings = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        page: String(page),
        limit: String(limit),
        sort: "-created_date"
      });
      const res = await fetch(`/api/ids/scm/inventory-management/lpg-billing?${query}`);
      const d = await res.json();
      setBillings(d.data || []);
      setTotal(d.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, page, limit]);

  useEffect(() => {
    fetchBillings();
  }, [fetchBillings]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "POSTED":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Posted</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search billing no or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Filter className="h-4 w-4" />
          </Button>
          <Button onClick={onCreate} className="h-10 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4 mr-2" />
            New Billing
          </Button>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-white/20 dark:border-zinc-800/50">
              <TableHead className="w-[150px]">Billing No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Total KG</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8} className="h-16 animate-pulse">
                    <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : billings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 opacity-20" />
                    No consumption billing found.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              billings.map((b) => (
                <TableRow key={b.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors border-white/20 dark:border-zinc-800/50">
                  <TableCell className="font-mono font-bold text-blue-600">{b.billing_no}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.billing_date ? format(new Date(b.billing_date), "MMM dd, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{b.customer?.customer_name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{b.customer_code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{b.site?.site_name || "—"}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {b.total_billable_kg.toFixed(2)} <span className="text-[10px] text-muted-foreground">kg</span>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₱ {b.grand_total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(b.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onEdit(b.id!)} className="cursor-pointer">
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination placeholder */}
        {total > limit && (
          <div className="p-4 border-t border-white/20 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-xs text-muted-foreground">Showing {billings.length} of {total} results</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="h-8"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
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
