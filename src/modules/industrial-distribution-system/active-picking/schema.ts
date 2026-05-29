import { z } from "zod";

export const ScanSerialSchema = z.object({
    detail_id: z.number().int().positive("Invalid detail ID"),
    serial_number: z.string().min(1, "Serial number is required").max(50, "Serial number too long"),
});

export type ScanSerialPayload = z.infer<typeof ScanSerialSchema>;
