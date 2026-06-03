export interface CustomerHistoryRecord {
    id: number;
    customer_code: string;
    customer_name: string;
    type: 'Regular' | 'Employee';
    user_id?: number | null;
    customer_image?: string | null;
    store_name: string;
    store_signage: string;
    brgy?: string | null;
    city?: string | null;
    province?: string | null;
    contact_number: string;
    customer_email?: string | null;
    tel_number?: string | null;
    bank_details?: string | null;
    customer_tin?: string | null;
    payment_term?: number | null;
    store_type: number | null;
    price_type?: string | null;
    encoder_id: number;
    credit_type?: number | null;
    company_code?: number | null;
    date_entered?: string | null;
    isActive: number;
    isVAT: number;
    isEWT: number;
    classification?: number | null;
    discount_type?: number | null;
    otherDetails?: string | null;
    division_id?: number | null;
    department_id?: number | null;
    location?: string | null;
    salesman_name?: string;
    salesman_code?: string | null;
}

export interface CustomerHistoryResponse {
    customers: CustomerHistoryRecord[];
    metadata: {
        total_count: number;
        filter_count?: number;
        page: number;
        pageSize: number;
        lastUpdated: string;
    };
}
