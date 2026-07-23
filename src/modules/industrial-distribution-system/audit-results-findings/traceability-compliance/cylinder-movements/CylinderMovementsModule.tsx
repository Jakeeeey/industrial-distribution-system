"use client";

import * as React from "react";
import { fetchCylinderMovements, fetchCylinderProducts } from "./providers/fetchProvider";
import { groupMovementsBySerial, detectExceptions } from "./service";
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
// Antigravity: Removed unused 'Search' icon from lucide-react import to resolve lint warning
import { RefreshCw, HelpCircle, Database, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
// Antigravity: Removed unused Select import after converting product select to SearchableSelect
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";

export function CylinderMovementsModule() {
    const [movements, setMovements] = React.useState<SerialMovement[]>([]);
    const [masterProducts, setMasterProducts] = React.useState<Array<{ product_id: number; product_name: string }>>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [selectedProductName, setSelectedProductName] = React.useState<string>("ALL_PRODUCTS");
    const [serialSearchQuery, setSerialSearchQuery] = React.useState<string>("");

    const [activeTab, setActiveTab] = React.useState<string>("cylinders");

    const [selectedTraceSerial, setSelectedTraceSerial] = React.useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

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

            if (productsData.length > 0 && (!selectedProductName || selectedProductName === "")) {
                setSelectedProductName("ALL_PRODUCTS");
            }
        } catch (err) {
            console.error("[Cylinder Movements] Initial fetch error:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to establish secure connection to serial movement view.";
            setError(errorMessage);
            toast.error("Could not load serial movements data.");
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const productOptions = React.useMemo(() => {
        const uniqueFromMovements = Array.from(new Set(movements.map(m => m.productName)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        
        if (uniqueFromMovements.length > 0) {
            return uniqueFromMovements;
        }

        return masterProducts.map(p => p.product_name);
    }, [movements, masterProducts]);

    const allCylinderSummaries = React.useMemo(() => {
        return groupMovementsBySerial(movements);
    }, [movements]);

    const filteredCylinders = React.useMemo(() => {
        if (!selectedProductName) return [];
        if (selectedProductName === "ALL_PRODUCTS") return allCylinderSummaries;
        if (selectedProductName.endsWith(" (EMPTY)")) {
            const baseName = selectedProductName.replace(" (EMPTY)", "");
            return allCylinderSummaries.filter(c => 
                c.productName === baseName && 
                c.movements.some(m => m.uomIds === "EMPTY" || m.uomIds === "EMPTY_CYLINDER")
            );
        }
        return allCylinderSummaries.filter(c => c.productName === selectedProductName);
    }, [allCylinderSummaries, selectedProductName]);

    const filteredLedger = React.useMemo(() => {
        if (!selectedProductName) return [];
        if (selectedProductName === "ALL_PRODUCTS") return movements;
        if (selectedProductName.endsWith(" (EMPTY)")) {
            const baseName = selectedProductName.replace(" (EMPTY)", "");
            return movements.filter(m => 
                m.productName === baseName && 
                (m.uomIds === "EMPTY" || m.uomIds === "EMPTY_CYLINDER")
            );
        }
        return movements.filter(m => m.productName === selectedProductName);
    }, [movements, selectedProductName]);

    const activeExceptions = React.useMemo(() => {
        if (!selectedProductName) return [];
        return detectExceptions(filteredCylinders);
    }, [filteredCylinders, selectedProductName]);

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
            } else {
                const doc = c.lastMovementType.toLowerCase();
                if (doc.includes("pos") || doc.includes("sales invoice") || doc.includes("sales_invoice")) {
                    withCustomer++;
                } else if (doc.includes("refill") || doc.includes("return to supplier") || doc.includes("rts")) {
                    refill++;
                } else if (doc.includes("transfer") || doc.includes("dispatch")) {
                    inTransit++;
                } else {
                    withCustomer++;
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

    const handleSearch = (overrideQuery?: string) => {
        const query = (overrideQuery ?? serialSearchQuery).trim().toUpperCase();
        if (!query) {
            toast.warning("Please enter a valid serial number.");
            return;
        }

        const matched = allCylinderSummaries.find(c => c.serialNumber.toUpperCase() === query);
        if (matched) {
            setSelectedTraceSerial(matched.serialNumber);
            setIsDrawerOpen(true);
        } else {
            toast.error(`No tracking history found for serial "${query}".`);
        }
    };

    const handleSimulateScan = () => {
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
        setSelectedProductName("ALL_PRODUCTS");
        toast.info("Filters reset to default.");
    };

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
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card shadow-sm space-y-4 max-w-xl mx-auto my-12">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">API Connection Error</h3>
                <p className="text-sm text-muted-foreground font-medium">
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
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        Cylinder Movement Ledger
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Trace the custody, handling history, and movement timeline of serialized cylinders.
                    </p>
                </div>
                <Button onClick={loadData} variant="outline" size="sm" className="gap-2 font-semibold text-xs border-border h-9 bg-background">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
                </Button>
            </div>

            <Card className="border border-border/80 shadow-xs bg-card">
                <CardContent className="p-5 flex flex-col md:flex-row gap-5 items-end justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
                        <div className="space-y-1.5">
                            <Label htmlFor="productSelect" className="text-xs font-semibold text-muted-foreground">Select Product</Label>
                            <SearchableSelect
                                options={[
                                    { value: "ALL_PRODUCTS", label: "All Products" },
                                    ...productOptions.map((name) => ({ value: name, label: name })),
                                    ...Array.from(new Set(movements.filter(m => m.uomIds === "EMPTY" || m.uomIds === "EMPTY_CYLINDER").map(m => m.productName)))
                                        .map((name) => ({ value: `${name} (EMPTY)`, label: `${name} (EMPTY)` }))
                                ]}
                                value={selectedProductName}
                                onValueChange={(val) => setSelectedProductName(val)}
                                placeholder="Select cylinder product..."
                                className="h-9 border-input bg-background font-medium text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="serialSearch" className="text-xs font-semibold text-muted-foreground">Quick Serial Trace</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="serialSearch"
                                    type="text"
                                    placeholder="Enter cylinder serial number..."
                                    value={serialSearchQuery}
                                    onChange={(e) => setSerialSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    className="h-9 select-all font-semibold uppercase tracking-wider bg-background text-xs"
                                />
                                <Button onClick={() => handleSearch()} size="sm" className="h-9 font-semibold text-xs px-4">
                                    Search
                                </Button>
                                <Button onClick={handleSimulateScan} size="sm" variant="outline" className="h-9 font-semibold text-xs px-3 whitespace-nowrap bg-background">
                                    Scan Sample
                                </Button>
                            </div>
                        </div>
                    </div>
                    {selectedProductName && selectedProductName !== "ALL_PRODUCTS" && (
                        <Button variant="ghost" onClick={handleResetFilters} className="text-xs text-muted-foreground font-semibold hover:bg-muted h-9 px-3 shrink-0">
                            Clear Filters
                        </Button>
                    )}
                </CardContent>
            </Card>

            {selectedProductName ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardHeader className="p-4 pb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Cylinders</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className="text-xl font-bold text-foreground tracking-tight">{kpis.total.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Active serial assets</p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardHeader className="p-4 pb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">In Branch</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className="text-xl font-bold text-foreground tracking-tight">{kpis.inBranch.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">In branch custody</p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardHeader className="p-4 pb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">With Customer</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className="text-xl font-bold text-foreground tracking-tight">{kpis.withCustomer.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Custody balance</p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardHeader className="p-4 pb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Supplier / Refill</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className="text-xl font-bold text-foreground tracking-tight">{kpis.refill.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Awaiting refill</p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardHeader className="p-4 pb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">In Transit</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className="text-xl font-bold text-foreground tracking-tight">{kpis.inTransit.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Under transfer</p>
                        </CardContent>
                    </Card>

                    <Card className={cn(
                        "border shadow-xs",
                        kpis.exceptions > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/80 bg-card"
                    )}>
                        <CardHeader className="p-4 pb-1">
                            <span className={cn(
                                "text-[10px] font-semibold uppercase tracking-wider",
                                kpis.exceptions > 0 ? "text-destructive" : "text-muted-foreground"
                            )}>Exceptions</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-1">
                            <div className={cn(
                                "text-xl font-bold tracking-tight",
                                kpis.exceptions > 0 ? "text-destructive" : "text-foreground"
                            )}>{kpis.exceptions.toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground mt-1">Requires audit</p>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="border border-dashed border-border/80 flex flex-col items-center justify-center p-8 text-center bg-card/25 shadow-none">
                    <HelpCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select a product to populate custody metrics.</p>
                </Card>
            )}

            {selectedProductName ? (
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="space-y-6">
                    <div className="border-b border-border/80 w-full flex justify-start">
                        <TabsList className="bg-transparent p-0 h-10 gap-6">
                            <TabsTrigger value="cylinders" className="text-xs font-bold px-1 rounded-none data-[state=active]:bg-transparent">
                                Cylinder List
                            </TabsTrigger>
                            <TabsTrigger value="ledger" className="text-xs font-bold px-1 rounded-none data-[state=active]:bg-transparent">
                                Movement Ledger
                            </TabsTrigger>
                            <TabsTrigger value="exceptions" className="text-xs font-bold px-1 rounded-none data-[state=active]:bg-transparent flex items-center gap-2">
                                Exceptions
                                {kpis.exceptions > 0 && (
                                    <Badge variant="destructive" className="font-bold text-[9px] px-1.5 py-0 rounded-full h-4.5 min-w-4.5 flex items-center justify-center">
                                        {kpis.exceptions}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="cylinders">
                        <CylinderListTable 
                            data={filteredCylinders} 
                            onViewTrace={handleOpenTrace} 
                        />
                    </TabsContent>
                    <TabsContent value="ledger">
                        <MovementLedgerTable 
                            data={filteredLedger} 
                            onViewTrace={handleOpenTrace} 
                            productNameFilter={selectedProductName}
                        />
                    </TabsContent>
                    <TabsContent value="exceptions">
                        <ExceptionsPanel 
                            exceptions={activeExceptions} 
                            onViewTrace={handleOpenTrace} 
                        />
                    </TabsContent>
                </Tabs>
            ) : (
                <Card className="flex flex-col items-center justify-center p-16 text-center border border-dashed rounded-xl bg-card/25 shadow-none">
                    <Database className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-1">Browse Mode Empty State</h3>
                    <p className="text-xs text-muted-foreground max-w-xs leading-normal">
                        Select a product from the filters to view cylinder listings and raw transaction ledger logs.
                    </p>
                </Card>
            )}

            <TraceDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                cylinder={activeTraceCylinder} 
            />
        </div>
    );
}
