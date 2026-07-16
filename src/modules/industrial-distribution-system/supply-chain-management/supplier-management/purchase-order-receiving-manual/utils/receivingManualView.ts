export function isReceivedOrClosedPO(po: {
    status?: string | null;
    inventoryStatus?: string | number | null;
} | null | undefined) {
    const status = String(po?.status ?? "").trim().toUpperCase();
    const inventoryStatus = Number(po?.inventoryStatus ?? 0);
    return status === "CLOSED" || status === "RECEIVED" || inventoryStatus === 6;
}

export function receivingManualWorkbenchMode(po: {
    status?: string | null;
    inventoryStatus?: string | number | null;
} | null | undefined) {
    return isReceivedOrClosedPO(po) ? "readonly" : "receiving";
}

export function isReceivingPOOpening(openingPOId: string | number | null | undefined, poId: string | number | null | undefined) {
    const opening = String(openingPOId ?? "").trim();
    const target = String(poId ?? "").trim();
    return Boolean(opening && target && opening === target);
}

export function shouldShowReceivingWorkbenchSkeleton(openingPOId: string | number | null | undefined) {
    return String(openingPOId ?? "").trim().length > 0;
}

export type ReceivedItemSerial = {
    sn: string;
    tareWeight?: string;
    expiryDate?: string;
    receiptNo?: string;
};

export function receivedItemSerials(
    item: { id?: string | number | null; porId?: string | number | null },
    history: Array<{
        receiptNo?: string | null;
        items?: Array<{
            porId?: string | number | null;
            serials?: ReceivedItemSerial[];
        }>;
    }> | null | undefined
): ReceivedItemSerial[] {
    const itemPorId = String(item?.porId || item?.id || "").trim();
    if (!itemPorId || !Array.isArray(history)) return [];

    const serials: ReceivedItemSerial[] = [];
    for (const receipt of history) {
        const receiptItems = Array.isArray(receipt?.items) ? receipt.items : [];
        for (const receiptItem of receiptItems) {
            if (String(receiptItem?.porId || "").trim() !== itemPorId) continue;

            const receiptSerials = Array.isArray(receiptItem?.serials) ? receiptItem.serials : [];
            for (const serial of receiptSerials) {
                const sn = String(serial?.sn || "").trim().toUpperCase();
                if (!sn) continue;
                serials.push({
                    sn,
                    tareWeight: String(serial?.tareWeight || ""),
                    expiryDate: String(serial?.expiryDate || ""),
                    receiptNo: String(receipt?.receiptNo || ""),
                });
            }
        }
    }

    return serials;
}
