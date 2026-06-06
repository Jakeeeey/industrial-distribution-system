import { ActivePickingRepo } from "./active-picking.repo";
import { Consolidator, ConsolidatorDetail, ConsolidatorSerialMapping } from "../types";

export const ActivePickingService = {
    async getBranches(divisionId: number = 1): Promise<{ id: number, branch_name: string }[]> {
        return ActivePickingRepo.fetchBranchesByDivision(divisionId);
    },

    async getPickings(divisionId: number = 1, status: string = "Picking", page: number = 1, limit: number = 20, search: string = ""): Promise<{ data: Consolidator[], meta: { total: number, filter_count: number } }> {
        const result = await ActivePickingRepo.fetchPickings(divisionId, status, page, limit, search);
        return {
            data: result.data,
            meta: {
                total: result.meta.filter_count,
                filter_count: result.meta.filter_count
            }
        };
    },

    async getPickingDetails(consolidatorId: number, branchId: number, sessionToken: string | null = null): Promise<ConsolidatorDetail[]> {
        const details = await ActivePickingRepo.fetchPickingDetails(consolidatorId);
        
        // Extract product IDs to fetch inventory
        const productIds = details.map(d => d.product_id).filter(id => id != null);
        
        // Fetch inventory to get running_inventory_unit
        const inventory = await ActivePickingRepo.fetchInventoryForProducts(productIds, branchId, sessionToken);
        
        // Map inventory back to details
        const inventoryMap = new Map<number, number>();
        inventory.forEach(inv => {
            inventoryMap.set(inv.product_id, inv.running_inventory_unit);
        });
        
        return details.map(d => {
            if (d.product) {
                d.product.running_inventory_unit = inventoryMap.get(d.product_id) || 0;
            }
            return d;
        });
    },

    async processSerialPick(consolidatorId: number, serialNumber: string, userId: number | null, branchId: number, sessionToken: string | null = null): Promise<{ success: boolean; message: string; newQuantity: number; detailId: number }> {
        // 1. Verify if serial is on hand for this branch and identify its productId
        let onhandInfo;
        try {
            onhandInfo = await ActivePickingRepo.verifySerialOnhand(serialNumber, branchId, sessionToken);
        } catch (err) {
            const error = err as Error;
            if (error.message === "NETWORK_FAILURE") {
                throw new Error("Unable to reach the warehouse server. Please check your connection.");
            }
            throw new Error(error.message || "Failed to verify serial number.");
        }
        
        if (!onhandInfo) {
            throw new Error(`Serial ${serialNumber} is not currently available in this branch.`);
        }
        
        // Ensure productId is a number for comparison
        const productId = Number(onhandInfo.productId);

        // 2. Find the matching detail row in this consolidator for the product
        const details = await ActivePickingRepo.fetchPickingDetails(consolidatorId);
        
        const detail = details.find(d => Number(d.product_id) === productId);
        
        if (!detail) {
            throw new Error("This item is not required for this picking order.");
        }

        const detailId = detail.id;
        const userIdNum = userId ? Number(userId) : null;

        // --- NEW VALIDATION CHECKERS ---
        
        // 1. Check if Picked >= Ordered
        if (detail.picked_quantity >= detail.ordered_quantity) {
            throw new Error("Order limit reached for this item.");
        }

        // 2. Check if Picked >= Available Stock
        const inventory = await ActivePickingRepo.fetchInventoryForProducts([productId], branchId, sessionToken);
        const stockInfo = inventory.find(inv => Number(inv.product_id) === productId);
        const availableStock = stockInfo?.running_inventory_unit || 0;

        if (detail.picked_quantity >= availableStock) {
            throw new Error("Cannot pick more than the available physical stock.");
        }

        // -------------------------------

        // PH Manila Time (+08:00)
        // Note: Using ISO string and manually adjusting for Manila offset if needed, 
        // or just using a helper that ensures UTC+8.
        const now = new Date();
        const manilaOffset = 8 * 60; // minutes
        const manilaTime = new Date(now.getTime() + (manilaOffset + now.getTimezoneOffset()) * 60000);
        const timestamp = manilaTime.toISOString().replace('Z', '+08:00');

        // 3. Check uniqueness in picking mappings
        const exists = await ActivePickingRepo.checkSerialExists(serialNumber);
        if (exists) {
            throw new Error("This serial number has already been scanned.");
        }

        // 4. Update picked quantity
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, 1, userIdNum, timestamp);
        
        // 5. Save serial mapping
        await ActivePickingRepo.saveSerialMapping(detailId, serialNumber, userIdNum, timestamp);
        
        return {
            success: true,
            message: "Serial processed and matched to product successfully",
            newQuantity: newQty,
            detailId
        };
    },

    async getSerialsForDetail(detailId: number): Promise<ConsolidatorSerialMapping[]> {
        return ActivePickingRepo.fetchSerialsForDetail(detailId);
    },

    async removeSerialPick(mappingId: number, detailId: number, userId: number | null = null): Promise<{ success: boolean; newQuantity: number }> {
        // 1. Delete mapping
        await ActivePickingRepo.deleteSerialMapping(mappingId);

        // PH Manila Time (+08:00)
        const now = new Date();
        const manilaOffset = 8 * 60; // minutes
        const manilaTime = new Date(now.getTime() + (manilaOffset + now.getTimezoneOffset()) * 60000);
        const timestamp = manilaTime.toISOString().replace('Z', '+08:00');

        // 2. Decrement picked quantity
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, -1, userId, timestamp);

        return { success: true, newQuantity: newQty };
    },

    async completePicking(consolidatorId: number, status: string = "Picked"): Promise<void> {
        await ActivePickingRepo.updateConsolidatorStatus(consolidatorId, status);
    }
};
