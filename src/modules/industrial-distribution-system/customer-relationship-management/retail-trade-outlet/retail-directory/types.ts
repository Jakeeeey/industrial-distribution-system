export interface CustomerRecord {
  id: number;
  customer_code: string;
  customer_name: string;
  classification: number | string;
  store_type: number | string;
  store_name: string;
  store_signage: string;
  province: string;
  city: string;
  brgy: string;
  contact_number: string;
  customer_email: string;
  payment_term: number | string;
  price_type: string;
  customer_tin: string | null;
  status: string;
  isActive: number;
  isVAT: number;
  isEWT: number;
  otherDetails: string | Record<string, unknown> | null;
  latitude: string | null;
  longitude: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RetailNode extends CustomerRecord {
  // Empty for now, but explicit type for retail customers
}

export interface SubDealerNode extends CustomerRecord {
  retailAccounts: RetailNode[];
  linkedRetailCount: number;
}

export interface DealerNode extends CustomerRecord {
  subDealers: SubDealerNode[];
  linkedSubDealerCount: number;
}

export interface RetailDirectoryState {
  dealers: DealerNode[];
  standaloneSubDealers: SubDealerNode[];
  standaloneRetail: RetailNode[];
  filteredCount: number;
  totalDealers: number;
  totalSubDealers: number;
  totalRetail: number;
  totalActive: number;
}

export type SelectedNode = DealerNode | SubDealerNode | RetailNode | null;
