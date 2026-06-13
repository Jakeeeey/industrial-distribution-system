// PostedHeaderTransactionList.tsx
// AG-CHANGE: Created to display all lpg_metered_wiwo_transactions for a POSTED header.
// Renders as a read-only table list — no actions allowed once a header is POSTED.
"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, CheckCircle2, RefreshCw, Scale, Receipt } from "lucide-react";
import type { MeteredWiwoTransaction, LpgTransactionHeader } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PostedHeaderTransactionListProps {
  header: LpgTransactionHeader;
}

export function PostedHeaderTransactionList({ header }: PostedHeaderTransactionListProps) {
  const [transactions, setTransactions] = useState<MeteredWiwoTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all transactions for this specific header using the transaction_header_id filter
      const res = await fetch(
        `/api/ids/scm/lpg-billing-management/wiwo-billing?type=header-transactions&headerId=${header.header_id}`
      );
      const json = await res.json();
      setTransactions(json.data ?? []);
    } catch (err) {
      console.error("Failed to fetch header transactions", err);
    } finally {
      setLoading(false);
    }
  }, [header.header_id]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const statusColor = (status: string) => {
    if (status === "POSTED") return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    if (status === "CANCELLED") return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  };

  return (
    <div className="bg-card/80 backdrop-blur-md border border-border rounded-3xl shadow-md w-full animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Linked Transactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All billing records for this posted header</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchTransactions()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <Receipt className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">No transactions found for this header.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-border bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-accent/30"
              >
                {/* Left: Transaction Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-foreground truncate">{tx.transaction_no}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.customer?.customer_name || tx.customer_code}
                      {tx.site?.site_name && <span> — {tx.site.site_name}</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{tx.transaction_date}</span>
                    </div>
                  </div>
                </div>

                {/* Right: KG, Source, Status */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Billable KG</p>
                    <p className="font-bold text-foreground text-base">{Number(tx.billable_kg ?? 0).toFixed(3)} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Source</p>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider mt-0.5">
                      {tx.billable_source}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                      {tx.transaction_type?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}

            {/* Summary Footer */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center justify-between mt-2">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} linked to this header
              </p>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Total Billable:{" "}
                {transactions.reduce((sum, t) => sum + Number(t.billable_kg ?? 0), 0).toFixed(3)} kg
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
