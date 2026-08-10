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
import { Edit, Settings2, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductTableProps {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  onEdit: (product: Product) => void;
  onView: (product: Product) => void;
}

export function ProductTable({ 
  products, 
  categories, 
  brands, 
  onEdit, 
  onView,
}: ProductTableProps) {
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

  // Group products by parent_id or product_id to ensure parent products and their variants are grouped strictly together
  const groupedProducts = products.reduce((acc, product) => {
    const groupKey = product.parent_id ? String(product.parent_id) : String(product.product_id);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Variants / Codes</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Serialized</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                No products found
              </TableCell>
            </TableRow>
          ) : (
            Object.entries(groupedProducts).map(([groupKey, groupItems]) => {
              // Find parent item if present, otherwise fall back to first item
              const parentItem = groupItems.find((p) => !p.parent_id) || groupItems[0];
              const groupName = parentItem.product_name || "Unknown";

              return (
                <TableRow 
                  key={groupKey}
                  className="bg-background hover:bg-muted/30 transition-colors group"
                >
                  <TableCell className="font-medium">
                    {groupName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                      {groupItems.map(variant => {
                        // AG-COMMENT: Display exact variant code or distinct UOM identifier (e.g. FULL, EMPTY, SWAP) to avoid ambiguous label truncation or duplicate-looking badges
                        let variantLabel = variant.product_code;
                        if (variant.uom_ids && variant.uom_ids.trim() !== '') {
                          variantLabel = `${variant.uom_ids} (${variant.product_code})`;
                        } else if (!variant.parent_id && parentItem.is_serialized) {
                          variantLabel = `FULL (${variant.product_code})`;
                        }

                        return (
                          <DropdownMenu key={variant.product_id}>
                            <DropdownMenuTrigger asChild>
                              <Badge 
                                variant={variant.isActive ? "secondary" : "outline"} 
                                className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 data-[state=open]:ring-2 data-[state=open]:ring-primary/50 flex items-center gap-1.5 ${!variant.isActive && 'opacity-60 grayscale'}`}
                              >
                                {variantLabel}
                                <Settings2 className="w-3 h-3 opacity-50" />
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                                Code: {variant.product_code}
                              </div>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(variant); }}>
                                <Eye className="h-4 w-4 mr-2" /> View Variant
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(variant); }}>
                                <Edit className="h-4 w-4 mr-2" /> Edit Variant
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryName(parentItem.product_category)}</TableCell>
                  <TableCell>{getBrandName(parentItem.product_brand)}</TableCell>
                  <TableCell>
                    {parentItem.is_serialized ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">YES</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">NO</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* If all items have the same status, show it, otherwise 'Mixed' */}
                    {groupItems.every(p => p.isActive === parentItem.isActive) ? (
                      <Badge variant={parentItem.isActive ? "default" : "secondary"}>
                        {parentItem.isActive ? "Active" : "Inactive"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Mixed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
