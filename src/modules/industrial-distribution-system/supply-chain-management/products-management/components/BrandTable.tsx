import React, { useState, useMemo } from "react";
import { Brand } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface BrandTableProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
}

export function BrandTable({ brands, onEdit }: BrandTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const filteredBrands = useMemo(() => {
    if (!searchQuery) return brands;
    return brands.filter(b => 
      b.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (b.sku_code && b.sku_code.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [brands, searchQuery]);

  const totalItems = filteredBrands.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Ensure page is within bounds when total items change
  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const paginatedBrands = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredBrands.slice(start, start + limit);
  }, [filteredBrands, page, limit]);

  return (
    <div>
      <div className="flex flex-col gap-4 mb-4 px-2 mt-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search brands..."
                className="pl-8 bg-background"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground flex justify-between items-center">
          <span>Total: {totalItems} items</span>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>SKU Code</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBrands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No brands found
                </TableCell>
              </TableRow>
            ) : (
              paginatedBrands.map((brand) => (
                <TableRow key={brand.brand_id}>
                  <TableCell className="font-medium">{brand.brand_name}</TableCell>
                  <TableCell>{brand.sku_code || "-"}</TableCell>
                  <TableCell>{brand.created_at ? new Date(brand.created_at).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(brand)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4 px-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select value={String(limit)} onValueChange={(v) => {
            setLimit(Number(v));
            setPage(1);
          }}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>per page</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <div className="text-sm font-medium mx-2">
            Page {page} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
