import { NextResponse, NextRequest } from "next/server";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/error-handler";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;

/**
 * AG-COMMENT: Fetches on-hand serials directly from Spring Boot /api/v-serial-onhand/all (or /filter).
 *
 * vos_database.v_serial_onhand columns:
 *  - id (row_number)
 *  - product_id (SKU id, e.g. 25438 for empty variant)
 *  - parent_id (parent SKU id, coalesce(p.parent_id, rm.product_id), e.g. 25437)
 *  - branch_id (branch holding inventory)
 *  - serial_number (cylinder serial)
 *  - status (if(p.unit_of_measurement = 18, 'Empty', 'Full'))
 *
 * Filters supported:
 *  - branchId  = branchId (required)
 *  - productId = productId (optional; matched against product_id OR parent_id)
 *  - status    = 'FULL' | 'EMPTY' | 'ALL' (optional; filters by cylinder condition)
 *
 * Used by SerialPickerModal for Stock OUT serial picking.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawBranchId = searchParams.get("branchId");
    const rawProductId = searchParams.get("productId");
    const rawStatus = searchParams.get("status")?.trim().toUpperCase();

    const branchId = Number(rawBranchId);
    const productId = rawProductId ? Number(rawProductId) : undefined;

    if (!branchId || isNaN(branchId)) {
      return NextResponse.json({ error: "Missing or invalid branchId" }, { status: 400 });
    }

    if (!SPRING_API_BASE_URL) {
      throw new Error("Spring API configuration missing (SPRING_API_BASE_URL)");
    }

    // AG-COMMENT: Retrieve auth token with multi-source fallback (cookie vos_access_token, springboot_token, or Authorization header)
    const token =
      request.cookies.get("vos_access_token")?.value ||
      request.cookies.get("springboot_token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token. Please log in again." },
        { status: 401 }
      );
    }

    // AG-COMMENT: Attach both Authorization Bearer and Cookie headers required by Spring Boot security filters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Cookie": `vos_access_token=${token}`,
    };

    // Try /api/v-serial-onhand/filter first with branchId and productId, fall back to /all
    let list: unknown[] = [];
    let springRes: Response | null = null;

    try {
      const filterUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`);
      filterUrl.searchParams.set("branchId", String(branchId));
      if (productId && !isNaN(productId) && productId > 0) {
        filterUrl.searchParams.set("productId", String(productId));
      }

      springRes = await fetch(filterUrl.toString(), {
        headers,
        cache: "no-store",
      });

      if (springRes.ok) {
        const raw = await springRes.json();
        list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.v_serial_onhand)
              ? raw.v_serial_onhand
              : Array.isArray(raw?.content)
                ? raw.content
                : [];
      }
    } catch (e) {
      console.warn("Spring Boot filter endpoint failed, falling back to /all:", e);
    }

    // Fallback to /all endpoint if filter did not succeed or returned non-ok status
    if (!springRes || !springRes.ok || list.length === 0) {
      const allUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/all`);
      allUrl.searchParams.set("branchId", String(branchId));
      if (productId && !isNaN(productId) && productId > 0) {
        allUrl.searchParams.set("productId", String(productId));
      }

      const allRes = await fetch(allUrl.toString(), {
        headers,
        cache: "no-store",
      });

      if (!allRes.ok) {
        const errText = await allRes.text().catch(() => "");
        console.error("Spring Boot /api/v-serial-onhand/all returned status:", allRes.status, errText);
        
        // AG-COMMENT: Standardize 401 response so client-side modal can initiate silent token refresh
        if (allRes.status === 401) {
          return NextResponse.json(
            { 
              error: "SESSION_EXPIRED",
              message: "Your session has expired. Re-authenticating..."
            },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: `Spring API error (${allRes.status}): Failed to fetch on-hand serials` },
          { status: allRes.status }
        );
      }

      const rawData = await allRes.json();
      list = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
          ? rawData.data
          : Array.isArray(rawData?.v_serial_onhand)
            ? rawData.v_serial_onhand
            : Array.isArray(rawData?.content)
              ? rawData.content
              : [];
    }

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

    // AG-COMMENT: Scope results strictly to the requested branch, match product_id OR parent_id,
    // and filter by the requested cylinder status (FULL vs EMPTY).
    const normalized = (list as RawSpringSerial[])
      .filter((item) => {
        // 1. Branch scoping
        const bId = Number(item.branch_id || item.branchId);
        if (bId && bId !== branchId) return false;

        // 2. Product ID / Parent ID scoping (matches specific variant or parent cylinder SKU)
        if (productId && !isNaN(productId) && productId > 0) {
          const itemProdId = Number(item.product_id || item.productId);
          const itemParentId = item.parent_id || item.parentId ? Number(item.parent_id || item.parentId) : null;
          const matchesProduct = itemProdId === productId || (itemParentId !== null && itemParentId === productId);
          if (!matchesProduct) return false;
        }

        // 3. Status filter ('Full' vs 'Empty')
        const itemStatus = String(item.status || "Full").trim().toUpperCase();
        if (rawStatus && rawStatus !== "ALL") {
          return itemStatus === rawStatus;
        }

        return true;
      })
      .map((item, idx) => ({
        id: item.id || idx + 1,
        serial_number: String(item.serialNumber || item.serial_number || "").trim(),
        product_id: Number(item.productId || item.product_id || productId || 0),
        parent_id: item.parentId || item.parent_id ? Number(item.parentId || item.parent_id) : null,
        branch_id: Number(item.branchId || item.branch_id || branchId),
        status: String(item.status || "Full").trim(), // Preserve exact status from v_serial_onhand
      }))
      .filter((item) => item.serial_number.length > 0);

    return NextResponse.json({ data: normalized });
  } catch (err) {
    return handleApiError(err);
  }
}
