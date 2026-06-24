// components/CustomerCylinderDetailView.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Premium detailed dashboard for a specific customer.
// Displays customer profile card, key aging stats, and two tables:
//   1. Connected Cylinders (reusing CylinderAgingTable columns)
//   2. Transaction History (IN / OUT movement log)
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Calendar,
  Building,
  Phone,
  Mail,
  MapPin,
  Clock,
  Package,
  AlertTriangle,
  History,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";

import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import {
  formatDaysWithCustomer,
  formatAgingBasisSource,
  formatDate,
  resolveCustomerSegment,
} from "../services";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Currency Formatter ────────────────────────────────────────────────────────
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// ── Sort Header Helper ────────────────────────────────────────────────────────
interface SortHeaderProps<T extends string> {
  label: string;
  sortKey: T;
  currentKey: string;
  currentDir: "asc" | "desc";
  onSort: (key: T) => void;
}

function SortHeader<T extends string>({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: SortHeaderProps<T>) {
  const isActive = currentKey === sortKey;
  return (
    <button
      // Soft gray uppercase tracking-wider text-[10px] style
      className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3 text-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-foreground" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground/80" />
      )}
    </button>
  );
}

// ── Detail View Component ─────────────────────────────────────────────────────
export function CustomerCylinderDetailView() {
  const { customerDetail, isLoading } = useCustomerCylinderAging();

  // State for the Call Customer modal
  const [callModalOpen, setCallModalOpen] = React.useState(false);
  // State for the Email Confirmation modal
  const [emailModalOpen, setEmailModalOpen] = React.useState(false);
  const [emailSending, setEmailSending] = React.useState(false);
  const [cylinderSearch, setCylinderSearch] = React.useState("");
  const [txSearch, setTxSearch] = React.useState("");

  // Sort states
  const [cylSortKey, setCylSortKey] = React.useState<"serialNumber" | "productCode" | "daysWithCustomer">("daysWithCustomer");
  const [cylSortDir, setCylSortDir] = React.useState<"asc" | "desc">("desc");

  const [txSortKey, setTxSortKey] = React.useState<"transactionDate" | "serialNumber" | "netAmount">("transactionDate");
  const [txSortDir, setTxSortDir] = React.useState<"asc" | "desc">("desc");

  // Pagination states
  const [cylPage, setCylPage] = React.useState(1);
  const [cylPageSize, setCylPageSize] = React.useState(10);

  const [txPage, setTxPage] = React.useState(1);
  const [txPageSize, setTxPageSize] = React.useState(10);

  if (isLoading || !customerDetail) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        {/* Header Skeleton */}
        <div className="flex-none px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Scrollable Content Skeleton */}
        <div className="flex-1 p-6 space-y-4 overflow-y-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Profile Card Skeleton */}
            <Card className="lg:col-span-1 shadow-sm border-border flex flex-col p-0 gap-0">
              <div className="py-3 px-4 border-b border-border/50 bg-muted/10">
                <Skeleton className="h-4 w-32" />
              </div>
              <CardContent className="p-4 space-y-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="h-3 w-full max-w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="p-3 bg-muted/20 border-t border-border/50 flex gap-2 mt-auto">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </Card>

            {/* KPI Cards Skeleton */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border shadow-sm flex flex-col justify-between p-0 gap-0">
                  <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-2.5 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Tabs & Table Skeleton */}
          <div className="mt-4">
            <div className="flex gap-2 mb-4 border-b border-border/40 pb-2">
              <Skeleton className="h-9 w-40 rounded-md" />
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
            <Card className="border-border shadow-sm overflow-hidden p-0 gap-0">
              <div className="p-3 bg-muted/10 border-b border-border/40 flex items-center justify-between">
                <Skeleton className="h-8 w-64 rounded-md" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableHead key={i} className="py-2.5 px-4"><Skeleton className="h-4 w-full" /></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Computations for KPI cards ──────────────────────────────────────────────
  const connected = customerDetail.connectedCylinders;
  const totalCyls = connected.length;

  const validDays = connected
    .map((c) => c.daysWithCustomer)
    .filter((d): d is number => d !== null);

  const avgDays =
    validDays.length > 0 ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length) : 0;
  const maxDays = validDays.length > 0 ? Math.max(...validDays) : 0;

  const warningCyls = connected.filter((c) => c.daysWithCustomer !== null && c.daysWithCustomer >= 31 && c.daysWithCustomer < 91).length;
  const criticalCyls = connected.filter((c) => c.daysWithCustomer !== null && c.daysWithCustomer >= 91).length;

  // Resolve customer segment info once at the top level for profile and table use
  const segmentInfo = resolveCustomerSegment(customerDetail.customerName, customerDetail.storeName);

  // Note: Calculated product capacities mix was removed here since the Connected Product Mix card was removed to prevent user confusion.

  // ── Pipeline: Connected Cylinders ──────────────────────────────────────────
  const filteredCyls = connected.filter((c) => {
    if (!cylinderSearch) return true;
    const term = cylinderSearch.toLowerCase();
    return (
      c.serialNumber.toLowerCase().includes(term) ||
      (c.productCode || "").toLowerCase().includes(term) ||
      (c.productName || "").toLowerCase().includes(term)
    );
  });

  const sortedCyls = [...filteredCyls].sort((a, b) => {
    const av = a[cylSortKey] ?? "";
    const bv = b[cylSortKey] ?? "";
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return cylSortDir === "asc" ? cmp : -cmp;
  });

  const totalCylPages = Math.max(1, Math.ceil(sortedCyls.length / cylPageSize));
  const paginatedCyls = sortedCyls.slice((cylPage - 1) * cylPageSize, cylPage * cylPageSize);

  // ── Pipeline: Transaction History ──────────────────────────────────────────
  const filteredTxs = customerDetail.transactions.filter((t) => {
    if (!txSearch) return true;
    const term = txSearch.toLowerCase();
    return (
      t.serialNumber.toLowerCase().includes(term) ||
      (t.productCode || "").toLowerCase().includes(term) ||
      (t.referenceNo || "").toLowerCase().includes(term) ||
      t.movementType.toLowerCase().includes(term)
    );
  });

  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const av = a[txSortKey] ?? "";
    const bv = b[txSortKey] ?? "";
    let cmp = 0;
    if (txSortKey === "transactionDate") {
      cmp = new Date(av).getTime() - new Date(bv).getTime();
    } else if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return txSortDir === "asc" ? cmp : -cmp;
  });

  const totalTxPages = Math.max(1, Math.ceil(sortedTxs.length / txPageSize));
  const paginatedTxs = sortedTxs.slice((txPage - 1) * txPageSize, txPage * txPageSize);

  const handleCylSort = (key: typeof cylSortKey) => {
    if (cylSortKey === key) {
      setCylSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setCylSortKey(key);
      setCylSortDir("asc");
    }
    setCylPage(1);
  };

  const handleTxSort = (key: typeof txSortKey) => {
    if (txSortKey === key) {
      setTxSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTxSortKey(key);
      setTxSortDir("asc");
    }
    setTxPage(1);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* ── Header Toolbar (Fixed at Top) ─────────────────────────────────── */}
      <div className="flex-none px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/10">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 pr-12">
            <Building className="h-5 w-5 text-muted-foreground" />
            {customerDetail.customerName || "Customer Details"}
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
            Customer Code: {customerDetail.customerCode} · Profile View
          </p>
        </div>
      </div>

      {/* ── Scrollable Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* ── Dashboard Grid: Balance profile & KPI metrics side-by-side on desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Customer Profile Card with initials avatar and Call/Email actions */}
          <Card className="lg:col-span-1 border-border shadow-sm overflow-hidden flex flex-col justify-between bg-card p-0 gap-0">
            <div className="bg-muted/30 border-b border-border py-3 px-4">
              <div className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground font-bold">
                Customer Profile
              </div>
            </div>
            <CardContent className="p-4 space-y-3.5 text-xs flex-1">
              {/* Avatar section */}
              <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {customerDetail.customerName ? customerDetail.customerName.slice(0, 2).toUpperCase() : "CU"}
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block text-muted-foreground leading-none">
                    Customer Code
                  </span>
                  <span className="text-foreground font-semibold font-mono text-[11px] mt-1 block">
                    {customerDetail.customerCode}
                  </span>
                </div>
              </div>

              {/* Segment Badge */}
              <div className="flex items-start gap-2 pt-1">
                <Badge variant="outline" className={`text-[9px] uppercase font-bold py-0.5 ${segmentInfo.badgeColor}`}>
                  {segmentInfo.label} Segment
                </Badge>
              </div>

              {/* Profile fields */}
              {customerDetail.branchName && (
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Assigned Branch</span>
                    <span className="text-foreground font-medium">{customerDetail.branchName}</span>
                  </div>
                </div>
              )}
              {customerDetail.storeName && (
                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Store Name</span>
                    <span className="text-foreground font-medium">{customerDetail.storeName}</span>
                  </div>
                </div>
              )}
              {customerDetail.contactNumber && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Contact Number</span>
                    <span className="text-foreground font-medium">{customerDetail.contactNumber}</span>
                  </div>
                </div>
              )}
              {customerDetail.customerEmail && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Email Address</span>
                    <span className="text-foreground font-medium">{customerDetail.customerEmail}</span>
                  </div>
                </div>
              )}
              {customerDetail.customerAddress && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Billing/Delivery Address</span>
                    <span className="text-foreground font-medium leading-relaxed">{customerDetail.customerAddress}</span>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Quick Actions Footer - centralizing row actions inside customer profile */}
            <div className="p-3 bg-muted/20 border-t border-border/50 flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 font-bold text-[10px] md:text-xs rounded-lg transition-colors gap-1.5 h-8 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setCallModalOpen(true)}
              >
                <PhoneCall className="h-3.5 w-3.5" /> Call Customer
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-bold text-[10px] md:text-xs rounded-lg transition-colors gap-1.5 h-8"
                disabled={!customerDetail.customerEmail}
                onClick={() => setEmailModalOpen(true)}
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
            </div>
          </Card>

          {/* ── Call Customer Modal ──────────────────────────────────────── */}
          <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
            <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
              <DialogTitle className="sr-only">Call Customer</DialogTitle>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-blue-600 text-white">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">{customerDetail?.customerName || "Customer"}</div>
                  <div className="text-[11px] text-blue-100 mt-0.5">{customerDetail?.customerCode}</div>
                </div>
              </div>
              {/* Body */}
              <div className="px-5 py-5 space-y-3">
                {customerDetail?.contactNumber ? (
                  <>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Contact Number</p>
                    <a
                      href={`tel:${customerDetail.contactNumber}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                        <Phone className="h-4 w-4 text-blue-500" />
                      </div>
                      <span className="font-mono font-bold text-lg text-foreground tracking-wide">
                        {customerDetail.contactNumber}
                      </span>
                    </a>
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      Tap the number to call on mobile devices.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                    <Phone className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">No contact number on record</p>
                    <p className="text-xs text-center opacity-70">Update the customer profile to add a contact number.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {/* ── Email Confirmation Modal ───────────────────────────────── */}
          <Dialog open={emailModalOpen} onOpenChange={(open) => { if (!emailSending) setEmailModalOpen(open); }}>
            <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
              <DialogTitle className="sr-only">Send Email Confirmation</DialogTitle>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-muted/30 border-b border-border">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight text-foreground">Send Aging Statement</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Confirm email delivery</div>
                </div>
              </div>
              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  You are about to send a cylinder aging statement email to:
                </p>
                {/* Recipient card */}
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-mono text-sm font-semibold text-foreground truncate">
                      {customerDetail?.customerEmail}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground ml-5">
                    {customerDetail?.customerName}
                    {customerDetail?.storeName ? ` · ${customerDetail.storeName}` : ""}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This will include their {totalCyls} connected cylinder(s), aging metrics, and recommended actions.
                </p>
              </div>
              {/* Footer actions */}
              <div className="flex gap-2 px-5 pb-5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg font-semibold h-9"
                  disabled={emailSending}
                  onClick={() => setEmailModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-lg font-semibold h-9 bg-primary hover:bg-primary/90"
                  disabled={emailSending}
                  onClick={async () => {
                    if (!customerDetail?.customerEmail) return;
                    setEmailSending(true);
                    const promise = fetch("/api/ids/bia/customer-cylinder-aging", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: customerDetail.customerEmail,
                        customerName: customerDetail.customerName,
                        customerCode: customerDetail.customerCode,
                        storeName: customerDetail.storeName,
                        contactNumber: customerDetail.contactNumber,
                        customerEmail: customerDetail.customerEmail,
                        connectedCylinders: connected.map((c) => ({
                          serialNumber: c.serialNumber,
                          productName: c.productName,
                          productCode: c.productCode,
                          deployedDate: c.deployedDate,
                          daysWithCustomer: c.daysWithCustomer,
                        })),
                        avgDays,
                        maxDays,
                        warningCyls,
                        criticalCyls,
                      }),
                    }).then(async (res) => {
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.message || "Failed to send email");
                      return data;
                    });
                    toast.promise(promise, {
                      loading: `Sending to ${customerDetail.customerEmail}...`,
                      success: "Aging statement sent successfully!",
                      error: (err) => `Failed: ${err.message}`,
                    });
                    try {
                      await promise;
                    } catch { /* toast handles error */ } finally {
                      setEmailSending(false);
                      setEmailModalOpen(false);
                    }
                  }}
                >
                  {emailSending ? "Sending..." : "Confirm Send"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <Card className="border-border shadow-sm hover:shadow transition-shadow flex flex-col justify-between p-0 gap-0">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  <Package className="h-4 w-4 text-primary" /> Active Cylinders
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground mt-2">{totalCyls}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Currently connected</div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:shadow transition-shadow flex flex-col justify-between p-0 gap-0">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  <Clock className="h-4 w-4 text-emerald-500" /> Average Aging
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2">{avgDays} days</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Mean deployment span</div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:shadow transition-shadow flex flex-col justify-between p-0 gap-0">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  {maxDays >= 31 ? (
                    <AlertTriangle className={`h-4 w-4 ${maxDays >= 91 ? "text-destructive" : "text-amber-500"}`} />
                  ) : (
                    <Activity className="h-4 w-4 text-primary" />
                  )}
                  Max Aging
                </div>
                <div className={`text-2xl sm:text-3xl font-black mt-2 ${maxDays >= 91 ? "text-destructive" : maxDays >= 31 ? "text-amber-500" : "text-foreground"}`}>
                  {maxDays} days
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Longest deployment span</div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:shadow transition-shadow flex flex-col justify-between p-0 gap-0">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  <Calendar className="h-4 w-4 text-amber-500" /> Warning/Critical
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-500 flex items-baseline gap-1 mt-2">
                  {warningCyls + criticalCyls}
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground font-mono">
                    ({warningCyls} Warning / {criticalCyls} Critical)
                  </span>
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Aged over 30 days</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Detailed Lists Tabs: Full Width span below dashboard grid ── */}
        <Tabs defaultValue="connected" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connected" className="text-xs font-semibold gap-1.5">
              <Package className="h-4 w-4" /> Connected Cylinders ({totalCyls})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs font-semibold gap-1.5">
              <History className="h-4 w-4" /> Full Transaction History ({customerDetail.transactions.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Connected Cylinders */}
          <TabsContent value="connected" className="mt-4 border border-border bg-card rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/10">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="cca-detail-cyl-search"
                  placeholder="Search connected serial, product…"
                  value={cylinderSearch}
                  onChange={(e) => {
                    setCylinderSearch(e.target.value);
                    setCylPage(1);
                  }}
                  className="pl-8 h-8 text-xs rounded-lg"
                />
              </div>
              <span className="text-[10px] font-semibold font-mono text-muted-foreground uppercase mr-1">
                {filteredCyls.length} Matching
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10 border-b border-border/40">
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="w-10 text-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 py-2.5 px-2 md:py-3.5 md:px-4">#</TableHead>
                    <TableHead className="py-2.5 px-2 md:py-3.5 md:px-4">
                      <SortHeader
                        label="Asset / Serial"
                        sortKey="serialNumber"
                        currentKey={cylSortKey}
                        currentDir={cylSortDir}
                        onSort={handleCylSort}
                      />
                    </TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-2.5 px-2 md:py-3.5 md:px-4">Condition</TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-2.5 px-2 md:py-3.5 md:px-4">Deployed Date</TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-2.5 px-2 md:py-3.5 md:px-4">Deployment Basis</TableHead>
                    <TableHead className="py-2.5 px-2 md:py-3.5 md:px-4">
                      <SortHeader
                        label="Days Held & Status"
                        sortKey="daysWithCustomer"
                        currentKey={cylSortKey}
                        currentDir={cylSortDir}
                        onSort={handleCylSort}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCyls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground py-4 px-4">
                        No connected cylinders found matching filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCyls.map((c, idx) => {
                      const rIdx = (cylPage - 1) * cylPageSize + idx + 1;
                      const isOverdue = c.daysWithCustomer !== null && c.daysWithCustomer > segmentInfo.limitDays;
                      const statusBadgeColor = isOverdue
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 font-bold"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 font-bold";

                      return (
                        <TableRow key={`${c.cylinderAssetId}-${idx}`} className="hover:bg-muted/30 transition-colors border-b border-border/40 text-xs md:text-[13px]">
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4 text-center text-muted-foreground font-mono">{rIdx}</TableCell>
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4">
                            <div className="font-semibold text-foreground whitespace-nowrap text-xs md:text-sm">
                              {c.productName || c.productCode || "Cylinder Asset"}
                            </div>
                            <div className="text-[9px] md:text-[10px] text-muted-foreground font-mono mt-0.5">{c.serialNumber}</div>
                          </TableCell>
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-[9px] md:text-[10px] py-0 px-1.5 whitespace-nowrap font-semibold">
                              {c.cylinderCondition}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4 whitespace-nowrap font-medium text-muted-foreground">{formatDate(c.deployedDate)}</TableCell>
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4 text-[9px] md:text-[10px] font-medium text-muted-foreground leading-tight max-w-[120px] truncate" title={formatAgingBasisSource(c.agingBasisSource)}>
                            {formatAgingBasisSource(c.agingBasisSource) || "—"}
                          </TableCell>
                          <TableCell className="py-2.5 px-2 md:py-4 md:px-4">
                            <div className="flex flex-col">
                              <Badge variant="outline" className={`w-fit text-[9px] md:text-[10px] py-0.5 px-2 ${statusBadgeColor}`}>
                                {formatDaysWithCustomer(c.daysWithCustomer)}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground font-mono font-bold mt-1 uppercase tracking-wider">
                                Limit: {segmentInfo.limitDays} Days
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Connected Cylinders Pagination */}
            <div className="flex flex-col gap-2 px-5 py-3 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
              <span className="text-xs text-muted-foreground font-medium">
                Showing {sortedCyls.length === 0 ? 0 : (cylPage - 1) * cylPageSize + 1} - {Math.min(sortedCyls.length, cylPage * cylPageSize)} of {sortedCyls.length}
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Rows:</span>
                  <Select value={String(cylPageSize)} onValueChange={(v) => { setCylPageSize(Number(v)); setCylPage(1); }}>
                    <SelectTrigger className="w-16 h-8 text-xs font-semibold rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={cylPage <= 1} onClick={() => setCylPage(p => p - 1)}>‹</Button>
                  <span className="text-xs font-mono font-bold px-2 min-w-10 text-center">{cylPage} / {totalCylPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={cylPage >= totalCylPages} onClick={() => setCylPage(p => p + 1)}>›</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Transaction History */}
          <TabsContent value="transactions" className="mt-4 border border-border bg-card rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/10">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="cca-detail-tx-search"
                  placeholder="Search transaction serial, product, ref…"
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  className="pl-8 h-8 text-xs rounded-lg"
                />
              </div>
              <span className="text-[10px] font-semibold font-mono text-muted-foreground uppercase mr-1">
                {filteredTxs.length} Transactions
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10 border-b border-border/40">
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="w-8 text-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 py-1.5 px-1 md:py-2 md:px-2.5">#</TableHead>
                    <TableHead className="py-1.5 px-1 md:py-2 md:px-2.5">
                      <SortHeader
                        label="Tx Date"
                        sortKey="transactionDate"
                        currentKey={txSortKey}
                        currentDir={txSortDir}
                        onSort={handleTxSort}
                      />
                    </TableHead>
                    <TableHead className="py-1.5 px-1 md:py-2 md:px-2.5">
                      <SortHeader
                        label="Serial No."
                        sortKey="serialNumber"
                        currentKey={txSortKey}
                        currentDir={txSortDir}
                        onSort={handleTxSort}
                      />
                    </TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 py-1.5 px-1 md:py-2 md:px-2.5">Product</TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-1.5 px-1 md:py-2 md:px-2.5">Movement</TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-1.5 px-1 md:py-2 md:px-2.5">Source</TableHead>
                    <TableHead className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap py-1.5 px-1 md:py-2 md:px-2.5">Ref No.</TableHead>
                    <TableHead className="py-1.5 px-1 md:py-2 md:px-2.5">
                      <SortHeader
                        label="Net Amount"
                        sortKey="netAmount"
                        currentKey={txSortKey}
                        currentDir={txSortDir}
                        onSort={handleTxSort}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTxs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-20 text-center text-xs text-muted-foreground py-4 px-4">
                        No transactions found matching filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTxs.map((t, idx) => {
                      const rIdx = (txPage - 1) * txPageSize + idx + 1;
                      const isOut = t.movementType === "OUT";
                      return (
                        <TableRow key={`${t.id}-${idx}`} className="hover:bg-muted/30 transition-colors border-b border-border/40 text-[11px] md:text-xs">
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 text-center text-muted-foreground font-mono">{rIdx}</TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 whitespace-nowrap font-medium text-muted-foreground">{formatDate(t.transactionDate)}</TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 font-mono font-bold whitespace-nowrap text-foreground">{t.serialNumber}</TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5">
                            <div className="font-semibold text-foreground whitespace-nowrap text-[11px] md:text-xs">{t.productCode}</div>
                            <div className="text-[8.5px] md:text-[9.5px] text-muted-foreground max-w-20 md:max-w-28 truncate mt-0.5" title={t.productName ?? ""}>
                              {t.productName}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5">
                            <Badge
                              variant={isOut ? "destructive" : "default"}
                              className="text-[8px] md:text-[9px] font-bold gap-0.5 flex items-center w-fit px-1 py-0"
                            >
                              {isOut ? (
                                <>
                                  <TrendingUp className="h-2.5 w-2.5 shrink-0" /> OUT
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-2.5 w-2.5 shrink-0" /> IN
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 whitespace-nowrap text-muted-foreground font-medium text-[10px] md:text-xs">
                            {t.sourceModule} · {t.transactionSource === "POS_TRANSACTION" ? "POS Tx" : "SO"}
                          </TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 whitespace-nowrap font-mono text-muted-foreground text-[10px] md:text-xs">{t.referenceNo || "—"}</TableCell>
                          <TableCell className="py-1 px-1 md:py-1.5 md:px-2.5 whitespace-nowrap font-mono font-semibold text-foreground text-[10px] md:text-xs">
                            {formatCurrency(t.netAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Transactions Pagination */}
            <div className="flex flex-col gap-2 px-5 py-3 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
              <span className="text-xs text-muted-foreground font-medium">
                Showing {sortedTxs.length === 0 ? 0 : (txPage - 1) * txPageSize + 1} - {Math.min(sortedTxs.length, txPage * txPageSize)} of {sortedTxs.length}
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Rows:</span>
                  <Select value={String(txPageSize)} onValueChange={(v) => { setTxPageSize(Number(v)); setTxPage(1); }}>
                    <SelectTrigger className="w-16 h-8 text-xs font-semibold rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>‹</Button>
                  <span className="text-xs font-mono font-bold px-2 min-w-10 text-center">{txPage} / {totalTxPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={txPage >= totalTxPages} onClick={() => setTxPage(p => p + 1)}>›</Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

}
