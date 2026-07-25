// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/schema.ts
import { z } from "zod";

/**
 * Zod validation schema for raw API serial movement records.
 * Supports both camelCase and snake_case formatting for robust integration.
 */
export const rawSerialMovementSchema = z.object({
    ts: z.string().optional(),
    movementAt: z.string().optional(),
    
    product_id: z.number().optional(),
    productId: z.number().optional(),
    
    product_name: z.string().optional(),
    productName: z.string().optional(),
    
    serial_number: z.string().optional(),
    serialNumber: z.string().optional(),
    
    branch_id: z.number().optional(),
    branchId: z.number().optional(),
    
    branch_name: z.string().optional(),
    branchName: z.string().optional(),
    
    doc_no: z.string().optional(),
    documentNo: z.string().optional(),
    
    doc_type: z.string().optional(),
    documentType: z.string().optional(),
    
    in_qty: z.coerce.number().optional(),
    inQty: z.coerce.number().optional(),
    
    out_qty: z.coerce.number().optional(),
    outQty: z.coerce.number().optional(),
    
    customer_code: z.string().nullable().optional(),
    customerCode: z.string().nullable().optional(),
    
    customer_name: z.string().nullable().optional(),
    customerName: z.string().nullable().optional(),
    
    supplier_name: z.string().nullable().optional(),
    supplierName: z.string().nullable().optional(),

    // Added: unit of measure field from updated v_serial_movements view
    uom_ids: z.string().nullable().optional(),
    uomIds: z.string().nullable().optional(),
});

export const rawSerialMovementListSchema = z.array(rawSerialMovementSchema);
