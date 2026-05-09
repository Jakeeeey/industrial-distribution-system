"use client";

import { useEffect, useState, useCallback } from "react";
import { lpgSiteService } from "../services/lpgSiteService";
import { SiteCylinder, SiteCylinderStatus } from "../types";
import {
  Plus,
  Trash2,
  Cylinder,
  Calendar,
  Weight,
  AlertCircle,
  PackageCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronsUpDown, Pencil } from "lucide-react";
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

interface AvailableAsset {
  id: number;
  serial_number: string;
  tare_weight?: number;
  product_id?: number;
  product?: { product_name: string };
}

interface AvailableProduct {
  product_id: number;
  product_name: string;
  product_code: string;
}

interface SiteCylinderManagerProps {
  siteId?: number | null;
  customerCode: string;
  stagedCylinders?: SiteCylinder[];
  onStagedChange?: (cylinders: SiteCylinder[]) => void;
}

export function SiteCylinderManager({ siteId, customerCode, stagedCylinders, onStagedChange }: SiteCylinderManagerProps) {
  const [cylinders, setCylinders] = useState<SiteCylinder[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [editingCylinder, setEditingCylinder] = useState<SiteCylinder | null>(null);

  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const [installForm, setInstallForm] = useState<Partial<SiteCylinder>>({
    site_cylinder_status: 'CONNECTED',
    opening_lpg_kg: 50,
    installed_date: new Date().toISOString().split('T')[0]
  });

  const loadCylinders = useCallback(async () => {
    if (!siteId) {
      setCylinders(stagedCylinders || []);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await lpgSiteService.fetchCylindersAtSite(siteId);
      setCylinders(data);
    } catch {
      toast.error("Failed to load cylinders");
    } finally {
      setLoading(false);
    }
  }, [siteId, stagedCylinders]);

  const loadAvailableAssets = useCallback(async () => {
    if (!selectedProductId && !editingCylinder) {
      setAvailableAssets([]);
      return;
    }
    try {
      const data = await lpgSiteService.fetchAvailableCylinders(assetSearch, selectedProductId || undefined);
      setAvailableAssets(data || []);
    } catch (error) {
      console.error("Failed to load assets", error);
      setAvailableAssets([]);
    }
  }, [assetSearch, selectedProductId, editingCylinder]);

  const loadAvailableProducts = useCallback(async () => {
    try {
      const data = await lpgSiteService.fetchSerializedProducts(productSearch);
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("Failed to load products", error);
      setAvailableProducts([]);
    }
  }, [productSearch]);

  useEffect(() => {
    loadCylinders();
  }, [loadCylinders]);

  useEffect(() => {
    if (open) {
      loadAvailableProducts();
    }
  }, [open, loadAvailableProducts]);

  useEffect(() => {
    if (open && (selectedProductId || editingCylinder)) {
      loadAvailableAssets();
    }
  }, [open, selectedProductId, editingCylinder, loadAvailableAssets]);

  const handleInstall = async () => {
    if (!installForm.cylinder_asset_id && !editingCylinder) return toast.error("Please select a cylinder");

    try {
      if (editingCylinder) {
        if (!siteId) {
          const updated = stagedCylinders?.map(c =>
            c.id === editingCylinder.id ? { ...c, ...installForm } : c
          );
          onStagedChange?.(updated || []);
        } else {
          await lpgSiteService.updateSiteCylinder(editingCylinder.id, installForm);
          await loadCylinders();
        }
        toast.success("Cylinder updated");
      } else {
        if (!siteId) {
          const currentAssetId = typeof installForm.cylinder_asset_id === 'object' ? (installForm.cylinder_asset_id as { id: number })?.id : installForm.cylinder_asset_id;
          const selectedAsset = availableAssets.find(a => a.id === currentAssetId);
          const newStaged: SiteCylinder = {
            id: Math.random(),
            lpg_site_id: 0,
            customer_code: customerCode,
            cylinder_asset_id: installForm.cylinder_asset_id!,
            installed_date: installForm.installed_date || new Date().toISOString().split('T')[0],
            removed_date: null,
            site_cylinder_status: installForm.site_cylinder_status || 'CONNECTED',
            opening_lpg_kg: installForm.opening_lpg_kg ?? null,
            current_estimated_lpg_kg: installForm.opening_lpg_kg ?? null,
            remarks: null,
            created_by: null,
            created_date: null,
            modified_by: null,
            modified_date: null,
            asset: selectedAsset ? {
              id: selectedAsset.id,
              serial_number: selectedAsset.serial_number,
              tare_weight: selectedAsset.tare_weight ?? 0,
              product_id: selectedAsset.product_id ?? 0,
              product: selectedAsset.product ? {
                product_id: selectedAsset.product_id ?? 0,
                product_name: selectedAsset.product.product_name,
                product_code: ''
              } : undefined
            } : undefined
          };
          onStagedChange?.([...(stagedCylinders || []), newStaged]);
        } else {
          await lpgSiteService.installCylinder({
            ...installForm,
            lpg_site_id: siteId,
            customer_code: customerCode
          });
          await loadCylinders();
        }
        toast.success("Cylinder installed");
      }
      setOpen(false);
      setEditingCylinder(null);
      setInstallForm({
        site_cylinder_status: 'CONNECTED',
        opening_lpg_kg: 50,
        installed_date: new Date().toISOString().split('T')[0]
      });
    } catch {
      toast.error("Operation failed");
    }
  };

  const handleRemove = async (sc: SiteCylinder) => {
    if (!siteId) {
      onStagedChange?.((stagedCylinders || []).filter(c => c.id !== sc.id));
      return;
    }
    if (!confirm("Are you sure you want to remove this cylinder from the site?")) return;
    try {
      const assetId = typeof sc.cylinder_asset_id === 'object' ? sc.cylinder_asset_id.id : sc.cylinder_asset_id;
      await lpgSiteService.removeCylinder(sc.id, assetId);
      toast.success("Cylinder removed successfully");
      loadCylinders();
    } catch {
      toast.error("Failed to remove cylinder");
    }
  };

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-500" />
              Active Site Cylinders
            </h3>
            <p className="text-xs text-muted-foreground">Manage cylinders currently deployed at this installation.</p>
          </div>

          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
              setEditingCylinder(null);
              setSelectedProductId(null);
              setAvailableAssets([]);
              setInstallForm({
                site_cylinder_status: 'CONNECTED',
                opening_lpg_kg: 50,
                installed_date: new Date().toISOString().split('T')[0]
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all">
                <Plus className="h-4 w-4" />
                Install Cylinder
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-zinc-200 dark:border-zinc-800">
              <DialogHeader>
                <DialogTitle>{editingCylinder ? "Update Cylinder Status" : "Deploy Cylinder to Site"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Cylinder Product</Label>
                  <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                    <PopoverTrigger asChild disabled={!!editingCylinder}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productPickerOpen}
                        className="w-full justify-between rounded-xl border-zinc-200 dark:border-zinc-800 font-normal h-10"
                      >
                        {editingCylinder
                          ? (editingCylinder.asset?.product?.product_name || "Existing Product")
                          : (selectedProductId
                            ? availableProducts.find(p => p.product_id === selectedProductId)?.product_name
                            : "Select cylinder product...")
                        }
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput
                          placeholder="Search product..."
                          className="h-10"
                          value={productSearch}
                          onValueChange={setProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No products found.</CommandEmpty>
                          <CommandGroup>
                            {(availableProducts || []).map((product) => (
                              <CommandItem
                                key={product.product_id}
                                value={product.product_name}
                                onSelect={() => {
                                  setSelectedProductId(product.product_id);
                                  setInstallForm({ ...installForm, cylinder_asset_id: undefined });
                                  setProductPickerOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProductId === product.product_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold">{product.product_name}</span>
                                  <span className="text-xs text-muted-foreground">{product.product_code}</span>
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
                  <Label>Select Cylinder Serial Number</Label>
                  <Popover open={assetPickerOpen} onOpenChange={setAssetPickerOpen}>
                    <PopoverTrigger asChild disabled={!!editingCylinder || (!selectedProductId && !editingCylinder)}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assetPickerOpen}
                        className="w-full justify-between rounded-xl border-zinc-200 dark:border-zinc-800 font-normal h-10"
                      >
                        {editingCylinder
                          ? (editingCylinder.asset?.serial_number || "Existing Asset")
                          : (installForm.cylinder_asset_id
                            ? availableAssets.find(a => a.id === (typeof installForm.cylinder_asset_id === 'object' ? installForm.cylinder_asset_id.id : installForm.cylinder_asset_id))?.serial_number
                            : (!selectedProductId ? "Select product first..." : "Select available serial..."))
                        }
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput
                          placeholder="Type serial number to search..."
                          className="h-10"
                          value={assetSearch}
                          onValueChange={setAssetSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No available cylinders found.</CommandEmpty>
                          <CommandGroup>
                            {(availableAssets || []).map((asset) => (
                              <CommandItem
                                key={asset.id}
                                value={asset.serial_number}
                                onSelect={() => {
                                  setInstallForm({ ...installForm, cylinder_asset_id: asset.id });
                                  setAssetPickerOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    (typeof installForm.cylinder_asset_id === 'object' ? installForm.cylinder_asset_id.id : installForm.cylinder_asset_id) === asset.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-mono font-bold">{asset.serial_number}</span>
                                  {asset.tare_weight && <span className="text-[10px] text-muted-foreground">Tare: {asset.tare_weight} KG</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status at Site</Label>
                    <Select
                      value={installForm.site_cylinder_status}
                      onValueChange={(val: SiteCylinderStatus) => setInstallForm({ ...installForm, site_cylinder_status: val })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="CONNECTED">Connected</SelectItem>
                        <SelectItem value="STANDBY">Standby</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Opening LPG (KG)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={installForm.opening_lpg_kg ?? ""}
                      onChange={(e) => setInstallForm({ ...installForm, opening_lpg_kg: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Installation Date</Label>
                  <Input
                    type="date"
                    value={installForm.installed_date}
                    onChange={(e) => setInstallForm({ ...installForm, installed_date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button onClick={handleInstall} className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white">
                    {editingCylinder ? "Update Cylinder" : "Deploy Cylinder"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/50">
                <TableHead>Serial Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>LPG Weight (Est.)</TableHead>
                <TableHead>Installed Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : cylinders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    No cylinders currently installed at this site.
                  </TableCell>
                </TableRow>
              ) : (
                cylinders.map((sc) => (
                  <TableRow key={sc.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Cylinder className="h-4 w-4 text-zinc-600" />
                        </div>
                        <span className="font-mono font-medium">{sc.asset?.serial_number || (typeof sc.cylinder_asset_id === 'object' ? sc.cylinder_asset_id?.serial_number : "Unknown")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sc.site_cylinder_status === 'CONNECTED' ? 'default' : 'outline'}
                        className={`rounded-md text-[10px] uppercase ${sc.site_cylinder_status === 'CONNECTED' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' : ''}`}
                      >
                        {sc.site_cylinder_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-bold">{Number(sc.current_estimated_lpg_kg ?? sc.opening_lpg_kg ?? 0).toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground">KG</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {sc.installed_date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setEditingCylinder(sc);
                            const assetObj = sc.asset || (typeof sc.cylinder_asset_id === 'object' ? sc.cylinder_asset_id : undefined);
                            setInstallForm({
                              site_cylinder_status: sc.site_cylinder_status,
                              opening_lpg_kg: sc.opening_lpg_kg || 0,
                              installed_date: sc.installed_date,
                              cylinder_asset_id: assetObj?.id
                            });
                            setSelectedProductId(assetObj?.product_id ?? null);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemove(sc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {cylinders.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">Billing Notice</p>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                These cylinders will be automatically suggested in the **Consumption Billing** module for this site.
                Ensure the statuses are correct to maintain accurate inventory levels.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
