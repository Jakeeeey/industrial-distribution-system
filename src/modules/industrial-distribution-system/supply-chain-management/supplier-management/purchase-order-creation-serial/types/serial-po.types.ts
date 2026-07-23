// src/modules/.../purchase-order-creation-serial/types/serial-po.types.ts
// Purpose: TypeScript interfaces for the Cylinder Refill Serial Tagging module.
// Revised: PO creation types removed. This module now only selects existing
//          is_refill=1 POs and registers serial numbers against them.

// ─── PO List Item ─────────────────────────────────────────────────────────────
// Shown in the PO selection list. Includes all statuses so user can see the
// full pipeline (approved + pending approval + already tagged).
export type SerialTaggingPOListItem = {
    poId: number;
    poNumber: string;
    supplierName: string;
    date: string;                   // ISO date string YYYY-MM-DD
    inventoryStatus: number;        // 13 = approved for tagging; others = pending
    inventoryStatusLabel: string;   // display label from transaction_status table
    isTagged: boolean;              // true = purchase_order.is_tagged = 1
    totalLines: number;             // count of purchase_order_products rows
    totalOrderedQty: number;        // sum of ordered_quantity across all lines
    totalSerials: number;           // count of existing purchase_order_serial rows
    remark?: string;
};

// ─── Serial Entry ─────────────────────────────────────────────────────────────
// One serial number for a cylinder unit.
export type SerialEntry = {
    serial_number: string;
    saved?: boolean;    // true = already in DB; false/undefined = draft (this session)
};

// ─── Tagging Line ─────────────────────────────────────────────────────────────
// Represents one purchase_order_products row with its serial state.
export type SerialTaggingLine = {
    lineId: number;             // purchase_order_product_id
    productId: number;
    productName: string;
    sku: string;
    branchId: number;
    branchName: string;
    orderedQty: number;         // fixed from purchase_order_products.ordered_quantity
    savedSerials: SerialEntry[];    // already in purchase_order_serial (read-only display)
    draftSerials: SerialEntry[];    // entered this session, not yet submitted
};

// ─── PO Detail ────────────────────────────────────────────────────────────────
// Full workspace data for a selected PO (shown in tagging panel).
export type SerialTaggingPODetail = {
    poId: number;
    poNumber: string;
    supplierName: string;
    date: string;
    remark?: string;
    inventoryStatus: number;
    inventoryStatusLabel?: string;
    isTagged: boolean;
    lines: SerialTaggingLine[];
};

// ─── Tag Serials Payload ─────────────────────────────────────────────────────
// POST body sent to the route when submitting drafted serial numbers.
export type TagSerialsPayload = {
    poId: number;
    entries: Array<{
        lineId: number;         // purchase_order_product_id FK target
        productId: number;
        serial_number: string;
    }>;
};

// ─── Tag Serials Result ───────────────────────────────────────────────────────
// API response after submitting serials.
export type TagSerialsResult = {
    serialsInserted: number;
    isTaggedNow: boolean;       // true if purchase_order.is_tagged was patched to 1
    poNumber: string;
};
