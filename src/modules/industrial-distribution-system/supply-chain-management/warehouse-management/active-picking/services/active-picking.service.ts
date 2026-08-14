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
        // Concurrently verify if serial is on hand, check mapping uniqueness within the consolidation, and fetch picking details
        const [onhandInfoResult, serialScanned, detailsResult] = await Promise.allSettled([
            ActivePickingRepo.verifySerialOnhand(serialNumber, branchId, sessionToken),
            ActivePickingRepo.checkSerialExistsInConsolidation(serialNumber, consolidatorId),
            ActivePickingRepo.fetchPickingDetails(consolidatorId)
        ]);

        if (serialScanned.status === "rejected" || (serialScanned.status === "fulfilled" && serialScanned.value)) {
            throw new Error("This serial number has already been scanned for this order.");
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
        const onhandInfo = onhandInfoResult.value;

        if (!onhandInfo) {
            const asset = await ActivePickingRepo.fetchCylinderAssetBySerial(serialNumber);
            if (asset) {
                // Validate that status is AVAILABLE, FULL, or EMPTY
                const status = (asset.cylinder_status || "").toString().toUpperCase();
                if (status !== "AVAILABLE" && status !== "FULL" && status !== "EMPTY") {
                    throw new Error(`Serial number is not available for picking. Current status: ${status || "UNKNOWN"}`);
                }

                // CASE-SENSITIVE VALIDATION: Ensure the input matches the exact letter casing stored in Directus database
                const dbSerial = (asset.serial_number || "") as string;
                if (dbSerial && dbSerial !== serialNumber.trim()) {
                    throw new Error("Serial number does not match the exact letter casing stored in the database.");
                }
                productId = Number(asset.product_id);
            } else {
                throw new Error("Serial number not found. Please verify the serial number and try again.");
            }
        } else {
            // CASE-SENSITIVE VALIDATION: Ensure the input matches the exact letter casing stored in Spring Boot database
            const dbSerial = onhandInfo.serialNumber;
            if (dbSerial && dbSerial !== serialNumber.trim()) {
                throw new Error("Serial number does not match the exact letter casing stored in the database.");
            }
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
