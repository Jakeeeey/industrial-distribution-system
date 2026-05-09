import { Product, Category, Brand } from "../types";

export const productsService = {
  async getProducts(params?: { q?: string; category?: string; brand?: string; status?: string; page?: number; limit?: number }) {
    const sp = new URLSearchParams(params as Record<string, string>);
    const res = await fetch(`/api/ids/scm/product-management/products?${sp.toString()}`);
    if (!res.ok) {
      const err = await res.text();
      console.error("[ProductsService] getProducts failed:", err);
      throw new Error(err);
    }
    return await res.json();
  },

  async createProduct(data: Partial<Product>) {
    const res = await fetch("/api/ids/scm/product-management/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async updateProduct(id: number, data: Partial<Product>) {
    const res = await fetch(`/api/ids/scm/product-management/products?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async deleteProduct(id: number) {
    const res = await fetch(`/api/ids/scm/product-management/products?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async deleteProducts(ids: number[]) {
    const res = await fetch(`/api/ids/scm/product-management/products?ids=${ids.join(",")}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  // Categories
  async getCategories(q?: string) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const res = await fetch(`/api/ids/scm/product-management/categories?${sp.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async createCategory(data: Partial<Category>) {
    const res = await fetch("/api/ids/scm/product-management/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async updateCategory(id: number, data: Partial<Category>) {
    const res = await fetch(`/api/ids/scm/product-management/categories?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  // Brands
  async getBrands(q?: string) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const res = await fetch(`/api/ids/scm/product-management/brands?${sp.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async createBrand(data: Partial<Brand>) {
    const res = await fetch("/api/ids/scm/product-management/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async updateBrand(id: number, data: Partial<Brand>) {
    const res = await fetch(`/api/ids/scm/product-management/brands?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  // Lookups (reuse existing if possible, but let's keep it simple for now)
  async getLookups() {
    const res = await fetch("/api/ids/fm/product-pricing/lookups");
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
};
