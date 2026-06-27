import { NextResponse } from 'next/server';
import { cookies } from "next/headers";

function getUserIdFromToken(token: string | undefined | null): number | null {
    if (!token) return null;
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = Buffer.from(b64, "base64").toString("utf8");
        const payload = JSON.parse(json);
        const idValue = payload.user_id ?? payload.userId ?? payload.id ?? payload.sub;
        if (idValue != null) {
            const num = Number(idValue);
            return isNaN(num) ? null : num;
        }
    } catch {}
    return null;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL + '/items';
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function fetcher(endpoint: string) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP fetch error: ${response.status}`);
    return response.json();
}

async function poster(endpoint: string, data: unknown) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP post error: ${response.status} - ${errorText}`);
    }
    return response.json();
}

async function patcher(endpoint: string, data: unknown) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP patch error: ${response.status} - ${errorText}`);
    }
    return response.json();
}

async function deleter(endpoint: string, data?: unknown) {
    const options: RequestInit = {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            ...(data ? { 'Content-Type': 'application/json' } : {})
        }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP delete error: ${response.status} - ${errorText}`);
    }
    return true;
}

export async function POST(request: Request) {
    try {
        const body = await request.json(); 
        const { serials, selectedProductId, invoiceId } = body;

        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        const userId = getUserIdFromToken(token);
        const now = new Date().toISOString();

        if (!Array.isArray(serials) || !selectedProductId) {
            return NextResponse.json({ error: 'serials array and selectedProductId are required' }, { status: 400 });
        }

        if (serials.length === 0) {
            return NextResponse.json({ success: true, message: 'No serials to process' });
        }

        const serialsList = serials.map(s => encodeURIComponent(s.trim())).join(',');

        // 1. Query BOTH draft and existing first to avoid cross-contamination
        const draftResPromise = fetcher(`/cylinder_assets_draft?filter[serial_number][_in]=${serialsList}`);
        const existingResPromise = fetcher(`/cylinder_assets?filter[serial_number][_in]=${serialsList}&fields=id`);
        
        const [draftRes, existingRes] = await Promise.all([draftResPromise, existingResPromise]);
        
        const draftAssets = draftRes.data || [];
        const existingAssets = existingRes.data || [];

        // 2. Insert drafted ones to cylinder_assets
        if (draftAssets.length > 0) {
            const payloads = draftAssets.map((asset: Record<string, unknown>) => {
                const newAsset = { ...asset };
                delete newAsset.id;
                delete newAsset.user_created;
                delete newAsset.date_created;
                delete newAsset.user_updated;
                delete newAsset.date_updated;
                
                if (userId) {
                    newAsset.created_by = userId;
                    newAsset.modified_by = userId;
                }
                newAsset.modified_date = now;

                return newAsset;
            });
            await poster('/cylinder_assets', payloads);
            
            // Delete from draft using array of IDs in request body
            const draftIds = draftAssets.map((a: { id: string | number }) => a.id);
            await deleter('/cylinder_assets_draft', draftIds);
        }

        // 3. Update existing assets in cylinder_assets
        if (existingAssets.length > 0) {
            const bulkUpdates = existingAssets.map((a: { id: string | number }) => ({
                id: a.id,
                product_id: Number(selectedProductId),
                cylinder_status: 'EMPTY',
                ...(userId ? { modified_by: userId } : {}),
                modified_date: now
            }));
            await patcher('/cylinder_assets', bulkUpdates);
        }

        // 4. Save to post_dispatch_invoices_serial
        if (invoiceId && serials.length > 0) {
            const invoiceSerialPayloads = serials.map((s: string) => ({
                post_dispatch_invoice_id: invoiceId,
                product_id: Number(selectedProductId),
                serial_number: s.trim().toUpperCase(),
                ...(userId ? { created_by: userId, modified_by: userId } : {}),
                modified_date: now
            }));
            await poster('/post_dispatch_invoices_serial', invoiceSerialPayloads);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('Confirm Cylinder Assets API Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to confirm Cylinder Assets';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
