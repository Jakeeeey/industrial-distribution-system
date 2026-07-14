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

    // Fixed unused parameters warning by referencing them using void statements
    async getPickingDetails(consolidatorId: number, branchId: number, sessionToken: string | null = null): Promise<ConsolidatorDetail[]> {
        // OPTIMIZATION: Bypassed heavy database view calculations for available stocks.
        // The Stock column has been removed from UI, and stock validation runs purely on the backend during scans.
        void branchId;
        void sessionToken;
        return ActivePickingRepo.fetchPickingDetails(consolidatorId);
    },

    async processSerialPick(consolidatorId: number, serialNumber: string, userId: number | null, branchId: number, sessionToken: string | null = null): Promise<{ success: boolean; message: string; newQuantity: number; detailId: number; serialMapping?: ConsolidatorSerialMapping }> {
        // Concurrently verify if serial is on hand, check mapping uniqueness, and fetch picking details
        const [onhandInfoResult, serialScanned, detailsResult] = await Promise.allSettled([
            ActivePickingRepo.verifySerialOnhand(serialNumber, branchId, sessionToken),
            ActivePickingRepo.checkSerialExists(serialNumber),
            ActivePickingRepo.fetchPickingDetails(consolidatorId)
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

        if (detailsResult.status === "rejected") {
            throw new Error("Failed to fetch picking details.");
        }

        let productId: number;
        let availableStock: number | null = null;
        const onhandInfo = onhandInfoResult.value;

        if (!onhandInfo) {
            const asset = await ActivePickingRepo.fetchCylinderAssetBySerial(serialNumber);
            if (!asset) {
                throw new Error("UNREGISTERED_SERIAL");
            }
            productId = Number(asset.product_id);

            // OPTIMIZATION: Only fetch general inventory if the cylinder is NOT physically on hand.
            // If it is on hand, we safely assume available stock > 0 and skip this heavy query.
            const inventory = await ActivePickingRepo.fetchInventoryForProducts([productId], branchId, sessionToken);
            const stockInfo = inventory.find(inv => Number(inv.product_id) === productId);
            availableStock = stockInfo?.running_inventory_unit || 0;
        } else {
            productId = Number(onhandInfo.productId);
        }

        const details = detailsResult.value;
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

        // 2. Check if Picked >= Available Stock (only validated if we fell back to fetching inventory)
        if (availableStock !== null && detail.picked_quantity >= availableStock) {
            throw new Error("Cannot pick more than the available physical stock.");
        }

        // ---------------------------

        // PH Manila Time
        const timestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(' ', 'T');

        // Calculate quantity directly to avoid internal GET in updatePickedQuantity
        const targetNewQty = detail.picked_quantity + 1;

        // OPTIMIZATION: Instead of concurrent Promise.all database updates which can cause partial success states,
        // we execute sequentially. We first save the serial mapping (securing uniqueness). If it succeeds,
        // we then increment the picked quantity. If the mapping fails, the quantity remains untouched.
        const savedMapping = await ActivePickingRepo.saveSerialMapping(detailId, serialNumber, userIdNum, timestamp);
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, 1, userIdNum, timestamp, targetNewQty);

        // OPTIMIZATION: Return the savedMapping object so that the front-end can immediately update its local state
        // and avoid triggering an extra HTTP GET call to sync the details list.
        // Removed 'as any' to satisfy TypeScript constraints
        return {
            success: true,
            message: "Serial processed and matched to product successfully",
            newQuantity: newQty,
            detailId,
            serialMapping: savedMapping
        };
    },

    async getSerialsForDetail(detailId: number): Promise<ConsolidatorSerialMapping[]> {
        return ActivePickingRepo.fetchSerialsForDetail(detailId);
    },

    async removeSerialPick(mappingId: number, detailId: number, userId: number | null = null): Promise<{ success: boolean; newQuantity: number }> {
        // 1. Delete mapping
        await ActivePickingRepo.deleteSerialMapping(mappingId);

        // PH Manila Time
        const timestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(' ', 'T');

        // 2. Decrement picked quantity
        const newQty = await ActivePickingRepo.updatePickedQuantity(detailId, -1, userId, timestamp);

        return { success: true, newQuantity: newQty };
    },

    async completePicking(consolidatorId: number, status: string = "Picked"): Promise<void> {
        await ActivePickingRepo.updateConsolidatorStatus(consolidatorId, status);
    }
};
