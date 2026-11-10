/**
 * API Route to fetch active branches for filtering
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
}

export async function GET() {
    try {
        const base = getDirectusBase();
        const url = `${base}/items/branches?filter[is_active][_eq]=1&sort=branch_name&limit=-1`;
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getDirectusToken()}`,
            },
            cache: 'no-store',
        });
        if (!res.ok) {
            return NextResponse.json({ data: [] });
        }
        const json = await res.json().catch(() => ({ data: [] }));
        return NextResponse.json({ data: json?.data || [] });
    } catch {
        return NextResponse.json({ data: [] });
    }
}

