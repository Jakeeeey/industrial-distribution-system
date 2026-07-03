// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/providers/fetchProvider.ts
import { SerialMovement } from "../types";

/**
 * Fetches all normalized serial movement records from the proxy endpoint.
 * Cache is disabled to guarantee real-time visibility.
 * 
 * @returns A promise resolving to the list of normalized SerialMovement rows.
 */
export async function fetchCylinderMovements(): Promise<SerialMovement[]> {
    const timestamp = Date.now();
    const res = await fetch(`/api/ids/arf/traceability-compliance/cylinder-movements?_t=${timestamp}`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Failed to fetch serial movements (HTTP ${res.status})`);
    }

    const json = await res.json();
    return json.data || [];
}

/**
 * Fetches serialized products from Directus to cross-reference tracked cylinders.
 * 
 * @returns List of active products flagged as serialized.
 */
export async function fetchCylinderProducts(): Promise<Array<{ product_id: number; product_name: string }>> {
    const timestamp = Date.now();
    const url = `/api/ids/arf/inventory-management/physical-inventory/directus/products?fields=product_id,product_name&filter[isActive][_eq]=1&filter[is_serialized][_eq]=1&sort=product_name&limit=-1&_t=${timestamp}`;
    
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch product master data (HTTP ${res.status})`);
    }

    const json = await res.json();
    return json.data || [];
}
