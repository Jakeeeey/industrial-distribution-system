// src/modules/.../purchase-order-creation-serial/services/fetchProviders.ts
// Purpose: Client-side API wrappers for the Cylinder Refill Serial Tagging module.
// Revised: Removed PO creation calls. Now provides PO list/detail and serial tagging.

import type {
    SerialTaggingPOListItem,
    SerialTaggingPODetail,
    TagSerialsPayload,
    TagSerialsResult,
} from "../types/serial-po.types";

// ─── Base URL ─────────────────────────────────────────────────────────────────
const BASE = "/api/ids/scm/supplier-management/purchase-order-creation-serial";

// ─── Generic Fetch Wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        cache: "no-store",
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers as Record<string, string>),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = text;
        try {
            const j = JSON.parse(text);
            detail = j?.error || j?.details || text;
        } catch { /* ignore */ }
        throw new Error(`${res.status} ${res.statusText} — ${detail}`);
    }

    const json = await res.json().catch(() => null);
    // Unwrap { data: ... } envelope
    if (json && typeof json === "object" && "data" in json) {
        return (json as { data: T }).data;
    }
    return json as T;
}

// ─── Fetch Refill PO List ─────────────────────────────────────────────────────
/** Fetch all is_refill=1 POs (all statuses) for the PO selection list. */
export async function fetchRefillPOs(): Promise<SerialTaggingPOListItem[]> {
    return apiFetch<SerialTaggingPOListItem[]>(BASE);
}

// ─── Fetch PO Detail ──────────────────────────────────────────────────────────
/** Fetch a single PO's header + product lines + existing serial numbers. */
export async function fetchPODetail(poId: number): Promise<SerialTaggingPODetail> {
    return apiFetch<SerialTaggingPODetail>(`${BASE}?poId=${poId}`);
}

// ─── Submit Tagged Serials ────────────────────────────────────────────────────
/** POST draft serials to the API. Returns insert count + updated detail. */
export async function submitTaggedSerials(
    payload: TagSerialsPayload
): Promise<TagSerialsResult & { updatedDetail: SerialTaggingPODetail }> {
    return apiFetch<TagSerialsResult & { updatedDetail: SerialTaggingPODetail }>(BASE, {
        method: "POST",
        body: JSON.stringify({ action: "tag_serials", ...payload }),
    });
}
