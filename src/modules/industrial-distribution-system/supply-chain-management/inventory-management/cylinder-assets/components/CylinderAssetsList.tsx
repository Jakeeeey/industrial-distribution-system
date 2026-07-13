import { CylinderAsset } from "../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Search, Cylinder, ArrowUp, ArrowDown, ArrowUpDown, X, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useReactToPrint } from "react-to-print";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  QrCode,
  CheckCircle2,
  ShieldAlert
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { format, isPast, isBefore, addDays } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Barcode as BarcodeIcon } from "lucide-react";

interface Props {
  data: CylinderAsset[];
  onCreate: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  filters: {
    search: string;
    setSearch: (val: string) => void;
    branchId: number | undefined;
    setBranchId: (val: number | undefined) => void;
    status: string | undefined;
    setStatus: (val: string | undefined) => void;
    productId: number | undefined;
    setProductId: (val: number | undefined) => void;
    condition: string | undefined;
    setCondition: (val: string | undefined) => void;
    expirationStatus: string | undefined;
    setExpirationStatus: (val: string | undefined) => void;
  };
  pagination: {
    page: number;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    total: number;
  };
  sorting: {
    sortBy: string;
    sortOrder: "ASC" | "DESC";
    toggleSort: (field: string) => void;
  };
  globalStats: {
    available: number;
    withCustomer: number;
    expired: number;
    nearExpiration: number;
    total: number;
  };
}

export function CylinderAssetsList({ data, onCreate, onEdit, onDelete, filters, pagination, sorting, globalStats }: Props) {

  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CylinderAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isAllSelectedGlobal, setIsAllSelectedGlobal] = useState(false);
  const [isFetchingGlobal, setIsFetchingGlobal] = useState(false);
  const [globalAssets, setGlobalAssets] = useState<CylinderAsset[]>([]);
  const [printMode, setPrintMode] = useState<"QR" | "BARCODE">("QR");
  const [isBulkPrintDialogOpen, setIsBulkPrintDialogOpen] = useState(false);
  const [isBulkPreviewOpen, setIsBulkPreviewOpen] = useState(false);
  const [columns, setColumns] = useState(3);
  const [labelSize, setLabelSize] = useState(1);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [paperSize, setPaperSize] = useState<"A4" | "Letter">("Letter");

  const selectedAssets = isAllSelectedGlobal
    ? globalAssets
    : data.filter(item => selectedIds.some(id => String(id) === String(item.id)));

  // Calculate items per page based on layout dynamically so it doesn't overflow
  const itemsPerPage = useMemo(() => {
    let rows = 3;
    if (orientation === "portrait") {
      rows = columns; // For aspect ratio 1/1.2, rows roughly equals columns
    } else {
      // Landscape: 11in x 8.5in. Usable height ~7.5in. Usable width ~10in.
      if (columns === 2) rows = 1;
      else if (columns === 3) rows = 1;
      else if (columns === 4) rows = 2;
      else if (columns === 5) rows = 3;
    }
    return columns * rows;
  }, [columns, orientation]);

  const paginatedAssets = useMemo(() => {
    const pages = [];
    for (let i = 0; i < selectedAssets.length; i += itemsPerPage) {
      pages.push(selectedAssets.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [selectedAssets, itemsPerPage]);

  const printRef = useRef<HTMLDivElement>(null);
  const bulkPrintRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Tag-${selectedAsset?.serial_number || 'Asset'}`,
  });

  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: `Bulk-Tags-${format(new Date(), 'yyyy-MM-dd')}`,
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length || isAllSelectedGlobal) {
      setSelectedIds([]);
      setIsAllSelectedGlobal(false);
    } else {
      setSelectedIds(data.map(item => item.id));
    }
  };

  const toggleSelect = (id: number | string) => {
    setIsAllSelectedGlobal(false);
    setSelectedIds(prev => {
      const isSelected = prev.some(i => String(i) === String(id));
      if (isSelected) {
        return prev.filter(i => String(i) !== String(id));
      } else {
        return [...prev, id as number]; // Type cast for consistency if possible, but state is number[]
      }
    });
  };

  const handleSelectAllGlobal = async () => {
    setIsAllSelectedGlobal(true);
    setIsFetchingGlobal(true);
    try {
      // Fetch ALL assets matching current filters
      const response = await fetch(`/api/ids/scm/inventory-management/cylinder-assets?limit=-1&status=${filters.status || ''}&condition=${filters.condition || ''}&branchId=${filters.branchId || ''}&productId=${filters.productId || ''}&search=${filters.search || ''}`);
      const d = await response.json();
      if (d.data) {
        setGlobalAssets(d.data);
        setSelectedIds(d.data.map((a: CylinderAsset) => a.id));
      }
    } catch (error) {
      console.error("Failed to fetch all assets:", error);
    } finally {
      setIsFetchingGlobal(false);
    }
  };



  // Statistics calculation (now uses globalStats passed from the API)
  const stats = globalStats;

  useEffect(() => {
    fetch("/api/ids/scm/inventory-management/cylinder-assets/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setProducts(
            d.data.map((p: { product_id: number; product_name: string; unit_of_measurement: number | null }) => {
              const uomLabel = p.unit_of_measurement === 23 ? " (FULL)" : p.unit_of_measurement === 18 ? " (EMPTY)" : "";
              return { id: p.product_id, name: `${p.product_name}${uomLabel}` };
            })
          );
        }
      });

    // Updated fetch path to stock-adjustment-serial-posting/branches to reference the correct endpoint
    fetch("/api/ids/scm/inventory-management/stock-adjustment-serial-posting/branches")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setBranches(d.data.map((b: { id: number; branch_name: string }) => ({ id: b.id, name: b.branch_name })));
      });
  }, []);



  const renderSortIcon = (field: string) => {
    if (sorting.sortBy !== field) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sorting.sortOrder === "ASC" ? (
      <ArrowUp className="ml-2 h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="ml-2 h-3 w-3 text-blue-600" />
    );
  };



  return (
    <div className="flex flex-col gap-4 p-4 min-h-full">
      {/* ── Page Header & KPIs ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 md:p-8 mb-6 shadow-xl border border-slate-800">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 opacity-30 pointer-events-none">
           <div className="w-[30rem] h-[30rem] rounded-full bg-blue-500 blur-[100px] mix-blend-screen" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5">Cylinder Assets</h1>
            <p className="text-slate-400 text-sm font-medium">Manage and track your serialized products</p>
          </div>
          <Button onClick={onCreate} className="h-10 px-5 bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-black/20 font-semibold rounded-full border-0 transition-all hover:scale-105 active:scale-95">
            <Plus className="h-5 w-5 mr-2" />
            Add New Asset
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 relative z-10">
          {[
            { 
              label: "Total Assets", val: stats.total, icon: Cylinder, color: "text-white", bg: "bg-white/10",
              isActive: !filters.status && !filters.expirationStatus && !filters.condition,
              onClick: () => {
                filters.setStatus(undefined);
                filters.setExpirationStatus(undefined);
                filters.setCondition(undefined);
              }
            },
            { 
              label: "Available", val: stats.available, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",
              isActive: filters.status === "AVAILABLE",
              onClick: () => {
                filters.setStatus("AVAILABLE");
                filters.setExpirationStatus(undefined);
                filters.setCondition(undefined);
              }
            },
            { 
              label: "With Customers", val: stats.withCustomer, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20",
              isActive: filters.status === "WITH_CUSTOMER",
              onClick: () => {
                filters.setStatus("WITH_CUSTOMER");
                filters.setExpirationStatus(undefined);
                filters.setCondition(undefined);
              }
            },
            { 
              label: "Near Exp.", val: stats.nearExpiration, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20",
              isActive: filters.expirationStatus === "NEAR_EXPIRATION",
              onClick: () => {
                filters.setExpirationStatus("NEAR_EXPIRATION");
                filters.setStatus(undefined);
                filters.setCondition(undefined);
              }
            },
            { 
              label: "Expired", val: stats.expired, icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20",
              isActive: filters.expirationStatus === "EXPIRED",
              onClick: () => {
                filters.setExpirationStatus("EXPIRED");
                filters.setStatus(undefined);
                filters.setCondition(undefined);
              }
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="h-full"
            >
              <div 
                onClick={item.onClick}
                className={`flex flex-col p-4 sm:p-5 rounded-xl border border-white/5 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all cursor-pointer h-full justify-between gap-3 shadow-inner ${item.bg ? item.bg.split(' ')[1] : ''} ${item.isActive ? 'ring-2 ring-white/50 bg-white/10 scale-[1.02]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider">{item.label}</span>
                  <div className={`p-1.5 sm:p-2 rounded-lg ${item.bg?.split(' ')[0]}`}>
                    <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.color}`} />
                  </div>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                  {item.val}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Search & Filters Toolbar ────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl shadow-sm mb-6 p-2 sm:p-3">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          
          {/* Global Search */}
          <div className="w-full lg:w-72 xl:w-96 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search serials or remarks..."
                value={filters.search}
                onChange={(e) => filters.setSearch(e.target.value)}
                className="pl-9 h-10 w-full bg-muted/30 border-border/50 focus-visible:ring-1 transition-all rounded-lg"
              />
            </div>
          </div>

          <div className="hidden lg:block w-[1px] h-8 bg-border/60 mx-1 mb-1" />

          {/* Filters Row */}
          <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div>
              <Select value={filters.status || "ALL"} onValueChange={(val) => filters.setStatus(val === "ALL" ? undefined : val)}>
                <SelectTrigger className="h-10 bg-transparent border-border/50 hover:bg-muted/30 rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="WITH_CUSTOMER">With Customer</SelectItem>
                  <SelectItem value="EMPTY">Empty</SelectItem>
                  <SelectItem value="LOADED">Loaded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.condition || "ALL"} onValueChange={(val) => filters.setCondition(val === "ALL" ? undefined : val)}>
                <SelectTrigger className="h-10 bg-transparent border-border/50 hover:bg-muted/30 rounded-lg">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Conditions</SelectItem>
                  <SelectItem value="GOOD">Good</SelectItem>
                  <SelectItem value="FOR_REPAIR">For Repair</SelectItem>
                  <SelectItem value="DAMAGED">Damaged</SelectItem>
                  <SelectItem value="SCRAP">Scrap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <SearchableSelect
                options={[
                  { value: "ALL", label: "All Branches" },
                  ...branches.map(b => ({ value: String(b.id), label: b.name }))
                ]}
                value={filters.branchId ? String(filters.branchId) : "ALL"}
                onValueChange={(val) => filters.setBranchId(val === "ALL" ? undefined : Number(val))}
                placeholder="Branch"
                className="h-10 w-full bg-transparent border-border/50 hover:bg-muted/30 rounded-lg"
              />
            </div>

            <div>
              <SearchableSelect
                options={[
                  { value: "ALL", label: "All Products" },
                  ...products.map(p => ({ value: String(p.id), label: p.name }))
                ]}
                value={filters.productId ? String(filters.productId) : "ALL"}
                onValueChange={(val) => filters.setProductId(val === "ALL" ? undefined : Number(val))}
                placeholder="Product"
                className="h-10 w-full bg-transparent border-border/50 hover:bg-muted/30 rounded-lg"
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              filters.setStatus(undefined);
              filters.setCondition(undefined);
              filters.setExpirationStatus(undefined);
              filters.setBranchId(undefined);
              filters.setProductId(undefined);
              filters.setSearch("");
            }}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg hidden sm:flex"
            title="Clear Filters"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => {
              filters.setStatus(undefined);
              filters.setCondition(undefined);
              filters.setExpirationStatus(undefined);
              filters.setBranchId(undefined);
              filters.setProductId(undefined);
              filters.setSearch("");
            }}
            className="h-10 w-full text-muted-foreground hover:text-red-600 hover:bg-red-50 sm:hidden mt-1"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      </div>

      {/* ── Bulk Actions & Selection Banner ──────────────── */}
      {selectedIds.length > 0 && (
        <div className="space-y-0 shadow-sm border border-blue-100 dark:border-blue-800 rounded-lg overflow-visible animate-in fade-in slide-in-from-top-1 mb-1">
          <div className="flex items-center justify-between bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm min-h-[56px] px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 leading-none">
                {isAllSelectedGlobal
                  ? `All ${pagination.total} assets selected`
                  : `${selectedIds.length} asset${selectedIds.length > 1 ? 's' : ''} selected`
                }
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds([]);
                  setIsAllSelectedGlobal(false);
                }}
                className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 dark:hover:bg-blue-800/40"
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsBulkPrintDialogOpen(true)}
                disabled={isFetchingGlobal}
                className="h-8 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-none"
              >
                {isFetchingGlobal ? <div className="h-3 w-3 animate-spin border-2 border-white border-t-transparent rounded-full" /> : <Printer className="h-4 w-4" />}
                Print Labels ({isAllSelectedGlobal ? pagination.total : selectedIds.length})
              </Button>
            </div>
          </div>

          {/* Gmail-style "Select all X" banner */}
          {selectedIds.length === data.length && !isAllSelectedGlobal && pagination.total > data.length && (
            <div className="bg-blue-600/5 dark:bg-blue-400/5 text-center py-2 border-t border-blue-100 dark:border-blue-800/50 text-xs animate-in fade-in duration-300">
              <p className="text-muted-foreground font-medium">
                All {data.length} assets on this page are selected.{" "}
                <button
                  onClick={handleSelectAllGlobal}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1"
                >
                  Select all {pagination.total} assets in Cylinder Assets
                </button>
              </p>
            </div>
          )}

          {isAllSelectedGlobal && (
            <div className="bg-blue-600/5 dark:bg-blue-400/5 text-center py-2 border-t border-blue-100 dark:border-blue-800/50 text-xs animate-in fade-in duration-300">
              <p className="text-muted-foreground font-medium">
                All {pagination.total} assets are selected.{" "}
                <button
                  onClick={() => {
                    setSelectedIds([]);
                    setIsAllSelectedGlobal(false);
                  }}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1"
                >
                  Clear selection
                </button>
              </p>
            </div>
          )}
        </div>
      )}

      <Card className="flex-1 min-h-[500px] overflow-hidden flex flex-col shadow-md border-border/60 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <CardContent className="p-0 flex-1 overflow-auto relative custom-scrollbar">
          <Table className="hidden md:table w-full min-w-[1200px] table-fixed border-separate border-spacing-0">
            <TableHeader className="sticky top-0 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-md z-40 shadow-[0_1px_0_rgba(0,0,0,0.1)]">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="w-[50px] px-4 h-12">
                  <div className="flex items-center h-full">
                    <Checkbox
                      checked={
                        isAllSelectedGlobal || (data.length > 0 && selectedIds.length === data.length)
                          ? true
                          : selectedIds.length > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
                <TableHead className="w-[12%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("serial_number")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Serial {renderSortIcon("serial_number")}</div>
                </TableHead>
                <TableHead className="w-[18%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("product_id")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Product {renderSortIcon("product_id")}</div>
                </TableHead>
                <TableHead className="w-[10%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("cylinder_status")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Status {renderSortIcon("cylinder_status")}</div>
                </TableHead>
                <TableHead className="w-[10%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("cylinder_condition")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Cond. {renderSortIcon("cylinder_condition")}</div>
                </TableHead>
                <TableHead className="w-[12%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("expiration_date")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Exp. {renderSortIcon("expiration_date")}</div>
                </TableHead>
                <TableHead className="w-[8%] font-bold text-foreground text-right cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("tare_weight")}>
                  <div className="flex items-center justify-end text-[11px] uppercase tracking-wider h-full">Tare (KG) {renderSortIcon("tare_weight")}</div>
                </TableHead>
                <TableHead className="w-[12%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("current_branch_id")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Branch {renderSortIcon("current_branch_id")}</div>
                </TableHead>
                <TableHead className="w-[12%] font-bold text-foreground cursor-pointer h-12 py-0" onClick={() => sorting.toggleSort("current_customer_code")}>
                  <div className="flex items-center text-[11px] uppercase tracking-wider h-full">Customer {renderSortIcon("current_customer_code")}</div>
                </TableHead>
                <TableHead className="w-[80px] text-right font-bold text-foreground pr-6 h-12 py-0 text-[11px] uppercase tracking-wider">
                  <div className="flex items-center justify-end h-full">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground opacity-60">
                      <Cylinder className="h-12 w-12 mb-4 stroke-1" />
                      <p className="text-lg font-medium">No assets found</p>
                      <p className="text-sm">Click &quot;Add Asset&quot; to register your first serialized product.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => {
                  const isExpired = item.expiration_date && isPast(new Date(item.expiration_date));
                  const isNearExp = item.expiration_date && !isExpired && isBefore(new Date(item.expiration_date), addDays(new Date(), 30));

                  return (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-muted/10 transition-colors group border-b last:border-b-0 ${selectedIds.some(id => String(id) === String(item.id)) ? 'bg-blue-50/60 dark:bg-blue-900/40' : ''}`}
                    >
                      <TableCell className="w-[50px] px-4 py-2">
                        <Checkbox
                          checked={selectedIds.some(id => String(id) === String(item.id))}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.serial_number}`}
                        />
                      </TableCell>
                      <TableCell className="w-[12%] font-bold text-foreground">
                        <div className="truncate">{item.serial_number}</div>
                      </TableCell>
                      <TableCell className="w-[18%] font-medium">
                        <div className="truncate">
                          {item.product?.product_name || "N/A"}
                          {item.product?.unit_of_measurement === 23 ? " (FULL)" : item.product?.unit_of_measurement === 18 ? " (EMPTY)" : ""}
                        </div>
                        {item.product?.product_code && <span className="block text-[10px] text-muted-foreground truncate">{item.product.product_code}</span>}
                      </TableCell>
                      <TableCell className="w-[10%]">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full border-none shadow-sm
                            ${item.cylinder_status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              item.cylinder_status === 'WITH_CUSTOMER' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}
                        >
                          {item.cylinder_status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[10%]">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full
                            ${item.cylinder_condition === 'GOOD' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20' :
                              'border-red-200 text-red-700 bg-red-50/50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20'}`}
                        >
                          {item.cylinder_condition.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[12%] text-xs font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isExpired ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {item.expiration_date}
                            </span>
                          ) : isNearExp ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {item.expiration_date}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {item.expiration_date || "—"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-[8%] text-xs font-mono text-right font-medium tabular-nums">
                        {item.tare_weight !== null && !isNaN(Number(item.tare_weight))
                          ? `${Number(item.tare_weight).toFixed(2)} (KG)`
                          : "—"}
                      </TableCell>
                      <TableCell className="w-[12%] text-muted-foreground truncate">{item.branch?.branch_name || "N/A"}</TableCell>
                      <TableCell className="w-[12%] text-muted-foreground truncate">{item.customer?.customer_name || item.current_customer_code || "N/A"}</TableCell>
                      <TableCell className="w-[80px] text-right space-x-1 pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedAsset(item);
                            setQrModalOpen(true);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-indigo-600"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item.id)} className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Mobile Card List View */}
          <div className="md:hidden flex flex-col p-4 gap-3">
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground opacity-60 bg-muted/20 rounded-xl border border-dashed">
                <Cylinder className="h-10 w-10 mb-3 stroke-1" />
                <p className="font-medium text-sm">No assets found</p>
              </div>
            ) : (
              data.map((item) => {
                const isExpired = item.expiration_date && isPast(new Date(item.expiration_date));
                const isNearExp = item.expiration_date && !isExpired && isBefore(new Date(item.expiration_date), addDays(new Date(), 30));
                
                return (
                  <div key={item.id} className={`flex flex-col p-4 rounded-xl border shadow-sm transition-all ${selectedIds.some(id => String(id) === String(item.id)) ? 'border-blue-400 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20' : 'border-border/60 bg-white dark:bg-zinc-900/50'}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedIds.some(id => String(id) === String(item.id))}
                            onCheckedChange={() => toggleSelect(item.id)}
                            aria-label={`Select ${item.serial_number}`}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-base leading-none mb-1">{item.serial_number}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {item.product?.product_name || "N/A"}
                            {item.product?.unit_of_measurement === 23 ? " (FULL)" : item.product?.unit_of_measurement === 18 ? " (EMPTY)" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center -mt-1 -mr-1">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedAsset(item); setQrModalOpen(true); }} className="h-8 w-8 text-muted-foreground hover:text-indigo-600">
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item.id)} className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status</span>
                        <Badge variant="secondary" className={`text-[10px] w-fit font-black px-2 py-0 border-none shadow-sm ${item.cylinder_status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.cylinder_status === 'WITH_CUSTOMER' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          {item.cylinder_status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Condition</span>
                        <Badge variant="outline" className={`text-[10px] w-fit font-black px-2 py-0 ${item.cylinder_condition === 'GOOD' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20' : 'border-red-200 text-red-700 bg-red-50/50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20'}`}>
                          {item.cylinder_condition.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Branch</span>
                        <span className="text-xs font-medium truncate">{item.branch?.branch_name || "N/A"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Customer</span>
                        <span className="text-xs font-medium truncate">{item.customer?.customer_name || item.current_customer_code || "N/A"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Expiration</span>
                        <span className={`text-xs font-medium flex items-center gap-1 ${isExpired ? 'text-red-600' : isNearExp ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {isExpired ? <ShieldAlert className="h-3 w-3" /> : isNearExp ? <AlertTriangle className="h-3 w-3" /> : null}
                          {item.expiration_date || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Tare (KG)</span>
                        <span className="text-xs font-medium font-mono tabular-nums">
                          {item.tare_weight !== null && !isNaN(Number(item.tare_weight)) ? `${Number(item.tare_weight).toFixed(2)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
        {data.length > 0 && (
          <div className="border-t p-4 bg-muted/10">
            <DataTablePagination
              pageIndex={pagination.page}
              pageSize={pagination.pageSize}
              rowCount={pagination.total}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </div>
        )}
      </Card>

      {/* ── Asset Label Modal (QR & Barcode) ──────────────── */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-center flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${printMode === 'QR' ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-400'}`}>
                  <QrCode className="h-6 w-6" />
                </div>
                <div className={`p-3 rounded-full ${printMode === 'BARCODE' ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-400'}`}>
                  <BarcodeIcon className="h-6 w-6" />
                </div>
              </div>
              Asset Identification Labels
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Select label type and print for this cylinder
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6 gap-6">
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-full max-w-[240px]">
              <Button
                variant={printMode === 'QR' ? "outline" : "ghost"}
                size="sm"
                className={`flex-1 h-8 text-xs gap-2 border-none ${printMode === 'QR' ? 'bg-white shadow-sm hover:bg-white' : 'text-muted-foreground'}`}
                onClick={() => setPrintMode('QR')}
              >
                <QrCode className="h-3.5 w-3.5" />
                QR Code
              </Button>
              <Button
                variant={printMode === 'BARCODE' ? "outline" : "ghost"}
                size="sm"
                className={`flex-1 h-8 text-xs gap-2 border-none ${printMode === 'BARCODE' ? 'bg-white shadow-sm hover:bg-white' : 'text-muted-foreground'}`}
                onClick={() => setPrintMode('BARCODE')}
              >
                <BarcodeIcon className="h-3.5 w-3.5" />
                Barcode
              </Button>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-500" />
              <div ref={printRef} className="relative p-6 bg-white flex flex-col items-center justify-center gap-4 w-[280px] shadow-2xl rounded-xl border border-zinc-100 mx-auto">
                {selectedAsset && (
                  <>
                    <div className="flex items-center justify-center min-h-[160px]">
                      <AnimatePresence mode="wait">
                        {printMode === 'QR' ? (
                          <motion.div
                            key="qr"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="p-2 border-4 border-black rounded-xl bg-white"
                          >
                            <QRCodeSVG
                              value={selectedAsset?.serial_number || ''}
                              size={140}
                              level="H"
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="barcode"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="p-3 border-4 border-black rounded-xl bg-white flex items-center justify-center overflow-hidden"
                          >
                            <Barcode
                              value={selectedAsset?.serial_number || ''}
                              width={1.8}
                              height={80}
                              fontSize={12}
                              background="#ffffff"
                              lineColor="#000000"
                              margin={0}
                              displayValue={false}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="text-center space-y-1 w-full">
                      <p className="font-mono font-black text-2xl text-black tracking-tight leading-none">{selectedAsset?.serial_number}</p>
                      <div className="h-[1.5px] bg-black w-full opacity-10 my-1" />
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest truncate max-w-full">{selectedAsset?.product?.product_name}</p>
                      <div className="flex items-center justify-between text-[7px] text-zinc-400 font-bold pt-1 uppercase">
                        <span>Seagas Industrial</span>
                        <span>{format(new Date(), 'yyyy-MM-dd')}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              className="h-11 font-semibold gap-2 border-zinc-200 hover:bg-zinc-50"
              onClick={() => handlePrint()}
            >
              <Printer className="h-4 w-4" />
              Print Label
            </Button>
            <Button
              className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/20"
              onClick={() => setQrModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Print Selection Dialog ─────────────────── */}
      <Dialog open={isBulkPrintDialogOpen} onOpenChange={setIsBulkPrintDialogOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Bulk Print Labels</DialogTitle>
            <DialogDescription>
              Choose the label format for {isAllSelectedGlobal ? pagination.total : selectedIds.length} assets.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-6">
            <Card
              className={`relative cursor-pointer transition-all duration-300 border-2 overflow-hidden ${printMode === 'QR' ? 'border-blue-600 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}
              onClick={() => setPrintMode('QR')}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <div className={`p-4 rounded-2xl ${printMode === 'QR' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-100 text-zinc-500'}`}>
                  <QrCode className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold">QR Codes</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Detailed Data</p>
                </div>
                {printMode === 'QR' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className={`relative cursor-pointer transition-all duration-300 border-2 overflow-hidden ${printMode === 'BARCODE' ? 'border-indigo-600 bg-indigo-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}
              onClick={() => setPrintMode('BARCODE')}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <div className={`p-4 rounded-2xl ${printMode === 'BARCODE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-zinc-100 text-zinc-500'}`}>
                  <BarcodeIcon className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Barcodes</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Standard Scanning</p>
                </div>
                {printMode === 'BARCODE' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setIsBulkPrintDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
              onClick={() => {
                setIsBulkPrintDialogOpen(false);
                setIsBulkPreviewOpen(true);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Configure Layout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Print Preview Modal ────────────────────── */}
      <Dialog open={isBulkPreviewOpen} onOpenChange={setIsBulkPreviewOpen}>
        <DialogContent 
          showCloseButton={false}
          className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-100 dark:bg-zinc-950"
        >
          <DialogHeader className="p-4 bg-white dark:bg-zinc-900 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Print Preview</DialogTitle>
                <DialogDescription>
                  Adjust layout settings before printing {selectedAssets.length} labels.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Orientation:</Label>
                  <Select value={orientation} onValueChange={(v) => setOrientation(v as "portrait" | "landscape")}>
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Size:</Label>
                  <Select value={paperSize} onValueChange={(v) => setPaperSize(v as "A4" | "Letter")}>
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Letter">Letter</SelectItem>
                      <SelectItem value="A4">A4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Columns:</Label>
                  <Select value={String(columns)} onValueChange={(v) => setColumns(Number(v))}>
                    <SelectTrigger className="w-[80px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Col</SelectItem>
                      <SelectItem value="3">3 Col</SelectItem>
                      <SelectItem value="4">4 Col</SelectItem>
                      <SelectItem value="5">5 Col</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Zoom:</Label>
                  <Select value={String(labelSize)} onValueChange={(v) => setLabelSize(Number(v))}>
                    <SelectTrigger className="w-[80px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.8">80%</SelectItem>
                      <SelectItem value="1">100%</SelectItem>
                      <SelectItem value="1.2">120%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-8 w-px bg-zinc-200 mx-2" />
                <div className="flex items-center gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="h-9 px-4 font-semibold text-zinc-600 hover:text-zinc-900 border-zinc-200">
                      Close
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={() => handleBulkPrint()}
                    className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-lg shadow-blue-500/20"
                  >
                    <Printer className="h-4 w-4" />
                    Print Now
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-16 bg-zinc-200/50 dark:bg-zinc-950/50 custom-scrollbar">
            {paginatedAssets.map((pageAssets, pageIdx) => {
              const pageWidth = orientation === 'portrait'
                ? (paperSize === 'Letter' ? '8.5in' : '8.27in')
                : (paperSize === 'Letter' ? '11in' : '11.69in');
              const pageHeight = orientation === 'portrait'
                ? (paperSize === 'Letter' ? '11in' : '11.69in')
                : (paperSize === 'Letter' ? '8.5in' : '8.27in');

              return (
                <div
                  key={pageIdx}
                  className="flex flex-col items-center shrink-0"
                  style={{
                    width: `calc(${pageWidth} * ${labelSize})`,
                    height: `calc(${pageHeight} * ${labelSize})`,
                  }}
                >
                  <div
                    className="bg-white shadow-2xl origin-top-left transition-all duration-300 flex flex-col"
                    style={{
                      transform: `scale(${labelSize})`,
                      width: pageWidth,
                      height: pageHeight,
                      padding: '0.5in',
                    }}
                  >
                    <div className="flex justify-between items-center mb-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b pb-2">
                      <span>Seagas Industrial - Page {pageIdx + 1} of {paginatedAssets.length}</span>
                      <span>{selectedAssets.length} Total Assets</span>
                    </div>
                    <div
                      className="grid gap-x-4 gap-y-6 flex-1 content-start"
                      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                    >
                      {pageAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex flex-col items-center justify-center p-3 border border-zinc-200 rounded-lg bg-white overflow-hidden"
                          style={{ aspectRatio: '1/1.2' }}
                        >
                          <div className="flex-1 flex items-center justify-center w-full mb-2 overflow-hidden">
                            {printMode === 'QR' ? (
                              <div className="p-1 border-2 border-black rounded bg-white">
                                <QRCodeSVG
                                  value={asset.serial_number}
                                  size={100 / (columns / 3)}
                                  level="M"
                                />
                              </div>
                            ) : (
                              <div className="p-1 border-2 border-black rounded bg-white w-full flex items-center justify-center overflow-hidden scale-90">
                                <Barcode
                                  value={asset.serial_number}
                                  width={1.5 / (columns / 3)}
                                  height={60}
                                  fontSize={12}
                                  margin={0}
                                  displayValue={false}
                                />
                              </div>
                            )}
                          </div>
                          <div className="text-center w-full space-y-0.5 px-1 overflow-hidden">
                            <p
                              className="font-mono font-black text-black leading-tight truncate"
                              style={{ fontSize: asset.serial_number.length > 15 ? '8px' : asset.serial_number.length > 12 ? '10px' : '12px' }}
                            >
                              {asset.serial_number}
                            </p>
                            <div className="h-[1px] bg-black w-full opacity-10" />
                            <p
                              className="font-bold text-zinc-800 uppercase leading-tight tracking-wider"
                              style={{
                                fontSize: (asset.product?.product_name?.length || 0) > 30 ? '5px' : (asset.product?.product_name?.length || 0) > 20 ? '6px' : '7px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {asset.product?.product_name}
                            </p>
                            <p className="text-[6px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Seagas</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Hidden Bulk Print Component ────────────────── */}
      <div className="hidden">
        <div ref={bulkPrintRef} className="print:block bg-white">
          <style dangerouslySetInnerHTML={{
            __html: `
            @page { 
              size: ${paperSize} ${orientation}; 
              margin: 0; 
            }
            @media print {
              body { margin: 0; }
              .print-page {
                page-break-after: always;
                page-break-inside: avoid;
              }
            }
          `}} />
          {paginatedAssets.map((pageAssets, pageIdx) => (
            <div
              key={pageIdx}
              className="print-page bg-white"
              style={{
                width: orientation === 'portrait'
                  ? (paperSize === 'Letter' ? '8.5in' : '8.27in')
                  : (paperSize === 'Letter' ? '11in' : '11.69in'),
                height: orientation === 'portrait'
                  ? (paperSize === 'Letter' ? '11in' : '11.69in')
                  : (paperSize === 'Letter' ? '8.5in' : '8.27in'),
                padding: '0.5in',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                className="grid gap-x-4 gap-y-6 content-start"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {pageAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col items-center justify-center p-3 border border-zinc-300 rounded-lg bg-white"
                    style={{ aspectRatio: '1/1.2' }}
                  >
                    <div className="flex-1 flex items-center justify-center w-full mb-2">
                      {printMode === 'QR' ? (
                        <div className="p-1 border-2 border-black rounded bg-white">
                          <QRCodeSVG
                            value={asset.serial_number}
                            size={100 / (columns / 3)}
                            level="M"
                          />
                        </div>
                      ) : (
                        <div className="p-1 border-2 border-black rounded bg-white w-full flex items-center justify-center overflow-hidden scale-90">
                          <Barcode
                            value={asset.serial_number}
                            width={1.5 / (columns / 3)}
                            height={60}
                            fontSize={12}
                            margin={0}
                            displayValue={false}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-center w-full space-y-0.5 px-1">
                      <p
                        className="font-mono font-black text-black leading-tight"
                        style={{ fontSize: asset.serial_number.length > 15 ? '8px' : asset.serial_number.length > 12 ? '10px' : '12px' }}
                      >
                        {asset.serial_number}
                      </p>
                      <div className="h-[1px] bg-black w-full opacity-10" />
                      <p
                        className="font-bold text-zinc-800 uppercase leading-tight tracking-wider"
                        style={{
                          fontSize: (asset.product?.product_name?.length || 0) > 30 ? '5px' : (asset.product?.product_name?.length || 0) > 20 ? '6px' : '7px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {asset.product?.product_name}
                      </p>
                      <p className="text-[6px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Seagas Industrial</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-[0.2in] left-0 right-0 text-center text-[8px] text-zinc-300 font-bold uppercase tracking-widest">
                Page {pageIdx + 1} of {paginatedAssets.length}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
