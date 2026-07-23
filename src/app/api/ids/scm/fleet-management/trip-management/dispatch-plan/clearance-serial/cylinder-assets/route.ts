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

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

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
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return response.json();
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const serialNumber = searchParams.get('serial_number');

    if (!serialNumber) {
        return NextResponse.json({ error: 'serial_number is required' }, { status: 400 });
    }

    try {
        // Query Directus cylinder_assets collection for the serial number, including the related product's uom_ids
        const encodedSerial = encodeURIComponent(serialNumber.trim());
        const response = await fetcher(`/cylinder_assets?filter[serial_number][_eq]=${encodedSerial}&fields=id,serial_number,product_id,product_id.uom_ids,cylinder_condition`);
        const data = response.data || [];

        // Check if the serial is currently on hand in inventory using the Spring Boot API
        const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
        let isOnHand = false;
        if (SPRING_API_BASE_URL) {
            try {
                const targetUrl = `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter?serialNumber=${encodedSerial}`;
                const springRes = await fetch(targetUrl, { method: 'GET', cache: 'no-store' });
                if (springRes.ok) {
                    const text = await springRes.text();
                    const parsed = text ? JSON.parse(text) : null;
                    // Check if response contains active inventory details
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        isOnHand = true;
                    } else if (parsed && typeof parsed === 'object') {
                        if ('productId' in parsed || (Array.isArray(parsed.content) && parsed.content.length > 0) || (Array.isArray(parsed.data) && parsed.data.length > 0)) {
                            isOnHand = true;
                        }
                    }
                }
            } catch (err) {
                console.error('Spring v-serial-onhand validation error:', err);
            }
        }

        const existsInCylinderAssets = data.length > 0;
        // Resolve the uom_ids of the serial's current product in the database
        const existingAssetProduct = data[0]?.product_id;
        const existingAssetUom = typeof existingAssetProduct === 'object' && existingAssetProduct !== null 
            ? (existingAssetProduct as Record<string, unknown>).uom_ids 
            : null;
        
        const isCurrentAssetEmpty = existsInCylinderAssets && existingAssetUom === 'EMPTY';

        // 1. If the serial is currently on hand in inventory, ALWAYS block it regardless of product status
        if (isOnHand) {
            return NextResponse.json({
                exists: existsInCylinderAssets,
                asset: data[0] || null,
                isDuplicate: true,
                reason: 'Serial is currently on hand in inventory'
            });
        }

        // 2. If it is NOT on hand, but exists as an EMPTY Cylinder Asset, block it
        if (isCurrentAssetEmpty) {
            return NextResponse.json({
                exists: existsInCylinderAssets,
                asset: data[0] || null,
                isDuplicate: true,
                reason: 'Serial already exists as an EMPTY Cylinder Asset'
            });
        }

        // For non-empty products (NULL, SWAP, OUTRIGHT, DEPOSIT, REFILL) that are NOT on hand, allow them to be confirmed
        return NextResponse.json({ 
            exists: existsInCylinderAssets,
            asset: data[0] || null,
            isDuplicate: false
        });
    } catch (err) {
        console.error('Cylinder Asset API Error:', err);
        return NextResponse.json({ error: 'Failed to verify Cylinder Asset' }, { status: 500 });
    }
}


export async function POST(request: Request) {
    try {
        const body = await request.json(); // Array of cylinder assets

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
            acquisition_date: getPhilippineTime().split('T')[0]
        }));

        const res = await poster('/cylinder_assets', payloads);

        return NextResponse.json({ success: true, data: res });
    } catch (err: unknown) {
        console.error('Bulk Cylinder Asset Registration API Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to register Cylinder Assets';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
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
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return response.json();
}

export async function PUT(request: Request) {
    try {
        const body = await request.json(); 
        
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const payload: Record<string, unknown> = {};
        if (body.product_id) payload.product_id = Number(body.product_id);
        if (body.cylinder_status) payload.cylinder_status = body.cylinder_status;

        const res = await patcher(`/cylinder_assets/${body.id}`, payload);

        return NextResponse.json({ success: true, data: res });
    } catch (err: unknown) {
        console.error('Update Cylinder Asset API Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to update Cylinder Asset';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
