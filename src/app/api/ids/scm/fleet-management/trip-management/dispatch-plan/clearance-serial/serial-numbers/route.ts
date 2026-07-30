import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '') + '/items';
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function fetcher(endpoint: string) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

/**
 * DEV-CHANGE: Scopes serial numbers strictly to the specific Post-Dispatch Plan (or Dispatch Plan).
 * Traces Post-Dispatch Plan -> Pre-Dispatch Plans -> Consolidator Dispatches -> Consolidator Details -> Serial Mappings
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dispatchIdParam = searchParams.get('dispatch_id') || searchParams.get('post_dispatch_plan_id');

        if (!dispatchIdParam) {
            return NextResponse.json([]);
        }

        const pdpId = Number(dispatchIdParam);
        if (isNaN(pdpId) || pdpId <= 0) {
            return NextResponse.json([]);
        }

        // 1. Fetch linked pre-dispatch plan IDs from post_dispatch_dispatch_plans junction table
        let dispatchPlanIds: number[] = [];
        try {
            const junctionRes = await fetcher(`/post_dispatch_dispatch_plans?filter[post_dispatch_plan_id][_eq]=${pdpId}&fields=dispatch_plan_id&limit=-1`);
            const junctions = junctionRes.data || [];
            dispatchPlanIds = junctions.map((j: { dispatch_plan_id: unknown }) => {
                if (typeof j.dispatch_plan_id === 'object' && j.dispatch_plan_id !== null) {
                    const obj = j.dispatch_plan_id as { id?: number; dispatch_id?: number };
                    return Number(obj.dispatch_id || obj.id);
                }
                return Number(j.dispatch_plan_id);
            }).filter((id: number) => !isNaN(id) && id > 0);
        } catch (jErr) {
            console.warn('[clearance-serial/serial-numbers] Error fetching junction records:', jErr);
        }

        // Fallback: If no junction records found, check if pdpId is directly a dispatch_plan ID
        if (dispatchPlanIds.length === 0) {
            dispatchPlanIds = [pdpId];
        }

        // 2. Fetch dispatch numbers from dispatch_plan
        const dpRes = await fetcher(`/dispatch_plan?filter[dispatch_id][_in]=${dispatchPlanIds.join(',')}&fields=dispatch_id,dispatch_no&limit=-1`);
        const dpList = dpRes.data || [];
        const dispatchNos = Array.from(new Set(dpList.map((dp: { dispatch_no?: string }) => dp.dispatch_no).filter(Boolean))) as string[];

        if (dispatchNos.length === 0) {
            return NextResponse.json([]);
        }

        // 3. Fetch consolidator dispatches linked to these dispatch numbers
        const encodedDispatchNos = dispatchNos.map((no) => encodeURIComponent(no)).join(',');
        const cdispRes = await fetcher(`/consolidator_dispatches?filter[dispatch_no][_in]=${encodedDispatchNos}&fields=consolidator_id&limit=-1`);
        const cdispList = cdispRes.data || [];
        const consolidatorIds = Array.from(new Set(
            cdispList.map((cd: { consolidator_id: unknown }) => {
                if (typeof cd.consolidator_id === 'object' && cd.consolidator_id !== null) {
                    const obj = cd.consolidator_id as { id?: number };
                    return obj.id;
                }
                return cd.consolidator_id;
            }).filter(Boolean)
        ));

        if (consolidatorIds.length === 0) {
            return NextResponse.json([]);
        }

        // 4. Fetch consolidator details for these consolidator IDs
        const cdRes = await fetcher(`/consolidator_details?filter[consolidator_id][_in]=${consolidatorIds.join(',')}&fields=id,product_id&limit=-1`);
        const consolidatorDetails = cdRes.data || [];
        const detailIds = consolidatorDetails.map((cd: { id: string | number }) => cd.id);

        if (detailIds.length === 0) {
            return NextResponse.json([]);
        }

        // 5. Fetch serial mappings associated strictly with these consolidator details
        const csmRes = await fetcher(`/consolidator_serial_mappings?filter[detail_id][_in]=${detailIds.join(',')}&fields=id,serial_number,detail_id.id,detail_id.product_id&limit=-1`);
        const mappings = csmRes.data || [];

        interface SerialItem {
            id: number | string;
            serial_number: string;
            detail_id: {
                id?: number | string;
                product_id?: number;
            } | number | null;
        }

        const result = (mappings as SerialItem[])
            .map((item) => {
                let prodId: number | null = null;
                if (typeof item.detail_id === 'object' && item.detail_id !== null) {
                    prodId = item.detail_id.product_id ? Number(item.detail_id.product_id) : null;
                } else if (item.detail_id) {
                    const matchedDetail = consolidatorDetails.find(
                        (cd: { id: string | number; product_id?: number }) => String(cd.id) === String(item.detail_id)
                    );
                    if (matchedDetail?.product_id) {
                        prodId = Number(matchedDetail.product_id);
                    }
                }

                return {
                    id: item.id,
                    product_id: prodId,
                    dispatch_id: pdpId,
                    serial: (item.serial_number || '').trim()
                };
            })
            .filter((m) => m.product_id !== null && m.serial.length > 0);

        return NextResponse.json(result);
    } catch (err) {
        console.error('Serial Numbers API Error:', err);
        return NextResponse.json({ error: 'Failed to fetch Serial Numbers' }, { status: 500 });
    }
}
