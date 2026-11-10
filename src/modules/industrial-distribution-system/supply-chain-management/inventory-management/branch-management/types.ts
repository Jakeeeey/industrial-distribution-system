export interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
    branch_description: string;
    branch_head: number | null;
    branch_head_name?: string | null;
    branch_head_email?: string | null;
    state_province: string | null;
    city: string | null;
    brgy: string | null;
    phone_number: string | null;
    postal_code: string | null;
    date_added: string;
    isMoving: number | boolean;
    isReturn: number | boolean;
    isBadStock: number | boolean;
    isActive: number | boolean;
    division_id?: number | null;
}

export interface BranchAudit {
    id: number;
    created_by: number | null;
    created_at: string | null;
    updated_by: number | null;
    updated_at: string | null;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type BranchStatusFilter = "All" | "Active" | "Inactive" | "Moving" | "Not Moving" | "Badstock";

export type BranchSortKey = "name" | "code" | "date";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface User {
    user_id: number;
    user_fname: string;
    user_mname?: string | null;
    user_lname: string;
    user_email?: string | null;
    user_contact?: string | null;
    user_position?: string | null;
}

export interface Province {
    code: string;
    name: string;
}

export interface City {
    code: string;
    name: string;
    provinceCode: string;
}

export interface Barangay {
    code: string;
    name: string;
    cityCode: string;
}
