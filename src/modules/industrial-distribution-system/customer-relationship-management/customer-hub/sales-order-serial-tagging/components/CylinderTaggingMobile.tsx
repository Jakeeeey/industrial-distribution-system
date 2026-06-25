import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SalesOrderTaggingDetails, MappedSerial, CustomerAsset } from "../types";
import { ScannedItem } from "../hooks/useCylinderTagging";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  const [activeTab, setActiveTab] = useState("scan");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus scanner input on tab switch to scan
  useEffect(() => {
    if (activeTab === "scan" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTab, scannedList]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const serial = scanInput.trim();
    if (serial) {
      onScan(serial);
      setScanInput("");
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
                <div className="flex justify-between items-center py-2">
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
                    {(item.tagged_serials.length > 0 || sessionScans.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t">
                        {item.tagged_serials.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary/80 text-muted-foreground border">
                            {s}
                          </span>
                        ))}
                        {sessionScans.map((s) => (
                          <span key={s.serial_number} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            {s.serial_number}
                          </span>
                        ))}
                      </div>
                    )}
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
            <Card className="border border-primary/20 shadow-md">
              <CardContent className="p-4 space-y-4">
                <form onSubmit={handleScanSubmit} className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Scan className="w-3.5 h-3.5 text-primary" /> Input Cylinder Serial ({mappedSerials.length} loaded)
                  </label>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Scan barcode or tap code..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className="font-mono text-base tracking-widest pl-10 h-12 uppercase"
                      disabled={submitting}
                    />
                    <Scan className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
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
