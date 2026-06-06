"use client";

import { useEffect, useState } from "react";
import { lpgSiteService } from "../services/lpgSiteService";
import { LpgSite, BillingMode, MeterUnit, MeterDirection } from "../types";
import {
  Save,
  MapPin,
  CreditCard,
  Cylinder,
  Loader2,
  ChevronLeft,
  Gauge
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
import { SiteCylinderManager } from "./SiteCylinderManager";
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
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string; brgy?: string; city?: string; province?: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);

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
        const customerList = await lpgSiteService.fetchCustomers();
        setCustomers(customerList);

        if (id) {
          const site = await lpgSiteService.fetchSiteById(id);
          if (site) {
            let lpgVapor = site.default_pressure_line ?? 2.0183;
            let psi = site.default_psi ?? 10.0;
            let cf = site.default_atmospheric_pressure ?? 14.7;

            if (typeof window !== "undefined") {
              const cached = localStorage.getItem(`lpg_site_config_${id}`);
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  lpgVapor = Number(parsed.configLpgVapor ?? lpgVapor);
                  psi = Number(parsed.configPsi ?? psi);
                  cf = Number(parsed.configCorrectionFactor ?? cf);
                } catch (e) {
                  console.error(e);
                }
              }
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
        }
      } catch {
        toast.error("Failed to load site data");
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_code) return toast.error("Please select a customer");

    try {
      setLoading(true);
      let siteId: number | null | undefined = id;

      if (id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cylinders: _c, default_pressure_line: _pl, default_psi: _psi, default_atmospheric_pressure: _ap, ...updatePayload } = formData;
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
              opening_lpg_kg: cylinder.opening_lpg_kg,
              current_estimated_lpg_kg: cylinder.opening_lpg_kg,
              installed_date: cylinder.installed_date
            });
          }
        }
        toast.success("Site and cylinders registered successfully");
      }

      // Persist pressure configuration locally
      if (typeof window !== "undefined" && siteId) {
        localStorage.setItem(
          `lpg_site_config_${siteId}`,
          JSON.stringify({
            configLpgVapor: formData.default_pressure_line ?? 2.0183,
            configPsi: formData.default_psi ?? 10.0,
            configCorrectionFactor: formData.default_atmospheric_pressure ?? 14.7,
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between sticky top-0 z-20 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-xl h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-black tracking-tight">
            {id ? "Edit LPG Site" : "Register New LPG Site"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl px-6 border-zinc-200 dark:border-zinc-800">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl px-6 bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-600/20">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Site Details
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Basic & Billing Information */}
        <div className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-600" />
              <h3 className="font-bold">Basic Information</h3>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full justify-between rounded-xl border-zinc-200 dark:border-zinc-800 font-normal h-10"
                    >
                      {formData?.customer_code
                        ? customers.find((c) => c.customer_code === formData.customer_code)?.customer_name || "Select customer..."
                        : "Select industrial customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xl" align="start">
                    <Command className="rounded-xl">
                      <CommandInput placeholder="Search customer name or code..." className="h-10" />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
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
                                setCustomerOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.customer_code === c.customer_code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.customer_name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{c.customer_code}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
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

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold">Billing & Pricing</h3>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Mode</Label>
                  <Select
                    value={formData?.billing_mode}
                    onValueChange={(val: BillingMode) => {
                      let updatedUnit = formData.meter_unit;
                      if (val === "METERED") updatedUnit = "M3";
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
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData?.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-600"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer text-xs">Active Registry</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold">Meter Configuration</h3>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meter Direction</Label>
                    <Select
                      value={formData?.meter_direction || "INCREASING"}
                      disabled
                      onValueChange={(val: MeterDirection) => setFormData({ ...formData, meter_direction: val })}
                    >
                      <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800">
                        <SelectItem value="INCREASING">INCREASING</SelectItem>
                        <SelectItem value="DECREASING">DECREASING</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Meter Reading</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData?.last_meter_reading ?? ""}
                      onChange={(e) => setFormData({ ...formData, last_meter_reading: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      className="rounded-xl border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conversion Factor</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="1.000000"
                      value={formData?.conversion_factor ?? ""}
                      onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      className="rounded-xl border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Reading Date</Label>
                    <Input
                      type="date"
                      value={formData?.last_reading_date || ""}
                      onChange={(e) => setFormData({ ...formData, last_reading_date: e.target.value })}
                      className="rounded-xl border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                </div>

                {/* ── PSI / Pressure Billing Constants ── */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Gauge className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <p className="text-sm font-semibold">PSI Conversion Constants</p>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      Kilo = Usage × LPG Vapor × Pressure Line
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* LPG VAPOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                        LPG Vapor
                        <span className="text-muted-foreground font-normal normal-case ml-1">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="1.000000"
                        value={formData?.default_pressure_line ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_pressure_line: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-violet-200 dark:border-violet-800/40 font-mono focus:ring-violet-500"
                      />
                      <p className="text-[10px] text-muted-foreground">e.g. 2.0183 — from pressure tables</p>
                    </div>
                    {/* PSI */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        PSI
                        <span className="text-muted-foreground font-normal normal-case ml-1">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="0.0000"
                        value={formData?.default_psi ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_psi: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">e.g. 10.0000 — 0 disables PSI correction</p>
                    </div>
                    {/* CORRECTION FACTOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Correction Factor
                        <span className="text-muted-foreground font-normal normal-case ml-1">(Constant)</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="14.7000"
                        value={formData?.default_atmospheric_pressure ?? ""}
                        onChange={(e) => setFormData({ ...formData, default_atmospheric_pressure: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">Default: 14.7 (atmospheric pressure)</p>
                    </div>
                  </div>

                  {/* FOR YOUR REFERENCE preview table */}
                  <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/50 mt-1">
                    <div className="px-3 py-1.5 bg-zinc-100/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">For Your Reference</p>
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                        <tr className="bg-white dark:bg-zinc-900/40">
                          <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">LPG VAPOR</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-violet-700 dark:text-violet-400">
                            {(formData?.default_pressure_line ?? 1).toFixed(4)}
                          </td>
                          <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                        </tr>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-900/20">
                          <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">PSI</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {(formData?.default_psi ?? 0).toFixed(4)}
                          </td>
                          <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                        </tr>
                        <tr className="bg-white dark:bg-zinc-900/40">
                          <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">CORRECTION FACTOR</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {(formData?.default_atmospheric_pressure ?? 14.7).toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-semibold uppercase">CONSTANT</td>
                        </tr>
                        <tr className="bg-orange-50/40 dark:bg-orange-950/10">
                          <td className="px-3 py-2 font-semibold text-orange-700 dark:text-orange-400">PRESSURE LINE</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-orange-700 dark:text-orange-400">
                            {(formData?.default_psi ?? 0) > 0
                              ? (((formData?.default_psi ?? 0) + (formData?.default_atmospheric_pressure ?? 14.7)) / (formData?.default_atmospheric_pressure ?? 14.7)).toFixed(4)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-[10px] text-orange-600 dark:text-orange-500 font-semibold uppercase">
                            {(formData?.default_psi ?? 0) > 0 ? "PSI + CF / CF" : "N/A"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Live formula */}
                  {(formData?.default_psi ?? 0) > 0 && (
                    <div className="bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20 rounded-xl px-4 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-0.5">KG Formula Preview</p>
                      <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                        Kilo = Usage × {(formData?.default_pressure_line ?? 1).toFixed(4)} × {(((formData?.default_psi ?? 0) + (formData?.default_atmospheric_pressure ?? 14.7)) / (formData?.default_atmospheric_pressure ?? 14.7)).toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          )}
        </div>


      </div>

      {/* Full Width Bottom: Cylinder Management */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Cylinder className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
          <h3 className="text-xl font-bold tracking-tight">Installed Site Cylinders</h3>
        </div>
        <SiteCylinderManager
          siteId={id}
          customerCode={formData?.customer_code || ""}
          stagedCylinders={formData?.cylinders}
          onStagedChange={(cyls) => setFormData({ ...formData, cylinders: cyls })}
        />
      </div>
    </div>
  );
}
