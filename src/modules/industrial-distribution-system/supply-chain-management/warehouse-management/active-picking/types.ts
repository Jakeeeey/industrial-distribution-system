export interface Consolidator {
    id: number;
    consolidator_no: string;
    status: 'Pending' | 'Picking' | 'Picked' | 'Audited';
    branch_id: number | null;
    created_by: number;
    checked_by: number | null;
    created_at: string;
    updated_at: string;
    
    // Aggregated data for UI
    total_items?: number;
    total_picked?: number;
    sales_orders?: string[]; // Assuming consolidator groups multiple SOs, maybe just use consolidator_no for now
}

export interface ConsolidatorDetail {
    id: number;
    consolidator_id: number;
    product_id: number;
    ordered_quantity: number;
    picked_quantity: number;
    applied_quantity: number;
    picked_at: string | null;
    picked_by: number | null;
    
    // Joined product data from v_running_inventory_by_unit or products table
    product?: {
        product_code: string;
        product_name: string;
        unit_name: string;
        running_inventory_unit: number; // Available stock
    };
}

export interface ConsolidatorSerialMapping {
    id: number;
    detail_id: number;
    serial_number: string;
    scanned_at: string;
    scanned_by: number | null;
}

export interface ProductInventory {
    id: string; // branch-product-supplier composite
    product_id: number;
    product_code: string;
    product_name: string;
    product_barcode: string | null;
    product_brand: string;
    product_category: string;
    unit_name: string;
    unit_count: number;
    branch_id: number;
    branch_name: string;
    last_cutoff: string | null;
    last_count_unit: number;
    movement_after_unit: number;
    running_inventory_unit: number;
    supplier_shortcut: string;
    supplier_id: number;
}
