"use client";

import { useEffect, useState } from "react";
import { lpgSiteService } from "../services/lpgSiteService";
import { LpgSite } from "../types";
import { SiteCylinderManager } from "./SiteCylinderManager";
import {
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

interface LpgSiteViewProps {
  id?: number | null;
  onBack: () => void;
}

export function LpgSiteView({ id, onBack }: LpgSiteViewProps) {
  const [fetching, setFetching] = useState(false);

  const [formData, setFormData] = useState<Partial<LpgSite>>({
    site_name: "",
    site_address: "",
    customer_code: "",
    billing_mode: "KILO",
    default_price_per_kg: 0,
    default_target_lpg_kg: 50.00,
    is_active: true,
    cylinders: [], 
    meter_no: "",
    meter_unit: "KG",
    meter_direction: "INCREASING",
    last_meter_reading: 0,
    conversion_factor: 1.0,
    default_pressure_line: 1.000000,
    default_psi: 10.0000,
    default_atmospheric_pressure: 14.7,
    last_reading_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setFetching(true);

        if (id) {
          const site = await lpgSiteService.fetchSiteById(id);
          if (site) {
            const lpgVapor = site.default_pressure_line ?? 2.0183;
            const psi = site.default_psi ?? 10.0;
            const cf = site.default_atmospheric_pressure ?? 14.7;

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

  if (fetching) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-0">
      
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-20 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 -mx-4 sm:mx-0 px-4 sm:px-0 mb-4 gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-10 w-10 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">
            View LPG Site Details
          </h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="rounded-xl px-6 border-zinc-200 dark:border-zinc-800 flex-1 sm:flex-none">
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
              <h3 className="font-bold">Basic Information</h3>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled
                  className="w-full justify-start rounded-xl border-zinc-200 dark:border-zinc-800 font-normal h-10 bg-zinc-50 dark:bg-zinc-900/50 cursor-default opacity-100 text-left px-3 sm:px-4"
                >
                  <span className="truncate">
                    {formData?.customer?.customer_name || formData?.customer_code || "No customer selected"}
                  </span>
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Site Name / Branch</Label>
                <Input
                  
                  value={formData?.site_name || ""}
                  readOnly
                  className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Site Address</Label>
                <Textarea
                  value={formData?.site_address || ""}
                  readOnly
                  className="rounded-xl border-zinc-200 dark:border-zinc-800 min-h-[80px] bg-zinc-50 dark:bg-zinc-900/50"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Mode</Label>
                  <Select value={formData?.billing_mode} disabled>
                    <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTH">BOTH (KILO & METERED)</SelectItem>
                      <SelectItem value="KILO">KILO (By Weight)</SelectItem>
                      <SelectItem value="METERED">METERED (By Volume)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-2 sm:pt-8">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData?.is_active}
                    disabled
                    className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-600"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer text-sm sm:text-xs">Active Registry</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Price / KG</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                    <Input
                      type="number"
                      value={formData?.default_price_per_kg}
                      readOnly
                      className="rounded-xl border-zinc-200 dark:border-zinc-800 pl-7 bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Fill (KG)</Label>
                  <Input
                    type="number"
                    value={formData?.default_target_lpg_kg}
                    readOnly
                    className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meter Number</Label>
                    <Input
                      value={formData?.meter_no || ""}
                      readOnly
                      className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meter Unit</Label>
                    <Select value={formData?.meter_unit || ""} disabled>
                      <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                      <p className="text-sm font-semibold">PSI Conversion Constants</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground sm:ml-1 mt-1 sm:mt-0">
                      Kilo = Usage × LPG Vapor × Pressure Line
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* LPG VAPOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 block truncate">
                        LPG Vapor
                      </Label>
                      <Input
                        type="number"
                        value={formData?.default_pressure_line ?? ""}
                        readOnly
                        className="rounded-xl border-violet-200 dark:border-violet-800/40 font-mono bg-zinc-50 dark:bg-zinc-900/50"
                      />
                    </div>
                    {/* PSI */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block truncate">
                        PSI
                      </Label>
                      <Input
                        type="number"
                        value={formData?.default_psi ?? ""}
                        readOnly
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono bg-zinc-50 dark:bg-zinc-900/50"
                      />
                    </div>
                    {/* CORRECTION FACTOR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block truncate">
                        Correction Factor
                      </Label>
                      <Input
                        type="number"
                        value={formData?.default_atmospheric_pressure ?? ""}
                        readOnly
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 font-mono bg-zinc-50 dark:bg-zinc-900/50"
                      />
                    </div>
                  </div>

                  {/* FOR YOUR REFERENCE preview table */}
                  <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/50 mt-2 w-full">
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
                              {Number(formData?.default_psi).toFixed(4)}
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
                              {Number(formData?.default_psi) > 0
                                ? ((Number(formData?.default_psi) + Number(formData?.default_atmospheric_pressure ?? 14.7)) / Number(formData?.default_atmospheric_pressure ?? 14.7)).toFixed(4)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px] text-orange-600 dark:text-orange-500 font-semibold uppercase whitespace-nowrap">
                              {Number(formData?.default_psi) > 0 ? "PSI + CF / CF" : "N/A"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}
        </div>

      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Cylinder className="h-5 w-5 text-zinc-900 dark:text-zinc-100 shrink-0" />
          <h3 className="text-xl font-bold tracking-tight truncate">Installed Site Cylinders</h3>
        </div>
        <SiteCylinderManager
          siteId={id}
          customerCode={formData?.customer_code || ""}
          stagedCylinders={formData?.cylinders}
          readOnly={true}
        />
      </div>
    </div>
  );
}