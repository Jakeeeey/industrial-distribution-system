import { ActivePickingRepo } from "./active-picking.repo";
import { Consolidator, ConsolidatorDetail, ConsolidatorSerialMapping } from "../types";

export const ActivePickingService = {
    async getBranches(divisionId: number = 1): Promise<{ id: number, branch_name: string }[]> {
        return ActivePickingRepo.fetchBranchesByDivision(divisionId);
    },

    async getPickings(divisionId: number = 1, status: string = "Picking", page: number = 1, limit: number = 20): Promise<{ data: Consolidator[], meta: { total: number } }> {
        const result = await ActivePickingRepo.fetchPickings(divisionId, status, page, limit);
        return {
            data: result.data,
            meta: {
                total: result.meta.filter_count
            }
        };
    },

    async getPickingDetails(consolidatorId: number, branchId: number): Promise<ConsolidatorDetail[]> {
        const details = await ActivePickingRepo.fetchPickingDetails(consolidatorId);
        
        // Extract product IDs to fetch inventory
        const productIds = details.map(d => d.product_id).filter(id => id != null);
        
        // Fetch inventory to get running_inventory_unit
        const inventory = await ActivePickingRepo.fetchInventoryForProducts(productIds, branchId, 1);
        
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

    async processSerialPick(detailId: number, serialNumber: string, userId: number | null, branchId: number): Promise<{ success: boolean; message: string; newQuantity: number }> {
        // 1. Fetch detail to get productId
        const detailUrl = `${ActivePickingRepo.getDirectusBase()}/items/consolidator_details/${detailId}?fields=product_id`;
        const detailRes = await fetch(detailUrl, { headers: ActivePickingRepo.getHeaders() });
        if (!detailRes.ok) throw new Error("Failed to fetch detail info");
        const detailData = await detailRes.json();
        const productId = detailData.data.product_id;

        // 2. Verify if serial is on hand for this branch and product
        const isOnHand = await ActivePickingRepo.verifySerialOnhand(serialNumber, productId, branchId);
        if (!isOnHand) {
            throw new Error(`Serial ${serialNumber} is not on-hand for this branch/product.`);
        }

        // 3. Check uniqueness in picking mappings
        const exists = await ActivePickingRepo.checkSerialExists(serialNumber);
        if (exists) {
            throw new Error(`Serial number ${serialNumber} has already been scanned.`);
        }

        // 4. Update picked quantity
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, 1);
        
        // 5. Save serial mapping
        await ActivePickingRepo.saveSerialMapping(detailId, serialNumber, userId);
        
        return {
            success: true,
            message: "Serial scanned successfully",
            newQuantity: newQty
        };
    },

    async getSerialsForDetail(detailId: number): Promise<ConsolidatorSerialMapping[]> {
        return ActivePickingRepo.fetchSerialsForDetail(detailId);
    },

    async removeSerialPick(mappingId: number, detailId: number): Promise<{ success: boolean; newQuantity: number }> {
        // 1. Delete mapping
        await ActivePickingRepo.deleteSerialMapping(mappingId);

        // 2. Decrement picked quantity
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, -1);

        return { success: true, newQuantity: newQty };
    },

    async completePicking(consolidatorId: number, status: string = "Picked"): Promise<void> {
        await ActivePickingRepo.updateConsolidatorStatus(consolidatorId, status);
    }
};
