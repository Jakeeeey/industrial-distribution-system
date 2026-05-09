import React from "react";
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
import { Edit, Trash } from "lucide-react";

interface BrandTableProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onDelete: (id: number) => void;
}

export function BrandTable({ brands, onEdit, onDelete }: BrandTableProps) {
  return (
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
          {brands.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                No brands found
              </TableCell>
            </TableRow>
          ) : (
            brands.map((brand) => (
              <TableRow key={brand.brand_id}>
                <TableCell className="font-medium">{brand.brand_name}</TableCell>
                <TableCell>{brand.sku_code || "-"}</TableCell>
                <TableCell>{brand.created_at ? new Date(brand.created_at).toLocaleDateString() : "-"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(brand)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(brand.brand_id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
