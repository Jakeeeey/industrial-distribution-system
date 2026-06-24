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
        // OPTIMIZATION: Bypassed heavy database view calculations for available stocks.
        // The Stock column has been removed from UI, and stock validation runs purely on the backend during scans.
        return ActivePickingRepo.fetchPickingDetails(consolidatorId);
    },

    async processSerialPick(consolidatorId: number, serialNumber: string, userId: number | null, branchId: number, sessionToken: string | null = null): Promise<{ success: boolean; message: string; newQuantity: number; detailId: number }> {
        // Concurrently verify if serial is on hand and check mapping uniqueness
        const [onhandInfoResult, serialScanned] = await Promise.allSettled([
            ActivePickingRepo.verifySerialOnhand(serialNumber, branchId, sessionToken),
            ActivePickingRepo.checkSerialExists(serialNumber)
        ]);

        if (serialScanned.status === "rejected" || (serialScanned.status === "fulfilled" && serialScanned.value)) {
            throw new Error("This serial number has already been scanned.");
        }

        if (onhandInfoResult.status === "rejected") {
            const error = onhandInfoResult.reason as Error;
            if (error.message === "NETWORK_FAILURE") {
                throw new Error("Unable to reach the warehouse server. Please check your connection.");
            }
            throw new Error(error.message || "Failed to verify serial number.");
        }

        let productId: number;
        const onhandInfo = onhandInfoResult.value;
        if (!onhandInfo) {
            const asset = await ActivePickingRepo.fetchCylinderAssetBySerial(serialNumber);
            if (!asset) {
                throw new Error("UNREGISTERED_SERIAL");
            }
            productId = Number(asset.product_id);
        } else {
            productId = Number(onhandInfo.productId);
        }

        // Concurrently fetch the details and the inventory check for the matched product
        const [details, inventory] = await Promise.all([
            ActivePickingRepo.fetchPickingDetails(consolidatorId),
            ActivePickingRepo.fetchInventoryForProducts([productId], branchId, sessionToken)
        ]);

        const detail = details.find(d => Number(d.product_id) === productId);
        if (!detail) {
            throw new Error("This item is not required for this picking order.");
        }

        const detailId = detail.id;
        const userIdNum = userId ? Number(userId) : null;

        // --- VALIDATION CHECKERS ---
        
        // 1. Check if Picked >= Ordered
        if (detail.picked_quantity >= detail.ordered_quantity) {
            throw new Error("Order limit reached for this item.");
        }

        // 2. Check if Picked >= Available Stock
        const stockInfo = inventory.find(inv => Number(inv.product_id) === productId);
        const availableStock = stockInfo?.running_inventory_unit || 0;

        if (detail.picked_quantity >= availableStock) {
            throw new Error("Cannot pick more than the available physical stock.");
        }

        // ---------------------------

        // PH Manila Time (+08:00)
        const now = new Date();
        const manilaOffset = 8 * 60; // minutes
        const manilaTime = new Date(now.getTime() + (manilaOffset + now.getTimezoneOffset()) * 60000);
        const timestamp = manilaTime.toISOString().replace('Z', '+08:00');

        // Calculate quantity directly to avoid internal GET in updatePickedQuantity
        const targetNewQty = detail.picked_quantity + 1;

        // OPTIMIZATION: Instead of concurrent Promise.all database updates which can cause partial success states,
        // we execute sequentially. We first save the serial mapping (securing uniqueness). If it succeeds,
        // we then increment the picked quantity. If the mapping fails, the quantity remains untouched.
        const savedMapping = await ActivePickingRepo.saveSerialMapping(detailId, serialNumber, userIdNum, timestamp);
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, 1, userIdNum, timestamp, targetNewQty);

        // OPTIMIZATION: Return the savedMapping object so that the front-end can immediately update its local state
        // and avoid triggering an extra HTTP GET call to sync the details list.
        return {
            success: true,
            message: "Serial processed and matched to product successfully",
            newQuantity: newQty,
            detailId,
            serialMapping: savedMapping
        } as any;
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
