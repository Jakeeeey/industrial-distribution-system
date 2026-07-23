import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get('serial');

    if (!serial) {
        return NextResponse.json({ error: 'serial is required' }, { status: 400 });
    }

    try {
        const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
        if (!SPRING_API_BASE_URL) {
            return NextResponse.json({ isOnHand: false });
        }

        const encodedSerial = encodeURIComponent(serial.trim());
        const targetUrl = `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/all?serialNumber=${encodedSerial}`;
        
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            headers["Cookie"] = `vos_access_token=${token}`;
        }
        
        const springRes = await fetch(targetUrl, { method: 'GET', headers, cache: 'no-store' });
        
        let isOnHand = false;
        let debugText = "";
        const debugStatus = springRes.status;
        
        if (springRes.ok) {
            const text = await springRes.text();
            debugText = text;
            console.log("Spring API response for " + serial + ": ", text);
            const parsed = text ? JSON.parse(text) : null;
            
            interface SerialItem {
                serialNumber?: string;
                serial_number?: string;
                [key: string]: unknown;
            }
            
            let dataArray: SerialItem[] = [];
            if (Array.isArray(parsed)) {
                dataArray = parsed;
            } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.content)) {
                    dataArray = parsed.content;
                } else if (Array.isArray(parsed.data)) {
                    dataArray = parsed.data;
                } else if ('productId' in parsed) {
                    dataArray = [parsed];
                }
            }

            isOnHand = dataArray.some(item => 
                (item?.serialNumber || item?.serial_number)?.toUpperCase() === serial.trim().toUpperCase()
            );
        } else {
            debugText = await springRes.text();
            console.log("Spring API failed for " + serial + ": status=" + debugStatus, debugText);
        }

        // Check Cylinder Assets for Product ID Match
        let assetProductId: number | null = null;
        const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
        const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
        
        if (NEXT_PUBLIC_API_BASE_URL && DIRECTUS_STATIC_TOKEN) {
            try {
                const assetUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/cylinder_assets?filter[serial_number][_eq]=${encodedSerial}&fields=product_id`;
                const assetRes = await fetch(assetUrl, {
                    headers: { 'Authorization': `Bearer ${DIRECTUS_STATIC_TOKEN}`, 'Content-Type': 'application/json' },
                    cache: 'no-store'
                });
                if (assetRes.ok) {
                    const assetData = await assetRes.json();
                    if (assetData.data && assetData.data.length > 0) {
                        const pid = assetData.data[0].product_id;
                        assetProductId = typeof pid === 'object' ? pid?.id : pid;
                    }
                }
            } catch (err) {
                console.error("Failed to fetch from cylinder_assets:", err);
            }
        }

        return NextResponse.json({ isOnHand, debugStatus, debugText, assetProductId });
    } catch (err) {
        console.error('Validation error:', err);
        return NextResponse.json({ error: 'Failed to validate' }, { status: 500 });
    }
}
