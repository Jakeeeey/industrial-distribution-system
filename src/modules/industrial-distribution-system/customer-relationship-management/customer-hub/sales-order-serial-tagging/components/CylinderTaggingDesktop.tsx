import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SalesOrderTaggingDetails, MappedSerial, CustomerAsset, TaggedSerial } from "../types";
import { ScannedItem } from "../hooks/useCylinderTagging";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Scan,
  Trash2,
  CheckCircle2,
  Building,
  Truck,
  Box,
  Cylinder,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

interface LineItemSerialsListProps {
  productMappedSerials: MappedSerial[];
  taggedSerials: TaggedSerial[];
  sessionScans: ScannedItem[];
  onRemove: (serial: string) => void;
}

function LineItemSerialsList({
  productMappedSerials,
  taggedSerials,
  sessionScans,
  onRemove,
}: LineItemSerialsListProps) {
  const [filterQuery, setFilterQuery] = useState("");
  
  // Construct the union of all serial numbers
  const allSerials = useMemo(() => {
    const set = new Set<string>();
    productMappedSerials.forEach((ms) => set.add(ms.serial_number.toUpperCase()));
    taggedSerials.forEach((t) => set.add(t.serial_number.toUpperCase()));
    sessionScans.forEach((s) => set.add(s.serial_number.toUpperCase()));
    return Array.from(set);
  }, [productMappedSerials, taggedSerials, sessionScans]);

  // Map each serial to its status and other info
  const serialItems = useMemo(() => {
    const items = allSerials.map((serial) => {
      const sessionScan = sessionScans.find((s) => s.serial_number.toUpperCase() === serial);
      const dbTag = taggedSerials.find((t) => t.serial_number.toUpperCase() === serial);
      const mapped = productMappedSerials.find((ms) => ms.serial_number.toUpperCase() === serial);
      
      let status = "not tagged";
      if (sessionScan) {
        status = "new";
      } else if (dbTag) {
        status = dbTag.status || "tagged";
      } else if (mapped?.cylinder_status === "WITH_CUSTOMER") {
        status = "delivered_other";
      }

      return {
        serial_number: serial,
        status,
        isSession: !!sessionScan,
        isDb: !!dbTag,
      };
    });

    // Sort: "new" (1) first, then "tagged" (2), then "not tagged" (3), then "delivered_other" (4)
    return items.sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === "new") return 1;
        if (status === "tagged") return 2;
        if (status === "not tagged") return 3;
        return 4;
      };
      return getPriority(a.status) - getPriority(b.status);
    });
  }, [allSerials, sessionScans, taggedSerials, productMappedSerials]);

  const filteredSerials = useMemo(() => {
    return serialItems.filter((item) =>
      item.serial_number.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [serialItems, filterQuery]);

  // Count tagged/new vs untagged
  const taggedCount = useMemo(() => {
    return serialItems.filter(item => item.status === "new" || item.status === "tagged").length;
  }, [serialItems]);

  const untaggedCount = useMemo(() => {
    return serialItems.filter(item => item.status === "not tagged").length;
  }, [serialItems]);

  const totalSerials = allSerials.length;
  const hasSerials = filteredSerials.length > 0;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Cylinder Serials ({taggedCount} tagged, {untaggedCount} on truck)
        </span>
        {totalSerials > 6 && (
          <Input
            type="text"
            placeholder="Filter serials..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-6 max-w-[160px] text-[10px] px-2 py-0.5 font-medium"
          />
        )}
      </div>

      <div className="max-h-32 overflow-y-auto pr-1">
        {!hasSerials ? (
          <p className="text-[10px] text-muted-foreground italic py-1">
            {filterQuery ? "No serials match search." : "No serials loaded or tagged."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center">
            {filteredSerials.map((item) => {
              if (item.isSession) {
                return (
                  <Badge
                    key={item.serial_number}
                    className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono text-[9px] flex items-center justify-between px-1.5 py-0.5 shrink-0"
                    title={`${item.serial_number} (New)`}
                  >
                    <span>{item.serial_number}</span>
                    <Trash2
                      className="w-2.5 h-2.5 cursor-pointer hover:text-red-500 ml-1.5 shrink-0"
                      onClick={() => onRemove(item.serial_number)}
                    />
                  </Badge>
                );
              }

              if (item.status === "delivered_other") {
                return (
                  <Badge
                    key={item.serial_number}
                    variant="outline"
                    className="font-mono text-[9px] border px-1.5 py-0.5 flex items-center shrink-0 bg-red-500/5 text-red-500 border-red-500/25 cursor-not-allowed select-none"
                    title={`${item.serial_number} (Delivered - Other Order)`}
                  >
                    <span>{item.serial_number}</span>
                    <span className="text-[8px] font-sans ml-1.5 shrink-0 select-none uppercase font-bold">
                      Delivered (Other Order)
                    </span>
                  </Badge>
                );
              }

              const isTagged = item.status.toLowerCase() === "tagged";

              return (
                <Badge
                  key={item.serial_number}
                  variant="outline"
                  className={`font-mono text-[9px] border px-1.5 py-0.5 flex items-center shrink-0 ${
                    isTagged 
                      ? "bg-blue-500/5 text-blue-500 border-blue-500/25" 
                      : "bg-amber-500/5 text-amber-500 border-amber-500/25"
                  }`}
                  // Dev-rule: If serial is not tagged, hide it like a password using * characters
                  title={`${
                    item.status === "not tagged"
                      ? "*".repeat(item.serial_number.length)
                      : item.serial_number
                  } (${isTagged ? "Tagged" : "Not Tagged"})`}
                >
                  <span>
                    {item.status === "not tagged"
                      ? "*".repeat(item.serial_number.length)
                      : item.serial_number}
                  </span>
                  <span className="text-[8px] font-sans ml-1.5 shrink-0 select-none uppercase font-bold">
                    {isTagged ? "Tagged" : "Not Tagged"}
                  </span>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface CylinderTaggingDesktopProps {
  orderDetails: SalesOrderTaggingDetails;
  mappedSerials: MappedSerial[];
  customerAssets: CustomerAsset[];
  scannedList: ScannedItem[];
  submitting: boolean;
  onScan: (serial: string) => void;
  onRemove: (serial: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onRefresh: () => void;
}

export default function CylinderTaggingDesktop({
  orderDetails,
  mappedSerials,
  customerAssets,
  scannedList,
  submitting,
  onScan,
  onRemove,
  onClear,
  onSubmit,
  onRefresh,
}: CylinderTaggingDesktopProps) {
  const [scanInput, setScanInput] = useState("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [autoEnter, setAutoEnter] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep scanner input focused
  useEffect(() => {
    if (inputRef.current && !isProcessingScan) {
      inputRef.current.focus();
    }
  }, [scannedList, isProcessingScan]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingScan) return;
    const serial = scanInput.trim();
    if (serial) {
      onScan(serial);
      setScanInput("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const diff = value.length - scanInput.length;
    setScanInput(value);
    
    if (autoEnter && diff > 2 && !isProcessingScan) {
      const serial = value.trim();
      if (serial) {
        setIsProcessingScan(true);
        setTimeout(() => {
          onScan(serial);
          setScanInput("");
          setIsProcessingScan(false);
        }, 500); // 500ms delay to briefly display scanned code
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!autoEnter) return;
    if (isProcessingScan) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").trim();
    if (pastedText) {
      setScanInput(pastedText);
      setIsProcessingScan(true);
      setTimeout(() => {
        onScan(pastedText);
        setScanInput("");
        setIsProcessingScan(false);
      }, 500); // 500ms delay to briefly display pasted code
    }
  };

  const { order, items } = orderDetails;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      {/* LEFT COLUMN: Order Details & Products (lg:col-span-7) */}
      <div className="lg:col-span-7 space-y-4 flex flex-col h-full">
        {/* Sales Order Card */}
        <Card className="border shadow-md backdrop-blur-md bg-card/60 relative overflow-hidden group py-3 gap-2">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <CardHeader className="p-0 px-4 pb-1.5">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-primary" />
                  Sales Order Info
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                  Order Number: <span className="text-foreground">{order.order_no}</span>
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-primary text-primary font-black uppercase px-2 py-0.5 text-[10px]">
                {order.order_status || "ACTIVE"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs border-t pt-2 px-4 pb-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-secondary/50">
                <Building className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold ">Customer</p>
                <p className="font-bold text-foreground line-clamp-2">{order.customer_name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{order.customer_code}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-secondary/50">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold">Branch</p>
                <p className="font-bold text-foreground">{order.branch_name || `Branch ${order.branch_id}`}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Items & Progress List */}
        <Card className="border shadow-md py-3 gap-2 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="p-0 px-4 pb-1.5">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Cylinder className="w-4 h-4 text-primary" />
              Order Line Items &amp; Tagging Progress
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monitor the progress of tagged cylinders versus ordered and allocated quantity.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[35%] font-bold py-2 px-4 text-xs">Product</TableHead>
                  <TableHead className="text-center font-bold py-2 px-2 text-xs">Target Qty</TableHead>
                  <TableHead className="text-center font-bold py-2 px-2 text-xs">Invoiced Qty</TableHead>
                  <TableHead className="text-center font-bold py-2 px-2 text-xs">Tagged</TableHead>
                  <TableHead className="text-right font-bold py-2 px-4 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground font-semibold text-xs">
                      No line items found in this Sales Order.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    // Maximum target is allocated if present, otherwise ordered
                    const targetQty = item.allocated_qty > 0 ? item.allocated_qty : item.ordered_qty;
                    // Current session scans for this item
                    const sessionScans = scannedList.filter((s) => s.sales_order_detail_id === item.detail_id);
                    const totalTagged = item.tagged_qty + sessionScans.length;
                    const percent = Math.min(100, Math.round((totalTagged / item.served_qty) * 100));
                    const isComplete = totalTagged >= targetQty;

                    return (
                      <React.Fragment key={item.detail_id}>
                        <TableRow className="hover:bg-secondary/5">
                          <TableCell className="py-2 px-4">
                            <div>
                              <p className="font-bold text-foreground text-xs">{item.product_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{item.product_code}</p>
                              <div className="flex items-center gap-1.5 mt-1 max-w-[150px]">
                                <Progress value={percent} className="h-1" />
                                <span className="text-[10px] font-bold text-muted-foreground">{percent}%</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2 px-2 text-xs">
                            <span className="font-bold">{targetQty}</span>
                            <span className="text-[10px] text-muted-foreground ml-0.5">{item.unit}</span>
                            {item.allocated_qty > 0 && (
                              <p className="text-[9px] text-primary font-bold leading-none mt-0.5">(Allocated)</p>
                            )}
                          </TableCell>
                          {/* Invoiced Qty Column (maps to served_qty) */}
                          <TableCell className="text-center py-2 px-2 text-xs">
                            <span className="font-bold text-foreground">{item.served_qty}</span>
                            <span className="text-[10px] text-muted-foreground ml-0.5">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-center py-2 px-2 text-xs">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-foreground">{totalTagged}</span>
                              {sessionScans.length > 0 && (
                                <span className="text-[9px] font-bold text-emerald-500">
                                  (+{sessionScans.length} new)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2 px-4">
                            {isComplete ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1 w-fit ml-auto py-0 px-1.5 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="font-bold w-fit ml-auto py-0 px-1.5 text-[10px]">
                                Pending {item.served_qty - totalTagged}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Collapsible tags row */}
                        {(() => {
                          const productMappedSerials = mappedSerials
                            .filter((ms) => Number(ms.product_id) === Number(item.product_id));
                          const hasAnySerials = productMappedSerials.length > 0 || item.tagged_serials.length > 0 || sessionScans.length > 0;

                          if (!hasAnySerials) return null;

                          return (
                            <TableRow className="bg-secondary/5 border-b hover:bg-secondary/5">
                              <TableCell colSpan={5} className="py-2 px-4">
                                <LineItemSerialsList
                                  productMappedSerials={productMappedSerials}
                                  taggedSerials={item.tagged_serials}
                                  sessionScans={sessionScans}
                                  onRemove={onRemove}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Scanning Controls & Inputs (lg:col-span-5) */}
      <Card 
        onClick={() => inputRef.current?.focus()}
        className="lg:col-span-5 border border-primary/20 shadow-md relative overflow-hidden bg-card/40 backdrop-blur-md py-3 gap-2 flex flex-col h-full w-full cursor-text"
      >
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
          <CardHeader className="p-0 px-4 pb-1.5 shrink-0">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-primary animate-pulse" />
                Serial Number Scanner
              </span>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 select-none cursor-pointer" onClick={() => setAutoEnter(!autoEnter)}>
                  <span title="Automatically processes and submits scanned or pasted input." className="text-[10px] text-muted-foreground font-semibold">Fast Mode</span>
                  <Switch checked={autoEnter} onCheckedChange={setAutoEnter} size="sm" id="auto-enter-toggle" />
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  AUTO-FOCUS ON
                </span>
              </div>
            </CardTitle>
            <CardDescription className="text-xs">
              Input or scan cylinder serial numbers. Only loaded consolidator mappings are accepted ({mappedSerials.length} loaded).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-0 flex-1 flex flex-col min-h-0">
            <form onSubmit={handleScanSubmit} className="space-y-1 shrink-0">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan or type serial number..."
                  value={scanInput}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  className="font-mono text-xs tracking-widest pl-8 h-9 border border-primary/20 focus:border-primary uppercase disabled:opacity-90 disabled:bg-emerald-500/5 disabled:border-emerald-500/30"
                  disabled={submitting || isProcessingScan}
                />
                <Scan className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold italic mt-0.5">
                Tip: If using a hardware barcode scanner, it will automatically hit &apos;Enter&apos; to submit.
              </p>
            </form>

            {/* Session Scanned Queue */}
            <div className="border rounded bg-secondary/20 overflow-hidden flex flex-col h-[280px]">
              <div className="p-2 px-3 bg-secondary/35 border-b flex justify-between items-center shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Cylinder className="w-3.5 h-3.5 text-primary" />
                  Scanned in this Session ({scannedList.length})
                </span>
                {scannedList.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 px-1.5"
                    onClick={onClear}
                  >
                    Clear All
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {scannedList.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-muted-foreground flex flex-col justify-center items-center h-full">
                    <p className="font-semibold">No serials scanned yet.</p>
                    <p className="mt-0.5 opacity-80">Awaiting cylinder barcode scans...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {scannedList.map((item) => (
                        <motion.div
                          key={item.serial_number}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="p-2 flex justify-between items-center hover:bg-secondary/30 transition-colors overflow-hidden"
                        >
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-xs text-foreground">{item.serial_number}</span>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{item.product_name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => onRemove(item.serial_number)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 pt-1 pb-3 shrink-0">
              <Button
                onClick={onSubmit}
                className="w-full h-10 font-bold text-xs tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center gap-1.5 group transition-all duration-200 active:scale-98"
                disabled={scannedList.length === 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    SUBMITTING TAGS...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    CONFIRM DELIVERY TAGGING ({scannedList.length})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* FULL WIDTH BOTTOM: Customer Holdings Table */}
      <div className="lg:col-span-12">
        <Card className="border shadow-md py-3 gap-2">
          <CardHeader className="p-0 px-4 pb-2 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Building className="w-4 h-4 text-primary" />
                Customer Cylinder Holdings
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Cylinders currently recorded in the custody of this customer ({order.customer_name}).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-secondary"
                onClick={onRefresh}
                title="Refresh Holdings"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </Button>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/50 text-[10px] font-bold text-muted-foreground">
                <Clock className="w-3 h-3" /> Deployed Count: {customerAssets.length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold py-2 px-4 text-xs">Serial Number</TableHead>
                  <TableHead className="font-bold py-2 px-4 text-xs">Cylinder Product</TableHead>
                  <TableHead className="text-right font-bold py-2 px-4 text-xs">Days on Site</TableHead>
                  <TableHead className="text-right font-bold py-2 px-4 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <AlertTriangle className="w-6 h-6 text-muted-foreground/60 mb-0.5" />
                        <p className="font-bold text-xs">No active holdings recorded</p>
                        <p className="text-[10px] opacity-80">This customer currently holds zero cylinders.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customerAssets.map((asset) => {
                    const highlightDays = asset.days_at_site > 30;
                      return (
                        <TableRow key={asset.serial_number} className="hover:bg-secondary/5">
                          <TableCell className="font-mono font-bold py-2 px-4 text-xs text-foreground flex items-center gap-1.5">
                            <Cylinder className="w-3.5 h-3.5 text-primary" />
                            {asset.serial_number}
                          </TableCell>
                          <TableCell className="py-2 px-4 text-xs">{asset.product_name}</TableCell>
                          <TableCell className="text-right py-2 px-4 text-xs font-semibold">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              highlightDays 
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                : "bg-secondary text-muted-foreground border"
                            }`}>
                              <Clock className="w-3 h-3" />
                              {asset.days_at_site} days
                            </span>
                          </TableCell>
                        <TableCell className="text-right py-2 px-4">
                          <Badge variant="outline" className="border-blue-500 text-blue-500 bg-blue-500/5 font-bold py-0 px-1.5 text-[10px]">
                            With Customer
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
