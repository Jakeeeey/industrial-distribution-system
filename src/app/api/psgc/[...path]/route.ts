import { NextRequest, NextResponse } from "next/server";

// In-memory cache for Philippine Standard Geographic Code lookups to optimize performance and prevent rate limiting
const psgcCache = new Map<string, unknown>();

/**
 * PSGC Proxy Route
 * Forwards Philippine Standard Geographic Code lookups to psgc.gitlab.io (with psgc.cloud as secondary fallback).
 * Caches responses in memory and sets HTTP cache headers.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const path = (await params).path.join("/");

    // Check in-memory cache first
    if (psgcCache.has(path)) {
        return NextResponse.json(psgcCache.get(path), {
            headers: {
                "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
            },
        });
    }

    let data: unknown = null;

    // Primary upstream: psgc.gitlab.io (requires trailing slash)
    try {
        const primaryUrl = `https://psgc.gitlab.io/api/${path}/`;
        const res = await fetch(primaryUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            data = await res.json();
        }
    } catch {
        // Fallback to secondary upstream
    }

    // Secondary upstream: psgc.cloud
    if (!data) {
        try {
            const fallbackUrl = `https://psgc.cloud/api/${path}`;
            const res = await fetch(fallbackUrl, {
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                data = await res.json();
            }
        } catch {
            // Both upstreams failed
        }
    }

    if (!data) {
        return NextResponse.json(
            { error: "Failed to fetch from PSGC API after trying all sources" },
            { status: 502 }
        );
    }

    // Cache valid array data
    if (Array.isArray(data)) {
        psgcCache.set(path, data);
    }

    return NextResponse.json(data, {
        headers: {
            "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
        },
    });
}
