import React from "react";
import { Product, Category, Brand } from "../types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash, Package, Tag, Settings2, Eye } from "lucide-react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductCatalogProps {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onView: (product: Product) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export function ProductCatalog({ 
  products, 
  categories, 
  brands, 
  onEdit, 
  onDelete, 
  onView,
  selectedIds,
  onSelectionChange
}: ProductCatalogProps) {
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

  if (products.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No products found.
      </div>
    );
  }

  // Group products by product_name
  const groupedProducts = products.reduce((acc, product) => {
    const name = product.product_name || "Unknown";
    if (!acc[name]) {
      acc[name] = [];
    }
    acc[name].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
      {Object.entries(groupedProducts).map(([groupName, groupItems]) => {
        const firstItem = groupItems[0];
        const groupIds = groupItems.map(p => p.product_id);
        const allSelected = groupIds.every(id => selectedIds.includes(id));
        const someSelected = groupIds.some(id => selectedIds.includes(id)) && !allSelected;
        const categoryName = getCategoryName(firstItem.product_category);
        const brandName = getBrandName(firstItem.product_brand);

        const toggleGroupSelection = (e?: React.MouseEvent) => {
          if (e) e.stopPropagation();
          if (allSelected) {
            onSelectionChange(selectedIds.filter(id => !groupIds.includes(id)));
          } else {
            const newIds = new Set([...selectedIds, ...groupIds]);
            onSelectionChange(Array.from(newIds));
          }
        };

        return (
          <Card 
            key={groupName} 
            className={`cursor-pointer overflow-hidden transition-all duration-200 border group relative flex flex-col ${allSelected ? 'ring-2 ring-primary border-transparent shadow-md' : 'border-border/50 hover:shadow-lg hover:border-border'}`}
            onClick={() => onView(firstItem)}
          >
            <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={() => toggleGroupSelection()}
                className={allSelected || someSelected ? "" : "opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm data-[state=checked]:opacity-100"}
              />
            </div>
            
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-900/50 flex items-center justify-center border-b border-border/50 relative overflow-hidden group/image">
              {firstItem.product_image ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055"}/assets/${firstItem.product_image}`}
                  alt={firstItem.product_name}
                  fill
                  className="object-cover group-hover/image:scale-105 transition-transform duration-500"
                  unoptimized
                />
              ) : (
                <Package className="w-12 h-12 text-slate-400/50 dark:text-slate-500/50" />
              )}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                <Badge variant={firstItem.isActive ? "default" : "secondary"} className="shadow-sm">
                  {firstItem.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            
            <CardHeader className="p-4 pb-2 flex-grow">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {brandName && brandName !== "—" && (
                  <Badge variant="secondary" className="text-[10px] uppercase font-medium bg-secondary/50 flex items-center gap-1 px-1.5">
                    <Tag className="w-3 h-3" />
                    {brandName}
                  </Badge>
                )}
                {categoryName && categoryName !== "—" && (
                  <Badge variant="outline" className="text-[10px] uppercase font-medium text-muted-foreground border-border/50 px-1.5">
                    {categoryName}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-[15px] font-bold leading-tight line-clamp-2" title={firstItem.product_name}>
                {groupName}
              </CardTitle>
              
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Variants</span>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                  {groupItems.map(variant => {
                    let variantLabel = variant.product_code;
                    const baseParts = groupName.split(' ')[0];
                    if (variantLabel.startsWith(baseParts)) {
                        const codeWords = variant.product_code.split(' ');
                        if (codeWords.length > 1) {
                            variantLabel = codeWords[codeWords.length - 1]; 
                        }
                    }
                    if (!variantLabel || variantLabel.trim() === '') {
                       variantLabel = variant.product_code;
                    }

                    return (
                      <DropdownMenu key={variant.product_id}>
                        <DropdownMenuTrigger asChild>
                          <Badge 
                            variant={variant.isActive ? "secondary" : "outline"} 
                            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 data-[state=open]:ring-2 data-[state=open]:ring-primary/50 flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 ${!variant.isActive && 'opacity-60 grayscale'}`}
                            title={variant.product_code}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {variantLabel}
                            <Settings2 className="w-3 h-3 opacity-50" />
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                            Code: {variant.product_code}
                          </div>
                          <DropdownMenuItem onClick={() => onView(variant)}>
                            <Eye className="h-4 w-4 mr-2" /> View Variant
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(variant)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit Variant
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onDelete(variant.product_id)}>
                            <Trash className="h-4 w-4 mr-2" /> Delete Variant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
