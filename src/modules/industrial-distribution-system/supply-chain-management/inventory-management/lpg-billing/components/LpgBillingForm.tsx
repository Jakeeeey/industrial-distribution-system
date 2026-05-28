"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  User,
  Calendar,
  Hash,
  Calculator,
  Save,
  CheckCircle,
  X
} from "lucide-react";
import {
  LpgSite,
  SiteCylinder,
  ConsumptionBilling,
  BillingCylinderLine
} from "../types";

import { format } from "date-fns";

interface Props {
  id?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LpgBillingForm({ id, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([]);
  const [sites, setSites] = useState<{ value: string; label: string; raw: LpgSite }[]>([]);
  const [availableCylinders, setAvailableCylinders] = useState<SiteCylinder[]>([]);

  const [branches, setBranches] = useState<{ value: string; label: string }[]>([]);
  const [salesmen, setSalesmen] = useState<{ value: string; label: string }[]>([]);

  // Form State
  const [customerCode, setCustomerCode] = useState("");
  const [siteId, setSiteId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [salesType, setSalesType] = useState("");
  const [receiptType, setReceiptType] = useState("");
  const [billingDate, setBillingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [billingNo, setBillingNo] = useState(`BILL-${Date.now().toString().slice(-6)}`);
  const [pricePerKg, setPricePerKg] = useState<number>(0);
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "POSTED">("DRAFT");

  // Cylinder Lines
  const [lines, setLines] = useState<Partial<BillingCylinderLine>[]>([]);

  // Initial Load
  useEffect(() => {
    fetch("/api/ids/scm/inventory-management/lpg-billing/customers")
      .then(r => r.json())
      .then(d => {
        if (d.data) setCustomers(d.data.map((c: { customer_code: string; customer_name: string }) => ({ value: c.customer_code, label: `${c.customer_code} - ${c.customer_name}` })));
      })
      .catch(console.error);

    fetch("/api/ids/scm/inventory-management/lpg-billing/branches").then(r => r.json()).then(d => d.data && setBranches(d.data.map((b: { id: number; branch_name: string }) => ({ value: String(b.id), label: b.branch_name })))).catch(console.error);
    fetch("/api/ids/scm/inventory-management/lpg-billing/salesmen").then(r => r.json()).then(d => d.data && setSalesmen(d.data.map((s: { id: number; salesman_name: string }) => ({ value: String(s.id), label: s.salesman_name })))).catch(console.error);
    // Add others if needed or just keep these for now
  }, []);

  // Detailed initial load if id exists
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/ids/scm/inventory-management/lpg-billing/${id}`)
        .then(r => r.json())
        .then(d => {
          const data = d.data;
          if (!data) return;
          setCustomerCode(data.customer_code);
          setSiteId(String(data.lpg_site_id));
          setBillingDate(data.billing_date);
          setBillingNo(data.billing_no);
          setPricePerKg(data.price_per_kg);
          setBranchId(data.branch_id ? String(data.branch_id) : "");
          setSalesmanId(data.salesman_id ? String(data.salesman_id) : "");
          setSupplierId(data.supplier_id ? String(data.supplier_id) : "");
          setSalesType(data.sales_type ? String(data.sales_type) : "");
          setReceiptType(data.receipt_type ? String(data.receipt_type) : "");
          setRemarks(data.remarks || "");
          setStatus(data.status as "DRAFT" | "POSTED");
          setLines(data.lines || []);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Load Sites when Customer changes
  useEffect(() => {
    if (customerCode) {
      fetch(`/api/ids/scm/inventory-management/lpg-billing/sites?customerCode=${customerCode}`)
        .then(r => r.json())
        .then(d => {
          const data: { id: number; site_name: string | null; default_price_per_kg: number; default_target_lpg_kg: number }[] = d.data || [];
          setSites(data.map((s) => ({ value: String(s.id), label: s.site_name || "Unnamed Site", raw: s as LpgSite })));
          if (!data.find((s) => String(s.id) === siteId)) {
            setSiteId("");
          }
        })
        .catch(console.error);
    } else {
      setSites([]);
      setSiteId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCode]);

  // Load Cylinders when Site changes
  useEffect(() => {
    if (siteId) {
      const selectedSite = sites.find(s => s.value === siteId)?.raw;
      if (selectedSite) {
        setPricePerKg(selectedSite.default_price_per_kg);
      }

      fetch(`/api/ids/scm/inventory-management/lpg-billing/cylinders?siteId=${siteId}`)
        .then(r => r.json())
        .then(d => {
          setAvailableCylinders(d.data || []);
        })
        .catch(console.error);
    } else {
      setAvailableCylinders([]);
      if (!id) setLines([]);
    }
  }, [siteId, sites, id]);

  // Helper to add a cylinder line
  const addCylinderLine = (cylinder: SiteCylinder) => {
    const selectedSite = sites.find(s => s.value === siteId)?.raw;
    const newLine: Partial<BillingCylinderLine> = {
      site_cylinder_id: cylinder.id,
      cylinder_asset_id: cylinder.cylinder_asset_id,
      product_id: cylinder.asset?.product_id,
      serial_number: cylinder.asset?.serial_number || "",
      tare_weight: cylinder.asset?.tare_weight || 0,
      target_lpg_kg: selectedSite?.default_target_lpg_kg || 50,
      current_gross_weight: 0,
      remaining_lpg_kg: 0,
      target_gross_weight: 0,
      kg_needed: 0,
      price_per_kg: pricePerKg,
      line_total: 0,
      product: cylinder.asset?.product
    };
    setLines(prev => [...prev, newLine]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<BillingCylinderLine>) => {
    setLines(prev => {
      const newLines = [...prev];
      const line = { ...newLines[index], ...updates };

      // Recalculate
      if (line.tare_weight !== undefined && line.current_gross_weight !== undefined && line.target_lpg_kg !== undefined) {
        line.remaining_lpg_kg = Number((line.current_gross_weight - line.tare_weight).toFixed(2));
        line.target_gross_weight = Number((line.tare_weight + line.target_lpg_kg).toFixed(2));
        line.kg_needed = Number((line.target_gross_weight - line.current_gross_weight).toFixed(2));
        line.line_total = Number((line.kg_needed * (line.price_per_kg || pricePerKg)).toFixed(2));
      }

      newLines[index] = line;
      return newLines;
    });
  };

  // Totals Calculation
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + (line.line_total || 0), 0);
    const tax = subtotal * 0.12; // Example 12% VAT
    const totalWeight = lines.reduce((sum, line) => sum + (line.kg_needed || 0), 0);
    return {
      totalWeight,
      subtotal,
      tax,
      grandTotal: subtotal + tax
    };
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerCode || !siteId || lines.length === 0) return;

    setLoading(true);
    try {
      const payload: Partial<ConsumptionBilling> = {
        billing_no: billingNo,
        billing_date: billingDate,
        customer_code: customerCode,
        lpg_site_id: Number(siteId),
        branch_id: branchId ? Number(branchId) : null,
        salesman_id: salesmanId ? Number(salesmanId) : null,
        supplier_id: supplierId ? Number(supplierId) : null,
        sales_type: salesType ? Number(salesType) : null,
        receipt_type: receiptType ? Number(receiptType) : null,
        price_per_kg: pricePerKg,
        total_billable_kg: totals.totalWeight,
        subtotal_amount: totals.subtotal,
        tax_amount: totals.tax,
        grand_total_amount: totals.grandTotal,
        status: status,
        remarks: remarks,
        billing_type: 'KILO',
        lines: lines as BillingCylinderLine[]
      };

      if (id) {
        //src\app\api\ids\scm\inventory-management\lpg-billing
        await fetch(`/api/ids/scm/inventory-management/lpg-billing/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`/api/ids/scm/inventory-management/lpg-billing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {id ? "Edit Consumption Billing" : "New Consumption Billing"}
          </h1>
          <p className="text-sm text-muted-foreground">KILO Billing Mode</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-9 px-4 hover:bg-red-50 hover:text-red-600 transition-colors">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !customerCode || !siteId || lines.length === 0}
            className="h-9 px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            {loading ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {status === "POSTED" ? "Post Billing" : "Save as Draft"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                <User className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Customer Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</Label>
                <SearchableSelect
                  options={customers}
                  value={customerCode}
                  onValueChange={setCustomerCode}
                  placeholder="Select Customer..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LPG Site</Label>
                <SearchableSelect
                  options={sites}
                  value={siteId}
                  onValueChange={setSiteId}
                  placeholder={customerCode ? "Select Site..." : "Select Customer First"}
                  disabled={!customerCode}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Branch</Label>
                <SearchableSelect
                  options={branches}
                  value={branchId}
                  onValueChange={setBranchId}
                  placeholder="Select Branch..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Salesman</Label>
                <SearchableSelect
                  options={salesmen}
                  value={salesmanId}
                  onValueChange={setSalesmanId}
                  placeholder="Select Salesman..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier</Label>
                <SearchableSelect
                  options={[]}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  placeholder="Select Supplier..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Type</Label>
                <SearchableSelect
                  options={[]}
                  value={salesType}
                  onValueChange={setSalesType}
                  placeholder="Select Type..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Type</Label>
                <SearchableSelect
                  options={[]}
                  value={receiptType}
                  onValueChange={setReceiptType}
                  placeholder="Select Receipt..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={billingDate}
                    onChange={e => setBillingDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing No</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={billingNo}
                    onChange={e => setBillingNo(e.target.value)}
                    className="pl-10 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price per KG</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₱</span>
                  <Input
                    type="number"
                    value={pricePerKg}
                    onChange={e => setPricePerKg(Number(e.target.value))}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cylinder Lines Table */}
          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/20 dark:border-zinc-800/50 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                  <Calculator className="h-4 w-4" />
                </div>
                <h2 className="font-semibold">Cylinder Lines</h2>
              </div>

              <div className="flex gap-2">
                {siteId && (
                  <SearchableSelect
                    options={availableCylinders
                      .filter(ac => !lines.find(l => l.site_cylinder_id === ac.id))
                      .map(ac => ({ value: String(ac.id), label: ac.asset?.serial_number || "Unknown" }))
                    }
                    value=""
                    onValueChange={(val) => {
                      const cyl = availableCylinders.find(ac => String(ac.id) === val);
                      if (cyl) addCylinderLine(cyl);
                    }}
                    placeholder="Add Cylinder..."
                    className="w-48 h-8"
                  />
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Serial / Product</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Tare</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Current Gross</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Target LPG</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">KG Needed</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[10px]">Line Total</th>
                    <th className="px-4 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground italic">
                        No cylinders added. Select a site to add connected cylinders.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold font-mono text-blue-600">{line.serial_number}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{line.product?.product_name}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="font-medium">{line.tare_weight} <span className="text-[10px] text-muted-foreground">kg</span></div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.current_gross_weight}
                            onChange={e => updateLine(idx, { current_gross_weight: Number(e.target.value) })}
                            className="h-8 w-24 mx-auto text-center font-bold"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.target_lpg_kg}
                            onChange={e => updateLine(idx, { target_lpg_kg: Number(e.target.value) })}
                            className="h-8 w-20 mx-auto text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={line.kg_needed && line.kg_needed > 0 ? "secondary" : "outline"} className="font-mono">
                            {line.kg_needed?.toFixed(2)} kg
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600">
                          ₱ {line.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar / Summary */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Billing Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-indigo-100 text-sm">
                <span>Total Weight Needed</span>
                <span className="font-mono font-bold">{totals.totalWeight.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between text-indigo-100 text-sm">
                <span>Subtotal</span>
                <span className="font-mono font-bold">₱ {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-indigo-100 text-sm">
                <span>Tax (12%)</span>
                <span className="font-mono font-bold">₱ {totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-white/20 flex justify-between items-end">
                <span className="font-bold">Grand Total</span>
                <span className="text-2xl font-black font-mono">
                  ₱ {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <button
                  onClick={() => setStatus("DRAFT")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === "DRAFT" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600" : "text-muted-foreground hover:text-zinc-900"}`}
                >
                  DRAFT
                </button>
                <button
                  onClick={() => setStatus("POSTED")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === "POSTED" ? "bg-white dark:bg-zinc-700 shadow-sm text-green-600" : "text-muted-foreground hover:text-zinc-900"}`}
                >
                  POSTED
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remarks</Label>
              <Textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Internal notes..."
                className="resize-none h-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
