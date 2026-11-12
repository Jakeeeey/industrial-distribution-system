import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  pickTokenFromPayload,
  getCookieOptions,
} from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE = (process.env.SPRING_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * Normalized shape expected by the Inventory Control frontend (SerialOnhandRecord).
 */
interface NormalizedSerialRecord {
  id: number;
  productId: number;
  parentId: number;
  branchId: number;
  serialNumber: string;
  status: string;
  cylinderStatus?: string;
  cylinderCondition?: string;
  currentBranchId?: number;
  currentCustomerCode?: string | null;
  acquisitionDate?: string | null;
}

/**
 * Extracts raw array of records from various Spring Boot / Directus response envelopes.
 */
function extractRecordList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object",
    );
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidates = [obj.data, obj.v_serial_onhand, obj.content];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is Record<string, unknown> =>
            item !== null && typeof item === "object",
        );
      }
    }
    if ("serialNumber" in obj || "serial_number" in obj) {
      return [obj];
    }
  }
  return [];
}

/**
 * Normalizes raw snake_case or camelCase serial records from Spring Boot or Directus
 * into the camelCase SerialOnhandRecord format required by Inventory Control.
 */
function normalizeSerialRecords(
  rawList: Record<string, unknown>[],
  fallbackBranchId?: string | null,
): NormalizedSerialRecord[] {
  const normalized: NormalizedSerialRecord[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const row = rawList[i];

    // Skip soft-deleted records if coming from cylinder_assets
    if (row.is_deleted === 1 || row.is_deleted === true) continue;

    const serialNumber = String(
      row.serialNumber ?? row.serial_number ?? "",
    ).trim();
    if (!serialNumber) continue;

    // Extract productId and optional nested product metadata (when expanded from Directus)
    let productId = 0;
    let nestedParentId = 0;
    let nestedUomIds = "";

    const rawProduct = row.productId ?? row.product_id;
    if (rawProduct && typeof rawProduct === "object") {
      const prodObj = rawProduct as Record<string, unknown>;
      productId = Number(prodObj.product_id ?? prodObj.id ?? 0);
      nestedParentId = Number(prodObj.parent_id ?? prodObj.parentId ?? 0);
      nestedUomIds = String(prodObj.uom_ids ?? prodObj.uomIds ?? "").trim();
    } else {
      productId = Number(rawProduct ?? 0);
    }

    const parentId = Number(
      row.parentId ?? row.parent_id ?? (nestedParentId || 0),
    );

    // Extract branchId / currentBranchId
    let branchId = 0;
    const rawBranch =
      row.branchId ??
      row.branch_id ??
      row.currentBranchId ??
      row.current_branch_id;
    if (rawBranch && typeof rawBranch === "object") {
      const branchObj = rawBranch as Record<string, unknown>;
      branchId = Number(branchObj.id ?? branchObj.branch_id ?? 0);
    } else {
      branchId = Number(rawBranch ?? fallbackBranchId ?? 0);
    }

    const cylinderStatus =
      typeof (row.cylinderStatus ?? row.cylinder_status) === "string"
        ? String(row.cylinderStatus ?? row.cylinder_status).trim()
        : undefined;

    const cylinderCondition =
      typeof (row.cylinderCondition ?? row.cylinder_condition) === "string"
        ? String(row.cylinderCondition ?? row.cylinder_condition).trim()
        : undefined;

    // Resolve Full vs Empty status
    let status = typeof row.status === "string" ? row.status.trim() : "";
    if (!status) {
      const cylUpper = (cylinderStatus || "").toUpperCase();
      const uomUpper = nestedUomIds.toUpperCase();
      status =
        cylUpper === "EMPTY" || uomUpper === "EMPTY" ? "Empty" : "Full";
    }

    const currentBranchId = Number(
      row.currentBranchId ??
        (typeof row.current_branch_id === "object" && row.current_branch_id
          ? (row.current_branch_id as Record<string, unknown>).id
          : row.current_branch_id) ??
        branchId,
    );

    const rawCustCode = row.currentCustomerCode ?? row.current_customer_code;
    const currentCustomerCode =
      typeof rawCustCode === "string" ? rawCustCode : null;

    const rawAcqDate = row.acquisitionDate ?? row.acquisition_date;
    const acquisitionDate =
      typeof rawAcqDate === "string" ? rawAcqDate : null;

    normalized.push({
      id: Number(row.id ?? i + 1),
      productId,
      parentId: Number.isFinite(parentId) ? parentId : 0,
      branchId: Number.isFinite(branchId) ? branchId : 0,
      serialNumber,
      status,
      ...(cylinderStatus ? { cylinderStatus } : {}),
      ...(cylinderCondition ? { cylinderCondition } : {}),
      ...(Number.isFinite(currentBranchId) && currentBranchId > 0
        ? { currentBranchId }
        : {}),
      currentCustomerCode,
      acquisitionDate,
    });
  }

  return normalized;
}

/**
 * Attempts to refresh the Spring Boot access token using the refreshToken cookie.
 */
async function tryRefreshSpringToken(
  req: NextRequest,
): Promise<string | null> {
  if (!SPRING_API_BASE) return null;
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) return null;

  try {
    const refreshRes = await fetch(`${SPRING_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!refreshRes.ok) return null;
    const payload = (await refreshRes.json().catch(() => null)) as
      | Record<string, unknown>
      | string
      | null;
    return pickTokenFromPayload(payload);
  } catch {
    return null;
  }
}

/**
 * Fallback helper: Queries Directus `v_serial_onhand` (or `cylinder_assets` if view is unavailable)
 * when Spring Boot returns 401/403 or is unreachable.
 */
async function fetchSerialOnhandFromDirectus(
  branchId: string | null,
  productId: string | null,
): Promise<NormalizedSerialRecord[] | null> {
  if (!DIRECTUS_BASE) return null;
  const headers = getDirectusHeaders();

  // 1. Try Directus `v_serial_onhand` view collection first
  try {
    const sohUrl = new URL(`${DIRECTUS_BASE}/items/v_serial_onhand`);
    sohUrl.searchParams.set("limit", "-1");
    if (branchId) {
      sohUrl.searchParams.set("filter[branch_id][_eq]", branchId);
    }
    if (productId) {
      sohUrl.searchParams.set("filter[product_id][_eq]", productId);
    }

    const sohRes = await fetch(sohUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (sohRes.ok) {
      const json = (await sohRes.json().catch(() => null)) as unknown;
      const list = extractRecordList(json);
      return normalizeSerialRecords(list, branchId);
    }
  } catch (err) {
    console.warn("[Inventory Control] Directus v_serial_onhand fallback error:", err);
  }

  // 2. Fallback to Directus `cylinder_assets` collection for on-hand cylinders at the branch
  try {
    const caUrl = new URL(`${DIRECTUS_BASE}/items/cylinder_assets`);
    caUrl.searchParams.set("limit", "-1");
    caUrl.searchParams.set(
      "fields",
      "id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,acquisition_date,is_deleted,product_id.product_id,product_id.parent_id,product_id.uom_ids",
    );
    caUrl.searchParams.set(
      "filter[cylinder_status][_in]",
      "AVAILABLE,FULL,EMPTY",
    );
    if (branchId) {
      caUrl.searchParams.set("filter[current_branch_id][_eq]", branchId);
    }
    if (productId) {
      caUrl.searchParams.set("filter[product_id][_eq]", productId);
    }

    const caRes = await fetch(caUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (caRes.ok) {
      const json = (await caRes.json().catch(() => null)) as unknown;
      const list = extractRecordList(json);
      return normalizeSerialRecords(list, branchId);
    }
  } catch (err) {
    console.warn("[Inventory Control] Directus cylinder_assets fallback error:", err);
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    let token =
      req.headers.get("authorization")?.replace("Bearer ", "").trim() ||
      req.cookies.get(COOKIE_NAME)?.value ||
      req.cookies.get("springboot_token")?.value;

    const { searchParams } = new URL(req.url);

    // If the frontend requested a Directus collection proxy, forward to Directus
    // using the configured NEXT_PUBLIC_API_BASE_URL. Use the `directusCollection`
    // query parameter to indicate which collection to fetch and forward any
    // additional query params (fields, limit, etc.). Do not require the
    // SPRING API token for directus proxying.
    const directusCollection = searchParams.get("directusCollection");
    if (directusCollection) {
      if (!DIRECTUS_BASE) {
        return NextResponse.json(
          { error: "DIRECTUS base URL not configured" },
          { status: 500 },
        );
      }

      // Build target URL with remaining search params except `directusCollection`
      // Use the string form to construct a new URLSearchParams (avoids `any` casting)
      const proxyParams = new URLSearchParams(searchParams.toString());
      proxyParams.delete("directusCollection");
      const target = `${DIRECTUS_BASE}/items/${encodeURIComponent(
        directusCollection,
      )}${proxyParams.toString() ? `?${proxyParams.toString()}` : ""}`;

      const headers = getDirectusHeaders();

      const res = await fetch(target, { method: "GET", headers });

      // If Directus returns 401, provide a clearer error so frontend can
      // surface a helpful message to developers/admins (invalid static token).
      if (res.status === 401) {
        const txt = await res.text().catch(() => "");
        let msg = "Directus authentication failed";
        try {
          const parsed = txt ? JSON.parse(txt) : null;
          if (parsed && typeof parsed === "object") {
            const p = parsed as Record<string, unknown>;
            if (typeof p.message === "string") {
              msg = `Directus authentication failed: ${p.message}`;
            } else if (typeof p.error === "string") {
              msg = `Directus authentication failed: ${p.error}`;
            } else if (txt) {
              msg = `Directus authentication failed: ${txt}`;
            }
          } else if (txt) {
            msg = `Directus authentication failed: ${txt}`;
          }
        } catch {
          if (txt) msg = `Directus authentication failed: ${txt}`;
        }
        console.error(msg);
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      // If Directus returns 403, this usually means the static token does not
      // have permission to access the requested collection. Return a clear
      // message so the frontend can surface actionable guidance.
      if (res.status === 403) {
        console.error(
          "Directus returned 403 for collection:",
          directusCollection,
        );
        return NextResponse.json(
          {
            error:
              "Directus returned 403 Forbidden. Check that DIRECTUS_STATIC_TOKEN is valid and has read permissions for the collection.",
          },
          { status: 502 },
        );
      }

      const text = await res.text();
      const contentType = res.headers.get("content-type") || "application/json";
      const respHeaders: Record<string, string> = {
        "content-type": contentType,
      };
      return new NextResponse(text, {
        status: res.status,
        headers: respHeaders,
      });
    }

    const branchId = searchParams.get("branchId");
    const productId = searchParams.get("productId");

    // Attempt to refresh token if missing before hitting Spring Boot
    let refreshedToken: string | null = null;
    if (!token) {
      refreshedToken = await tryRefreshSpringToken(req);
      if (refreshedToken) {
        token = refreshedToken;
      }
    }

    // Query Spring Boot if configured
    if (SPRING_API_BASE) {
      const springEndpoints = [
        `${SPRING_API_BASE}/api/v-serial-onhand/filter`,
        `${SPRING_API_BASE}/api/v-serial-onhand/all`,
      ];

      const fetchSpringEndpoint = async (
        endpoint: string,
        bearerToken?: string,
      ): Promise<Response | null> => {
        const url = new URL(endpoint);
        if (branchId) url.searchParams.set("branchId", branchId);
        if (productId) url.searchParams.set("productId", productId);

        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (bearerToken) {
          headers["Authorization"] = `Bearer ${bearerToken}`;
          headers["Cookie"] = `${COOKIE_NAME}=${bearerToken}`;
        }

        try {
          return await fetch(url.toString(), {
            method: "GET",
            headers,
            cache: "no-store",
          });
        } catch (err) {
          console.warn(`[Inventory Control] Spring fetch failed for ${endpoint}:`, err);
          return null;
        }
      };

      let springResponse: Response | null = null;

      // 1. Try primary filter endpoint with current token (if present)
      if (token) {
        springResponse = await fetchSpringEndpoint(springEndpoints[0], token);

        // 2. If 401/403 (expired/invalid token), attempt token refresh and retry
        if (
          springResponse &&
          (springResponse.status === 401 || springResponse.status === 403)
        ) {
          const newToken = await tryRefreshSpringToken(req);
          if (newToken && newToken !== token) {
            refreshedToken = newToken;
            token = newToken;
            springResponse = await fetchSpringEndpoint(
              springEndpoints[0],
              token,
            );
          }
        }
      }

      // 3. If still not ok (or no token was present, or expired token caused JwtAuthenticationFilter 401),
      // retry Spring endpoints without Authorization header in case anonymous read is permitted
      if (!springResponse || !springResponse.ok) {
        for (const endpoint of springEndpoints) {
          const unauthRes = await fetchSpringEndpoint(endpoint, undefined);
          if (unauthRes && unauthRes.ok) {
            springResponse = unauthRes;
            break;
          }
          // Also try `/all` with token if `/filter` failed with non-auth error
          if (token && (!springResponse || (springResponse.status !== 401 && springResponse.status !== 403))) {
            const authFallbackRes = await fetchSpringEndpoint(endpoint, token);
            if (authFallbackRes && authFallbackRes.ok) {
              springResponse = authFallbackRes;
              break;
            }
          }
        }
      }

      if (springResponse && springResponse.ok) {
        const text = await springResponse.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : [];
        } catch {
          data = [];
        }

        const rawList = extractRecordList(data);
        const records = normalizeSerialRecords(rawList, branchId);
        const res = NextResponse.json(records);

        // Persist refreshed access token cookie if a refresh occurred during this request
        if (refreshedToken) {
          res.cookies.set({
            name: COOKIE_NAME,
            value: refreshedToken,
            ...getCookieOptions(true, "/"),
          });
        }
        return res;
      }
    }

    // 4. Fallback to Directus (`v_serial_onhand` / `cylinder_assets`) when Spring Boot returns 401/error
    const directusRecords = await fetchSerialOnhandFromDirectus(
      branchId,
      productId,
    );
    if (directusRecords !== null) {
      const res = NextResponse.json(directusRecords);
      if (refreshedToken) {
        res.cookies.set({
          name: COOKIE_NAME,
          value: refreshedToken,
          ...getCookieOptions(true, "/"),
        });
      }
      return res;
    }

    return NextResponse.json(
      { error: "Failed to fetch serial on-hand data" },
      { status: 502 },
    );
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Inventory Control API Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
