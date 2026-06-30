/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/ids/bia/rto-operation/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF route: GET /api/ids/bia/rto-operation
//
// Data strategy:
//   Step 1: Fetch movement rows from Spring Boot /api/views/rto-operation
//           Each row = one serial number per movement event
//           movementDirection = "OUT" (full delivered) | "IN" (empty returned)
//
//   Step 2: Aggregate into per-customerCode groups:
//           - fullsDelivered  = sum of outQty where direction = "OUT"
//           - emptiesReturned = sum of inQty where direction = "IN"
//           - missingTanks    = fullsDelivered - emptiesReturned
//           - activeCylinderSerials = unique serial numbers appearing in OUT movements
//
//   Step 3: Enrich with Directus `customer` metadata (name, address, contact, etc.)
//
//   Step 4: Fetch assigned salesmen from Directus `customer_salesmen`
//
//   Step 5: Fetch cylinder unit costs from Directus `cylinder_assets`
//           to compute financialExposure = missingTanks × avgUnitCost
//
//   Step 6: Fetch unpaid balance from Directus `sales_invoice`
//           (filter: customer_code IN [...], payment_status = "Unpaid", isReplaced = false)
//
// Returns: RTODealerRecord[] — one entry per dealer customer code
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import type {
  RTODealerRecord,
  RTOAgent,
  MissingStatus,
  BalanceStatus,
} from "@/modules/industrial-distribution-system/bia/rto-operation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Directus helpers ──────────────────────────────────────────────────────────

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) throw new Error("Directus base URL is not configured.");
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusToken(): string {
  return (
    process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || ""
  ).trim();
}

function directusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: directusHeaders(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json?.errors as Array<{ message: string }> | undefined;
    const msg =
      errors?.[0]?.message ||
      `Directus ${res.status} ${res.statusText}: ${url}`;
    throw new Error(msg);
  }
  return json as T;
}

interface DirectusListResponse<T> {
  data: T[];
}

/** Splits array into fixed-size chunks to avoid huge URL query strings. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Classification helpers ────────────────────────────────────────────────────

function mapPriceTypeName(name: string | null | undefined): string {
  if (!name) return "";
  const upper = name.trim().toUpperCase();
  if (upper === "A" || upper === "PRICE A" || upper === "TIER A")
    return "A - Dealer";
  if (upper === "B" || upper === "PRICE B" || upper === "TIER B")
    return "B - Sub-Dealer";
  if (upper === "C" || upper === "PRICE C" || upper === "TIER C")
    return "C - RTO";
  if (upper === "D" || upper === "PRICE D" || upper === "TIER D")
    return "D - Commercial";
  if (upper === "E" || upper === "PRICE E" || upper === "TIER E")
    return "E - Walk-in";
  return name.trim();
}

// ── Risk computation ──────────────────────────────────────────────────────────

function computeMissingStatus(missing: number): MissingStatus {
  if (missing > 100) return "critical";
  if (missing > 50) return "warning";
  return "normal";
}

function computeBalanceStatus(balance: number): BalanceStatus {
  if (balance <= 0) return "paid";
  if (balance < 100_000) return "low";
  return "high";
}

function coalesceNum(
  ...vals: (number | string | null | undefined)[]
): number {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== "") {
      const n = Number(v);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function toDateStr(dt: string | null | undefined): string | null {
  if (!dt) return null;
  return dt.split(/[ T]/)[0];
}

// ── Spring Boot response row shape ────────────────────────────────────────────

/**
 * One movement row returned by /api/views/rto-operation.
 * Each row represents a single serial number in a single movement event.
 */
interface RTOMovementRow {
  id: string;
  movementDatetime: string | null;
  customerCode: string | null;
  customerName: string | null;
  productId: number | null;
  productName: string | null;
  serialNumber: string | null;
  branchId: number | null;
  sourceId: number | null;
  docNo: string | null;
  docType: string | null;
  movementDirection: "IN" | "OUT" | string;
  inQty: number;
  outQty: number;
  movementQty: number;
  documentStatus: string | null;
  linkedSalesInvoiceId: number | null;
  dispatchPlanId: number | null;
  vehicleId: number | null;
  driverId: number | null;
  deliveryDate: string | null;
}

// ── Directus raw shapes ───────────────────────────────────────────────────────

interface DirectusCustomer {
  id: number | string;
  customer_code: string | null;
  customer_name: string | null;
  store_name: string | null;
  contact_number: string | null;
  customer_email: string | null;
  brgy: string | null;
  city: string | null;
  province: string | null;
  date_entered?: string | null;
  price_type?: string | null;
  price_type_id?:
    | number
    | { price_type_id: number; price_type_name: string | null }
    | null;
}

interface DirectusSalesInvoice {
  invoice_id: number;
  customer_code: string | null;
  net_amount: number | string | null;
  total_amount: number | string | null;
  payment_status: string | null;
  isReplaced: boolean | number | { data: number[] } | null;
}

// ── Grouping accumulator ──────────────────────────────────────────────────────

interface GroupedDealer {
  customerCode: string;
  customerName: string | null;
  branchId: number | null;
  fullsDelivered: number;     // sum outQty where direction = OUT
  emptiesReturned: number;    // sum inQty where direction = IN
  serialsOut: Set<string>;    // unique serials from OUT movements (currently with dealer)
  serialsIn: Set<string>;     // unique serials from IN movements (returned from dealer)
  lastDeliveryDate: string | null;
}

// ── Main GET handler ──────────────────────────────────────────────────────────

/**
 * GET /api/ids/bia/rto-operation
 *
 * Optional query params:
 *   branchId      - filter by branch (integer) — applied after aggregation
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth token check ────────────────────────────────────────────────────
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.cookies.get("vos_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: no token provided" },
        { status: 401 }
      );
    }

    const SPRING_API_BASE = process.env.SPRING_API_BASE_URL;
    if (!SPRING_API_BASE) {
      return NextResponse.json(
        { error: "Spring API base URL is not configured" },
        { status: 500 }
      );
    }

    const base = getDirectusBase();
    const { searchParams } = new URL(req.url);
    const requestedCustomerCode = searchParams.get("customerCode")?.trim();

    // ── Step 1: Fetch Directus customer metadata first ─────────────────────
    const customerFields = [
      "id",
      "customer_code",
      "customer_name",
      "store_name",
      "contact_number",
      "customer_email",
      "brgy",
      "city",
      "province",
      "date_entered",
      "price_type",
      "price_type_id.price_type_name",
    ].join(",");

    let custUrl = `${base}/items/customer?limit=-1&fields=${encodeURIComponent(
      customerFields
    )}`;
    if (requestedCustomerCode) {
      custUrl += `&filter[customer_code][_eq]=${encodeURIComponent(
        requestedCustomerCode
      )}`;
    }

    const custJson = await fetchJson<DirectusListResponse<DirectusCustomer>>(
      custUrl
    ).catch(() => null);
    const allCustomers = custJson?.data || [];

    // Filter relevant dealers: price classifications A, B, C (Dealer, Sub-Dealer, RTO)
    const dealerCustomers = requestedCustomerCode
      ? allCustomers // Bypass filter if a specific code was requested to let it load
      : allCustomers.filter((c) => {
          const ptName = (c.price_type_id as any)?.price_type_name || c.price_type;
          if (!ptName) return false;
          const mapped = mapPriceTypeName(ptName);
          return (
            mapped.startsWith("A -") ||
            mapped.startsWith("B -") ||
            mapped.startsWith("C -")
          );
        });

    const customersMap = new Map<string, DirectusCustomer>();
    for (const cust of dealerCustomers) {
      if (cust.customer_code) {
        customersMap.set(cust.customer_code.trim(), cust);
      }
    }

    const dealerCodes = Array.from(customersMap.keys());
    if (dealerCodes.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // ── Step 2: Fetch all movement rows from Spring Boot ────────────────────
    const springUrl = `${SPRING_API_BASE}/api/v-rto-operation/all`;
    const springRes = await fetch(springUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `vos_access_token=${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const springText = await springRes.text();
    if (!springRes.ok) {
      console.error(
        `[BFF:RTOOperation] Spring Boot returned ${springRes.status}:`,
        springText
      );
      return NextResponse.json(
        { error: "Backend request failed" },
        { status: springRes.status }
      );
    }

    let springData: any = null;
    try {
      springData = springText ? JSON.parse(springText) : null;
    } catch {
      return NextResponse.json(
        {
          error: "Unexpected non-JSON response from Spring Boot View API",
        },
        { status: 502 }
      );
    }

    let rows: RTOMovementRow[] = [];
    if (Array.isArray(springData)) {
      rows = springData as RTOMovementRow[];
    } else if (springData && typeof springData === "object") {
      const d = (springData as Record<string, unknown>).data;
      if (Array.isArray(d)) {
        rows = d as RTOMovementRow[];
      }
    }

    // Filter by customer code if requested
    if (requestedCustomerCode) {
      const normRequested = requestedCustomerCode.toLowerCase();
      rows = rows.filter((r) => r.customerCode?.toLowerCase() === normRequested);
    }

    // ── Step 3: Aggregate movement rows into per-customerCode groups ────────
    const groupedMap = new Map<string, GroupedDealer>();

    for (const r of rows) {
      const code = (r.customerCode || "").trim();
      if (!code) continue;

      const serial = r.serialNumber ? r.serialNumber.trim() : null;
      const direction = (r.movementDirection || "").toUpperCase();

      let existing = groupedMap.get(code);
      if (!existing) {
        existing = {
          customerCode: code,
          customerName: r.customerName ?? null,
          branchId: r.branchId ?? null,
          fullsDelivered: 0,
          emptiesReturned: 0,
          serialsOut: new Set<string>(),
          serialsIn: new Set<string>(),
          lastDeliveryDate: null,
        };
        groupedMap.set(code, existing);
      }

      if (direction === "OUT") {
        existing.fullsDelivered += coalesceNum(r.outQty, r.movementQty, 1);
        if (serial) existing.serialsOut.add(serial);
        if (r.deliveryDate || r.movementDatetime) {
          const d = toDateStr(r.deliveryDate || r.movementDatetime);
          if (d && (!existing.lastDeliveryDate || d > existing.lastDeliveryDate)) {
            existing.lastDeliveryDate = d;
          }
        }
      } else if (direction === "IN") {
        existing.emptiesReturned += coalesceNum(r.inQty, r.movementQty, 1);
        if (serial) existing.serialsIn.add(serial);
      }
    }

    // ── Step 4: Fetch assigned salesmen (network) per dealer ────────────────
    const customerIds = Array.from(customersMap.values()).map((c) =>
      String(c.id)
    );
    const agentsByCustomerId = new Map<string, RTOAgent[]>();

    if (customerIds.length > 0) {
      for (const chunkIds of chunk(customerIds, 100)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const csUrl =
          `${base}/items/customer_salesmen?limit=-1` +
          `&filter[customer_id][_in]=${encoded}` +
          `&fields=id,customer_id,salesman_id.id,salesman_id.salesman_name,salesman_id.salesman_code`;
        const csJson = await fetchJson<DirectusListResponse<any>>(
          csUrl
        ).catch(() => null);
        if (csJson?.data) {
          for (const cs of csJson.data) {
            const custId = String(cs.customer_id);
            if (!agentsByCustomerId.has(custId)) {
              agentsByCustomerId.set(custId, []);
            }
            const sm = cs.salesman_id;
            if (sm && typeof sm === "object") {
              const agent: RTOAgent = {
                id: String(sm.id),
                name: sm.salesman_name || "Unknown Agent",
                code: sm.salesman_code ?? null,
                barangay: null,
              };
              agentsByCustomerId.get(custId)!.push(agent);
            }
          }
        }
      }
    }

    // ── Step 5: Fetch cylinder asset costs for financial exposure ────────────
    // Collect all unique serial numbers from BOTH OUT and IN movements to look up details/cost
    const allSerials = Array.from(
      new Set(
        Array.from(groupedMap.values()).flatMap((g) => [
          ...Array.from(g.serialsOut),
          ...Array.from(g.serialsIn),
        ])
      )
    );

    // Map: serial → details (cost, branchId, branchName, branchCode)
    const cylinderAssetsMap = new Map<
      string,
      {
        cost: number;
        branchId: number | null;
        branchName: string | null;
        branchCode: string | null;
      }
    >();

    if (allSerials.length > 0) {
      for (const chunkSerials of chunk(allSerials, 100)) {
        const encoded = encodeURIComponent(chunkSerials.join(","));
        const cyUrl =
          `${base}/items/cylinder_assets?limit=-1` +
          `&filter[serial_number][_in]=${encoded}` +
          `&fields=serial_number,cost,current_branch_id.id,current_branch_id.branch_name,current_branch_id.branch_code`;
        const cyJson = await fetchJson<DirectusListResponse<any>>(
          cyUrl
        ).catch(() => null);
        if (cyJson?.data) {
          for (const cy of cyJson.data) {
            if (cy.serial_number) {
              const cost = coalesceNum(cy.cost);
              let branchId: number | null = null;
              let branchName: string | null = null;
              let branchCode: string | null = null;

              if (cy.current_branch_id && typeof cy.current_branch_id === "object") {
                branchId = cy.current_branch_id.id ?? null;
                branchName = cy.current_branch_id.branch_name ?? null;
                branchCode = cy.current_branch_id.branch_code ?? null;
              }

              cylinderAssetsMap.set(cy.serial_number, {
                cost,
                branchId,
                branchName,
                branchCode,
              });
            }
          }
        }
      }
    }

    // ── Step 6: Fetch unpaid balance from Directus sales_invoice ────────────
    //
    // payment_status = "Unpaid" (as specified in schema and user note)
    // isReplaced = false (exclude replaced invoices)
    // Sum net_amount (or total_amount as fallback) per customer_code
    //
    const unpaidBalanceByCode = new Map<string, number>();

    for (const chunkCodes of chunk(dealerCodes, 100)) {
      const encoded = encodeURIComponent(chunkCodes.join(","));
      const siUrl =
        `${base}/items/sales_invoice?limit=-1` +
        `&filter[customer_code][_in]=${encoded}` +
        `&filter[payment_status][_eq]=Unpaid` +
        `&filter[isReplaced][_eq]=false` +
        `&fields=invoice_id,customer_code,net_amount,total_amount,payment_status,isReplaced`;
      const siJson = await fetchJson<
        DirectusListResponse<DirectusSalesInvoice>
      >(siUrl).catch(() => null);

      if (siJson?.data) {
        for (const inv of siJson.data) {
          const code = inv.customer_code?.trim();
          if (!code) continue;
          // Skip replaced invoices (extra guard)
          const replaced = inv.isReplaced;
          const isReplaced =
            replaced === true ||
            replaced === 1 ||
            (Array.isArray((replaced as any)?.data) &&
              ((replaced as any).data as number[])[0] === 1);
          if (isReplaced) continue;

          const amount = coalesceNum(inv.net_amount, inv.total_amount);
          unpaidBalanceByCode.set(
            code,
            (unpaidBalanceByCode.get(code) ?? 0) + amount
          );
        }
      }
    }

    // ── Step 7: Build RTODealerRecord[] ──────────────────────────────────────
    const records: RTODealerRecord[] = Array.from(groupedMap.values()).map(
      (g) => {
        const code = g.customerCode;
        const cust = customersMap.get(code);

        // Customer meta
        const custId = cust ? String(cust.id) : "";
        const customerName = g.customerName || cust?.customer_name || null;
        const storeName = cust?.store_name ?? null;
        const contactNumber = cust?.contact_number ?? null;
        const customerEmail = cust?.customer_email ?? null;
        const addressParts = cust
          ? [cust.brgy, cust.city, cust.province].filter(Boolean).join(", ")
          : "";
        const customerAddress = addressParts || null;
        const createdAt = cust ? toDateStr(cust.date_entered) : null;

        // Classification from price_type
        const ptName = cust
          ? (cust.price_type_id as any)?.price_type_name || cust.price_type
          : null;
        const classification = ptName ? mapPriceTypeName(ptName) : "C - RTO";

        // Branch — use branchId from movement rows (more reliable than cylinder lookup), fallback to cylinder assets
        let branchId = g.branchId;
        let branchName: string | null = null;
        let branchCode: string | null = null;

        // Resolve branch details from mapped cylinder assets if not present
        for (const serial of g.serialsOut) {
          const cy = cylinderAssetsMap.get(serial);
          if (cy) {
            if (!branchId && cy.branchId) {
              branchId = cy.branchId;
            }
            if (cy.branchName && !branchName) {
              branchName = cy.branchName;
            }
            if (cy.branchCode && !branchCode) {
              branchCode = cy.branchCode;
            }
          }
        }

        // Assigned agents (salesman network)
        const assignedAgents = custId
          ? (agentsByCustomerId.get(custId) ?? [])
          : [];

        // Cylinder accounting
        const fullsDelivered = g.fullsDelivered;
        const emptiesReturned = g.emptiesReturned;
        const missingTanks = Math.max(0, fullsDelivered - emptiesReturned);
        const tempMissingStatus = computeMissingStatus(missingTanks);

        // Unpaid balance from sales_invoice (payment_status = Unpaid)
        const unpaidBalance = unpaidBalanceByCode.get(code) ?? 0;
        const balanceStatus = computeBalanceStatus(unpaidBalance);

        // Financial exposure = (missingTanks × average cylinder cost) + unpaid balance
        const serialsArr = Array.from(g.serialsOut);
        const costsForDealer = serialsArr
          .map((s) => cylinderAssetsMap.get(s)?.cost ?? 0)
          .filter((c) => c > 0);
        let avgUnitCost: number | null = null;
        if (costsForDealer.length > 0) {
          avgUnitCost =
            costsForDealer.reduce((a, b) => a + b, 0) / costsForDealer.length;
        }
        const financialExposure = (missingTanks * (avgUnitCost ?? 0)) + unpaidBalance;

        // Overall risk status is the maximum of missingStatus and balanceStatus
        let missingStatus: MissingStatus = "normal";
        if (tempMissingStatus === "critical" || balanceStatus === "high") {
          missingStatus = "critical";
        } else if (tempMissingStatus === "warning" || balanceStatus === "low") {
          missingStatus = "warning";
        }

        // Active cylinders with dealer = serials from OUT movements
        // (those that haven't come back yet as IN movements)
        const outCylinderSerials = serialsArr;
        const inCylinderSerials = Array.from(g.serialsIn);
        const activeCylindersWithDealer = missingTanks;

        return {
          customerCode: code,
          customerName,
          storeName,
          contactNumber,
          customerEmail,
          customerAddress,
          branchId,
          branchName,
          branchCode,
          assignedAgents,
          fullsDelivered,
          emptiesReturned,
          missingTanks,
          missingStatus,
          riskFlag: missingStatus === "critical",
          financialExposure,
          unpaidBalance,
          balanceStatus,
          activeCylindersWithDealer,
          outCylinderSerials,
          inCylinderSerials,
          lastDeliveryDate: g.lastDeliveryDate,
          createdAt,
          classification,
        } satisfies RTODealerRecord;
      }
    );

    // Sort by missingTanks descending (highest risk first)
    records.sort((a, b) => b.missingTanks - a.missingTanks);

    return NextResponse.json(records, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[BFF:RTOOperation] Error:", detail);
    return NextResponse.json(
      { ok: false, message: "Internal server error", detail },
      { status: 500 }
    );
  }
}
