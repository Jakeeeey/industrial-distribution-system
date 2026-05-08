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

        console.log(`[ActivePickingRepo] Fetching from: ${url}`);

        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Failed to fetch consolidators: ${await response.text()}`);
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
            throw new Error(`Failed to fetch consolidator details: ${await response.text()}`);
        }

        const data = await response.json();

        return data.data.map((item: { product_id: unknown; [key: string]: unknown }) => {
            // Robustly extract the product ID from the relational object or flat field
            const productRef = item.product_id as ProductRef | null;
            let pId: string | number | null = null;

            if (productRef) {
                if (typeof productRef === 'object') {
                    pId = productRef.id ?? productRef.productId ?? productRef.product_id ?? null;
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

        const token = sessionToken || process.env.VOS_ACCESS_TOKEN || process.env.vos_access_token || DIRECTUS_TOKEN;
        const baseUrl = process.env.SPRING_API_BASE_URL;
        const productIdsStr = productIds.join(",");
        
        // Target Spring Boot View with specific dates and divisionId
        const url = `${baseUrl}/api/view-running-inventory-by-unit/all?startDate=2025-01-01&endDate=2025-12-30&divisionId=1&productId=${productIdsStr}&branchId=${branchId}&size=10000`;

        try {
            const response = await fetch(url, { 
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }, 
                cache: "no-store" 
            });
            
            if (!response.ok) {
                console.error(`[ActivePickingRepo] Failed to fetch inventory from Spring, status: ${response.status}`);
                return [];
            }

            const json = await response.json();
            
            // Handle Spring Boot response structure (might be wrapped in 'content' or 'data')
            let items = [];
            if (Array.isArray(json)) items = json;
            else if (json.content && Array.isArray(json.content)) items = json.content;
            else if (json.data && Array.isArray(json.data)) items = json.data;

            // Map Spring Boot fields to our ProductInventory type
            return items.map((item: any) => ({
                product_id: item.productId ?? item.product_id,
                branch_id: item.branchId ?? item.branch_id,
                running_inventory_unit: item.runningInventoryUnit ?? item.running_inventory_unit ?? item.quantity ?? 0
            }));
        } catch (error) {
            console.error("[ActivePickingRepo] Error fetching inventory from Spring:", error);
            return [];
        }
    },

    async checkSerialExists(serialNumber: string): Promise<boolean> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings?filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&limit=1`;
        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Failed to check serial: ${await response.text()}`);
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
            throw new Error(`Failed to save serial mapping: ${await response.text()}`);
        }

        const data = await response.json();
        return data.data;
    },

    async updatePickedQuantity(detailId: number, incrementBy: number, userId: number | null, timestamp: string): Promise<number> {
        // First fetch current to increment safely
        const getUrl = `${DIRECTUS_BASE}/items/consolidator_details/${detailId}?fields=picked_quantity`;
        const getRes = await fetch(getUrl, { headers: getHeaders() });
        if (!getRes.ok) throw new Error("Failed to fetch current quantity");
        const getData = await getRes.json();
        const currentQty = getData.data.picked_quantity || 0;
        const newQty = Math.max(0, currentQty + incrementBy);

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
            throw new Error(`Failed to update picked quantity: ${await patchRes.text()}`);
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
            throw new Error(`Failed to delete serial mapping: ${await response.text()}`);
        }
    },

    async verifySerialOnhand(serialNumber: string, branchId: number, sessionToken: string | null = null): Promise<{ productId: number } | null> {
        const token = sessionToken || process.env.VOS_ACCESS_TOKEN || process.env.vos_access_token || process.env.DIRECTUS_STATIC_TOKEN || DIRECTUS_TOKEN;
        const baseUrl = process.env.SPRING_API_BASE_URL;
        const inputSerial = serialNumber.trim().toUpperCase();
        const trace: string[] = [];
        
        const extractData = (raw: Record<string, unknown> | unknown[] | null): Record<string, unknown>[] => {
            if (Array.isArray(raw)) return raw as Record<string, unknown>[];
            if (raw && typeof raw === 'object' && 'content' in raw && Array.isArray(raw.content)) return raw.content as Record<string, unknown>[];
            if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)) return raw.data as Record<string, unknown>[];
            return [];
        };

        const tryFetch = async (endpoint: string, queryParams: string) => {
            const urlWithAll = `${baseUrl}/api/${endpoint}/all?${queryParams}&size=10000`;
            trace.push(`Fetching: ${endpoint}/all?${queryParams}`);
            try {
                const res = await fetch(urlWithAll, {
                    cache: "no-store",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
                });
                
                let items: Record<string, unknown>[] = [];
                if (res.ok) {
                    const json = await res.json();
                    items = extractData(json);
                }

                // If empty or failed, try without /all
                if (items.length === 0) {
                    const urlWithoutAll = `${baseUrl}/api/${endpoint}?${queryParams}&size=10000`;
                    trace.push(`Fallback: ${endpoint}?${queryParams}`);
                    const res2 = await fetch(urlWithoutAll, {
                        cache: "no-store",
                        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
                    });
                    if (res2.ok) {
                        const json2 = await res2.json();
                        items = extractData(json2);
                    }
                }

                trace.push(`Found ${items.length} items`);
                return items;
            } catch (e) {
                const err = e as Error;
                trace.push(`Error: ${err.message}`);
                return [];
            }
        };

        try {
            // 1. Try specific search (Serial + Branch)
            let data = await tryFetch("v-serial-onhand", `serialNumber=${encodeURIComponent(serialNumber.trim())}&branchId=${branchId}`);
            
            // 2. Try specific search (Serial + Branch) - snake_case
            if (data.length === 0) {
                data = await tryFetch("v-serial-onhand", `serial_number=${encodeURIComponent(serialNumber.trim())}&branch_id=${branchId}`);
            }

            // 3. Try SERIAL ONLY (Postman Style) - This is likely why Postman works
            if (data.length === 0) {
                trace.push("Serial+Branch empty, trying Serial only...");
                data = await tryFetch("v-serial-onhand", `serialNumber=${encodeURIComponent(serialNumber.trim())}`);
                if (data.length === 0) {
                    data = await tryFetch("v-serial-onhand", `serial_number=${encodeURIComponent(serialNumber.trim())}`);
                }
            }

            // 4. Try BRANCH ONLY
            if (data.length === 0) {
                trace.push("Serial search empty, trying Branch only...");
                data = await tryFetch("v-serial-onhand", `branchId=${branchId}`);
                if (data.length === 0) {
                    data = await tryFetch("v-serial-onhand", `branch_id=${branchId}`);
                }
            }

            // 5. Global diagnostic: If still 0, see if ANY data exists in this view at all
            if (data.length === 0) {
                trace.push("Branch empty, checking global...");
                const globalSample = await tryFetch("v-serial-onhand", "size=1");
                if (globalSample.length > 0) {
                    trace.push(`Global found! Sample: ${JSON.stringify(globalSample[0])}`);
                } else {
                    trace.push("Global is also empty!");
                }
            }

            if (data.length === 0) {
                throw new Error(`DEBUG_TRACE: ${trace.join(" -> ")}`);
            }

            const onhand = data.find((item: Record<string, unknown>) => {
                const dbVal = item.serialNumber ?? item.serial_number ?? item.serialNo ?? item.serial;
                if (dbVal === undefined || dbVal === null) return false;
                
                const dbSerial = String(dbVal).trim().toUpperCase();
                const dbBranchId = item.branchId ?? item.branch_id;
                const branchMatch = dbBranchId === undefined || dbBranchId === null || Number(dbBranchId) === branchId;
                
                return dbSerial === inputSerial && branchMatch;
            });

            if (onhand) {
                const product = onhand.product as ProductRef | undefined;
                const pId = onhand.productId ?? onhand.product_id ?? product?.id ?? product?.product_id;
                if (pId !== undefined && pId !== null) {
                    return { productId: Number(pId) };
                }
                throw new Error(`DEBUG_TRACE: Serial found but productId missing in fields: ${Object.keys(onhand).join(", ")}`);
            }
            
            throw new Error(`DEBUG_TRACE: Serial ${inputSerial} not found in ${data.length} records. First item sample: ${data[0] ? JSON.stringify(data[0]) : "NONE"}`);
        } catch (error) {
            const err = error as Error;
            console.error("[Active Picking Repo] Error verifying onhand serial:", err);
            if (err.message.includes("DEBUG_TRACE")) throw err;
            throw new Error("NETWORK_FAILURE");
        }
    }
};
;
