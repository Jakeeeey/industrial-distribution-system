import { useState, useEffect } from "react";
import { productsService } from "../services/products-service";
import { Product, Category, Brand } from "../types";
import { toast } from "sonner";

export function useProductsManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<{ unit_id: number | string; unit_name: string; unit_shortcut: string }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  // 1. Initial metadata load (Run on mount and refresh)
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [catRes, brandRes, lookupRes] = await Promise.all([
          productsService.getCategories(),
          productsService.getBrands(),
          productsService.getLookups()
        ]);
        setCategories(catRes.data || []);
        setBrands(brandRes.data || []);
        setUnits(lookupRes.data?.units || []);
      } catch (error) {
        console.error("Metadata fetch failed:", error);
      }
    }
    fetchMetadata();
  }, [refreshKey]); // Re-run when refresh changes

  // 2. Paginated Products Load (Run on change)
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const prodRes = await productsService.getProducts({ page, limit });
        setProducts(prodRes.data || []);
        setTotalItems(
          prodRes.meta?.filter_count !== undefined 
            ? prodRes.meta.filter_count 
            : (prodRes.meta?.total_count ?? 0)
        );
      } catch (error) {
        toast.error("Failed to fetch products: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [page, limit, refreshKey]); // Re-run when page/limit/refresh changes

  return {
    products,
    categories,
    brands,
    units,
    loading,
    refresh,
    page,
    setPage,
    limit,
    setLimit,
    totalItems
  };
}
