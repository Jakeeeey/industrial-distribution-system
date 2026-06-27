// src/modules/.../purchase-order-creation-serial/types/serial-po.schema.ts
// Purpose: Zod validation schemas for the Serial Tagging module API contracts.
// Revised: Old PO creation schema removed. Only validates serial tagging payload.

import { z } from "zod";

// ─── Single serial entry ──────────────────────────────────────────────────────
export const SerialEntrySchema = z.object({
    lineId: z.number().int().positive("lineId (purchase_order_product_id) is required"),
    productId: z.number().int().positive("productId is required"),
    serial_number: z.string().min(1, "Serial number cannot be empty").max(100),
});

// ─── Tag Serials Schema (main POST body) ─────────────────────────────────────
export const TagSerialsSchema = z.object({
    poId: z.number().int().positive("PO ID is required"),
    entries: z
        .array(SerialEntrySchema)
        .min(1, "At least one serial entry is required"),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type TagSerialsSchemaType = z.infer<typeof TagSerialsSchema>;
export type SerialEntrySchemaType = z.infer<typeof SerialEntrySchema>;
