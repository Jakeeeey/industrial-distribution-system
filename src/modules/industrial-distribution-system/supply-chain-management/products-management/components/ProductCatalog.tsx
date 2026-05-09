import React from "react";
import { Product, Category, Brand } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash, Eye, Package, Tag } from "lucide-react";
import Image from "next/image";

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

  if (products.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No products found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
      {products.map((product) => {
        const isSelected = selectedIds.includes(product.product_id);
        const categoryName = getCategoryName(product.product_category);
        const brandName = getBrandName(product.product_brand);

        return (
          <Card 
            key={product.product_id} 
            className={`overflow-hidden transition-all duration-200 border group relative flex flex-col ${isSelected ? 'ring-2 ring-primary border-transparent shadow-md' : 'border-border/50 hover:shadow-lg hover:border-border'}`}
          >
            <div className="absolute top-3 left-3 z-10">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => toggleOne(product.product_id)}
                className={isSelected ? "" : "opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm data-[state=checked]:opacity-100"}
              />
            </div>
            
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-900/50 flex items-center justify-center border-b border-border/50 relative overflow-hidden group/image">
              {product.product_image ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055"}/assets/${product.product_image}`}
                  alt={product.product_name}
                  fill
                  className="object-cover group-hover/image:scale-105 transition-transform duration-500"
                  unoptimized
                />
              ) : (
                <Package className="w-12 h-12 text-slate-400/50 dark:text-slate-500/50" />
              )}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                <Badge variant={product.isActive ? "default" : "secondary"} className="shadow-sm">
                  {product.isActive ? "Active" : "Inactive"}
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
              <CardTitle className="text-[15px] font-bold leading-tight line-clamp-2" title={product.product_name}>
                {product.product_name}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1.5 font-mono bg-muted/50 w-max px-2 py-0.5 rounded border border-border/50">
                Code: {product.product_code}
              </div>
            </CardHeader>
            
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Base Price</div>
                <div className="font-bold text-lg text-primary">
                  {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(product.price_per_unit || 0)}
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="p-2 flex justify-end gap-1 bg-muted/30">
              <Button variant="ghost" size="icon" onClick={() => onView(product)} title="View" className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(product)} title="Edit" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(product.product_id)} title="Delete" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30">
                <Trash className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
