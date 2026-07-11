import { NextRequest, NextResponse } from "next/server";
import { directusFetch, getDirectusBase } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/directus";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/error-handler";

const DIRECTUS_URL = getDirectusBase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ? Number(searchParams.get("branchId")) : undefined;
    const productId = searchParams.get("productId") ? Number(searchParams.get("productId")) : undefined;

    const params = {
      search: searchParams.get("search") || undefined,
      branchId: (branchId !== undefined && !isNaN(branchId)) ? branchId : undefined,
      status: searchParams.get("status") || undefined,
      productId: (productId !== undefined && !isNaN(productId)) ? productId : undefined,
      condition: searchParams.get("condition") || undefined,
    };

    const filters: Record<string, unknown> = {};

    if (params?.branchId) filters.current_branch_id = { _eq: params.branchId };
    if (params?.status) filters.cylinder_status = { _eq: params.status };
    if (params?.productId) filters.product_id = { _eq: params.productId };
    if (params?.condition) filters.cylinder_condition = { _eq: params.condition };
    if (params?.search) {
      filters._or = [
        { serial_number: { _icontains: params.search } },
        { remarks: { _icontains: params.search } },
      ];
    }

    let query = `fields=cylinder_status,expiration_date&limit=-1`;
    if (Object.keys(filters).length > 0) {
      query += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    const res = await directusFetch<{ data: { cylinder_status: string; expiration_date: string | null }[] }>(`${DIRECTUS_URL}/items/cylinder_assets?${query}`);
    
    const assets = res.data || [];
    
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    let available = 0;
    let withCustomer = 0;
    let expired = 0;
    let nearExpiration = 0;

    assets.forEach(a => {
        if (a.cylinder_status === 'AVAILABLE') available++;
        if (a.cylinder_status === 'WITH_CUSTOMER') withCustomer++;
        
        if (a.expiration_date) {
            const expDate = new Date(a.expiration_date);
            if (expDate < now) {
                expired++;
            } else if (expDate < thirtyDaysFromNow) {
                nearExpiration++;
            }
        }
    });

    return NextResponse.json({ data: { available, withCustomer, expired, nearExpiration, total: assets.length } });
  } catch (error) {
    return handleApiError(error);
  }
}
