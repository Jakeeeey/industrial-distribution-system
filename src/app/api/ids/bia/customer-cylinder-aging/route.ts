// src/app/api/ids/bia/customer-cylinder-aging/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF (Backend-for-Frontend) proxy for the Spring Boot Customer Cylinder Aging endpoint.
// Auth pattern: req.cookies.get() + sends BOTH Authorization: Bearer AND Cookie header.
// This dual-header approach matches all other working Spring routes in this project.
// Mirrors: src/app/api/ids/scm/inventory-management/physical-inventory/running-inventory/route.ts
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

/**
 * GET /api/ids/bia/customer-cylinder-aging
 *
 * Supported query params forwarded to Spring:
 *   - productId    (integer)
 *   - customerCode (string)
 *   - startDate    (YYYY-MM-DD)
 *   - endDate      (YYYY-MM-DD)
 *
 * Auth: reads vos_access_token from NextRequest cookies.
 * Sends both Authorization: Bearer <token> AND Cookie: vos_access_token=<token>
 * to Spring — required because Spring may validate via either mechanism.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Read token directly from NextRequest (standard working pattern) ───────
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized: Missing access token" },
      { status: 401 }
    );
  }

  if (!SPRING_API_BASE_URL) {
    return NextResponse.json(
      { ok: false, message: "SPRING_API_BASE_URL is not configured." },
      { status: 500 }
    );
  }

  // ── 2. Build Spring target URL with forwarded query params ───────────────────
  const targetUrl = new URL(
    `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-customer-cylinder-aging-master/filter`
  );

  const forwarded = ["productId", "customerCode", "startDate", "endDate"];
  for (const key of forwarded) {
    const val = req.nextUrl.searchParams.get(key);
    if (val !== null && val.trim() !== "") {
      targetUrl.searchParams.set(key, val);
    }
  }

  // ── 3. Proxy to Spring with both auth headers ────────────────────────────────
  try {
    const springRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `${COOKIE_NAME}=${token}`,   // Spring may also read via cookie
        Accept: "application/json",
      },
      cache: "no-store",
    });

    // Pass through Spring's status and body verbatim
    const contentType = springRes.headers.get("content-type") ?? "application/json";
    const text = await springRes.text();

    if (!springRes.ok) {
      console.error(`[BFF:CylinderAging] Spring error ${springRes.status}:`, text);
    }

    return new NextResponse(text, {
      status: springRes.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[BFF:CylinderAging] Fetch error:", detail);
    return NextResponse.json(
      { ok: false, message: "BFF Error", detail },
      { status: 502 }
    );
  }
}
