import React from "react";
import { Product, Category, Brand } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductTableProps {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onView: (product: Product) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export function ProductTable({ 
  products, 
  categories, 
  brands, 
  onEdit, 
  onDelete, 
  onView,
  selectedIds,
  onSelectionChange
}: ProductTableProps) {
  const toggleAll = () => {
    if (selectedIds.length === products.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map(p => p.product_id));
    }
  };

  const toggleOne = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };
  const getCategoryName = (idOrObj: unknown) => {
    if (typeof idOrObj === 'object' && idOrObj !== null && 'category_name' in idOrObj) return (idOrObj as Record<string, string>).category_name;
    const cat = categories.find(c => c.category_id === Number(idOrObj));
    return cat ? cat.category_name : String(idOrObj);
  };

  const getBrandName = (idOrObj: unknown) => {
    if (typeof idOrObj === 'object' && idOrObj !== null && 'brand_name' in idOrObj) return (idOrObj as Record<string, string>).brand_name;
    const brand = brands.find(b => b.brand_id === Number(idOrObj));
    return brand ? brand.brand_name : String(idOrObj);
  };
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={products.length > 0 && selectedIds.length === products.length}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                No products found
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.product_id} className={selectedIds.includes(product.product_id) ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(product.product_id)}
                    onCheckedChange={() => toggleOne(product.product_id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{product.product_code}</TableCell>
                <TableCell>{product.product_name}</TableCell>
                <TableCell>
                  {getCategoryName(product.product_category)}
                </TableCell>
                <TableCell>
                  {getBrandName(product.product_brand)}
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(product.price_per_unit)}
                </TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => onView(product)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(product.product_id)}>
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
