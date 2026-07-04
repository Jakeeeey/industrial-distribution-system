import { NextRequest, NextResponse } from "next/server";

// =====================
// DIRECTUS HELPERS
// =====================
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

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: { ...directusHeaders(), ...(init?.headers as Record<string, string> | undefined) },
        cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
        const errors = json?.errors as Array<{ message: string }> | undefined;
        const msg = errors?.[0]?.message || (json?.error as string) || `Directus error ${res.status} ${res.statusText}`;
        throw new Error(msg);
    }
    return json as T;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================
// HELPERS
// =====================
function ok(data: unknown, status = 200) { return NextResponse.json({ data }, { status }); }
function bad(error: string, status = 400) { return NextResponse.json({ error }, { status }); }
function toStr(v: unknown, fb = "") { const s = String(v ?? "").trim(); return s ? s : fb; }
function toNum(v: unknown) { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
function getVal(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
    if (!obj) return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
}

function ensureId(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") {
        const obj = v as Record<string, unknown>;
        const id = obj?.id ?? obj?.purchase_order_product_id ?? obj?.product_id;
        const n = toNum(id);
        return n > 0 ? n : null;
    }
    const n = toNum(v);
    return n > 0 ? n : null;
}



function deriveDiscountPercentFromCode(codeRaw: string): number {
    const code = String(codeRaw ?? "").trim().toUpperCase();
    if (!code || code === "NO DISCOUNT" || code === "D0") return 0;
    const nums = (code.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(n => n > 0 && n <= 100);
    if (!nums.length) return 0;
    const f = nums.reduce((acc, p) => acc * (1 - p / 100), 1);
    return Number(((1 - f) * 100).toFixed(4));
}

function keyLine(poId: number, productId: number, branchId: number) { return `${poId}::${productId}::${branchId}`; }
function nowISO() {
    const d = new Date();
    const datePart = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
    const timePart = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(d);
    return `${datePart} ${timePart}`;
}

interface DiscountLine {
    id?: string | number;
    description?: string;
    percentage?: string | number;
    line_id?: { id?: string | number; description?: string; percentage?: string | number; };
}

function calculateDiscountFromLines(lines: DiscountLine[]): number {
    if (!lines.length) return 0;
    const factor = lines.reduce((acc: number, l: DiscountLine) => acc * (1 - toNum(l.line_id?.percentage ?? l?.percentage) / 100), 1);
    return Number(((1 - factor) * 100).toFixed(4));
}

const PO_COLLECTION = "purchase_order";
const PO_PRODUCTS_COLLECTION = "purchase_order_products";
const SUPPLIERS_COLLECTION = "suppliers";
const PRODUCTS_COLLECTION = "products";
const BRANCHES_COLLECTION = "branches";
const POR_COLLECTION = "purchase_order_receiving";
const LOTS_COLLECTION = "lots";
const UNITS_COLLECTION = "units";
const PRODUCT_SUPPLIER_COLLECTION = "product_per_supplier";

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// =====================
// INTERFACES
// =====================
interface POHeaderRow {
    purchase_order_id: string | number;
    purchase_order_no: string;
    date?: string;
    date_encoded?: string;
    approver_id?: string | number;
    date_approved?: string;
    payment_status?: string | number;
    inventory_status?: string | number;
    date_received?: string;
    supplier_name?: string | number;
    total_amount?: string | number;
    gross_amount?: string | number;
    vat_amount?: string | number;
    withholding_tax_amount?: string | number;
    price_type?: string;
    receiving_type?: string | number;
    discount_percentage?: string | number;
    discount_percent?: string | number;
    discount_type?: {
        id?: string | number;
        discount_type?: string;
        discount_code?: string;
        name?: string;
        line_per_discount_type?: DiscountLine[];
    } | null;
    [key: string]: unknown;
}

interface ProductRow {
    product_id: string | number;
    product_name?: string;
    barcode?: string;
    product_code?: string;
    cost_per_unit?: string | number;
    unit_of_measurement?: { unit_id?: string | number; unit_name?: string; unit_shortcut?: string; } | null;
    unit_of_measurement_count?: string | number;
    is_serialized?: string | number | boolean;
}

interface PORow {
    purchase_order_product_id: string | number;
    purchase_order_id: string | number;
    product_id: string | number;
    branch_id: string | number;
    received_quantity?: string | number;
    receipt_no?: string | null;
    receipt_date?: string | null;
    received_date?: string | null;
    isPosted?: string | number;
    lot_id?: string | number;
    batch_no?: string;
    expiry_date?: string;
    unit_price?: string | number;
    discount_type?: string | number | null;
}

interface POProductRow {
    purchase_order_product_id: string | number;
    purchase_order_id: string | number;
    product_id: string | number;
    branch_id?: string | number | null;
    ordered_quantity: string | number;
    unit_price: string | number;
    total_amount?: string | number;
    discount_type?: string | number | null;
    [key: string]: unknown;
}

// =====================
// DATA FETCHERS
// =====================
async function fetchApprovedNotReceivedPOs(base: string): Promise<POHeaderRow[]> {
    const supUrl = `${base}/items/${SUPPLIERS_COLLECTION}?limit=-1&filter[division_id][_eq]=1&fields=id`;
    let validSupplierIds: number[] = [];
    try {
        const supJ = await fetchJson<{ data: { id: number }[] }>(supUrl);
        validSupplierIds = (supJ?.data || []).map((s) => Number(s.id)).filter((id) => id > 0);
    } catch {
        return [];
    }

    if (validSupplierIds.length === 0) return [];

    const baseQs = [
        "limit=-1", "sort=-purchase_order_id",
        "fields=purchase_order_id,purchase_order_no,date,date_encoded,approver_id,date_approved,payment_status,inventory_status,date_received,supplier_name,total_amount,price_type,is_refill,is_tagged",
        "filter[_or][0][inventory_status][_eq]=13", "filter[_or][1][inventory_status][_eq]=9",
        "filter[_or][2][inventory_status][_eq]=11", "filter[_or][3][inventory_status][_eq]=12",
        "filter[_or][4][inventory_status][_eq]=3",
        "filter[inventory_status][_neq]=6"
    ].join("&");

    const allRows: POHeaderRow[] = [];
    
    for (const ids of chunk(validSupplierIds, 150)) {
        const qs = `${baseQs}&filter[supplier_name][_in]=${encodeURIComponent(ids.join(","))}`;
        const url = `${base}/items/${PO_COLLECTION}?${qs}`;
        try {
            const j = await fetchJson<{ data: POHeaderRow[] }>(url);
            if (j?.data) allRows.push(...j.data);
        } catch {}
    }
    
    return allRows.sort((a, b) => Number(b.purchase_order_id) - Number(a.purchase_order_id));
}

async function fetchSupplierNames(base: string, supplierIds: number[]) {
    const map = new Map<number, string>();
    const uniq = Array.from(new Set(supplierIds.filter((n) => n > 0)));
    if (!uniq.length) return map;
    for (const ids of chunk(uniq, 250)) {
        const url = `${base}/items/${SUPPLIERS_COLLECTION}?limit=-1&filter[id][_in]=${encodeURIComponent(ids.join(","))}&fields=id,supplier_name`;
        const j = await fetchJson<{ data: Array<{id: string | number; supplier_name: string}> }>(url);
        for (const s of (j?.data ?? [])) map.set(toNum(s.id), toStr(s.supplier_name, "—"));
    }
    return map;
}

async function fetchProductsMap(base: string, productIds: number[]) {
    const map = new Map<number, ProductRow>();
    const uniq = Array.from(new Set(productIds.filter((n) => n > 0)));
    if (!uniq.length) return map;
    for (const ids of chunk(uniq, 250)) {
        const url = `${base}/items/${PRODUCTS_COLLECTION}?limit=-1&filter[product_id][_in]=${encodeURIComponent(ids.join(","))}&fields=product_id,product_name,barcode,product_code,cost_per_unit,unit_of_measurement.*,unit_of_measurement_count,is_serialized`;
        const j = await fetchJson<{ data: ProductRow[] }>(url);
        for (const p of (j?.data ?? [])) map.set(toNum(p.product_id), p);
    }
    return map;
}

async function fetchBranchesMap(base: string, branchIds: number[]) {
    const map = new Map<number, string>();
    const uniq = Array.from(new Set(branchIds.filter((n) => n > 0)));
    if (!uniq.length) return map;
    for (const ids of chunk(uniq, 250)) {
        const url = `${base}/items/${BRANCHES_COLLECTION}?limit=-1&filter[id][_in]=${encodeURIComponent(ids.join(","))}&fields=id,branch_name,branch_description`;
        const j = await fetchJson<{ data: Array<{id: string | number; branch_name: string; branch_description: string}> }>(url);
        for (const b of (j?.data ?? [])) map.set(toNum(b.id), toStr(b.branch_name) || toStr(b.branch_description) || `Branch ${b.id}`);
    }
    return map;
}

async function fetchPORByPOIds(base: string, poIds: number[]) {
    if (!poIds.length) return [] as PORow[];
    const rows: PORow[] = [];
    for (const ids of chunk(Array.from(new Set(poIds)), 250)) {
        const url = `${base}/items/${POR_COLLECTION}?limit=-1&filter[purchase_order_id][_in]=${encodeURIComponent(ids.join(","))}&fields=purchase_order_product_id,purchase_order_id,product_id,branch_id,received_quantity,receipt_no,receipt_date,received_date,isPosted,lot_id,batch_no,expiry_date,unit_price,discount_type`;
        const j = await fetchJson<{ data: PORow[] }>(url);
        rows.push(...(j?.data ?? []));
    }
    return rows;
}

async function fetchPOProductsByPOId(base: string, poId: number): Promise<POProductRow[]> {
    const url = `${base}/items/${PO_PRODUCTS_COLLECTION}?limit=-1&filter[purchase_order_id][_eq]=${encodeURIComponent(String(poId))}&fields=purchase_order_product_id,purchase_order_id,product_id,branch_id,ordered_quantity,unit_price,total_amount`;
    const j = await fetchJson<{ data: POProductRow[] }>(url);
    return (j?.data ?? []);
}

async function fetchDiscountTypesMap(base: string) {
    const map = new Map<string, { name: string; pct: number }>();
    try {
        const fields = encodeURIComponent("id,discount_type,total_percent,line_per_discount_type.line_id.*");
        const url = `${base}/items/discount_type?limit=-1&fields=${fields}`;
        const j = await fetchJson<{ data: Array<{ id: string | number; discount_type: string; total_percent: string | number; line_per_discount_type?: DiscountLine[] }> }>(url);
        for (const dt of (j?.data ?? [])) {
            const id = String(dt.id);
            const rawPct = toNum(dt.total_percent);
            const lines = dt.line_per_discount_type ?? [];
            const computed = lines.length > 0 ? calculateDiscountFromLines(lines) : (rawPct > 0 ? rawPct : deriveDiscountPercentFromCode(toStr(dt.discount_type)));
            map.set(id, { name: toStr(dt.discount_type), pct: computed });
        }
    } catch {}
    return map;
}

async function fetchProductSupplierLinks(base: string, productIds: number[], supplierId?: number) {
    const map = new Map<number, { supplier_id: number; discount_type: unknown }>();
    const ids = Array.from(new Set(productIds));
    if (!ids.length) return map;

    for (const chunkIds of chunk(ids, 250)) {
        const url = supplierId 
            ? `${base}/items/${PRODUCT_SUPPLIER_COLLECTION}?limit=-1&filter[product_id][_in]=${encodeURIComponent(chunkIds.join(","))}&filter[supplier_id][_eq]=${supplierId}&fields=*`
            : `${base}/items/${PRODUCT_SUPPLIER_COLLECTION}?limit=-1&filter[product_id][_in]=${encodeURIComponent(chunkIds.join(","))}&fields=*`;
            
        const j = await fetchJson<{ data: Record<string, unknown>[] }>(url);
        for (const link of (j?.data ?? [])) {
            const pid = toNum(link?.product_id);
            if (pid) map.set(pid, { supplier_id: toNum(link?.supplier_id), discount_type: link?.discount_type });
        }
    }
    return map;
}

// =====================
// BUSINESS LOGIC
// =====================
function productDisplayCode(p: ProductRow | null | undefined, productId: number) {
    const pc = toStr(p?.product_code);
    const bc = toStr(p?.barcode);
    if (pc && bc && pc !== bc) return `${pc} (${bc})`;
    return pc || bc || String(productId);
}

function effectiveReceivedQty(por: PORow | null | undefined) {
    const posted = toNum(por?.isPosted) === 1;
    if (posted) return Math.max(0, toNum(por?.received_quantity ?? 0));
    const evidence = Boolean(toStr(por?.receipt_no) || toStr(por?.receipt_date) || toStr(por?.received_date));
    if (!evidence) return 0;
    return Math.max(0, toNum(por?.received_quantity ?? 0));
}

function buildPorIdsByKey(porRows: PORow[]) {
    const map = new Map<string, number[]>();
    for (const r of porRows) {
        const k = keyLine(toNum(r.purchase_order_id), toNum(r.product_id), toNum(r.branch_id));
        const arr = map.get(k) ?? [];
        arr.push(toNum(r.purchase_order_product_id));
        map.set(k, arr);
    }
    return map;
}

function isFullyReceived(poId: number, lines: POProductRow[], porRows: PORow[]) {
    for (const ln of lines) {
        const expected = toNum(ln.ordered_quantity);
        if (expected <= 0) continue;
        const received = porRows
            .filter((r) => toNum(r.product_id) === toNum(ln.product_id) && toNum(r.branch_id) === toNum(ln.branch_id ?? 0))
            .reduce((sum, r) => sum + effectiveReceivedQty(r), 0);
        if (received < expected) return false;
    }
    return true;
}

function receivingStatusFrom(poId: number, lines: POProductRow[], porRows: PORow[]): "OPEN" | "PARTIAL" | "CLOSED" {
    const fully = isFullyReceived(poId, lines, porRows);
    if (fully) return "CLOSED";
    const hasAnyPosted = porRows.some(r => toNum(r.isPosted) === 1);
    const hasAnyReceipt = porRows.some(r => effectiveReceivedQty(r) > 0 || toStr(r.receipt_no));
    if (hasAnyPosted || hasAnyReceipt) return "PARTIAL";
    return "OPEN";
}

async function ensureOpenReceivingRow(args: {
    base: string; poId: number; productId: number; branchId: number;
    unitPrice: number; discountTypeId: number | null; discountPercent: number;
}) {
    const { base, poId, productId, branchId, unitPrice, discountTypeId, discountPercent } = args;

    const findUrl = `${base}/items/${POR_COLLECTION}?limit=1&sort=-purchase_order_product_id&filter[purchase_order_id][_eq]=${encodeURIComponent(String(poId))}&filter[product_id][_eq]=${encodeURIComponent(String(productId))}&filter[branch_id][_eq]=${encodeURIComponent(String(branchId))}&filter[isPosted][_eq]=0&fields=purchase_order_product_id,received_quantity,receipt_no`;
    const found = await fetchJson<{ data: Record<string, unknown>[] }>(findUrl);
    const row = Array.isArray(found?.data) ? found.data[0] : null;
    if (row?.purchase_order_product_id) return { porId: toNum(row.purchase_order_product_id), receivedQty: toNum(row.received_quantity), created: false };

    const lineGross = unitPrice; // qty=0 at creation, so gross = unitPrice × 1 for per-unit seed
    const discountedSum = Number((lineGross * (discountPercent / 100)).toFixed(2));
    const net = lineGross - discountedSum;
    const vatExcl = Number((net / 1.12).toFixed(2));
    const vatAmt = Number((net - vatExcl).toFixed(2));
    const ewtAmt = Number((vatExcl * 0.01).toFixed(2));

    const insertPayload: Record<string, unknown> = {
        purchase_order_id: poId, product_id: productId, branch_id: branchId,
        received_quantity: 0, unit_price: unitPrice, discounted_amount: discountedSum,
        discount_type: discountTypeId, vat_amount: vatAmt,
        withholding_amount: ewtAmt, total_amount: Number(net.toFixed(2)),
        isPosted: 0, receipt_no: null, receipt_date: null, received_date: null
    };

    const created = await fetchJson<{ data: Record<string, unknown> }>(`${base}/items/${POR_COLLECTION}`, {
        method: "POST", body: JSON.stringify(insertPayload)
    });
    return { porId: toNum(created?.data?.purchase_order_product_id), receivedQty: 0, created: true };
}

// =====================
// API ROUTES
// =====================
export async function GET() {
    try {
        const base = getDirectusBase();
        const poHeaders = await fetchApprovedNotReceivedPOs(base);
        const poIds = poHeaders.map((p) => toNum(p.purchase_order_id)).filter(Boolean);
        if (!poIds.length) return ok([]);

        const urlLines = `${base}/items/${PO_PRODUCTS_COLLECTION}?limit=-1&fields=purchase_order_id,product_id,branch_id,ordered_quantity,purchase_order_product_id&filter[purchase_order_id][_in]=${poIds.join(",")}`;
        const jl = await fetchJson<{ data: POProductRow[] }>(urlLines);
        const poLinesAll = jl?.data ?? [];
        const porRowsAll = await fetchPORByPOIds(base, poIds);
        const supplierMap = await fetchSupplierNames(base, poHeaders.map((p) => toNum(p.supplier_name)));

        const list = poHeaders.map((po) => {
            const poId = toNum(po.purchase_order_id);
            const lines = poLinesAll.filter((l) => toNum(l.purchase_order_id) === poId);
            const porRows = porRowsAll.filter((r) => toNum(r.purchase_order_id) === poId);
            if (isFullyReceived(poId, lines, porRows)) return null;
            return {
                id: String(poId), poNumber: toStr(po.purchase_order_no),
                supplierName: supplierMap.get(toNum(po.supplier_name)) || "—",
                status: receivingStatusFrom(poId, lines, porRows),
                totalAmount: toNum(po.total_amount), currency: "PHP",
                itemsCount: new Set(lines.map(l => l.product_id)).size,
                branchesCount: new Set(lines.map(l => l.branch_id)).size,
                priceType: toStr(po.price_type, "Cost Per Unit"),
                isRefill: Number(po.is_refill ?? 0) === 1,
                isTagged: Number(po.is_tagged ?? 0) === 1
            };
        }).filter(Boolean);
        return ok(list);
    } catch (e: unknown) { return bad((e as Error).message, 500); }
}

export async function POST(req: NextRequest) {
    try {
        const base = getDirectusBase();
        const body = await req.json().catch(() => ({}));
        const action = toStr(body.action);

        if (action === "open_po" || action === "verify_po") {
            const poId = toNum(body.poId || body.barcode);
            const poUrl = `${base}/items/${PO_COLLECTION}/${poId}?fields=*,discount_type.*,discount_type.line_per_discount_type.line_id.*`;
            const pj = await fetchJson<{ data: POHeaderRow }>(poUrl).catch(() => null);
            const po = pj?.data;
            if (!po) return bad("PO not found", 404);

            // Block receiving if refill PO and not tagged
            if (Number(po.is_refill ?? 0) === 1 && Number(po.is_tagged ?? 0) !== 1) {
                return bad("This refill Purchase Order is not tagged. Serials must be tagged before receiving.", 400);
            }

            const lines = await fetchPOProductsByPOId(base, toNum(po.purchase_order_id));
            const porRows = await fetchPORByPOIds(base, [toNum(po.purchase_order_id)]);
            const productIdsAll = lines.map(l => toNum(l.product_id));
            const productsMap = await fetchProductsMap(base, productIdsAll);
            const branchesMap = await fetchBranchesMap(base, lines.map(l => toNum(l.branch_id ?? 0)));
            const supplierMap = await fetchSupplierNames(base, [toNum(po.supplier_name)]);
            const productLinksMap = await fetchProductSupplierLinks(base, productIdsAll, toNum(po.supplier_name));
            const discountMap = await fetchDiscountTypesMap(base);
            const porIdsByKey = buildPorIdsByKey(porRows);

            let headerDiscountPercent = 0;
            const dType = po.discount_type;
            const dLines = dType?.line_per_discount_type || [];
            if (dLines.length > 0) headerDiscountPercent = calculateDiscountFromLines(dLines);
            else headerDiscountPercent = deriveDiscountPercentFromCode(toStr(dType?.discount_type || dType?.name));

            const allocationsMap = new Map<number, unknown[]>();
            for (const ln of lines) {
                const pid = toNum(ln.product_id);
                const bid = toNum(ln.branch_id ?? 0);
                const k = keyLine(toNum(po.purchase_order_id), pid, bid);
                const p = productsMap.get(pid);
                const pors = porIdsByKey.get(k) || [];
                const receivedQty = pors.reduce((sum, id) => sum + effectiveReceivedQty(porRows.find(r => toNum(r.purchase_order_product_id) === id)), 0);

                const lineDiscountTypeId = productLinksMap.get(pid)?.discount_type;
                let lineDiscountPercent = headerDiscountPercent;
                let lineDiscountTypeStr = dType ? toStr(dType.discount_type || dType.name, "Standard") : "Standard";
                const resId = ensureId(lineDiscountTypeId);
                if (resId) {
                    const dt = discountMap.get(String(resId));
                    if (dt) { lineDiscountPercent = dt.pct; lineDiscountTypeStr = dt.name; }
                }

                const dAmt = toNum(ln.unit_price) * (lineDiscountPercent / 100);
                const remainingQty = Math.max(0, toNum(ln.ordered_quantity) - receivedQty);

                // ✅ Only include if there is still a balance to receive, or if user wants to see all (User said "show products not yet received")
                if (remainingQty > 0) {
                    const existing = allocationsMap.get(bid) || [];
                    allocationsMap.set(bid, [...existing, {
                        id: pors[0] ? String(pors[0]) : `${pid}-${bid}`, porId: String(pors[0] || ""),
                        purchaseOrderProductId: String(ln.purchase_order_product_id), // Passed to align serial tagging correctly
                        productId: String(pid), branchId: String(bid), name: toStr(p?.product_name, `Product #${pid}`),
                        barcode: productDisplayCode(p, pid), uom: String(p?.unit_of_measurement?.unit_shortcut ?? "BOX").toUpperCase(),
                        expectedQty: remainingQty, receivedQty: 0, requiresRfid: false,
                        isSerialized: !!p?.is_serialized,
                        isReceived: false, unitPrice: toNum(ln.unit_price),
                        discountType: lineDiscountTypeStr, discountAmount: dAmt, netAmount: 0 // Net amount for THIS session
                    }]);
                }
            }

            const uniqueReceipts = Array.from(new Set(porRows.map(r => r.receipt_no).filter(Boolean)));
            const history = uniqueReceipts.map(rno => {
                const rs = porRows.filter(r => r.receipt_no === rno);
                return { receiptNo: rno, receiptDate: rs[0]?.receipt_date || rs[0]?.received_date || "", isPosted: rs.every(r => toNum(r.isPosted) === 1), itemsCount: rs.length };
            }).sort((a,b) => (b.receiptNo ?? "").localeCompare(a.receiptNo ?? ""));

            return ok({
                id: String(po.purchase_order_id), poNumber: toStr(po.purchase_order_no),
                supplier: { id: String(po.supplier_name), name: supplierMap.get(toNum(po.supplier_name)) || "Supplier" },
                status: receivingStatusFrom(toNum(po.purchase_order_id), lines, porRows),
                allocations: Array.from(allocationsMap.entries()).map(([bid, items]) => ({ branch: { id: String(bid), name: branchesMap.get(bid) || `Branch ${bid}` }, items })),
                priceType: toStr(getVal(po, "price_type", "priceType"), "Cost Per Unit"),
                isInvoice: (Number(getVal(po, "receiving_type", "receivingType")) === 2) || 
                          (toNum(getVal(po, "vat_amount", "vatAmount", "val_amount", "valAmount")) > 0) || 
                          (toNum(getVal(po, "withholding_tax_amount", "withholdingTaxAmount")) > 0),
                createdAt: po.date_encoded ? new Date(po.date_encoded).toISOString() : new Date().toISOString(),
                history,
                isRefill: Number(po.is_refill ?? 0) === 1,
                isTagged: Number(po.is_tagged ?? 0) === 1
            });
        }

        if (action === "lookup_product") {
            const code = toStr(body.barcode).trim();
            const sid = toNum(body.supplierId);
            const url = `${base}/items/${PRODUCTS_COLLECTION}?limit=1&filter[_or][0][barcode][_eq]=${encodeURIComponent(code)}&filter[_or][1][product_code][_eq]=${encodeURIComponent(code)}&fields=product_id,product_name,barcode,product_code,cost_per_unit,unit_of_measurement.*,unit_of_measurement_count`;
            const j = await fetchJson<{ data: ProductRow[] }>(url);
            const p = j?.data?.[0];
            if (!p) return bad("Product not found", 404);
            if (Number(p.unit_of_measurement?.unit_id ?? p.unit_of_measurement) !== 11) return bad("Only 'Box' UOM allowed", 400);

            let discTypeStr = "Standard";
            let discPct = 0;

            if (sid) {
                const linkUrl = `${base}/items/${PRODUCT_SUPPLIER_COLLECTION}?limit=1&filter[product_id][_eq]=${p.product_id}&filter[supplier_id][_eq]=${sid}&fields=discount_type.*,discount_type.line_per_discount_type.line_id.*`;
                const lj = await fetchJson<{ data: Array<Record<string, unknown>> }>(linkUrl).catch(() => ({ data: [] }));
                const link = lj?.data?.[0];
                const dt = link?.discount_type as Record<string, unknown> | null | undefined;
                if (dt) {
                    discTypeStr = toStr(dt.discount_type || dt.name, "Standard");
                    const lines = (dt.line_per_discount_type as DiscountLine[]) || [];
                    if (lines.length > 0) discPct = calculateDiscountFromLines(lines);
                    else if (toNum(dt.total_percent) > 0) discPct = toNum(dt.total_percent);
                    else discPct = deriveDiscountPercentFromCode(discTypeStr);
                }
            }

            return ok({ 
                productId: String(p.product_id), 
                name: String(p.product_name), 
                barcode: String(p.barcode || p.product_code), 
                unitPrice: toNum(p.cost_per_unit),
                discountType: discTypeStr,
                discountPercent: discPct,
                uom: "BOX",
                sku: String(p.barcode || p.product_code)
            });
        }

        if (action === "save_receipt") {
            const { poId, receiptNo, receiptDate, porCounts, porSerials, porMetaData, receiverId } = body;
            const thePoId = toNum(poId);
            if (!thePoId) return bad("Missing PO ID");

            const poUrl = `${base}/items/${PO_COLLECTION}/${thePoId}?fields=purchase_order_id,purchase_order_no,supplier_name,discount_type.*,discount_type.line_per_discount_type.line_id.*,inventory_status,price_type,date_encoded,receiving_type,vat_amount,withholding_tax_amount,is_refill,is_tagged`;
            const pj = await fetchJson<{ data: POHeaderRow }>(poUrl);
            const po = pj?.data;

            // Block saving receipt if refill PO and not tagged
            if (Number(po?.is_refill ?? 0) === 1 && Number(po?.is_tagged ?? 0) !== 1) {
                return bad("This refill Purchase Order is not tagged. Serials must be tagged before receiving.", 400);
            }
            let poDiscountPercent = 0;
            const dType = po?.discount_type;
            if (dType?.line_per_discount_type?.length) poDiscountPercent = calculateDiscountFromLines(dType.line_per_discount_type);
            else poDiscountPercent = deriveDiscountPercentFromCode(toStr(dType?.discount_type));

            const discountMap = await fetchDiscountTypesMap(base);
            const porRows = await fetchPORByPOIds(base, [thePoId]);
            const lines = await fetchPOProductsByPOId(base, thePoId);
            
            // ✅ Fix: Correctly resolve ALL product IDs involved (from lines AND any extra existing POR rows)
            const productIdsSet = new Set<number>();
            lines.forEach(l => productIdsSet.add(toNum(l.product_id)));
            porRows.forEach(r => productIdsSet.add(toNum(r.product_id)));
            // Also include from porCounts keys if they are composite pid-bid
            Object.keys(porCounts).forEach(k => { if (k.includes("-")) productIdsSet.add(toNum(k.split("-")[0])); });
            
            const linksMap = await fetchProductSupplierLinks(base, Array.from(productIdsSet), toNum(po?.supplier_name));
            const productsMap = await fetchProductsMap(base, Array.from(productIdsSet));

            for (const [key, qtyNum] of Object.entries(porCounts)) {
                const qty = toNum(qtyNum);
                if (qty <= 0) continue;
                if (String(key).includes("-")) {
                    const [pidStr, bidStr] = key.split("-");
                    const pid = toNum(pidStr), bid = toNum(bidStr);
                    const ml = lines.find(l => toNum(l.product_id) === pid && toNum(l.branch_id) === bid);
                    let uPrice = 0;
                    if (ml) uPrice = toNum(ml.unit_price);
                    else {
                        const pj2 = await fetchJson<{ data: ProductRow }>(`${base}/items/${PRODUCTS_COLLECTION}/${pid}?fields=cost_per_unit`);
                        uPrice = toNum(pj2?.data?.cost_per_unit || 0);
                    }

                    const lineTypeId = linksMap.get(pid)?.discount_type;
                    let linePct = poDiscountPercent;
                    let resolvedId = ensureId(lineTypeId);
                    if (resolvedId) {
                        const dt = discountMap.get(String(resolvedId));
                        if (dt) { linePct = dt.pct; }
                    } else resolvedId = ensureId(dType);

                    // ✅ Removed unused isExclLine

                    const ensured = await ensureOpenReceivingRow({ base, poId: thePoId, productId: pid, branchId: bid, unitPrice: uPrice, discountTypeId: resolvedId, discountPercent: linePct });
                    porCounts[String(ensured.porId)] = qty;
                    delete porCounts[key];
                    if (porMetaData?.[key]) { porMetaData[String(ensured.porId)] = porMetaData[key]; delete porMetaData[key]; }
                    if (porSerials?.[key]) { porSerials[String(ensured.porId)] = porSerials[key]; delete porSerials[key]; }
                }
            }

            const meta = (porMetaData && typeof porMetaData === "object") ? porMetaData : {};
            for (const [porId, qtyNum] of Object.entries(porCounts)) {
                const qty = toNum(qtyNum); if (qty <= 0) continue;
                const m = meta[porId] || {};
                const pr = (await fetchJson<{ data: PORow }>(`${base}/items/${POR_COLLECTION}/${porId}?fields=unit_price,discount_type,received_quantity,product_id`)).data;
                const uPrice = toNum(pr?.unit_price || 0), pId = toNum(pr?.product_id);

                let linePct = poDiscountPercent, dtId = ensureId(pr?.discount_type);
                if (dtId) {
                    const dt = discountMap.get(String(dtId));
                    if (dt) linePct = dt.pct;
                } else {
                    const linkId = ensureId(linksMap.get(pId)?.discount_type);
                    if (linkId) { const dt = discountMap.get(String(linkId)); if (dt) { linePct = dt.pct; dtId = linkId; } }
                    if (!dtId) dtId = ensureId(dType);
                }

                const newQty = toNum(pr?.received_quantity || 0) + qty;
                const lineGross = uPrice * newQty;
                const lineDisc = Number((lineGross * (linePct / 100)).toFixed(2));
                const lineNet = lineGross - lineDisc;
                const vatExclTotal = Number((lineNet / 1.12).toFixed(2));
                const vatAmtTotal = Number((lineNet - vatExclTotal).toFixed(2));
                const ewtAmtTotal = Number((vatExclTotal * 0.01).toFixed(2));

                const isRefill = Number(po?.is_refill ?? 0) === 1;
                const isSerialized = !!(productsMap.get(pId)?.is_serialized);
                const patch: Record<string, unknown> = {
                    receipt_no: receiptNo, receipt_date: receiptDate, received_quantity: newQty, received_date: nowISO(), 
                    isPosted: (isRefill || isSerialized) ? 0 : 1,
                    discount_type: dtId || null, discounted_amount: lineDisc,
                    vat_amount: vatAmtTotal, withholding_amount: ewtAmtTotal,
                    total_amount: Number(lineGross.toFixed(2))
                };
                if (m.lotNo) patch.lot_id = toNum(m.lotNo);
                if (m.batchNo) patch.batch_no = m.batchNo;
                if (m.expiryDate) patch.expiry_date = m.expiryDate;

                await fetchJson(`${base}/items/${POR_COLLECTION}/${porId}`, { method: "PATCH", body: JSON.stringify(patch) });

                // ✅ Handle Serial Numbers (Piece-by-Piece registration)
                const serials = Array.isArray(porSerials?.[porId]) ? porSerials[porId] : [];
                if (serials.length > 0) {
                    for (const sObj of serials) {
                        const snValue = typeof sObj === 'object' ? sObj.sn : sObj;
                        const serialPayload: Record<string, unknown> = {
                            purchase_order_product_id: Number(porId),
                            product_id: Number(pId),
                            serial_no: String(snValue).trim(),
                            rfid_code: `M-${String(snValue).trim()}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        };
                        
                        if (typeof sObj === 'object') {
                            if (sObj.tareWeight) serialPayload.tare_weight = toNum(sObj.tareWeight);
                            if (sObj.expiryDate) {
                                // Ensure date is valid for DB (YYYY-MM-DD)
                                serialPayload.expiry_date = sObj.expiryDate;
                            }
                        }

                        // Try to insert serial, if it fails due to duplicate RFID, it will be caught
                        await fetchJson(`${base}/items/purchase_order_receiving_items`, {
                            method: "POST",
                            body: JSON.stringify(serialPayload)
                        }).catch(e => {
                            console.error(`Serial insertion failed for ${snValue}:`, e.message);
                            // If it fails, we might want to try with a unique RFID fallback if it's critical
                            // but usually we want to respect the uniqueness constraint
                        });

                        // ✅ NEW: Save to purchase_order_receiving_serial table for all POs (dev-rule.md requirement)
                        const recSerialPayload: Record<string, unknown> = {
                            purchase_order_product_id: Number(porId),
                            product_id: Number(pId),
                            serial_number: String(snValue).trim(),
                        };
                        if (typeof sObj === 'object' && sObj.tareWeight) {
                            recSerialPayload.tare_weight = toNum(sObj.tareWeight);
                        }

                        await fetchJson(`${base}/items/purchase_order_receiving_serial`, {
                            method: "POST",
                            body: JSON.stringify(recSerialPayload)
                        }).catch(e => {
                            console.error(`Failed to insert into purchase_order_receiving_serial for ${snValue}:`, e.message);
                        });
                    }
                }
            }

            const fLines = await fetchPOProductsByPOId(base, thePoId), fPors = await fetchPORByPOIds(base, [thePoId]);
            const updatedPorIdsByKey = buildPorIdsByKey(fPors);

            const isRefill = Number(po?.is_refill ?? 0) === 1;
            const fully = isFullyReceived(thePoId, fLines, fPors);
            const hasRec = fPors.some(r => toStr(r.receipt_no) || toNum(r.received_quantity) > 0);
            const nextStatus = fully ? (isRefill ? 13 : 6) : (hasRec ? 9 : po.inventory_status);
            const sMap: Record<string, string> = { "1": "Requested", "3": "Approved", "6": "Received", "9": "Partially Received", "13": "For Receiving" };
            const nStatusKey = String(nextStatus);
            const currStatusKey = String(toNum(po.inventory_status));
            console.log(`[RECEIVING DEBUG] PO #${thePoId} updated. nextStatus: ${sMap[nStatusKey] || "???"}(${nextStatus}) | fully: ${fully}, hasRec: ${hasRec}, currentDB: ${sMap[currStatusKey] || "???"}(${po.inventory_status})`);

            // ✅ Determine isInvoice status
            const poIsInvoice = (Number(getVal(po, "receiving_type", "receivingType")) === 2) || 
                          (toNum(getVal(po, "vat_amount", "vatAmount")) > 0) || 
                          (toNum(getVal(po, "withholding_tax_amount", "withholdingTaxAmount")) > 0);

            // ✅ Recalculate PO header totals from all receiving rows
            let poGross = 0, poDiscount = 0;
            for (const r of fPors) {
                const rQty = toNum(r.received_quantity);
                const rPrice = toNum(r.unit_price);
                poGross += rQty * rPrice;
                // Use the POR's own discount data if available
                const rPid = toNum(r.product_id);
                const rDtId = ensureId(r.discount_type);
                let rPct = poDiscountPercent;
                if (rDtId) { const dt = discountMap.get(String(rDtId)); if (dt) rPct = dt.pct; }
                else { const linkId = ensureId(linksMap.get(rPid)?.discount_type); if (linkId) { const dt = discountMap.get(String(linkId)); if (dt) rPct = dt.pct; } }
                poDiscount += rQty * Number((rPrice * (rPct / 100)).toFixed(2));
            }
            const poNet = Math.max(0, poGross - poDiscount);
            const priceType = toStr(getVal(po, "price_type", "priceType"), "Cost Per Unit");
            const isExclusive = priceType.toUpperCase() === "VAT EXCLUSIVE";

            const patchPO: Record<string, unknown> = { inventory_status: nextStatus };
            if (receiverId) patchPO.receiver_id = receiverId;
            if (fully) patchPO.date_received = nowISO();

            // ✅ Only apply VAT/EWT totals if the PO is an Invoice
            if (poIsInvoice) {
                let vatTotal = 0, ewtTotal = 0;
                if (isExclusive) { vatTotal = poNet * 0.12; ewtTotal = poNet * 0.01; }
                else { const vatableAmt = poNet / 1.12; vatTotal = poNet - vatableAmt; ewtTotal = vatableAmt * 0.01; }
                patchPO.vat_amount = Number(vatTotal.toFixed(2));
                patchPO.withholding_tax_amount = Number(ewtTotal.toFixed(2));
            }
            patchPO.total_amount = Number(poNet.toFixed(2));

            await fetchJson(`${base}/items/${PO_COLLECTION}/${thePoId}`, { method: "PATCH", body: JSON.stringify(patchPO) }).catch(() => {});

            // ✅ Sync the "received" flag in purchase_order_products for each line
            for (const ln of fLines) {
                const pid = toNum(ln.product_id);
                const bid = toNum(ln.branch_id ?? 0);
                const k = keyLine(thePoId, pid, bid);
                const pors = updatedPorIdsByKey.get(k) || [];
                const totalRec = pors.reduce((sum, id) => sum + effectiveReceivedQty(fPors.find(r => toNum(r.purchase_order_product_id) === id)), 0);
                const ordered = toNum(ln.ordered_quantity);
                
                const shouldBeReceived = (totalRec >= ordered && totalRec > 0) || (ordered === 0 && totalRec > 0);
                const currentReceived = toNum((ln as Record<string, unknown>).received || 0);

                if (shouldBeReceived && currentReceived !== 1) {
                    await fetchJson(`${base}/items/${PO_PRODUCTS_COLLECTION}/${ln.purchase_order_product_id}`, {
                        method: "PATCH", body: JSON.stringify({ received: 1 })
                    }).catch(() => {});
                } else if (!shouldBeReceived && currentReceived === 1) {
                    await fetchJson(`${base}/items/${PO_PRODUCTS_COLLECTION}/${ln.purchase_order_product_id}`, {
                        method: "PATCH", body: JSON.stringify({ received: 0 })
                    }).catch(() => {});
                }
            }

            // ✅ Return the full updated PO detail so the frontend can render the Receipt Preview
            // Include ALL product IDs: from PO lines AND from receiving rows (for extra products)
            const allProductIdsSet = new Set<number>();
            fLines.forEach(l => allProductIdsSet.add(toNum(l.product_id)));
            fPors.forEach(r => allProductIdsSet.add(toNum(r.product_id)));
            const updatedProductIds = Array.from(allProductIdsSet);
            const updatedProductsMap = await fetchProductsMap(base, updatedProductIds);
            const allBranchIdsSet = new Set<number>();
            fLines.forEach(l => allBranchIdsSet.add(toNum(l.branch_id ?? 0)));
            fPors.forEach(r => allBranchIdsSet.add(toNum(r.branch_id)));
            const updatedBranchesMap = await fetchBranchesMap(base, Array.from(allBranchIdsSet));
            const updatedSupplierMap = await fetchSupplierNames(base, [toNum(po.supplier_name)]);
            
            const updatedAllocationsMap = new Map<number, unknown[]>();
            const processedLinesSet = new Set<string>();

            // 1. Process standard PO lines
            for (const ln of fLines) {
                const pid = toNum(ln.product_id);
                const bid = toNum(ln.branch_id ?? 0);
                const k = keyLine(thePoId, pid, bid);
                processedLinesSet.add(k);
                const p = updatedProductsMap.get(pid);
                const pors = updatedPorIdsByKey.get(k) || [];
                const allRows = pors.map(id => fPors.find(r => toNum(r.purchase_order_product_id) === id)).filter(Boolean);
                
                const currentRows = allRows.filter(r => toStr(r!.receipt_no) === toStr(receiptNo));
                const previousRows = allRows.filter(r => toStr(r!.receipt_no) !== toStr(receiptNo));
                
                const prevRecQty = previousRows.reduce((sum, r) => sum + effectiveReceivedQty(r!), 0);
                const currRecQty = currentRows.reduce((sum, r) => sum + effectiveReceivedQty(r!), 0);
                const ordered = toNum(ln.ordered_quantity);
                const startingBalance = Math.max(0, ordered - prevRecQty);

                if (currRecQty <= 0 && startingBalance <= 0) continue; // Skip if nothing happened and nothing expected

                const lineDiscountTypeId = linksMap.get(pid)?.discount_type;
                let lineDiscountPercent = poDiscountPercent;
                let lineDiscountTypeStr = dType ? toStr(dType.discount_type || dType.name, "Standard") : "Standard";
                const resId = ensureId(lineDiscountTypeId);
                if (resId) {
                    const dt = discountMap.get(String(resId));
                    if (dt) { lineDiscountPercent = dt.pct; lineDiscountTypeStr = dt.name; }
                }

                const dAmt = toNum(ln.unit_price) * (lineDiscountPercent / 100);
                updatedAllocationsMap.set(bid, [...(updatedAllocationsMap.get(bid) ?? []), {
                    id: pors[0] ? String(pors[0]) : `${pid}-${bid}`, porId: String(pors[0] || ""),
                    purchaseOrderProductId: String(ln.purchase_order_product_id), // Passed to align serial tagging correctly
                    productId: String(pid), branchId: String(bid), name: toStr(p?.product_name, `Product #${pid}`),
                    barcode: productDisplayCode(p, pid), uom: String(p?.unit_of_measurement?.unit_shortcut ?? "BOX").toUpperCase(),
                    expectedQty: startingBalance, receivedQty: currRecQty, requiresRfid: false,
                    isReceived: currRecQty >= startingBalance && startingBalance > 0, unitPrice: toNum(ln.unit_price),
                    discountType: lineDiscountTypeStr, discountAmount: dAmt, netAmount: currRecQty * (toNum(ln.unit_price) - dAmt)
                }]);
            }

            // 2. Process extra POR rows that aren't in fLines
            for (const r of fPors) {
                if (toStr(r.receipt_no) !== toStr(receiptNo)) continue; // ONLY show items from THIS receipt
                
                const pid = toNum(r.product_id);
                const bid = toNum(r.branch_id);
                const k = keyLine(thePoId, pid, bid);
                if (processedLinesSet.has(k)) continue;
                processedLinesSet.add(k);

                const p = updatedProductsMap.get(pid);
                const recQty = toNum(r.received_quantity);
                const lineDiscountTypeId = linksMap.get(pid)?.discount_type;
                let lineDiscountPercent = poDiscountPercent;
                let lineDiscountTypeStr = "Standard";
                const resId = ensureId(lineDiscountTypeId);
                if (resId) {
                    const dt = discountMap.get(String(resId));
                    if (dt) { lineDiscountPercent = dt.pct; lineDiscountTypeStr = dt.name; }
                }

                const dAmt = toNum(r.unit_price) * (lineDiscountPercent / 100);
                updatedAllocationsMap.set(bid, [...(updatedAllocationsMap.get(bid) ?? []), {
                    id: String(r.purchase_order_product_id), porId: String(r.purchase_order_product_id),
                    productId: String(pid), branchId: String(bid), name: toStr(p?.product_name, `Product #${pid}`),
                    barcode: productDisplayCode(p, pid), uom: String(p?.unit_of_measurement?.unit_shortcut ?? "BOX").toUpperCase(),
                    expectedQty: 0, receivedQty: recQty, requiresRfid: false,
                    isReceived: true, unitPrice: toNum(r.unit_price),
                    discountType: lineDiscountTypeStr, discountAmount: dAmt, netAmount: recQty * (toNum(r.unit_price) - dAmt)
                }]);
            }

            const detail = {
                id: String(thePoId), poNumber: toStr(po.purchase_order_no),
                supplier: { id: String(po.supplier_name), name: updatedSupplierMap.get(toNum(po.supplier_name)) || "Supplier" },
                status: receivingStatusFrom(thePoId, fLines, fPors),
                allocations: Array.from(updatedAllocationsMap.entries()).map(([bid, items]) => ({ branch: { id: String(bid), name: updatedBranchesMap.get(bid) || `Branch ${bid}` }, items })),
                priceType: toStr(getVal(po, "price_type", "priceType"), "Cost Per Unit"),
                isInvoice: poIsInvoice,
                createdAt: po.date_encoded ? new Date(po.date_encoded).toISOString() : new Date().toISOString(),
                isRefill: Number(po.is_refill ?? 0) === 1,
                isTagged: Number(po.is_tagged ?? 0) === 1,
            };

            return ok({ success: true, detail });
        }

        if (action === "get_supplier_products") {
            const supplierId = toNum(body.supplierId);
            if (!supplierId) return bad("Missing Supplier ID", 400);

            // Fetch links with expanded discount info
            const linksUrl = `${base}/items/${PRODUCT_SUPPLIER_COLLECTION}?limit=-1&filter[supplier_id][_eq]=${supplierId}&fields=product_id,discount_type.*,discount_type.line_per_discount_type.line_id.*`;
            const lj = await fetchJson<{ data: Array<Record<string, unknown>> }>(linksUrl);
            const links = lj?.data ?? [];
            if (!links.length) return ok([]);

            const pids = links.map(r => toNum(r.product_id)).filter(id => id > 0);
            if (!pids.length) return ok([]);

            // Then get the full product details (only BOX items)
            const map = await fetchProductsMap(base, pids);
            
            const results = links.map(link => {
                const pid = toNum(link.product_id);
                const p = map.get(pid);
                if (!p) return null;
                if (Number(p.unit_of_measurement?.unit_id ?? p.unit_of_measurement) !== 11) return null;

                const dt = link.discount_type as Record<string, unknown> | null | undefined;
                let discTypeStr = "Standard";
                let discPct = 0;
                if (dt) {
                    discTypeStr = toStr(dt.discount_type || dt.name, "Standard");
                    const lines = (dt.line_per_discount_type as DiscountLine[]) || [];
                    if (lines.length > 0) discPct = calculateDiscountFromLines(lines);
                    else if (toNum(dt.total_percent) > 0) discPct = toNum(dt.total_percent);
                    else discPct = deriveDiscountPercentFromCode(discTypeStr);
                }

                return {
                    productId: String(p.product_id),
                    name: String(p.product_name),
                    sku: String(p.barcode || p.product_code),
                    barcode: String(p.barcode || p.product_code),
                    unitPrice: toNum(p.cost_per_unit),
                    uom: "BOX",
                    discountType: discTypeStr,
                    discountPercent: discPct
                };
            }).filter(Boolean);

            return ok(results);
        }

        if (action === "get_lots") {
            const url = `${base}/items/${LOTS_COLLECTION}?limit=-1&sort=lot_name&fields=lot_id,lot_name`;
            const j = await fetchJson<{ data: Record<string, unknown>[] }>(url);
            return ok(j?.data ?? []);
        }

        if (action === "get_units") {
            const url = `${base}/items/${UNITS_COLLECTION}?limit=-1&sort=unit_name&fields=unit_id,unit_name,unit_shortcut`;
            const j = await fetchJson<{ data: Record<string, unknown>[] }>(url);
            return ok(j?.data ?? []);
        }

        // =====================
        // REFILL RECEIVING ACTIONS
        // =====================

        // Fetch pre-tagged serials from purchase_order_serial for a given purchase_order_product_id (porId) or list of ids (porIds)
        // Comments: Updated to support batch-fetching for showing expected returning serials inline in Step 3 workbench.
        if (action === "get_tagged_serials") {
            const porId = toNum(body.porId);
            const porIds: number[] = Array.isArray(body.porIds) ? body.porIds.map((val: unknown) => toNum(val)).filter((n: number) => n > 0) : [];

            if (!porId && porIds.length === 0) return bad("Missing porId or porIds", 400);

            let filterStr = "";
            if (porIds.length > 0) {
                filterStr = `filter[purchase_order_product_id][_in]=${porIds.join(",")}`;
            } else {
                filterStr = `filter[purchase_order_product_id][_eq]=${porId}`;
            }

            const url = `${base}/items/purchase_order_serial?limit=-1&${filterStr}&fields=id,serial_number,product_id,purchase_order_product_id`;
            const j = await fetchJson<{ data: { id: number; serial_number: string; product_id: number; purchase_order_product_id: number }[] }>(url);
            return ok(j?.data ?? []);
        }

        // Three-tier serial validation for refill rapid scan:
        // 1. purchase_order_serial (pre-tagged) → source: "tagged"
        // 2. cylinder_assets (known asset) → source: "asset"
        // 3. Not found → requiresRegistration: true
        // Three-tier serial validation for refill rapid scan:
        // 1. purchase_order_serial (pre-tagged inside this PO) -> source: "tagged"
        // 2. cylinder_assets (known asset) -> source: "asset"
        // 3. Not found -> requiresRegistration: true
        // Comments: Updated check to query PO-wide for auto-allocation routing.
        if (action === "validate_scan_serial") {
            const serialNumber = toStr(body.serialNumber).toUpperCase();
            const poId = toNum(body.poId);
            if (!serialNumber) return bad("Missing serialNumber", 400);

            // Step 1: Check purchase_order_serial (PO-wide check for auto-allocation)
            if (poId) {
                // Get all purchase_order_product_ids for this PO via purchase_order_products table
                const allPorUrl = `${base}/items/${PO_PRODUCTS_COLLECTION}?limit=-1&filter[purchase_order_id][_eq]=${poId}&fields=purchase_order_product_id,product_id`;
                const allPorJ = await fetchJson<{ data: { purchase_order_product_id: number; product_id: number }[] }>(allPorUrl).catch(() => null);
                const allPorIds = (allPorJ?.data ?? []).map(r => r.purchase_order_product_id);
                
                if (allPorIds.length > 0) {
                    const taggedUrl = `${base}/items/purchase_order_serial?limit=1&filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&filter[purchase_order_product_id][_in]=${allPorIds.join(",")}&fields=id,serial_number,product_id,purchase_order_product_id`;
                    const taggedJ = await fetchJson<{ data: { id: number; serial_number: string; product_id: number; purchase_order_product_id: number }[] }>(taggedUrl).catch(() => null);
                    
                    if (taggedJ?.data?.length) {
                        const matched = taggedJ.data[0];
                        return ok({
                            valid: true,
                            source: "tagged",
                            serial: serialNumber,
                            purchaseOrderProductId: matched.purchase_order_product_id
                        });
                    }
                }
            }

            // Step 2: Check cylinder_assets
            const assetUrl = `${base}/items/cylinder_assets?limit=1&filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&filter[is_deleted][_eq]=0&fields=id,serial_number,product_id,cylinder_status,cylinder_condition,tare_weight,expiration_date,current_supplier_id`;
            const assetJ = await fetchJson<{ data: Record<string, unknown>[] }>(assetUrl).catch(() => null);
            if (assetJ?.data?.length) {
                const asset = assetJ.data[0];
                return ok({
                    valid: true,
                    source: "asset",
                    serial: serialNumber,
                    asset: {
                        id: asset.id,
                        cylinder_status: asset.cylinder_status,
                        cylinder_condition: asset.cylinder_condition,
                        tare_weight: asset.tare_weight,
                        expiration_date: asset.expiration_date,
                        product_id: asset.product_id,
                    }
                });
            }

            // Step 3: Not found — requires new registration
            return ok({ valid: false, requiresRegistration: true, serial: serialNumber });
        }

        // Register a new cylinder into cylinder_assets with status WITH_SUPPLIER
        if (action === "register_cylinder") {
            const { productId, serialNumber, tareWeight, expirationDate, currentSupplierId } = body;
            if (!productId || !serialNumber) return bad("Missing productId or serialNumber", 400);

            const payload: Record<string, unknown> = {
                product_id: toNum(productId),
                serial_number: toStr(serialNumber).toUpperCase(),
                cylinder_status: "WITH_SUPPLIER",
                cylinder_condition: "GOOD",
                is_deleted: 0,
            };
            if (tareWeight) payload.tare_weight = parseFloat(String(tareWeight));
            if (expirationDate) payload.expiration_date = toStr(expirationDate);
            if (currentSupplierId) payload.current_supplier_id = toNum(currentSupplierId);

            const created = await fetchJson<{ data: Record<string, unknown> }>(`${base}/items/cylinder_assets`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            return ok({ id: created?.data?.id, serial_number: created?.data?.serial_number });
        }

        return bad("Unknown action");

    } catch (e: unknown) { return bad((e as Error).message, 500); }
}
