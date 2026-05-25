import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";

import { cookies } from "next/headers";
import { getDirectusBase, directusHeaders } from "@/modules/industrial-distribution-system/supply-chain-management/supplier-management/purchase-order-summary/providers/fetchProviders";

import PurchaseOrderSummaryModule from "@/modules/industrial-distribution-system/supply-chain-management/supplier-management/purchase-order-summary/PurchaseOrderSummaryModule";
import { PurchaseOrder, Supplier, StatusRef } from "@/modules/industrial-distribution-system/supply-chain-management/supplier-management/purchase-order-summary/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

// ── JWT Helper Functions ──────────────────────────────────────────────────────
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;

        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
    for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
    const payload = token ? decodeJwtPayload(token) : null;

    const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
    const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
    const email = pickString(payload, ["email", "Email"]);

    const name = [first, last].filter(Boolean).join(" ") || email || "User";

    return {
        name,
        email: email || "",
        avatar: "/avatars/shadcn.jpg",
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
    const n = parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

// ── Data Fetching ─────────────────────────────────────────────────────────────
async function getData(): Promise<{
    poData: PurchaseOrder[];
    suppliers: Supplier[];
    paymentStatuses: StatusRef[];
    transactionStatuses: StatusRef[];
}> {
    try {
        const base = getDirectusBase();
        const headers = directusHeaders();

        // ── Step 1: Resolve Industrial supplier IDs (division_id = 1) ──────────
        const supRes = await fetch(
            `${base}/items/suppliers?limit=-1&fields=id,supplier_name,supplier_type&filter[division_id][_eq]=1`,
            { cache: "no-store", headers }
        );
        const supsJson = await supRes.json() as { data: Record<string, unknown>[] };
        const allSuppliers = supsJson.data || [];
        const industrialSupplierIds = allSuppliers.map(s => Number(s.id)).filter(Boolean);

        // Short-circuit if no industrial suppliers exist
        if (!industrialSupplierIds.length) {
            const [payRes, transRes] = await Promise.all([
                fetch(`${base}/items/payment_status?limit=-1`, { cache: "no-store", headers }),
                fetch(`${base}/items/transaction_status?limit=-1`, { cache: "no-store", headers }),
            ]);
            return {
                poData: [],
                suppliers: allSuppliers as unknown as Supplier[],
                paymentStatuses: (await payRes.json()).data || [],
                transactionStatuses: (await transRes.json()).data || [],
            };
        }

        const idList = industrialSupplierIds.join(",");

        // ── Step 2: Fetch POs for Industrial suppliers ────
        const poFields = [
            "*",
            "supplier_name.id",
            "supplier_name.division_id",
        ].join(",");

        const [poRes, payRes, transRes, popRes, serProdRes] = await Promise.all([
            fetch(
                `${base}/items/purchase_order?limit=-1` +
                `&fields=${encodeURIComponent(poFields)}` +
                `&filter[supplier_name][_in]=${encodeURIComponent(idList)}`,
                { cache: "no-store", headers }
            ),
            fetch(`${base}/items/payment_status?limit=-1`, { cache: "no-store", headers }),
            fetch(`${base}/items/transaction_status?limit=-1`, { cache: "no-store", headers }),
            fetch(
                `${base}/items/purchase_order_products?limit=-1` +
                `&fields=purchase_order_product_id,purchase_order_id,product_id`,
                { cache: "no-store", headers }
            ),
            fetch(
                `${base}/items/products?limit=-1&fields=product_id&filter[is_serialized][_eq]=1`,
                { cache: "no-store", headers }
            ),
        ]);

        const pos = await poRes.json() as { data: Record<string, unknown>[] };
        const pays = await payRes.json();
        const trans = await transRes.json();
        const popData = await popRes.json();
        const serProdData = await serProdRes.json();

        const popRows: Record<string, unknown>[] = popData.data || [];
        const serializedProductIds = new Set((serProdData.data || []).map((p: Record<string, unknown>) => toNum(p.product_id)));

        const poList = pos.data || [];

        // ── Step 3: Determine is_serialized_po via purchase_order_products ────────
        //
        //    A PO is flagged is_serialized_po = true if any of its ordered
        //    products have is_serialized = 1. This works for Requested (1)
        //    POs as well as partially/fully received ones.
        // ────────────────────────────────────────────────────────────────────────
        const serializedPoIds = new Set<number>();
        for (const p of popRows) {
            const productId = toNum(p.product_id);
            if (serializedProductIds.has(productId)) {
                serializedPoIds.add(toNum(p.purchase_order_id));
            }
        }

        // ── Step 5: Enrich each PO ───────────────────────────────────────────
        const enrichedPoList = poList.map((po: Record<string, unknown>) => {
            const poId = toNum(po.purchase_order_id);

            // Normalize supplier_name: Directus expands to object due to nested fields.
            // Restore to numeric ID for frontend lookups.
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

            // ── is_serialized_po ─────────────────────────────────────
            const isSerializedPo = serializedPoIds.has(poId);

            // ── Inventory status ────────────────────────────────────────────────
            const effectiveStatus = toNum(po.inventory_status || 0);

            return {
                ...po,
                supplier_name: supplierId || po.supplier_name,
                inventory_status: effectiveStatus,
                is_serialized_po: isSerializedPo,
                is_industrial_supplier: isIndustrialSupplier,
            };
        });

        return {
            poData: enrichedPoList as PurchaseOrder[],
            suppliers: allSuppliers as unknown as Supplier[],
            paymentStatuses: pays.data || [],
            transactionStatuses: trans.data || [],
        };

    } catch (error) {
        console.error("Fetch error:", error);
        return { poData: [], suppliers: [], paymentStatuses: [], transactionStatuses: [] };
    }
}


export default async function Page() {
    // Next.js cookies() is async in App Router
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

    const headerUser = buildHeaderUserFromToken(token);
    const { poData, suppliers, paymentStatuses, transactionStatuses } = await getData();

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* ===== Header ===== */}
            <header
                className="
                    sticky top-2 z-50 relative
                    flex h-16 shrink-0 items-center justify-between
                    border-b bg-background shadow-sm
                    before:content-[''] before:absolute before:inset-x-0
                    before:-top-2 before:h-2 before:bg-background
                "
            >
                <div className="flex h-full items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="#">
                                    Supplier Management
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>
                                    Purchase Order Summary
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="flex h-full items-center px-4">
                    <NavUser user={headerUser} />
                </div>
            </header>

            {/* ===== Content ===== */}
            <ScrollArea className="min-h-0 flex-1">
                <div className="p-4">
                    <PurchaseOrderSummaryModule
                        poData={poData}
                        suppliers={suppliers}
                        paymentStatuses={paymentStatuses}
                        transactionStatuses={transactionStatuses}
                    />
                </div>
            </ScrollArea>
        </div>
    );
}