import { Consolidator, ConsolidatorDetail, ConsolidatorSerialMapping, ProductInventory } from "../types";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DIRECTUS_TOKEN}`
    };
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

    async fetchPickings(divisionId: number = 1, status: string = "Picking", page: number = 1, limit: number = 20): Promise<{ data: Consolidator[], meta: { filter_count: number } }> {
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
        const url = `${DIRECTUS_BASE}/items/consolidator?filter[status][_eq]=${status}&filter[branch_id][division_id][_eq]=${divisionId}&fields=${fields}&sort=-id&page=${page}&limit=${limit}&meta=filter_count`;
        
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
        
        return data.data.map((item: any) => ({
            ...item,
            product: item.product_id && typeof item.product_id === 'object' ? {
                product_code: item.product_id.product_code,
                product_name: item.product_id.product_name,
                unit_name: item.product_id.unit_of_measurement?.unit_name || '',
                running_inventory_unit: 0 // Will be populated later
            } : undefined,
            product_id: typeof item.product_id === 'object' ? item.product_id.id : item.product_id // Restore primitive ID
        }));
    },

    async fetchInventoryForProducts(productIds: number[], branchId: number, divisionId: number): Promise<ProductInventory[]> {
        if (productIds.length === 0) return [];
        
        const productIdsStr = productIds.join(",");
        const url = `${DIRECTUS_BASE}/items/v_running_inventory_by_unit?filter[product_id][_in]=${productIdsStr}&filter[branch_id][_eq]=${branchId}&limit=-1`;
        
        const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (!response.ok) {
            console.error("Failed to fetch inventory from view, response:", await response.text());
            return [];
        }
        
        const data = await response.json();
        return data.data;
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

    async saveSerialMapping(detailId: number, serialNumber: string, userId: number | null): Promise<ConsolidatorSerialMapping> {
        const url = `${DIRECTUS_BASE}/items/consolidator_serial_mappings`;
        const body = {
            detail_id: detailId,
            serial_number: serialNumber,
            scanned_by: userId
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

    async updatePickedQuantity(detailId: number, incrementBy: number): Promise<number> {
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
                picked_quantity: newQty
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

    async verifySerialOnhand(serialNumber: string, productId: number, branchId: number): Promise<boolean> {
        // External API to check onhand serials
        const url = `http://100.81.225.79:8086/api/v-serial-onhand/all`;
        
        try {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) return true; // Fallback to true if API is down to avoid blocking workflow
            
            const data: any[] = await response.json();
            
            // Find if serial exists for this product and branch
            const onhand = data.find(s => 
                s.serialNumber === serialNumber && 
                Number(s.productId) === productId && 
                Number(s.branchId) === branchId
            );
            
            return !!onhand;
        } catch (error) {
            console.error("[ActivePickingRepo] Error verifying onhand serial:", error);
            return true; // Fallback to true
        }
    }
};
