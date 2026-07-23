import { NextResponse } from 'next/server';
import { cookies } from "next/headers";

function getPhilippineTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

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
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return response.json();
}

export async function POST(request: Request) {
    try {
        const body = await request.json(); // Array of cylinder assets
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        const userId = getUserIdFromToken(token);
        const now = getPhilippineTime();

        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Body must be an array of assets' }, { status: 400 });
        }

        const payloads = body.map((asset: Record<string, unknown>) => ({
            product_id: Number(asset.product_id),
            serial_number: asset.serial_number,
            cylinder_status: asset.cylinder_status || 'AVAILABLE',
            cylinder_condition: asset.cylinder_condition || 'GOOD',
            current_branch_id: asset.current_branch_id ? Number(asset.current_branch_id) : null,
            expiration_date: asset.expiration_date || null,
            tare_weight: asset.tare_weight ? Number(asset.tare_weight) : null,
            cost: asset.cost ? Number(asset.cost) : null,
            acquisition_date: getPhilippineTime().split('T')[0],
            ...(userId ? { created_by: userId, modified_by: userId } : {}),
            modified_date: now
        }));

        const res = await poster('/cylinder_assets_draft', payloads);

        return NextResponse.json({ success: true, data: res });
    } catch (err: unknown) {
        console.error('Bulk Cylinder Asset Draft Registration API Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to draft Cylinder Assets';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
