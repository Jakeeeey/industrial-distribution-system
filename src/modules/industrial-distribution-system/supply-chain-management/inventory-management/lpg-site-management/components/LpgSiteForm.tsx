"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { lpgSiteService } from "../services/lpgSiteService";
import { LpgSite, BillingMode, MeterUnit } from "../types";
// import { SiteCylinderManager } from "./SiteCylinderManager";
import {
  Save,
  MapPin,
  CreditCard,
  // Cylinder,
  Loader2,
  ChevronLeft,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
// import { SiteCylinderManager } from "./SiteCylinderManager";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LpgSiteFormProps {
  id?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LpgSiteForm({ id, onSuccess, onCancel }: LpgSiteFormProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string; brgy?: string; city?: string; province?: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [formData, setFormData] = useState<Partial<LpgSite>>({
    site_name: "",
    site_address: "",
    customer_code: "",
    billing_mode: "KILO",
    default_price_per_kg: 0,
    default_target_lpg_kg: 50.00,
    is_active: true,
    cylinders: [], // Local staging for new sites
    meter_no: "",
    meter_unit: "KG",
    meter_direction: "INCREASING",
    last_meter_reading: 0,
    conversion_factor: 1.0,
    default_pressure_line: 1.000000,
    default_psi: 0.0,
    default_atmospheric_pressure: 14.7,
    last_reading_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setFetching(true);
        setFetchError(null);

        const customerList = await lpgSiteService.fetchCustomers();
        if (!customerList) {
          throw new Error("Failed to load customer list — the server returned no data.");
        }

        let initialCustomers = [...customerList];

        if (id) {
          const site = await lpgSiteService.fetchSiteById(id);
          if (!site) {
            throw new Error(`Site #${id} could not be loaded — it may not exist or the server is unavailable.`);
          }

          let lpgVapor = site.default_pressure_line;
          let psi = site.default_psi;
          let cf = site.default_atmospheric_pressure;

          if (typeof window !== "undefined") {
            const cached = localStorage.getItem(`lpg_site_config_${id}`);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                // Only override from cache if the cached key is present and a valid number
                if (parsed.configLpgVapor !== undefined && !isNaN(Number(parsed.configLpgVapor))) {
                  lpgVapor = Number(parsed.configLpgVapor);
                }
                if (parsed.configPsi !== undefined && !isNaN(Number(parsed.configPsi))) {
                  psi = Number(parsed.configPsi);
                }
                if (parsed.configCorrectionFactor !== undefined && !isNaN(Number(parsed.configCorrectionFactor))) {
                  cf = Number(parsed.configCorrectionFactor);
                }
              } catch {
                // Cached data is corrupt — clear it and warn the user
                localStorage.removeItem(`lpg_site_config_${id}`);
                toast.error("Cached PSI configuration was corrupted and has been cleared. Showing server values.");
              }
            }
          }

          // Ensure site customer is in the initial customers list
          if (site.customer_code && !initialCustomers.some(c => c.customer_code === site.customer_code)) {
            const siteCustomer = site.customer || {
              customer_code: site.customer_code,
              customer_name: site.customer_code
            };
            initialCustomers = [siteCustomer, ...initialCustomers];
          }

          setFormData({
            ...site,
            meter_direction: site.meter_direction || "INCREASING",
            default_pressure_line: lpgVapor,
            default_psi: psi,
            default_atmospheric_pressure: cf,
            cylinders: site.cylinders || []
          });
        }

        setCustomers(initialCustomers);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load site data.";
        setFetchError(msg);
        toast.error(msg);
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [id]);

  // Debounced search for customers
  useEffect(() => {
    if (!customerOpen) return;

    const searchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const list = await lpgSiteService.fetchCustomers(customerSearch);
        if (list) {
          setCustomers(prev => {
            // Keep the currently selected customer in the options list so it remains visible
            const currentSelected = prev.find(c => c.customer_code === formData.customer_code);
            let merged = [...list];
            if (currentSelected && !merged.some(c => c.customer_code === currentSelected.customer_code)) {
              merged = [currentSelected, ...merged];
            }
            return merged;
          });
        }
      } catch (err) {
        console.error("Error searching customers:", err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerOpen, formData.customer_code]);

  const handleCustomerOpenChange = (open: boolean) => {
    setCustomerOpen(open);
    if (!open) {
      setCustomerSearch("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_code) return toast.error("Please select a customer");

    try {
      setLoading(true);
      let siteId: number | null | undefined = id;

      if (id) {
        // Strip only the cylinders array (managed via its own endpoint).
        // default_pressure_line / default_psi / default_atmospheric_pressure ARE
        // persisted to lpg_customer_lpg_sites so they must stay in the payload.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cylinders: _c, ...updatePayload } = formData;
        await lpgSiteService.updateSite(id, updatePayload);
        toast.success("Site updated successfully");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cylinders: _c2, default_pressure_line: _pl2, default_psi: _psi2, default_atmospheric_pressure: _ap2, ...createPayload } = formData;
        const newSite = await lpgSiteService.createSite(createPayload);
        siteId = newSite.id;

        // If there are staged cylinders, install them now
        if (formData?.cylinders && formData.cylinders.length > 0) {
          for (const cylinder of formData.cylinders) {
            await lpgSiteService.installCylinder({
              lpg_site_id: siteId!,
              customer_code: formData.customer_code,
              cylinder_asset_id: cylinder.cylinder_asset_id,
              site_cylinder_status: cylinder.site_cylinder_status || 'CONNECTED',
              previous_lpg_kg: cylinder.previous_lpg_kg,
              current_lpg_kg: cylinder.previous_lpg_kg,
              installed_date: cylinder.installed_date
            });
          }
        }
        toast.success("Site and cylinders registered successfully");
      }

      // Persist pressure configuration locally (only when values are present)
      if (typeof window !== "undefined" && siteId) {
        localStorage.setItem(
          `lpg_site_config_${siteId}`,
          JSON.stringify({
            configLpgVapor: formData.default_pressure_line,
            configPsi: formData.default_psi,
            configCorrectionFactor: formData.default_atmospheric_pressure,
          })
        );
      }

      onSuccess();
    } catch {
      toast.error("Failed to save site");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-6">
        <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-red-700 dark:text-red-400">Failed to Load</p>
          <p className="text-sm text-muted-foreground max-w-sm">{fetchError}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => { setFetchError(null); setFetching(true); }}
            className="text-sm px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-0">
      
      {/* ── RESPONSIVE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-20 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 -mx-4 sm:mx-0 px-4 sm:px-0 mb-4 gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-xl h-10 w-10 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">
            {id ? "Edit LPG Site" : "Register New LPG Site"}
          </h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onCancel} className="rounded-xl px-6 border-zinc-200 dark:border-zinc-800 flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl px-6 bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-600/20 flex-1 sm:flex-none">
            {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Save className="h-4 w-4 shrink-0" />}
            <span className="truncate">Save Site</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Basic & Billing Information */}
        <div className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
              <h3 className="font-bold">Basic Information</h3>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Popover open={customerOpen} onOpenChange={handleCustomerOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full justify-between rounded-xl border-zinc-200 dark:border-zinc-800 font-normal h-10 px-3 sm:px-4 text-left"
                    >
                      <span className="truncate">
                        {formData?.customer_code
                          ? customers.find((c) => c.customer_code === formData.customer_code)?.customer_name || "Select customer..."
                          : "Select industrial customer..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xl" align="start">
                    <Command className="rounded-xl max-w-full" shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search customer name or code..." 
                        className="h-10" 
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        {loadingCustomers ? (
                          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                            Searching customers...
                          </div>
                        ) : customers.length === 0 ? (
                          <CommandEmpty>No customer found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.customer_code}
                                value={`${c.customer_name} ${c.customer_code}`}
                                onSelect={() => {
                                  const fullAddress = [c.brgy, c.city, c.province].filter(Boolean).join(", ");
                                  setFormData({
                                    ...formData,
                                    customer_code: c.customer_code,
                                    site_address: formData?.site_address || fullAddress
                                  });
                                  handleCustomerOpenChange(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    formData.customer_code === c.customer_code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col truncate pr-2">
                                  <span className="font-medium truncate">{c.customer_name}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase truncate">{c.customer_code}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Site Name / Branch</Label>
                <Input
                  placeholder="e.g. Warehouse A, Main Kitchen"
                  value={formData?.site_name || ""}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  className="rounded-xl border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="space-y-2">
                <Label>Site Address</Label>
                <Textarea
                  placeholder="Full physical address for delivery and billing"
                  value={formData?.site_address || ""}
                  onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                  className="rounded-xl border-zinc-200 dark:border-zinc-800 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600 shrink-0" />
              <h3 className="font-bold">Billing & Pricing</h3>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-4">
              
              {/* ── Responsive Grid: grid-cols-1 sm:grid-cols-2 ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Mode</Label>
                  <Select
                    value={formData?.billing_mode}
                    onValueChange={(val: BillingMode) => {
                      let updatedUnit = formData.meter_unit;
                      if (val === "METERED" || val === "BOTH") updatedUnit = "M3";
                      if (val === "KILO") updatedUnit = "KG";
                      setFormData({
                        ...formData,
                        billing_mode: val,
                        meter_unit: updatedUnit,
                        meter_direction: "INCREASING"
                      });
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800">
                      <SelectItem value="BOTH">BOTH (KILO & METERED)</SelectItem>
                      <SelectItem value="KILO">KILO (By Weight)</SelectItem>
                      <SelectItem value="METERED">METERED (By Volume)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Repositioned spacing for mobile so it doesn't look awkwardly padded */}
                <div className="flex items-center gap-2 sm:pt-8 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData?.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-600"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer text-sm sm:text-xs">Active Registry</Label>
                </div>
              </div>

              {/* ── Responsive Grid: grid-cols-1 sm:grid-cols-2 ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Price / KG</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData?.default_price_per_kg}
                      onChange={(e) => setFormData({ ...formData, default_price_per_kg: parseFloat(e.target.value) })}
                      className="rounded-xl border-zinc-200 dark:border-zinc-800 pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Fill (KG)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData?.default_target_lpg_kg}
                    onChange={(e) => setFormData({ ...formData, default_target_lpg_kg: parseFloat(e.target.value) })}
                    className="rounded-xl border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meter Configuration */}
          {(formData?.billing_mode === "METERED" || formData?.billing_mode === "BOTH") && (
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-600 shrink-0" />
                <h3 className="font-bold">Meter Configuration</h3>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                
                {/* ── Responsive Grid: grid-cols-1 sm:grid-cols-2 ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meter Number</Label>
                    <Input
                      placeholder="e.g. MET-12345"
                      value={formData?.meter_no || ""}
                      onChange={(e) => setFormData({ ...formData, meter_no: e.target.value })}
                      className="rounded-xl border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meter Unit</Label>
                    <Select
                      value={formData?.meter_unit || ""}
                      onValueChange={(val: MeterUnit) => setFormData({ ...formData, meter_unit: val })}
                    >
                      <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800">
                        <SelectItem value="M3">M3 (Cubic Meters)</SelectItem>
                        <SelectItem value="KG">KG (Kilograms)</SelectItem>
                        <SelectItem value="LITER">LITER (Liters)</SelectItem>
                        <SelectItem value="UNIT">UNIT (Units)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── PSI / Pressure Billing Constants ── */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <Gauge className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                      <p className="text-sm font-semibold">PSI Constants</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground sm:ml-1 mt-1 sm:mt-0">
                      Kilo = Usage × LPG Vapor × Pressure Line
                    </span>
                  </div>

                  {/* ── Responsive Grid: grid-cols-1 sm:grid-cols-3 ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* LPG VAPOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 block truncate">
                        LPG Vapor
                        <span className="text-muted-foreground font-normal normal-case ml-1 hidden lg:inline">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="1.000000"
                        value={formData?.default_pressure_line ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_pressure_line: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-violet-200 dark:border-violet-800/40 font-mono focus:ring-violet-500"
                      />
                      <p className="text-[10px] text-muted-foreground truncate">e.g. 2.0183 — from tables</p>
                    </div>
                    {/* PSI */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block truncate">
                        PSI
                        <span className="text-muted-foreground font-normal normal-case ml-1 hidden lg:inline">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="0.0000"
                        value={formData?.default_psi ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_psi: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground truncate">e.g. 10.0000 — 0 to disable</p>
                    </div>
                    {/* CORRECTION FACTOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block truncate">
                        Correction Factor
                        <span className="text-muted-foreground font-normal normal-case ml-1 hidden lg:inline">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="14.7000"
                        value={formData?.default_atmospheric_pressure ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_atmospheric_pressure: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground truncate">Default: 14.7 (atm pressure)</p>
                    </div>
                  </div>

                  {/* FOR YOUR REFERENCE preview table (Wrapped with overflow-x-auto for mobile) */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 mt-2 w-full overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">For Your Reference</p>
                    </div>
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-xs min-w-[300px]">
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                          <tr className="bg-white dark:bg-zinc-900/40">
                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">LPG VAPOR</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-violet-700 dark:text-violet-400">
                              {Number(formData?.default_pressure_line ?? 1).toFixed(4)}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                          </tr>
                          <tr className="bg-zinc-50/50 dark:bg-zinc-900/20">
                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">PSI</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {Number(formData?.default_psi ?? 0).toFixed(4)}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                          </tr>
                          <tr className="bg-white dark:bg-zinc-900/40">
                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">CORRECTION FACTOR</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {Number(formData?.default_atmospheric_pressure ?? 14.7).toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                          </tr>
                          <tr className="bg-orange-50/40 dark:bg-orange-950/10">
                            <td className="px-3 py-2 font-semibold text-orange-700 dark:text-orange-400 whitespace-nowrap">PRESSURE LINE</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-orange-700 dark:text-orange-400">
                              {Number(formData?.default_psi ?? 0) > 0
                                ? ((Number(formData?.default_psi ?? 0) + Number(formData?.default_atmospheric_pressure ?? 14.7)) / Number(formData?.default_atmospheric_pressure ?? 14.7)).toFixed(4)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px] text-orange-600 dark:text-orange-500 font-semibold uppercase whitespace-nowrap">
                              {Number(formData?.default_psi ?? 0) > 0 ? "PSI + CF / CF" : "N/A"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Live formula */}
                  {Number(formData?.default_psi ?? 0) > 0 && (
                    <div className="bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20 rounded-xl px-4 py-2.5 mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-0.5">KG Formula Preview</p>
                      <p className="text-xs sm:text-sm font-mono text-zinc-700 dark:text-zinc-300 break-words">
                        Kilo = Usage × {Number(formData?.default_pressure_line ?? 1).toFixed(4)} × {((Number(formData?.default_psi ?? 0) + Number(formData?.default_atmospheric_pressure ?? 14.7)) / Number(formData?.default_atmospheric_pressure ?? 14.7)).toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}