// src/app/api/ids/scm/supplier-management/purchase-order-creation-serial/route.ts
// Purpose: API handler for the Cylinder Refill Serial Tagging module.
//
// REVISED FLOW (no PO creation):
//   GET  ?         → List all is_refill=1 POs (all statuses) for PO selection screen
//   GET  ?poId=N   → Fetch PO detail: lines + existing serial counts
//   POST {action: "tag_serials"} → Insert purchase_order_serial rows, patch is_tagged if complete
//
// DB WRITES (POST only):
//   INSERT purchase_order_serial   (one row per new serial entry)
//   PATCH  purchase_order.is_tagged = 1  (only when all lines are fully serialized)
//
// NO purchase_order INSERT, NO purchase_order_products INSERT.

import { NextRequest, NextResponse } from "next/server";
import { TagSerialsSchema } from "@/modules/industrial-distribution-system/supply-chain-management/supplier-management/purchase-order-creation-serial/types/serial-po.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Directus Helpers ────────────────────────────────────────────────────────

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const cleaned = raw.trim().replace(/\/$/, "");
    if (!cleaned) throw new Error("DIRECTUS_URL is not set.");
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
    if (!token) throw new Error("DIRECTUS_STATIC_TOKEN is not set.");
    return token;
}

function directusHeaders(): Record<string, string> {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getDirectusToken()}`,
    };
}

async function directusFetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, {
        ...init,
        headers: { ...directusHeaders(), ...(init?.headers as Record<string, string> | undefined) },
        cache: "no-store",
    });
}

async function safeJson(res: Response): Promise<{ text: string; json: Record<string, unknown> }> {
    const text = await res.text().catch(() => "");
    const json = (() => {
        try { return text ? JSON.parse(text) : {}; }
        catch { return { raw: text }; }
    })() as Record<string, unknown>;
    return { text, json };
}

// ─── Data Mappers ─────────────────────────────────────────────────────────────

async function fetchSuppliersMap(base: string, ids: number[]) {
    const map = new Map<number, string>();
    const uniq = Array.from(new Set(ids)).filter(Boolean);
    if (!uniq.length) return map;
    const url = `${base}/items/suppliers?limit=-1&filter[id][_in]=${uniq.join(",")}&fields=id,supplier_name`;
    const res = await directusFetch(url);
    const { json } = await safeJson(res);
    for (const s of (json?.data as Record<string, unknown>[]) || []) {
        map.set(Number(s.id), String(s.supplier_name || "—"));
    }
    return map;
}

async function fetchProductsMap(base: string, ids: number[]) {
    const map = new Map<number, { name: string; sku: string }>();
    const uniq = Array.from(new Set(ids)).filter(Boolean);
    if (!uniq.length) return map;
    const url = `${base}/items/products?limit=-1&filter[product_id][_in]=${uniq.join(",")}&fields=product_id,product_name`;
    const res = await directusFetch(url);
    const { json } = await safeJson(res);
    for (const p of (json?.data as Record<string, unknown>[]) || []) {
        map.set(Number(p.product_id), {
            name: String(p.product_name || `Product #${p.product_id}`),
            sku: "",
        });
    }
    return map;
}

async function fetchBranchesMap(base: string, ids: number[]) {
    const map = new Map<number, string>();
    const uniq = Array.from(new Set(ids)).filter(Boolean);
    if (!uniq.length) return map;
    
    // Fallback chain for branch collection names
    const candidates = ["branches", "company_branches", "branch_master", "warehouses"];
    for (const col of candidates) {
        try {
            const url = `${base}/items/${col}?limit=-1&filter[id][_in]=${uniq.join(",")}&fields=id,branch_name`;
            const res = await directusFetch(url);
            if (!res.ok) continue;
            const { json } = await safeJson(res);
            const rows = Array.isArray(json?.data) ? json.data : [];
            if (rows.length > 0) {
                for (const r of rows) {
                    map.set(Number(r.id), String(r.branch_name || `Branch #${r.id}`));
                }
                return map; // Found the right table
            }
        } catch {
            // Ignore and try next
        }
    }
    return map;
}

// ─── GET: PO List ─────────────────────────────────────────────────────────────
// Returns all purchase_order rows where is_refill=1, sorted by date desc.
// Includes: supplier name, inventory status label, serial counts.

async function getPOList(base: string) {
    // Step 1: Fetch all refill POs
    const url =
        `${base}/items/purchase_order` +
        `?filter[is_refill][_eq]=1` +
        `&sort[]=-date&sort[]=-purchase_order_id` +
        `&limit=-1` +
        `&fields=purchase_order_id,purchase_order_no,supplier_name,` +
        `date,inventory_status.id,inventory_status.status,is_tagged,remark`;

    const res = await directusFetch(url);
    const { json } = await safeJson(res);
    if (!res.ok) throw new Error(`Failed to fetch PO list (${res.status})`);

    const rows = Array.isArray(json?.data) ? json.data as Record<string, unknown>[] : [];
    if (rows.length === 0) return [];

    // Step 2: For each PO, fetch line counts + serial counts in parallel (batch)
    const poIds = rows.map((r) => Number(r.purchase_order_id));

    // Fetch ordered qty sums per PO
    const linesUrl =
        `${base}/items/purchase_order_products` +
        `?filter[purchase_order_id][_in]=${poIds.join(",")}` +
        `&limit=-1` +
        `&fields=purchase_order_id,purchase_order_product_id,ordered_quantity`;

    // Fetch existing serial counts per PO
    const serialsUrl =
        `${base}/items/purchase_order_serial` +
        `?filter[purchase_order_product_id.purchase_order_id][_in]=${poIds.join(",")}` +
        `&limit=-1` +
        `&fields=purchase_order_product_id.purchase_order_id`;

    const [linesRes, serialsRes] = await Promise.all([
        directusFetch(linesUrl),
        directusFetch(serialsUrl),
    ]);

    const linesJson = await linesRes.json().catch(() => ({}));
    const serialsJson = await serialsRes.json().catch(() => ({}));

    const lineRows = Array.isArray(linesJson?.data) ? linesJson.data as Record<string, unknown>[] : [];
    const serialRows = Array.isArray(serialsJson?.data) ? serialsJson.data as Record<string, unknown>[] : [];

    // Build maps: poId → total ordered qty | poId → serial count
    const qtyMap = new Map<number, number>();
    const lineCountMap = new Map<number, number>();
    for (const lr of lineRows) {
        const pid = Number(lr.purchase_order_id);
        qtyMap.set(pid, (qtyMap.get(pid) ?? 0) + Number(lr.ordered_quantity ?? 0));
        lineCountMap.set(pid, (lineCountMap.get(pid) ?? 0) + 1);
    }

    const serialMap = new Map<number, number>();
    for (const sr of serialRows) {
        // purchase_order_product_id is a relational field joined as object
        const rel = sr["purchase_order_product_id"] as Record<string, unknown> | undefined;
        const pid = Number(rel?.purchase_order_id ?? 0);
        if (pid > 0) serialMap.set(pid, (serialMap.get(pid) ?? 0) + 1);
    }

    // Step 3: Fetch supplier names
    const supplierIds = rows.map((r) => Number(r.supplier_name)).filter(Boolean);
    const supplierMap = await fetchSuppliersMap(base, supplierIds);

    // Shape response
    return rows.map((r) => {
        const poId = Number(r.purchase_order_id);
        const statusRel = r["inventory_status"] as Record<string, unknown> | undefined;
        const supplierId = Number(r.supplier_name);
        return {
            poId,
            poNumber: String(r.purchase_order_no ?? ""),
            supplierName: supplierMap.get(supplierId) || "—",
            date: String(r.date ?? ""),
            inventoryStatus: Number(statusRel?.id ?? r.inventory_status ?? 0),
            inventoryStatusLabel: String(statusRel?.status ?? "—"),
            isTagged: Number(r.is_tagged ?? 0) === 1,
            totalLines: lineCountMap.get(poId) ?? 0,
            totalOrderedQty: qtyMap.get(poId) ?? 0,
            totalSerials: serialMap.get(poId) ?? 0,
            remark: r.remark ? String(r.remark) : undefined,
        };
    });
}

// ─── GET: PO Detail ───────────────────────────────────────────────────────────
// Returns PO header + all purchase_order_products lines + existing serials per line.

async function getPODetail(base: string, poId: number) {
    // 1. Fetch PO header
    const headerUrl =
        `${base}/items/purchase_order/${poId}` +
        `?fields=purchase_order_id,purchase_order_no,supplier_name,` +
        `date,remark,inventory_status.id,inventory_status.status,is_tagged`;

    // 2. Fetch product lines for this PO (with branch + product join)
    const linesUrl =
        `${base}/items/purchase_order_products` +
        `?filter[purchase_order_id][_eq]=${poId}` +
        `&limit=-1` +
        `&fields=purchase_order_product_id,product_id,branch_id,ordered_quantity`;

    const [headerRes, linesRes] = await Promise.all([
        directusFetch(headerUrl),
        directusFetch(linesUrl),
    ]);

    const headerJson = (await headerRes.json().catch(() => ({}))).data as Record<string, unknown> | undefined;
    const linesJson = await linesRes.json().catch(() => ({}));

    if (!headerRes.ok) throw new Error(`Failed to fetch PO header (${headerRes.status})`);

    const lineRows = Array.isArray(linesJson?.data) ? linesJson.data as Record<string, unknown>[] : [];
    const lineIds = lineRows.map((l) => Number(l.purchase_order_product_id)).filter(Boolean);

    // 3. Fetch existing serials for these lines
    let serialRows: Record<string, unknown>[] = [];
    if (lineIds.length > 0) {
        const serialsUrl =
            `${base}/items/purchase_order_serial` +
            `?filter[purchase_order_product_id][_in]=${lineIds.join(",")}` +
            `&limit=-1` +
            `&fields=id,purchase_order_product_id,serial_number`;

        const serialsRes = await directusFetch(serialsUrl);
        const serialsJson = await serialsRes.json().catch(() => ({}));
        serialRows = Array.isArray(serialsJson?.data) ? serialsJson.data as Record<string, unknown>[] : [];
    }

    // Group serials by lineId
    const serialsByLine = new Map<number, string[]>();
    for (const sr of serialRows) {
        const lid = Number(sr.purchase_order_product_id);
        if (!serialsByLine.has(lid)) serialsByLine.set(lid, []);
        serialsByLine.get(lid)!.push(String(sr.serial_number ?? ""));
    }

    // 4. Fetch Mappings (Suppliers, Products, Branches)
    const supplierId = Number(headerJson?.supplier_name);
    const supplierMap = await fetchSuppliersMap(base, [supplierId]);
    
    const productIds = lineRows.map(l => Number(l.product_id)).filter(Boolean);
    const productMap = await fetchProductsMap(base, productIds);
    
    const branchIds = lineRows.map(l => Number(l.branch_id)).filter(Boolean);
    const branchMap = await fetchBranchesMap(base, branchIds);

    // Shape lines
    const lines = lineRows.map((l) => {
        const lineId = Number(l.purchase_order_product_id);
        const pid = Number(l.product_id);
        const bid = Number(l.branch_id);
        
        const pInfo = productMap.get(pid);
        const bName = branchMap.get(bid);

        return {
            lineId,
            productId: pid,
            productName: pInfo?.name || `Product #${pid}`,
            sku: pInfo?.sku || "",
            branchId: bid,
            branchName: bName || `Branch #${bid}`,
            orderedQty: Number(l.ordered_quantity ?? 1),
            savedSerials: (serialsByLine.get(lineId) ?? []).map((sn) => ({ serial_number: sn, saved: true })),
            draftSerials: [],
        };
    });

    const statusRel = headerJson?.["inventory_status"] as Record<string, unknown> | undefined;

    return {
        poId,
        poNumber: String(headerJson?.purchase_order_no ?? ""),
        supplierName: supplierMap.get(supplierId) || "—",
        date: String(headerJson?.date ?? ""),
        remark: headerJson?.remark ? String(headerJson.remark) : undefined,
        inventoryStatus: Number(statusRel?.id ?? 0),
        isTagged: Number(headerJson?.is_tagged ?? 0) === 1,
        lines,
    };
}

// ─── POST: Tag Serials ────────────────────────────────────────────────────────
// Inserts purchase_order_serial rows and optionally patches is_tagged=1.

async function tagSerials(
    base: string,
    poId: number,
    entries: Array<{ lineId: number; productId: number; serial_number: string }>
): Promise<{ serialsInserted: number; isTaggedNow: boolean }> {
    // Build serial rows for batch insert
    const serialRows = entries.map((e) => ({
        purchase_order_product_id: e.lineId,
        product_id: e.productId,
        serial_number: String(e.serial_number).trim().toUpperCase(),
    }));

    // Insert all serials in one request
    const insertRes = await directusFetch(`${base}/items/purchase_order_serial`, {
        method: "POST",
        body: JSON.stringify(serialRows),
    });
    const insertJson = await insertRes.json().catch(() => ({}));

    if (!insertRes.ok) {
        const msg =
            (Array.isArray(insertJson?.errors) ? (insertJson.errors as Array<{ message?: string }>)[0]?.message : null) ||
            (insertJson?.error as string) ||
            `Failed to insert serials (${insertRes.status})`;
        throw new Error(msg);
    }

    const inserted = Array.isArray(insertJson?.data) ? insertJson.data.length : serialRows.length;

    // Check if all lines are now fully serialized → patch is_tagged = 1
    // Fetch current serial counts vs ordered qty for this PO
    const linesUrl =
        `${base}/items/purchase_order_products` +
        `?filter[purchase_order_id][_eq]=${poId}` +
        `&limit=-1` +
        `&fields=purchase_order_product_id,ordered_quantity`;

    const linesRes = await directusFetch(linesUrl);
    const linesData = ((await linesRes.json().catch(() => ({}))).data ?? []) as Record<string, unknown>[];

    let serialsData: Record<string, unknown>[] = [];
    const lineIds = linesData.map((l) => Number(l.purchase_order_product_id)).filter(Boolean);

    if (lineIds.length > 0) {
        const serialsUrl =
            `${base}/items/purchase_order_serial` +
            `?filter[purchase_order_product_id][_in]=${lineIds.join(",")}` +
            `&limit=-1` +
            `&fields=purchase_order_product_id`;

        const serialsRes = await directusFetch(serialsUrl);
        serialsData = ((await serialsRes.json().catch(() => ({}))).data ?? []) as Record<string, unknown>[];
    }

    // Count serials per line
    const snByLine = new Map<number, number>();
    for (const sr of serialsData) {
        // Handle case where Directus might return an object
        const raw = sr.purchase_order_product_id;
        const lid = typeof raw === 'object' && raw !== null ? Number((raw as Record<string, unknown>).id || (raw as Record<string, unknown>).purchase_order_product_id) : Number(raw);
        if (Number.isFinite(lid) && lid > 0) {
            snByLine.set(lid, (snByLine.get(lid) ?? 0) + 1);
        }
    }

    // Check completeness: every line's serial count >= ordered_quantity
    const allComplete =
        linesData.length > 0 &&
        linesData.every((l) => {
            const lid = Number(l.purchase_order_product_id);
            const qty = Number(l.ordered_quantity ?? 1);
            return (snByLine.get(lid) ?? 0) >= qty;
        });

    let isTaggedNow = false;
    if (allComplete) {
        // Patch purchase_order.is_tagged = 1
        const patchRes = await directusFetch(`${base}/items/purchase_order/${poId}`, {
            method: "PATCH",
            body: JSON.stringify({ is_tagged: true }),
        });
        isTaggedNow = patchRes.ok;
    }

    return { serialsInserted: inserted, isTaggedNow };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const base = getDirectusBase();
        const { searchParams } = new URL(req.url);
        const poIdParam = searchParams.get("poId");

        if (poIdParam) {
            // Return detail for one PO
            const poId = Number(poIdParam);
            if (!Number.isFinite(poId) || poId <= 0) {
                return NextResponse.json({ error: "Invalid poId" }, { status: 400 });
            }
            const detail = await getPODetail(base, poId);
            return NextResponse.json({ data: detail });
        }

        // Return full PO list
        const list = await getPOList(base);
        return NextResponse.json({ data: list });

    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const base = getDirectusBase();

        const rawBody = await req.json().catch(() => null);
        if (!rawBody) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // Validate action
        if (rawBody.action !== "tag_serials") {
            return NextResponse.json({ error: `Unknown action: ${rawBody.action}` }, { status: 400 });
        }

        // Validate payload
        const parsed = TagSerialsSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { poId, entries } = parsed.data;

        // Verify the PO exists and has inventory_status=13 (approved for tagging)
        const poCheckRes = await directusFetch(
            `${base}/items/purchase_order/${poId}?fields=purchase_order_id,inventory_status,is_refill`
        );
        if (!poCheckRes.ok) {
            return NextResponse.json({ error: "PO not found" }, { status: 404 });
        }
        const poData = ((await poCheckRes.json().catch(() => ({}))).data ?? {}) as Record<string, unknown>;

        if (Number(poData.is_refill) !== 1) {
            return NextResponse.json({ error: "This PO is not a refill PO." }, { status: 400 });
        }
        if (Number(poData.inventory_status) !== 13) {
            return NextResponse.json(
                { error: "PO is not approved for serial tagging (inventory_status must be 13)." },
                { status: 400 }
            );
        }

        // Insert serials and patch is_tagged
        const result = await tagSerials(base, poId, entries);

        // Return updated PO detail so client can refresh state
        const updatedDetail = await getPODetail(base, poId);

        return NextResponse.json({
            data: {
                serialsInserted: result.serialsInserted,
                isTaggedNow: result.isTaggedNow,
                poNumber: updatedDetail.poNumber,
                updatedDetail,
            },
        });

    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error during serial tagging", details: (e as Error).message },
            { status: 500 }
        );
    }
}
