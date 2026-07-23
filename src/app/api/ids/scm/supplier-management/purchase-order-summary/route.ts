import { NextRequest, NextResponse } from 'next/server';

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

interface ReceiptItem {
    productName: string;
    branchName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    batchNo: string;
    expiryDate: string;
    isSerialized: boolean;
    serializedItemCount: number;
}

interface ReceiptGroup {
    receiptNo: string;
    receiptDate: string;
    isPosted: boolean;
    items: ReceiptItem[];
}

// Serial audit log row shapes from Directus
interface TaggedSerialRow {
    id: number;
    purchase_order_product_id: number;
    product_id: number;
    serial_number: string;
}

interface ReceivedSerialRow {
    receiving_item_id: number;
    purchase_order_product_id: number;
    product_id: number;
    serial_number: string;
    created_at: string;
    tare_weight: number | null;
}

function toNum(v: unknown) { 
    const n = parseFloat(String(v ?? "").replace(/,/g, "")); 
    return Number.isFinite(n) ? n : 0; 
}
function toStr(v: unknown, fb = "") { 
    const s = String(v ?? "").trim(); 
    return s ? s : fb; 
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================
// GET - Fetch all POs
// =====================
export async function GET() {
    try {
        const base = getDirectusBase();

        const supRes = await fetchJson<{ data: { id: number }[] }>(
            `${base}/items/suppliers?limit=-1&fields=id&filter[division_id][_eq]=1`
        );
        const industrialSupplierIds = (supRes.data || []).map(s => s.id).filter(Boolean);

        if (!industrialSupplierIds.length) {
            return NextResponse.json({ data: [] });
        }

        const idList = encodeURIComponent(industrialSupplierIds.join(","));
        const poFields = ["*", "supplier_name.id", "supplier_name.division_id"].join(",");
        const apiUrl = `${base}/items/purchase_order?limit=-1&fields=${encodeURIComponent(poFields)}&filter[supplier_name][_in]=${idList}`;

        const poData = await fetchJson<{ data: Record<string, unknown>[] }>(apiUrl);
        const poList = poData.data || [];

        if (!poList.length) {
            return NextResponse.json({ data: [] });
        }

        const allPoIds = poList.map(po => toNum(po.purchase_order_id)).filter(Boolean);

        const popResForSer = await fetchJson<{ data: { purchase_order_id: number; product_id: { product_id: number; is_serialized: number | boolean } }[] }>(
            `${base}/items/purchase_order_products` +
            `?limit=-1` +
            `&fields=purchase_order_id,product_id.product_id,product_id.is_serialized` +
            `&filter[purchase_order_id][_in]=${encodeURIComponent(allPoIds.join(","))}`
        );
        
        const serializedPoIds = new Set<number>();
        for (const row of (popResForSer.data || [])) {
            const prod = row.product_id;
            if (prod?.is_serialized == 1 || prod?.is_serialized === true) {
                serializedPoIds.add(toNum(row.purchase_order_id));
            }
        }

        const [porRes, popRes2] = await Promise.all([
            fetchJson<{ data: Record<string, unknown>[] }>(
                `${base}/items/purchase_order_receiving` +
                `?limit=-1` +
                `&fields=purchase_order_product_id,purchase_order_id,received_quantity,isPosted,receipt_no` +
                `&filter[purchase_order_id][_in]=${encodeURIComponent(allPoIds.join(","))}`
            ),
            fetchJson<{ data: Record<string, unknown>[] }>(
                `${base}/items/purchase_order_products` +
                `?limit=-1` +
                `&fields=purchase_order_product_id,purchase_order_id,ordered_quantity` +
                `&filter[purchase_order_id][_in]=${encodeURIComponent(allPoIds.join(","))}`
            ),
        ]);

        const porRows = porRes.data || [];
        const popRows = popRes2.data || [];

        const orderedByPo = new Map<number, number>();
        for (const p of popRows) {
            const poId = toNum(p.purchase_order_id);
            orderedByPo.set(poId, (orderedByPo.get(poId) || 0) + toNum(p.ordered_quantity));
        }

        const receivedByPo = new Map<number, number>();
        const hasReceiptByPo = new Map<number, boolean>();
        for (const r of porRows) {
            const poId = toNum(r.purchase_order_id);
            receivedByPo.set(poId, (receivedByPo.get(poId) || 0) + toNum(r.received_quantity));
            if (r.receipt_no || toNum(r.received_quantity) > 0) {
                hasReceiptByPo.set(poId, true);
            }
        }

        const processed = poList.map(po => {
            const poId = toNum(po.purchase_order_id);
            const supplierObj = po?.supplier_name;
            
            const supplierId: number =
                typeof supplierObj === "object" && supplierObj !== null
                    ? toNum((supplierObj as Record<string, unknown>)?.id ?? (supplierObj as Record<string, unknown>)?.supplier_id ?? 0)
                    : toNum(supplierObj ?? 0);
                    
            const divisionId: number =
                typeof supplierObj === "object" && supplierObj !== null
                    ? toNum((supplierObj as Record<string, unknown>)?.division_id ?? 0)
                    : 0;
                    
            const isIndustrialSupplier = divisionId === 1;
            const isSerializedPo = serializedPoIds.has(poId);

            const dbStatus = toNum(po.inventory_status || 0);
            const hasReceipt = hasReceiptByPo.get(poId) || false;
            const totalOrdered = orderedByPo.get(poId) || 0;
            const totalReceived = receivedByPo.get(poId) || 0;
            const isApproved = po.date_approved || po.approver_id;

            let effectiveStatus = dbStatus;
            if (dbStatus !== 14 && dbStatus !== 7) {
                if (hasReceipt) {
                    const fullyReceived = totalOrdered > 0 && totalReceived >= totalOrdered;
                    effectiveStatus = fullyReceived ? 6 : 9;
                } else if (isApproved && (dbStatus === 1 || dbStatus === 0)) {
                    effectiveStatus = 3;
                }
            }

            return {
                ...po,
                supplier_name: supplierId || po.supplier_name,
                inventory_status: effectiveStatus,
                is_serialized_po: isSerializedPo,
                is_industrial_supplier: isIndustrialSupplier,
            };
        });

        return NextResponse.json({ data: processed });

    } catch (error) {
        console.error("GET Route Error:", error);
        return NextResponse.json({ error: (error as Error)?.message || "Internal Server Error" }, { status: 500 });
    }
}

// =====================
// POST - Fetch Details
// =====================
export async function POST(req: NextRequest) {
    try {
        const base = getDirectusBase();
        const body = await req.json().catch(() => ({}));
        const action = toStr(body.action);

        if (action === "get_po_details" || action === "get_receipts") {
            const poId = toNum(body.poId);
            if (!poId) return NextResponse.json({ error: "Missing poId" }, { status: 400 });

            const popUrl =
                `${base}/items/purchase_order_products` +
                `?limit=-1` +
                `&filter[purchase_order_id][_eq]=${poId}` +
                `&fields=purchase_order_product_id,purchase_order_id,product_id,branch_id,ordered_quantity,unit_price,total_amount,discounted_price`;
            const popJson = await fetchJson<{ data: Record<string, unknown>[] }>(popUrl);
            const allocationsRows = popJson?.data ?? [];

            const porUrl =
                `${base}/items/purchase_order_receiving` +
                `?limit=-1` +
                `&filter[purchase_order_id][_eq]=${poId}` +
                `&fields=purchase_order_product_id,purchase_order_id,product_id,branch_id,received_quantity,receipt_no,receipt_date,received_date,isPosted,unit_price,discounted_amount,total_amount,batch_no,expiry_date`;
            const porJson = await fetchJson<{ data: Record<string, unknown>[] }>(porUrl);
            const porRows = porJson?.data ?? [];

            const allPOPIds = allocationsRows.map(r => toNum(r.purchase_order_product_id)).filter(Boolean);
            let receivingItems: Record<string, unknown>[] = [];

            if (allPOPIds.length) {
                for (const ids of chunk(allPOPIds, 250)) {
                    const riRes = await fetchJson<{ data: Record<string, unknown>[] }>(
                        `${base}/items/purchase_order_receiving_items` +
                        `?limit=-1` +
                        `&filter[purchase_order_product_id][_in]=${encodeURIComponent(ids.join(","))}` +
                        `&fields=receiving_item_id,purchase_order_product_id,product_id,rfid_code,serial_no`
                    );
                    receivingItems = [...receivingItems, ...(riRes.data || [])];
                }
            }

            const productIds = Array.from(new Set([
                ...allocationsRows.map(r => toNum(r.product_id)),
                ...porRows.map(r => toNum(r.product_id)),
                ...receivingItems.map(r => toNum(r.product_id)),
            ])).filter(Boolean);

            const branchIds = Array.from(new Set([
                ...allocationsRows.map(r => toNum(r.branch_id)),
                ...porRows.map(r => toNum(r.branch_id)),
            ])).filter(Boolean);

            const [productsMap, branchesMap] = await Promise.all([
                (async () => {
                    const map = new Map<number, Record<string, unknown>>();
                    if (!productIds.length) return map;
                    for (const ids of chunk(productIds, 250)) {
                        const url =
                            `${base}/items/products` +
                            `?limit=-1` +
                            `&filter[product_id][_in]=${encodeURIComponent(ids.join(","))}` +
                            `&fields=product_id,product_name,barcode,product_code,is_serialized`;
                        const j = await fetchJson<{ data: Record<string, unknown>[] }>(url);
                        for (const p of (j?.data ?? [])) map.set(toNum(p.product_id), p);
                    }
                    return map;
                })(),
                (async () => {
                    const map = new Map<number, string>();
                    if (!branchIds.length) return map;
                    for (const ids of chunk(branchIds, 250)) {
                        const url =
                            `${base}/items/branches` +
                            `?limit=-1` +
                            `&filter[id][_in]=${encodeURIComponent(ids.join(","))}` +
                            `&fields=id,branch_name,branch_description`;
                        const j = await fetchJson<{ data: Record<string, unknown>[] }>(url);
                        for (const b of (j?.data ?? [])) {
                            map.set(toNum(b.id), toStr(b.branch_name) || toStr(b.branch_description) || `Branch ${b.id}`);
                        }
                    }
                    return map;
                })()
            ]);

            const serializedPOPIds = new Set<number>(
                receivingItems
                    .filter(ri => {
                        const prod = productsMap.get(toNum(ri.product_id));
                        return prod?.is_serialized == 1 || prod?.is_serialized === true;
                    })
                    .map(ri => toNum(ri.purchase_order_product_id))
            );

            const allocations = allocationsRows.map(row => {
                const pid = toNum(row.product_id);
                const bid = toNum(row.branch_id);
                const popId = toNum(row.purchase_order_product_id);

                const totalReceived = porRows
                    .filter(r => toNum(r.product_id) === pid && toNum(r.branch_id) === bid)
                    .reduce((sum, r) => sum + toNum(r.received_quantity), 0);

                const product = productsMap.get(pid);
                const scannedSerializedCount = receivingItems.filter(ri => {
                    const prod = productsMap.get(toNum(ri.product_id));
                    return (
                        toNum(ri.purchase_order_product_id) === popId &&
                        (prod?.is_serialized == 1 || prod?.is_serialized === true)
                    );
                }).length;

                return {
                    id: row.purchase_order_product_id,
                    productId: pid,
                    productName: toStr(product?.product_name, `Product #${pid}`),
                    branchName: branchesMap.get(bid) || `Branch ${bid}`,
                    orderedQty: toNum(row.ordered_quantity),
                    receivedQty: totalReceived,
                    unitPrice: toNum(row.unit_price),
                    discount: toNum(row.discounted_price || 0),
                    total: toNum(row.total_amount),
                    isSerialized: product?.is_serialized == 1 || product?.is_serialized === true,
                    scannedSerializedCount,
                    hasSerializedReceivingItems: serializedPOPIds.has(popId),
                    status: totalReceived >= toNum(row.ordered_quantity)
                        ? "FULFILLED"
                        : totalReceived > 0
                            ? "PARTIAL"
                            : "OPEN",
                };
            });

            const receivedRows = porRows.filter(r => toStr(r.receipt_no));
            const receiptMap = new Map<string, ReceiptGroup>();

            for (const row of receivedRows) {
                const rno = toStr(row.receipt_no);
                if (!receiptMap.has(rno)) {
                    receiptMap.set(rno, {
                        receiptNo: rno,
                        receiptDate: toStr(row.receipt_date || row.received_date),
                        isPosted: toNum(row.isPosted) === 1,
                        items: [],
                    });
                }
                const receipt = receiptMap.get(rno) as ReceiptGroup;
                const pid = toNum(row.product_id);
                const popId = toNum(row.purchase_order_product_id);
                const product = productsMap.get(pid);
                const isSerialized = product?.is_serialized == 1 || product?.is_serialized === true;

                const serializedItemCount = receivingItems.filter(ri => (
                    toNum(ri.purchase_order_product_id) === popId &&
                    (productsMap.get(toNum(ri.product_id))?.is_serialized == 1 ||
                        productsMap.get(toNum(ri.product_id))?.is_serialized === true)
                )).length;

                receipt.items.push({
                    productName: toStr(product?.product_name, `Product #${row.product_id}`),
                    branchName: branchesMap.get(toNum(row.branch_id)) || `Branch ${row.branch_id}`,
                    quantity: toNum(row.received_quantity),
                    unitPrice: toNum(row.unit_price),
                    discount: toNum(row.discounted_amount),
                    total: toNum(row.total_amount),
                    batchNo: toStr(row.batch_no),
                    expiryDate: toStr(row.expiry_date),
                    isSerialized,
                    serializedItemCount,
                });

                if (toNum(row.isPosted) !== 1) receipt.isPosted = false;
            }

            const receipts = Array.from(receiptMap.values())
                .sort((a, b) => b.receiptNo.localeCompare(a.receiptNo));

            // ── Serial Audit Log ───────────────────────────────────────────────────────
            // Fetch the PO's is_refill and is_tagged flags to determine if serials apply
            let isRefillTagged = false;
            let taggedSerials: TaggedSerialRow[] = [];
            let receivedSerials: ReceivedSerialRow[] = [];

            try {
                const poFlagRes = await fetchJson<{ data: { is_refill: number; is_tagged: number }[] }>(
                    `${base}/items/purchase_order?filter[purchase_order_id][_eq]=${poId}&fields=is_refill,is_tagged&limit=1`
                );
                const poFlags = poFlagRes?.data?.[0];
                isRefillTagged = Number(poFlags?.is_refill) === 1 && Number(poFlags?.is_tagged) === 1;
            } catch (e) {
                console.warn("[PO Summary] Could not fetch is_refill/is_tagged:", e);
            }

            if (isRefillTagged && allPOPIds.length) {
                // purchase_order_serial.purchase_order_product_id → purchase_order_products.purchase_order_product_id
                for (const ids of chunk(allPOPIds, 250)) {
                    const res = await fetchJson<{ data: TaggedSerialRow[] }>(
                        `${base}/items/purchase_order_serial` +
                        `?limit=-1` +
                        `&filter[purchase_order_product_id][_in]=${encodeURIComponent(ids.join(","))}` +
                        `&fields=id,purchase_order_product_id,product_id,serial_number`
                    );
                    taggedSerials = [...taggedSerials, ...(res?.data ?? [])];
                }
            }

            // Always fetch received serials from purchase_order_receiving_serial if there are received rows
            const porIds = porRows.map(r => toNum(r.purchase_order_product_id)).filter(Boolean);
            if (porIds.length) {
                for (const ids of chunk(porIds, 250)) {
                    const res = await fetchJson<{ data: ReceivedSerialRow[] }>(
                        `${base}/items/purchase_order_receiving_serial` +
                        `?limit=-1` +
                        `&filter[purchase_order_product_id][_in]=${encodeURIComponent(ids.join(","))}` +
                        `&fields=receiving_item_id,purchase_order_product_id,product_id,serial_number,created_at,tare_weight`
                    );
                    receivedSerials = [...receivedSerials, ...(res?.data ?? [])];
                }
            }

            // Group expected + received serials by product for the audit log
            // expected = purchase_order_serial (pre-tagged before receiving)
            // received = purchase_order_receiving_serial (physically scanned at receiving)
            const serialsByProduct = new Map<number, {
                productId: number;
                productName: string;
                expected: { id: number; serialNumber: string }[];
                received: { id: number; serialNumber: string; createdAt: string; tareWeight: number | null }[];
            }>();

            // Build expected serial groups from purchase_order_serial
            for (const row of taggedSerials) {
                const pid = toNum(row.product_id);
                if (!serialsByProduct.has(pid)) {
                    const product = productsMap.get(pid);
                    serialsByProduct.set(pid, {
                        productId: pid,
                        productName: toStr(product?.product_name, `Product #${pid}`),
                        expected: [],
                        received: [],
                    });
                }
                serialsByProduct.get(pid)!.expected.push({
                    id: toNum(row.id),
                    serialNumber: toStr(row.serial_number),
                });
            }

            // Merge received serials from purchase_order_receiving_serial
            for (const row of receivedSerials) {
                const pid = toNum(row.product_id);
                if (!serialsByProduct.has(pid)) {
                    const product = productsMap.get(pid);
                    serialsByProduct.set(pid, {
                        productId: pid,
                        productName: toStr(product?.product_name, `Product #${pid}`),
                        expected: [],
                        received: [],
                    });
                }
                serialsByProduct.get(pid)!.received.push({
                    id: toNum(row.receiving_item_id),
                    serialNumber: toStr(row.serial_number),
                    createdAt: toStr(row.created_at),
                    tareWeight: row.tare_weight !== null && row.tare_weight !== undefined ? toNum(row.tare_weight) : null,
                });
            }

            const serials = {
                isRefillTagged,
                byProduct: Array.from(serialsByProduct.values()),
            };


            return NextResponse.json({ data: { allocations, receipts, serials } });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    } catch (error) {
        console.error("POST Route Error:", error);
        return NextResponse.json({ error: (error as Error)?.message || "Internal Server Error" }, { status: 500 });
    }
}