import { NextResponse, NextRequest } from "next/server";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/error-handler";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;

/**
 * AG-COMMENT: Fetches on-hand serials directly from Spring Boot /api/v-serial-onhand/all.
 *
 * Filters applied:
 *  - branchId  = branchId (required)
 *  - productId = productId (optional; narrows to target SKU or parent SKU)
 *  - status    = 'Full' (only Full cylinders are valid for Stock OUT)
 *
 * Used exclusively by SerialPickerModal for Stock OUT serial picking.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawBranchId = searchParams.get("branchId");
    const rawProductId = searchParams.get("productId");

    const branchId = Number(rawBranchId);
    const productId = rawProductId ? Number(rawProductId) : undefined;

    if (!branchId || isNaN(branchId)) {
      return NextResponse.json({ error: "Missing or invalid branchId" }, { status: 400 });
    }

    if (!SPRING_API_BASE_URL) {
      throw new Error("Spring API configuration missing (SPRING_API_BASE_URL)");
    }

    const token = request.cookies.get("vos_access_token")?.value;

    const springUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/all`);
    springUrl.searchParams.set("branchId", String(branchId));
    if (productId && !isNaN(productId) && productId > 0) {
      springUrl.searchParams.set("productId", String(productId));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(springUrl.toString(), {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Spring Boot /api/v-serial-onhand/all returned status:", res.status, errText);
      return NextResponse.json(
        { error: `Spring API error (${res.status}): Failed to fetch on-hand serials` },
        { status: res.status }
      );
    }

    const rawData = await res.json();
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData?.v_serial_onhand)
          ? rawData.v_serial_onhand
          : Array.isArray(rawData?.content)
            ? rawData.content
            : [];

    interface RawSpringSerial {
      id?: number;
      serialNumber?: string;
      serial_number?: string;
      productId?: number | string;
      product_id?: number | string;
      parentId?: number | string;
      parent_id?: number | string;
      branchId?: number | string;
      branch_id?: number | string;
      status?: string;
    }

    // AG-COMMENT: Filter for status === 'Full' only and normalize fields for the picker UI
    const normalized = (list as RawSpringSerial[])
      .filter((item) => {
        const s = String(item.status || "Full").trim().toUpperCase();
        return s === "FULL" || s === ""; // Default to Full if status not explicitly Empty
      })
      .map((item, idx) => ({
        id: item.id || idx + 1,
        serial_number: String(item.serialNumber || item.serial_number || "").trim(),
        product_id: Number(item.productId || item.product_id || productId || 0),
        parent_id: item.parentId || item.parent_id ? Number(item.parentId || item.parent_id) : null,
        branch_id: Number(item.branchId || item.branch_id || branchId),
        status: "Full",
      }))
      .filter((item) => item.serial_number.length > 0);

    return NextResponse.json({ data: normalized });
  } catch (err) {
    return handleApiError(err);
  }
}
