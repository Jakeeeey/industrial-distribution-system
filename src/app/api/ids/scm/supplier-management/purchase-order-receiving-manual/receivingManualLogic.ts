export type ManualReceivingRow = {
    isPosted?: string | number | boolean | null;
    receipt_no?: string | null;
    receipt_date?: string | null;
    received_date?: string | null;
    received_quantity?: string | number | null;
};

export type ManualReceivingListTab = "normal" | "refill" | "received";

export const manualReceivingListInventoryStatuses = [13, 9, 11, 12, 3, 6];

function toText(v: unknown) {
    const s = String(v ?? "").trim();
    return s;
}

function toNumber(v: unknown) {
    const n = parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
}

export function isManualReceiptReverted(rows: ManualReceivingRow[]) {
    return rows.length > 0 && rows.every((row) => toNumber(row?.isPosted) === 2);
}

export function hasManualReceiptEvidence(row: ManualReceivingRow | null | undefined) {
    if (toNumber(row?.isPosted) === 2) return false;
    return Boolean(toText(row?.receipt_no) || toText(row?.receipt_date) || toText(row?.received_date));
}

export function effectiveManualReceivedQty(row: ManualReceivingRow | null | undefined) {
    if (toNumber(row?.isPosted) === 2) return 0;
    if (toNumber(row?.isPosted) === 1) return Math.max(0, toNumber(row?.received_quantity ?? 0));
    if (!hasManualReceiptEvidence(row)) return 0;
    return Math.max(0, toNumber(row?.received_quantity ?? 0));
}

export function manualReceiptStatus(rows: ManualReceivingRow[]) {
    if (isManualReceiptReverted(rows)) return "REVERTED";
    if (rows.length > 0 && rows.every((row) => toNumber(row?.isPosted) === 1)) return "POSTED";
    return "ACTIVE";
}

export function manualReceivingListTab(item: {
    status?: string | null;
    inventoryStatus?: string | number | null;
    isRefill?: boolean | number | string | null;
}): ManualReceivingListTab {
    const status = toText(item?.status).toUpperCase();
    if (status === "CLOSED" || status === "RECEIVED" || toNumber(item?.inventoryStatus) === 6) {
        return "received";
    }

    const refill = item?.isRefill === true || item?.isRefill === 1 || String(item?.isRefill) === "1" || String(item?.isRefill).toLowerCase() === "true";
    return refill ? "refill" : "normal";
}

export function formatTareWeightForCommit(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const raw = String(value).replace(/,/g, "").trim();
    if (!raw) return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;

    const n = Number(raw);
    if (!Number.isFinite(n)) return null;

    return raw;
}
