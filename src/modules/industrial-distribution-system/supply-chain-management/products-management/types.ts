export interface Category {
  category_id: number;
  category_name: string;
  image?: string | null;
  sku_code?: string | null;
  is_industrial?: number;
  created_by?: string | number | null;
  created_at?: string | null;
  updated_by?: string | number | null;
  updated_at?: string | null;
}

export interface Brand {
  brand_id: number;
  brand_name: string;
  sku_code?: string | null;
  image?: string | null;
  is_industrial?: number;
  created_by?: string | number | null;
  created_at?: string | null;
  updated_by?: string | number | null;
  updated_at?: string | null;
}

export interface Unit {
  unit_id: number;
  unit_name: string;
  unit_shortcut: string;
}

export interface Product {
  product_id: number;
  isActive: number; // TINYINT
  product_brand: number | Brand;
  product_code: string;
  product_name: string;
  description: string;
  short_description: string;
  unit_of_measurement: number | Unit;
  unit_of_measurement_count: number;
  product_category: number | Category;
  cost_per_unit: number;
  price_per_unit: number;
  is_serialized: number; // TINYINT
  product_image?: string | null;
  status: string;
  created_at?: string;
  created_by?: number;
  updated_at?: string;
  updated_by?: number;
  last_updated?: string;
}

export type ProductFormValues = Omit<Product, 'product_id' | 'created_at' | 'updated_at' | 'last_updated'> & {
  product_id?: number;
};
