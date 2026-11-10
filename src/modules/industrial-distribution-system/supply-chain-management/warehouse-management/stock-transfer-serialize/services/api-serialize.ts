import type { SerialLookupResponse } from "../types/serialize.types";
import type { UpdateSerializeTransferValues } from "../types/serialize.schema";

export type SerialLookupResult =
  | { success: true; data: SerialLookupResponse }
  | { success: false; error: string; statusCode: number };

export type SerialReceiveResult =
  | { success: true; data: { stockTransferId: number; serialNumber: string } }
  | { success: false; error: string; statusCode: number };

/**
 * Service for client-side API interaction with the Serialized Stock Transfer module.
 */
export const serializeLifecycleService = {
  /**
   * Performs a serial number lookup/validation through the API proxy.
   * AG-COMMENT: Ticket 1 - Returns a structured result instead of throwing raw unhandled exceptions
   * to avoid triggering Next.js dev console error overlays for normal validation failures.
   */
  async lookupSerial(serialNumber: string, branchId?: number): Promise<SerialLookupResult> {
    const params = new URLSearchParams({
      action: "lookup_serial",
      serial: serialNumber,
      ...(branchId ? { branch_id: String(branchId) } : {}),
    });

    try {
      const res = await fetch(`/api/ids/scm/warehouse-management/stock-transfer-serialize?${params.toString()}`, {
        cache: "no-store"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Serial lookup failed (${res.status})`,
          statusCode: res.status,
        };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        statusCode: 500,
      };
    }
  },

  /**
   * Verifies a serial number against dispatched items for receiving.
   * AG-COMMENT: Ticket 1 - Returns a structured result instead of throwing raw unhandled exceptions.
   */
  async lookupReceiveSerial(serialNumber: string, transferIds: number[]): Promise<SerialReceiveResult> {
    const params = new URLSearchParams({
      action: "verify_receive_serial",
      serial: serialNumber,
      transferIds: transferIds.join(","),
    });

    try {
      const res = await fetch(`/api/ids/scm/warehouse-management/stock-transfer-serialize?${params.toString()}`, {
        cache: "no-store"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Serial verification failed (${res.status})`,
          statusCode: res.status,
        };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        statusCode: 500,
      };
    }
  },

  /**
   * Updates transfer status and records serial tracking.
   */
  async submitStatusUpdate(payload: UpdateSerializeTransferValues): Promise<{ success: boolean }> {
    const res = await fetch("/api/ids/scm/warehouse-management/stock-transfer-serialize", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update status (${res.status})`);
    }

    return res.json();
  }
};
