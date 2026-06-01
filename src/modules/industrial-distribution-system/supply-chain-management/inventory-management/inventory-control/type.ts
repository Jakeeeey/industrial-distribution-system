// src/modules/.../inventory-control/type.ts

export type SerialStatus = "Full" | "Empty";

export interface SerialOnhandRecord {
    id: number;
    productId: number;
    parentId: number;
    branchId: number;
    serialNumber: string;
    status: string; // raw from API, e.g. "Full", "Empty"
}

export interface ProductInfo {
    product_id: number;
    product_name: string;
    barcode: string | null;
    product_category: number | null;
}

export interface CategoryInfo {
    category_id: number;
    category_name: string;
}

export interface BranchInfo {
    id: number;
    branch_name: string;
}

export interface EnrichedSerial extends SerialOnhandRecord {
    productName: string;
    categoryName: string;
    barcode: string | null;
    isFull: boolean;
}

export interface ProductGroup {
    productId: number;
    productName: string;
    categoryName: string;
    barcode: string | null;
    fullCount: number;
    emptyCount: number;
    totalCount: number;
    serials: EnrichedSerial[];
}

export interface CategoryGroup {
    categoryName: string;
    products: ProductGroup[];
    totalFull: number;
    totalEmpty: number;
    totalCount: number;
}

export interface InventorySummary {
    totalProducts: number;
    totalFull: number;
    totalEmpty: number;
    grandTotal: number;
}

export type ViewMode = "serial" | "barcode";

export type PrintMode = "serial" | "barcode";
export type PaperSize = "A4" | "Letter";
export type PrintOrientation = "portrait" | "landscape";

export interface PrintOptions {
    mode: PrintMode;
    paperSize: PaperSize;
    orientation: PrintOrientation;
    columns: number;
}

export interface DirectusItemsResponse<T> {
    data: T[];
}
