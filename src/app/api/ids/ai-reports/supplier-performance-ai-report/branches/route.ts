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
        // Strictly filter branches for Industrial Division (division_id = 1) and active status (isActive = 1)
        const url = `${base}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`;
        let res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getDirectusToken()}`,
            },
            cache: 'no-store',
        });

        // Fallback: If division_id filter fails or varies, fallback to division_id = 1 without isActive
        if (!res.ok) {
            const fallbackUrl = `${base}/items/branches?filter[division_id][_eq]=1&limit=-1&sort=branch_name`;
            res = await fetch(fallbackUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getDirectusToken()}`,
                },
                cache: 'no-store',
            });
        }

        if (!res.ok) {
            return NextResponse.json({ data: [] });
        }
        const json = await res.json().catch(() => ({ data: [] }));
        const rawBranches = Array.isArray(json?.data) ? json.data : [];

        // Additional in-memory guard to ensure only division_id = 1 branches are returned
        const filteredBranches = rawBranches.filter((b: Record<string, unknown>) => {
            if (b.division_id !== undefined && b.division_id !== null) {
                return Number(b.division_id) === 1;
            }
            return true;
        });

        // Normalize branch format { id: number, branch_name: string }
        const branches = filteredBranches.map((b: Record<string, unknown>) => ({
            id: Number(b.id),
            branch_name: String(b.branch_name || b.name || b.branch_code || `Branch ${b.id}`),
        }));

        return NextResponse.json({ data: branches });
    } catch {
        return NextResponse.json({ data: [] });
    }
}

