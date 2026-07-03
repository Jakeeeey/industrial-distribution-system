// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/types.ts

/**
 * Represents a normalized serial movement transaction row.
 */
export type SerialMovement = {
    movementAt: string;     // ts
    productId: number;      // product_id
    productName: string;    // product_name
    serialNumber: string;   // serial_number
    branchId: number;       // branch_id
    branchName: string;     // branch_name
    documentNo: string;     // doc_no
    documentType: string;   // doc_type
    inQty: number;          // in_qty (0 or 1)
    outQty: number;         // out_qty (0 or 1)
};

/**
 * Represents a unique cylinder aggregated from its movements.
 */
export type CylinderSummary = {
    serialNumber: string;
    productId: number;
    productName: string;
    lastHandlingBranch: string;
    lastMovementType: string;
    lastDocumentNo: string;
    direction: "IN" | "OUT" | "Review";
    lastMovementDate: string;
    movementCount: number;
    movements: SerialMovement[];
};

/**
 * Represents an inventory exception detected in a cylinder's timeline.
 */
export type ExceptionDetail = {
    id: string;
    serialNumber: string;
    productName: string;
    exceptionType: "refill_overdue" | "unresolved_transfer" | "stale_asset" | "conflicting_movement";
    title: string;
    description: string;
};

/**
 * Filter state for the cylinder list and movement ledger.
 */
export type CylinderFilters = {
    productName: string; // Main filter: Product Name (browse filter)
    serialSearch: string; // Quick serial search / barcode scan
};
