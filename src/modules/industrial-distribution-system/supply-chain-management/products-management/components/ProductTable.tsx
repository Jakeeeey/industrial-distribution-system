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
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash, Settings2, Eye } from "lucide-react";
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

  // Group products by product_name
  const groupedProducts = products.reduce((acc, product) => {
    const name = product.product_name || "Unknown";
    if (!acc[name]) {
      acc[name] = [];
    }
    acc[name].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const toggleGroupSelection = (groupProducts: Product[]) => {
    const groupIds = groupProducts.map(p => p.product_id);
    const allSelected = groupIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      onSelectionChange(selectedIds.filter(id => !groupIds.includes(id)));
    } else {
      const newIds = new Set([...selectedIds, ...groupIds]);
      onSelectionChange(Array.from(newIds));
    }
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
            <TableHead>Name</TableHead>
            <TableHead>Variants / Codes</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand</TableHead>
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
            Object.entries(groupedProducts).map(([groupName, groupItems]) => {
              const groupIds = groupItems.map(p => p.product_id);
              const allSelected = groupIds.every(id => selectedIds.includes(id));
              const someSelected = groupIds.some(id => selectedIds.includes(id)) && !allSelected;

              // Use the first item to get shared properties
              const firstItem = groupItems[0];

              return (
                <TableRow 
                  key={groupName}
                  className="bg-background hover:bg-muted/30 transition-colors group"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleGroupSelection(groupItems)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {groupName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                      {groupItems.map(variant => {
                        // Extract variant name by removing the base product name from the code
                        // or just use the code if it's entirely different
                        let variantLabel = variant.product_code;
                        
                        // Try to clean up the label if it contains the base name
                        const baseParts = groupName.split(' ')[0]; // e.g. "LPG" or "A"
                        if (variantLabel.startsWith(baseParts)) {
                            // Extract just the unique part. For "LPG 50KG SWAP" and base "LPG 50KG CTA...", 
                            // we can try to just use the last word, or use the whole code if it's small.
                            const codeWords = variant.product_code.split(' ');
                            if (codeWords.length > 1) {
                                variantLabel = codeWords[codeWords.length - 1]; // e.g. "SWAP"
                            }
                        }
                        
                        // Fallback if label is empty
                        if (!variantLabel || variantLabel.trim() === '') {
                           variantLabel = variant.product_code;
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
                              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDelete(variant.product_id); }}>
                                <Trash className="h-4 w-4 mr-2" /> Delete Variant
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryName(firstItem.product_category)}</TableCell>
                  <TableCell>{getBrandName(firstItem.product_brand)}</TableCell>
                  <TableCell>
                    {/* If all items have the same status, show it, otherwise 'Mixed' */}
                    {groupItems.every(p => p.isActive === firstItem.isActive) ? (
                      <Badge variant={firstItem.isActive ? "default" : "secondary"}>
                        {firstItem.isActive ? "Active" : "Inactive"}
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
