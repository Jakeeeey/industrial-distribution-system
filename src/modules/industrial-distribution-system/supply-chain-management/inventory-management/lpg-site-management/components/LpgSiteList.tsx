"use client";

import { useEffect, useState, useCallback } from "react";
import { lpgSiteService } from "../services/lpgSiteService";
import { LpgSite } from "../types";
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface LpgSiteListProps {
  onEdit: (id: number) => void;
  onCreate: () => void;
  onView: (id: number) => void;
}

export function LpgSiteList({ onEdit, onCreate, onView }: LpgSiteListProps) {
  const [sites, setSites] = useState<LpgSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [billingModeFilter, setBillingModeFilter] = useState("ALL");
  const [isActiveFilter, setIsActiveFilter] = useState("1");
  const [limit, setLimit] = useState(10);

  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      const { data, total } = await lpgSiteService.fetchSites({
        search,
        page,
        limit,
        billing_mode: billingModeFilter,
        is_active: isActiveFilter
      });
      console.log("Fetched sites data in LpgSiteList:", data);
      setSites(data);
      setTotal(total);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load LPG sites");
    } finally {
      setLoading(false);
    }
  }, [search, page, billingModeFilter, isActiveFilter, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSites();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadSites]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this site?")) return;
    try {
      await lpgSiteService.deleteSite(id);
      toast.success("Site deleted successfully");
      loadSites();
    } catch {
      toast.error("Failed to delete site");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-5" />
          <Input
            placeholder="Search sites or customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-orange-500/20"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={billingModeFilter} onValueChange={setBillingModeFilter}>
            <SelectTrigger className="w-[140px] bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-800 rounded-xl">
              <SelectValue placeholder="Billing Mode" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">All Modes</SelectItem>
              <SelectItem value="KILO">KILO</SelectItem>
              <SelectItem value="METERED">METERED</SelectItem>
              <SelectItem value="BOTH">BOTH</SelectItem>
            </SelectContent>
          </Select>

          <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
            <SelectTrigger className="w-[130px] bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-800 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="1">Active</SelectItem>
              <SelectItem value="0">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onCreate} className="rounded-xl gap-2 h-10 shadow-lg transition-all">
            <Plus className="h-4 w-4" />
            Add New Site
          </Button>
        </div>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md overflow-hidden rounded-2xl shadow-xl shadow-zinc-200/20 dark:shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 h-10 [&_th]:py-0 [&_th]:align-middle">
                <TableHead className="font-bold text-zinc-900 dark:text-zinc-100">Site Details</TableHead>
                <TableHead className="font-bold text-zinc-900 dark:text-zinc-100">Customer</TableHead>
                <TableHead className="font-bold text-zinc-900 dark:text-zinc-100">Billing Mode</TableHead>
                <TableHead className="font-bold text-zinc-900 dark:text-zinc-100">Status</TableHead>
                <TableHead className="font-bold text-zinc-900 dark:text-zinc-100 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-100 dark:border-zinc-800">
                    <TableCell><Skeleton className="h-12 w-full rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : sites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <MapPin className="h-10 w-10 opacity-20" />
                      <p>No sites found matching your criteria.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sites.map((site) => (
                  <TableRow key={site.id} onClick={() => onView(site.id)} className="group cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 transition-colors">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{site.site_name || "Unnamed Site"}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{site.site_address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{site.customer_code}</span>
                        <span className="text-xs text-muted-foreground">{site.customer?.customer_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={site.billing_mode === 'BOTH' ? 'default' : 'secondary'} className="rounded-md font-mono text-[10px]">
                        {site.billing_mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={!!site.is_active}
                          onCheckedChange={async (checked) => {
                            try {
                              setSites(sites.map(s => s.id === site.id ? { ...s, is_active: checked } : s));
                              await lpgSiteService.updateSite(site.id, { is_active: checked });
                              toast.success(`Site marked as ${checked ? 'ACTIVE' : 'INACTIVE'}`);
                            } catch {
                              toast.error("Failed to update site status");
                              loadSites();
                            }
                          }}
                        />
                        <span className={`text-[10px] font-bold ${site.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                          {site.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl border-zinc-200 dark:border-zinc-800">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(site.id); }} className="gap-2 cursor-pointer">
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(site.id); }} className="gap-2 cursor-pointer text-red-600 focus:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">
            Showing {sites.length} of {total} sites
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Rows per page</p>
            <Select
              value={limit.toString()}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px] rounded-lg border-zinc-200 dark:border-zinc-800 text-xs">
                <SelectValue placeholder={limit.toString()} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded-lg h-8 px-2 border-zinc-200 dark:border-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium px-2">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="rounded-lg h-8 px-2 border-zinc-200 dark:border-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
