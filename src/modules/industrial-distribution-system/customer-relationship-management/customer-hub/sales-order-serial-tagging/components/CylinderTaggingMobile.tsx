import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SalesOrderTaggingDetails, MappedSerial, CustomerAsset, TaggedSerial } from "../types";
import { ScannedItem } from "../hooks/useCylinderTagging";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scan,
  Trash2,
  Building,
  Box,
  Cylinder,
  Clock,
  Sparkles,
  AlertTriangle,
  Info,
  ListTodo,
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
    <div className="space-y-1.5 mt-1 pt-1 border-t w-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          Cylinder Serials ({taggedCount} tagged, {untaggedCount} on truck)
        </span>
        {totalSerials > 5 && (
          <Input
            type="text"
            placeholder="Filter..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-5.5 max-w-[110px] text-[9px] px-1.5 py-0 font-medium"
          />
        )}
      </div>

      <div className="max-h-28 overflow-y-auto pr-1">
        {!hasSerials ? (
          <p className="text-[9px] text-muted-foreground italic py-1">
            {filterQuery ? "No matches." : "None loaded."}
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
                  title={`${item.serial_number} (${isTagged ? "Tagged" : "Not Tagged"})`}
                >
                  <span>{item.serial_number}</span>
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

interface CylinderTaggingMobileProps {
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

export default function CylinderTaggingMobile({
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
}: CylinderTaggingMobileProps) {
  const [scanInput, setScanInput] = useState("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [autoEnter, setAutoEnter] = useState(true);
  const [activeTab, setActiveTab] = useState("scan");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus scanner input on tab switch to scan
  useEffect(() => {
    if (activeTab === "scan" && inputRef.current && !isProcessingScan) {
      inputRef.current.focus();
    }
  }, [activeTab, scannedList, isProcessingScan]);

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
    <div className="w-full space-y-4">
      {/* Mobile Header Info Summary Banner */}
      <div className="p-4 bg-card border border-primary/10 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <div className="space-y-1 pl-1">
          <div className="flex items-center gap-4">
            <span className="text-[9px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono tracking-wide">
              Active Dispatch
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground font-mono">
              {order.branch_name || `Branch ${order.branch_id}`}
            </span>
          </div>
          <h2 className="text-base font-black text-foreground tracking-tight leading-none">
            {order.order_no}
          </h2>
          <div>
            <p className="text-xs font-bold text-muted-foreground leading-tight">
              {order.customer_name}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground/80 mt-0.5">
              Code: {order.customer_code}
            </p>
          </div>
        </div>
        <Badge className="bg-primary text-primary-foreground font-black uppercase text-[9px] px-2 py-0.5 shrink-0 select-none">
          {order.order_status || "ACTIVE"}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Navigation Tabs (Info & Scan) */}
        <TabsList className="grid grid-cols-2 w-full h-11 bg-secondary/35 border p-1 rounded-xl">
          <TabsTrigger value="info" className="text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all">
            <Info className="w-3.5 h-3.5" /> Order &amp; Holdings
          </TabsTrigger>
          <TabsTrigger value="scan" className="text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 relative transition-all">
            <Scan className="w-3.5 h-3.5" /> Scan Serials
            {scannedList.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-background animate-pulse">
                {scannedList.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==============================================================
            TAB 1: INFO & PROGRESS & CUSTOMER HOLDINGS
            ============================================================== */}
        <TabsContent value="info" className="mt-4 space-y-4 focus-visible:outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 "
          >
            <Card className="border shadow-md py-4 gap-0">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-primary" /> Delivery Target Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0  divide-y divide-border text-sm">
                <div className="flex justify-between items-start py-2">
                  <span className="text-muted-foreground font-semibold">Customer</span>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{order.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{order.customer_code}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground font-semibold">Branch</span>
                  <span className="font-bold">{order.branch_name || `Branch ${order.branch_id}`}</span>
                </div>
              </CardContent>
            </Card>

            {/* Product targets list */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground pl-1">
                Required Quantities
              </h3>
              {items.map((item) => {
                const targetQty = item.allocated_qty > 0 ? item.allocated_qty : item.ordered_qty;
                const sessionScans = scannedList.filter((s) => s.sales_order_detail_id === item.detail_id);
                const totalTagged = item.tagged_qty + sessionScans.length;
                const percent = Math.min(100, Math.round((totalTagged / targetQty) * 100));
                const isComplete = totalTagged >= targetQty;

                return (
                  <Card key={item.detail_id} className="p-4 border shadow-sm gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm text-foreground line-clamp-1 flex items-center gap-1.5 flex-wrap">
                          {item.product_name}
                          {item.allocated_qty > 0 && (
                            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary px-1 py-0 h-4 uppercase font-bold shrink-0">
                              Allocated
                            </Badge>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.product_code}</p>
                      </div>
                      {isComplete ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] px-1.5 py-0.5 shrink-0">
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-black text-[10px] px-1.5 py-0.5 shrink-0">
                          Pending {targetQty - totalTagged}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-2">
                      <span>
                        Progress ({totalTagged} / {targetQty} {item.unit})
                        {sessionScans.length > 0 && (
                          <span className="text-emerald-500 font-bold mx-1">
                            (+{sessionScans.length} new)
                          </span>
                        )}
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-2 mx-2" />
                    
                    {/* Tagged list */}
                    {(() => {
                      const productMappedSerials = mappedSerials
                        .filter((ms) => Number(ms.product_id) === Number(item.product_id));
                      const hasAnySerials = productMappedSerials.length > 0 || item.tagged_serials.length > 0 || sessionScans.length > 0;

                      if (!hasAnySerials) return null;

                      return (
                        <LineItemSerialsList
                          productMappedSerials={productMappedSerials}
                          taggedSerials={item.tagged_serials}
                          sessionScans={sessionScans}
                          onRemove={onRemove}
                        />
                      );
                    })()}
                  </Card>
                );
              })}
            </div>

            {/* Customer Holdings (Moved inside Info tab) */}
            <Card className="border shadow-md py-4 gap-4">
              <CardHeader className="px-4 py-0 flex flex-row justify-between items-center">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-primary" /> Customer holdings
                </CardTitle>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground active:bg-secondary rounded-lg"
                    onClick={onRefresh}
                    type="button"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </Button>
                  <Badge variant="outline" className="font-bold text-xs bg-secondary/50">
                    {customerAssets.length} Deployed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 pl-10">
                <div className="divide-y divide-border">
                  {customerAssets.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="font-bold text-sm">No cylinders found with customer</p>
                    </div>
                  ) : (
                    customerAssets.map((asset) => {
                      const highlightDays = asset.days_at_site > 30;
                      return (
                        <div key={asset.serial_number} className="py-2.5 flex justify-between items-center text-xs hover:bg-secondary/5 transition-colors">
                          <div className="space-y-0.5">
                            <p className="font-mono font-bold text-foreground flex items-center gap-1">
                              <Cylinder className="w-3.5 h-3.5 text-primary" />
                              {asset.serial_number}
                            </p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{asset.product_name}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              highlightDays 
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                : "bg-secondary text-muted-foreground border"
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              {asset.days_at_site} days
                            </span>
                            <p className="text-[8px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">With Customer</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ==============================================================
            TAB 2: SCANNING INTERFACE (MOBILE SCANNER)
            ============================================================== */}
        <TabsContent value="scan" className="mt-4 space-y-4 focus-visible:outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="border border-primary/20 shadow-md gap-0">
              <CardHeader className="border-b">
                <CardTitle className="text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Scan className="w-3.5 h-3.5 text-primary animate-pulse" />
                    Serial Number Scanner
                  </span>
                  <div className="flex items-center gap-1.5 select-none cursor-pointer" onClick={() => setAutoEnter(!autoEnter)}>
                    <span className="text-[9px] text-muted-foreground font-semibold">Fast-Mode</span>
                    <Switch checked={autoEnter} onCheckedChange={setAutoEnter} size="sm" id="mobile-auto-enter-toggle" />
                  </div>
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Input cylinder serials. Only loaded mappings are accepted ({mappedSerials.length} loaded).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <form onSubmit={handleScanSubmit} className="space-y-1.5">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Scan QR Code or manually enter here..."
                      value={scanInput}
                      onChange={handleInputChange}  
                      onPaste={handlePaste}
                      className="font-mono  tracking-widest pl-10 h-12 text-[12px] border-2 border-primary/20 uppercase disabled:opacity-90 disabled:bg-emerald-500/5 disabled:border-emerald-500/30"
                      disabled={submitting || isProcessingScan}
                    />
                    <Scan className="absolute left-3 top-3.5 w-5 h-5 text-primary" />
                  </div>
                </form>

                {/* Scanned List */}
                <div className="border rounded-xl bg-secondary/15 overflow-hidden">
                  <div className="p-3 bg-secondary/30 border-b flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                      <ListTodo className="w-4 h-4 text-primary" /> To Tag ({scannedList.length})
                    </span>
                    {scannedList.length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-bold text-red-500 active:scale-95 px-2 py-1 rounded"
                        onClick={onClear}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    {scannedList.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                        <p className="font-bold">No serials scanned yet.</p>
                        <p className="opacity-75">Click on the box above to type or scan.</p>
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
                              className="p-3 flex justify-between items-center hover:bg-secondary/10 overflow-hidden"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="font-mono font-bold text-sm text-foreground">{item.serial_number}</p>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{item.product_name}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:text-red-500 rounded-lg active:bg-red-500/10"
                                onClick={() => onRemove(item.serial_number)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Submit Button */}
                <Button
                  onClick={onSubmit}
                  className="w-full h-12 font-black text-sm tracking-wide bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg flex items-center justify-center gap-2 rounded-xl active:scale-97 transition-transform"
                  disabled={scannedList.length === 0 || submitting}
                >
                  {submitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" /> Submitting Tagging...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Confirm Delivered ({scannedList.length})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
