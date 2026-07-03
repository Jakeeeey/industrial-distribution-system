// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/CylinderMovementsModule.tsx
"use client";

import * as React from "react";
import { fetchCylinderMovements, fetchCylinderProducts } from "./providers/fetchProvider";
import { groupMovementsBySerial, detectExceptions } from "./service";
// Comment: Removed unused type imports CylinderSummary, ExceptionDetail
import { SerialMovement } from "./types";
import { CylinderListTable } from "./components/CylinderListTable";
import { MovementLedgerTable } from "./components/MovementLedgerTable";
import { ExceptionsPanel } from "./components/ExceptionsPanel";
import { TraceDrawer } from "./components/TraceDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
// Comment: Removed unused icons Layers, ShieldAlert, ArrowUpRight, ArrowDownLeft, AlertTriangle
import { 
    Search, 
    RefreshCw, 
    ScanLine,
    Database,
    HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CylinderMovementsModule() {
    const [movements, setMovements] = React.useState<SerialMovement[]>([]);
    const [masterProducts, setMasterProducts] = React.useState<Array<{ product_id: number; product_name: string }>>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filter states
    const [selectedProductName, setSelectedProductName] = React.useState<string>("");
    const [serialSearchQuery, setSerialSearchQuery] = React.useState<string>("");

    // Tabs state
    const [activeTab, setActiveTab] = React.useState<"cylinders" | "ledger" | "exceptions">("cylinders");

    // Drawer state
    const [selectedTraceSerial, setSelectedTraceSerial] = React.useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

    // Initial load and reload logic
    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [movementsData, productsData] = await Promise.all([
                fetchCylinderMovements(),
                fetchCylinderProducts()
            ]);
            setMovements(movementsData);
            setMasterProducts(productsData);

            // Select the first product by default if we have products
            if (productsData.length > 0 && !selectedProductName) {
                // If there's a LPG 50KG Cylinder let's prioritize it (to match the HTML prototype), otherwise select first
                const defaultProd = productsData.find(p => p.product_name.includes("50KG")) || productsData[0];
                setSelectedProductName(defaultProd.product_name);
            }
        // Comment: Avoid explicit any by typing err as unknown and checking instanceof Error
        } catch (err) {
            console.error("[Cylinder Movements] Initial fetch error:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to establish secure connection to serial movement view.";
            setError(errorMessage);
            toast.error("Could not load serial movements data.");
        } finally {
            setIsLoading(false);
        }
    };

    // Comment: Disable react-hooks/exhaustive-deps warning since loadData should run strictly on mount
    React.useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filter product list options dynamically from movements unique list OR directus master
    const productOptions = React.useMemo(() => {
        const uniqueFromMovements = Array.from(new Set(movements.map(m => m.productName)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        
        if (uniqueFromMovements.length > 0) {
            return uniqueFromMovements;
        }

        return masterProducts.map(p => p.product_name);
    }, [movements, masterProducts]);

    // Group movements by serial number
    const allCylinderSummaries = React.useMemo(() => {
        return groupMovementsBySerial(movements);
    }, [movements]);

    // Filter cylinders list based on current active browse product
    const filteredCylinders = React.useMemo(() => {
        if (!selectedProductName) return [];
        return allCylinderSummaries.filter(c => c.productName === selectedProductName);
    }, [allCylinderSummaries, selectedProductName]);

    // Filter raw movements ledger based on selected browse product
    const filteredLedger = React.useMemo(() => {
        if (!selectedProductName) return [];
        return movements.filter(m => m.productName === selectedProductName);
    }, [movements, selectedProductName]);

    // Generate exception details
    const activeExceptions = React.useMemo(() => {
        if (!selectedProductName) return [];
        return detectExceptions(filteredCylinders);
    }, [filteredCylinders, selectedProductName]);

    // Derived KPI cards values
    const kpis = React.useMemo(() => {
        if (!selectedProductName) {
            return { total: 0, inBranch: 0, withCustomer: 0, refill: 0, inTransit: 0, exceptions: 0 };
        }

        const total = filteredCylinders.length;
        let inBranch = 0;
        let withCustomer = 0;
        let refill = 0;
        let inTransit = 0;

        filteredCylinders.forEach((c) => {
            if (c.direction === "IN") {
                inBranch++;
            } else if (c.direction === "Review") {
                // Conflicting, not classified
            } else {
                const doc = c.lastMovementType.toLowerCase();
                if (doc.includes("pos") || doc.includes("sales invoice") || doc.includes("sales_invoice")) {
                    withCustomer++;
                } else if (doc.includes("refill") || doc.includes("return to supplier") || doc.includes("rts")) {
                    refill++;
                } else if (doc.includes("transfer") || doc.includes("dispatch")) {
                    inTransit++;
                } else {
                    withCustomer++; // Fallback
                }
            }
        });

        return {
            total,
            inBranch,
            withCustomer,
            refill,
            inTransit,
            exceptions: activeExceptions.length
        };
    }, [filteredCylinders, activeExceptions, selectedProductName]);

    // Search function - opens trace drawer immediately if exact match is found across ALL cylinders
    const handleSearch = (overrideQuery?: string) => {
        const query = (overrideQuery ?? serialSearchQuery).trim().toUpperCase();
        if (!query) {
            toast.warning("Please enter a valid serial number.");
            return;
        }

        const matched = allCylinderSummaries.find(c => c.serialNumber.toUpperCase() === query);
        if (matched) {
            // Found: open trace drawer
            setSelectedTraceSerial(matched.serialNumber);
            setIsDrawerOpen(true);
        } else {
            toast.error(`No tracking history found for serial "${query}".`);
        }
    };

    // Simulate scanning a serial
    const handleSimulateScan = () => {
        // Find a random serial or use a default
        const sampleSerials = ["CYL-000126", "CYL-000127", "CYL-000141", "CYL-000205"];
        const matched = allCylinderSummaries.find(c => sampleSerials.includes(c.serialNumber)) || allCylinderSummaries[0];
        
        if (matched) {
            setSerialSearchQuery(matched.serialNumber);
            handleSearch(matched.serialNumber);
            toast.success(`Scanned serial: ${matched.serialNumber}`);
        } else {
            toast.error("No sample serials found in dataset.");
        }
    };

    const handleOpenTrace = (serial: string) => {
        setSelectedTraceSerial(serial);
        setIsDrawerOpen(true);
    };

    const handleResetFilters = () => {
        setSerialSearchQuery("");
        if (productOptions.length > 0) {
            // LPG 50KG Cylinder priority fallback
            const defaultProd = productOptions.find(p => p.includes("50KG")) || productOptions[0];
            setSelectedProductName(defaultProd);
        } else {
            setSelectedProductName("");
        }
        toast.info("Filters reset to default.");
    };

    // Renders the selected cylinder summary for trace drawer
    const activeTraceCylinder = React.useMemo(() => {
        if (!selectedTraceSerial) return null;
        return allCylinderSummaries.find(c => c.serialNumber === selectedTraceSerial) || null;
    }, [allCylinderSummaries, selectedTraceSerial]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-[250px]" />
                        <Skeleton className="h-4 w-[400px]" />
                    </div>
                    <Skeleton className="h-10 w-[120px]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-[300px] w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card shadow-sm space-y-4 max-w-xl mx-auto my-12">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 text-xl font-bold">
                    !
                </div>
                <h3 className="text-lg font-bold text-foreground">API Connection Error</h3>
                <p className="text-sm text-muted-foreground">
                    {error}
                </p>
                <div className="flex items-center gap-3">
                    <Button onClick={loadData} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Retry Connection
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 min-w-0 max-w-[1680px] mx-auto pb-12">
            {/* Page Header Area */}
            <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cylinder Movement Ledger</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Trace the lifecycle, location reference, and transaction history of every serialized cylinder.
                    </p>
                </div>
                <Button onClick={loadData} variant="outline" size="sm" className="gap-2 font-semibold text-xs border-input h-9">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
                </Button>
            </div>

            {/* Quick Serial Search / Scan Card */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 bg-card border rounded-xl p-5 items-end shadow-xs">
                <div className="space-y-2">
                    <Label htmlFor="serialSearch" className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Quick Serial Trace</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            <Search className="w-4 h-4" />
                        </span>
                        <Input
                            id="serialSearch"
                            type="text"
                            placeholder="Enter or scan a cylinder serial number..."
                            value={serialSearchQuery}
                            onChange={(e) => setSerialSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="pl-9 h-10 select-all font-semibold uppercase"
                        />
                    </div>
                </div>
                <Button onClick={() => handleSearch()} className="h-10 px-5 font-bold text-sm">
                    Search Cylinder
                </Button>
                <Button onClick={handleSimulateScan} variant="secondary" className="h-10 px-5 gap-2 border text-sm font-semibold text-muted-foreground bg-muted/40 hover:bg-muted">
                    <ScanLine className="w-4 h-4" /> Scan Serial
                </Button>
            </div>

            {/* Product filter browse card */}
            <div className="bg-card border rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-card-foreground">
                        Browse Cylinders by Product 
                        <span className="font-medium text-xs text-muted-foreground ml-2">
                            — Includes Branch, Customer, Supplier, and In-Transit cylinders
                        </span>
                    </h3>
                    <Button variant="link" onClick={handleResetFilters} className="text-xs text-primary font-bold p-0 h-auto">
                        Reset filters
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="productSelect" className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Product <span className="text-destructive">*</span></Label>
                        <select
                            id="productSelect"
                            value={selectedProductName}
                            onChange={(e) => setSelectedProductName(e.target.value)}
                            className="w-full h-10 px-3 border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">Select a cylinder product</option>
                            {productOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={handleResetFilters} variant="outline" className="h-10 font-bold border-input text-muted-foreground">
                        Reset
                    </Button>
                </div>
            </div>

            {/* KPI Metrics Dashboard */}
            {selectedProductName ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">Total Cylinders</div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.total.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground mt-2">Active product serials</div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> In Branch
                        </div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.inBranch.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2">Available in branches</div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> With Customer
                        </div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.withCustomer.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-2">Customer custody</div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Supplier / Refill
                        </div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.refill.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-2">Awaiting return</div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> In Transit
                        </div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.inTransit.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mt-2">Stock transfer/dispatch</div>
                    </div>
                    <div className={cn(
                        "bg-card border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow",
                        kpis.exceptions > 0 && "border-rose-500/20 bg-rose-500/[0.02]"
                    )}>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Exceptions
                        </div>
                        <div className="text-2xl font-black text-foreground mt-2">{kpis.exceptions.toLocaleString()}</div>
                        <div className={cn(
                            "text-[10px] font-semibold mt-2",
                            kpis.exceptions > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}>
                            Needs investigation
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl bg-card shadow-xs">
                    <HelpCircle className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">Select a product to populate custody KPI metrics.</p>
                </div>
            )}

            {/* Content Tabs */}
            {selectedProductName ? (
                <div className="space-y-4">
                    <div className="border-b flex items-center gap-6 overflow-x-auto shrink-0 select-none pb-[1px]">
                        <button
                            onClick={() => setActiveTab("cylinders")}
                            className={cn(
                                "py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap focus:outline-hidden",
                                activeTab === "cylinders" 
                                    ? "border-primary text-primary" 
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Cylinder List
                        </button>
                        <button
                            onClick={() => setActiveTab("ledger")}
                            className={cn(
                                "py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap focus:outline-hidden",
                                activeTab === "ledger" 
                                    ? "border-primary text-primary" 
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Movement Ledger
                        </button>
                        <button
                            onClick={() => setActiveTab("exceptions")}
                            className={cn(
                                "py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap focus:outline-hidden flex items-center gap-2",
                                activeTab === "exceptions" 
                                    ? "border-primary text-primary" 
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Exceptions 
                            {kpis.exceptions > 0 && (
                                <span className="bg-rose-500 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-full">
                                    {kpis.exceptions}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tab panels */}
                    <div>
                        {activeTab === "cylinders" && (
                            <CylinderListTable 
                                data={filteredCylinders} 
                                onViewTrace={handleOpenTrace} 
                            />
                        )}
                        {activeTab === "ledger" && (
                            <MovementLedgerTable 
                                data={filteredLedger} 
                                onViewTrace={handleOpenTrace} 
                                productNameFilter={selectedProductName}
                            />
                        )}
                        {activeTab === "exceptions" && (
                            <ExceptionsPanel 
                                exceptions={activeExceptions} 
                                onViewTrace={handleOpenTrace} 
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed rounded-xl bg-card">
                    <Database className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-base font-bold text-foreground mb-1">Browse Mode Empty State</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        Please select a product from the dropdown to list cylinders and view the transaction ledger.
                    </p>
                </div>
            )}

            {/* Trace drawer details overlay */}
            <TraceDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                cylinder={activeTraceCylinder} 
            />
        </div>
    );
}
