import { Consolidator, ConsolidatorDetail, ConsolidatorSerialMapping, ProductInventory } from "../types";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DIRECTUS_TOKEN}`
    };
}

interface ProductRef {
    id?: string | number;
    productId?: string | number;
    product_id?: string | number;
    product_code?: string;
    product_name?: string;
    unit_of_measurement?: { unit_name: string };
}

interface RawProductInventory {
    productId?: number;
    product_id?: number;
    branchId?: number;
    branch_id?: number;
    runningInventoryUnit?: number;
    running_inventory_unit?: number;
    quantity?: number;
}

export const ActivePickingRepo = {
    getDirectusBase() { return DIRECTUS_BASE; },
    getHeaders() { return getHeaders(); },

    async updateConsolidatorStatus(id: number, status: string): Promise<void> {
        const url = `${DIRECTUS_BASE}/items/consolidator/${id}`;
        const response = await fetch(url, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error("Failed to update status");
    },

    async fetchBranchesByDivision(divisionId: number): Promise<{ id: number, branch_name: string }[]> {
        const url = `${DIRECTUS_BASE}/items/branches?filter[division_id][_eq]=${divisionId}&fields=id,branch_name&limit=-1`;
        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch branches");
        const data = await response.json();
        return data.data;
    },

    async fetchPickings(divisionId: number = 1, status: string = "Picking", page: number = 1, limit: number = 20, search: string = ""): Promise<{ data: Consolidator[], meta: { filter_count: number } }> {
        const fields = [
            "id",
            "consolidator_no",
            "status",
            "branch_id",
            "created_by",
            "checked_by",
            "created_at",
            "updated_at"
        ].join(",");

        // Fetch consolidators with status and branches belonging to the division
        // Sort by id descending to get recent first (CLDTO-XXXXX)
        let url = `${DIRECTUS_BASE}/items/consolidator?filter[status][_eq]=${status}&filter[branch_id][division_id][_eq]=${divisionId}&fields=${fields}&sort=-id&page=${page}&limit=${limit}&meta=filter_count`;

        if (search) {
            url += `&filter[consolidator_no][_icontains]=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to fetch consolidators");
        }

        return await response.json();
    },

    async fetchPickingDetails(consolidatorId: number): Promise<ConsolidatorDetail[]> {
        const fields = [
            "id",
            "consolidator_id",
            "product_id",
            "product_id.product_id",
            "ordered_quantity",
            "picked_quantity",
            "applied_quantity",
            "picked_at",
            "picked_by",
            "product_id.product_code",
            "product_id.product_name",
            "product_id.unit_of_measurement.unit_name"
        ].join(",");

        const url = `${DIRECTUS_BASE}/items/consolidator_details?filter[consolidator_id][_eq]=${consolidatorId}&fields=${fields}&limit=-1`;

        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to fetch consolidator details");
        }

        const data = await response.json();

        return data.data.map((item: { product_id: unknown;[key: string]: unknown }) => {
            // Robustly extract the product ID from the relational object or flat field
            const productRef = item.product_id as ProductRef | null;
            let pId: string | number | null = null;

            if (productRef) {
                if (typeof productRef === 'object') {
                    pId = productRef.product_id ?? productRef.productId ?? productRef.id ?? null;
                } else {
                    pId = productRef as unknown as string | number;
                }
            }

            return {
                ...item,
                product_id: pId ? Number(pId) : null,
                product: productRef && typeof productRef === 'object' ? {
                    product_code: productRef.product_code,
                    product_name: productRef.product_name,
                    unit_name: productRef.unit_of_measurement?.unit_name || '',
                    running_inventory_unit: 0 // Will be populated later
                } : undefined
            };
        });
    },

    async fetchInventoryForProducts(productIds: number[], branchId: number, sessionToken: string | null = null): Promise<ProductInventory[]> {
        if (productIds.length === 0) return [];

        // Prefer the dedicated server-side Spring API token over the user session cookie.
        // The session cookie is a Directus JWT and will be rejected (401) by the Spring API.
        const token = process.env.VOS_ACCESS_TOKEN || process.env.vos_access_token || sessionToken || DIRECTUS_TOKEN;
        const baseUrl = process.env.SPRING_API_BASE_URL;
        const productIdsStr = productIds.join(",");

        // OPTIMIZATION: Dynamically compute a 30-day range (1 month) instead of a static 1 year.
        // This limits database movements scanning workload significantly, reducing execution time to milliseconds.
        const now = new Date();
        const startObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endObj = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const startDate = startObj.toISOString().split("T")[0];
        const endDate = endObj.toISOString().split("T")[0];

        // Target Spring Boot View with specific dates, divisionId, and a small buffer size=10
        const url = `${baseUrl}/api/view-running-inventory-by-unit/all?startDate=${startDate}&endDate=${endDate}&divisionId=1&productId=${productIdsStr}&branchId=${branchId}&size=10`;

        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                cache: "no-store"
            });

            if (!response.ok) {
                return [];
            }

            const json = await response.json();

            // Handle Spring Boot response structure (might be wrapped in 'content' or 'data')
            let items = [];
            if (Array.isArray(json)) items = json;
            else if (json.content && Array.isArray(json.content)) items = json.content;
            else if (json.data && Array.isArray(json.data)) items = json.data;

            // Map Spring Boot fields to our ProductInventory type (including last_cutoff)
            return items.map((item: any) => ({
                product_id: item.productId ?? item.product_id,
                branch_id: item.branchId ?? item.branch_id,
                running_inventory_unit: item.runningInventoryUnit ?? item.running_inventory_unit ?? item.quantity ?? 0,
                last_cutoff: item.lastCutoff ?? item.last_cutoff ?? null,
                last_count_unit: item.lastCountUnit ?? item.last_count_unit ?? item.lastCount ?? 0,
                movement_after_unit: item.movementAfterUnit ?? item.movement_after_unit ?? item.movementAfter ?? 0
            } as any));
        } catch {
            return [];
        }
    },

    async checkSerialExists(serialNumber: string): Promise<boolean> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings?filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&limit=1`;
        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to check serial");
        }
        const data = await response.json();
        return data.data.length > 0;
    },

    async saveSerialMapping(detailId: number, serialNumber: string, userId: number | null, timestamp: string): Promise<ConsolidatorSerialMapping> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings`;
        const body = {
            detail_id: detailId,
            serial_number: serialNumber,
            scanned_by: userId,
            scanned_at: timestamp
        };

        const response = await fetch(url, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error("Failed to save serial mapping");
        }

        const data = await response.json();
        return data.data;
    },

    async updatePickedQuantity(detailId: number, incrementBy: number, userId: number | null, timestamp: string, newQtyOverride?: number): Promise<number> {
        let newQty = newQtyOverride;
        if (newQty === undefined) {
            // First fetch current to increment safely
            const getUrl = `${DIRECTUS_BASE}/items/consolidator_details/${detailId}?fields=picked_quantity`;
            const getRes = await fetch(getUrl, { headers: getHeaders() });
            if (!getRes.ok) throw new Error("Failed to fetch current quantity");
            const getData = await getRes.json();
            const currentQty = getData.data.picked_quantity || 0;
            newQty = Math.max(0, currentQty + incrementBy);
        }

        const patchUrl = `${DIRECTUS_BASE}/items/consolidator_details/${detailId}`;
        const patchRes = await fetch(patchUrl, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
                picked_quantity: newQty,
                picked_by: userId,
                picked_at: timestamp
            })
        });

        if (!patchRes.ok) {
            throw new Error("Failed to update picked quantity");
        }

        return newQty;
    },

    async fetchSerialsForDetail(detailId: number): Promise<ConsolidatorSerialMapping[]> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings?filter[detail_id][_eq]=${detailId}&fields=*&limit=-1`;
        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch serials");
        const data = await response.json();
        return data.data;
    },

    async deleteSerialMapping(mappingId: number): Promise<void> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings/${mappingId}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error("Failed to delete serial mapping");
        }
    },

    async verifySerialOnhand(serialNumber: string, branchId: number, sessionToken: string | null = null): Promise<{ productId: number } | null> {
        // Prefer the dedicated server-side Spring API token over the user session cookie.
        // The session cookie is a Directus JWT and will be rejected (401) by the Spring API.
        const token = process.env.VOS_ACCESS_TOKEN || process.env.vos_access_token || sessionToken || process.env.DIRECTUS_STATIC_TOKEN || DIRECTUS_TOKEN;
        const baseUrl = process.env.SPRING_API_BASE_URL;
        const inputSerial = serialNumber.trim().toUpperCase();

        if (!baseUrl) {
            throw new Error("NETWORK_FAILURE");
        }

        // ADVANCED OPTIMIZATION: Query the high-performance '/filter' endpoint instead of the heavy '/all' endpoint.
        // This utilizes direct database index filtering on the Spring Boot side, resolving in milliseconds rather than seconds.
        const url = `${baseUrl}/api/v-serial-onhand/filter?serialNumber=${encodeURIComponent(inputSerial)}&branchId=${branchId}`;

        try {
            const res = await fetch(url, {
                cache: "no-store",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
            });

            if (!res.ok) {
                return null;
            }

            const json = await res.json();

            // Handle different shapes returned by /filter (object, array, or wrapped content)
            let onhand: any = null;
            if (json && typeof json === "object" && !Array.isArray(json)) {
                if ("productId" in json || "product_id" in json) {
                    onhand = json;
                } else {
                    const dataArray = json.content || json.data || [];
                    onhand = dataArray[0];
                }
            } else if (Array.isArray(json)) {
                onhand = json[0];
            }

            if (onhand) {
                const product = onhand.product as ProductRef | undefined;

                type PrimId = string | number | null | undefined;
                let pId: PrimId =
                    (onhand.productId as PrimId) ??
                    (onhand.product_id as PrimId) ??
                    (onhand.itemId as PrimId) ??
                    (onhand.item_id as PrimId) ??
                    (product?.id as PrimId) ??
                    (product?.product_id as PrimId) ??
                    (product?.productId as PrimId);

                // Additional fallback: if the 'product' field itself is a raw number (direct FK value)
                if ((pId === undefined || pId === null) && typeof onhand.product === 'number') {
                    pId = onhand.product as number;
                }

                if (pId !== undefined && pId !== null) {
                    return { productId: Number(pId) };
                }

                throw new Error("Unable to identify product for this serial.");
            }

            return null;
        } catch (error) {
            const err = error as Error;
            if (err.message === "NETWORK_FAILURE") {
                throw err;
            }
            throw new Error("NETWORK_FAILURE");
        }
    }
};

;
