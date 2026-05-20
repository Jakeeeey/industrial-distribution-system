import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

async function safeFetch<T = unknown>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? json ?? []) as T[];
  } catch {
    return [];
  }
}

/**
 * GET /api/ids/crm/customer-registration/walk-in-transactions
 *
 * Returns recent sales orders belonging to Walk-in customers.
 *
 * Steps:
 *  1. Fetch customer_classification → find the "Walk-in" classification ID(s)
 *  2. Fetch customers whose `classification` is in those IDs → collect customer_codes
 *  3. Fetch recent sales_orders filtered by those customer_codes
 *  4. For each order, fetch sales_order_details + product names
 *  5. Return enriched WalkInTransaction array
 */
export async function GET() {
  if (!DIRECTUS_BASE) {
    return NextResponse.json(
      { error: "Directus base URL not configured" },
      { status: 500 },
    );
  }

  try {
    // ── 1. Find Walk-in classification ID(s) ──────────────────────────────
    const classifications = await safeFetch<{
      id: number;
      classification_name: string;
    }>(
      `${DIRECTUS_BASE}/items/customer_classification?limit=-1&fields=id,classification_name`,
    );

    const walkInIds = classifications
      .filter((c) => c.classification_name?.toLowerCase().includes("walk"))
      .map((c) => c.id);

    if (walkInIds.length === 0) {
      // No walk-in classification found — return empty gracefully
      return NextResponse.json({ data: [] });
    }

    // ── 2. Fetch walk-in customer codes ───────────────────────────────────
    const customerFilter = encodeURIComponent(
      JSON.stringify({ classification: { _in: walkInIds } }),
    );
    const customers = await safeFetch<{
      id: number;
      customer_code: string;
      customer_name: string;
      store_name?: string | null;
    }>(
      `${DIRECTUS_BASE}/items/customer?limit=-1&fields=id,customer_code,customer_name,store_name&filter=${customerFilter}`,
    );

    if (customers.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Map customer_code → display name for quick lookup
    const customerMap = new Map<string, string>();
    customers.forEach((c) => {
      if (c.customer_code) {
        customerMap.set(
          String(c.customer_code).trim(),
          c.customer_name || c.store_name || c.customer_code,
        );
      }
    });

    const customerCodes = Array.from(customerMap.keys());

    // ── 3. Fetch recent sales orders for walk-in customers ────────────────
    const orderFilter = encodeURIComponent(
      JSON.stringify({ customer_code: { _in: customerCodes } }),
    );
    const orderFields = [
      "order_id",
      "order_no",
      "customer_code",
      "order_date",
      "created_date",
      "order_status",
      "net_amount",
      "total_amount",
    ].join(",");

    const orders = await safeFetch<{
      order_id: number;
      order_no: string | null;
      customer_code: string | null;
      order_date: string | null;
      created_date: string | null;
      order_status: string | null;
      net_amount: number | null;
      total_amount: number | null;
    }>(
      `${DIRECTUS_BASE}/items/sales_order?limit=20&sort=-order_date,-created_date&fields=${orderFields}&filter=${orderFilter}`,
    );

    if (orders.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // ── 4. Fetch order details + product names in parallel ─────────────────
    const orderIds = orders.map((o) => o.order_id);

    const [rawDetails, products] = await Promise.all([
      // All details for these orders in one query
      safeFetch<{
        detail_id: number;
        order_id: number;
        product_id: number;
        ordered_quantity: number | null;
      }>(
        `${DIRECTUS_BASE}/items/sales_order_details?limit=-1&fields=detail_id,order_id,product_id,ordered_quantity&filter=${encodeURIComponent(
          JSON.stringify({ order_id: { _in: orderIds } }),
        )}`,
      ),
      // All products referenced by those details (fetched after we know which product_ids)
      Promise.resolve([] as { product_id: number; product_name: string }[]),
    ]);

    // Collect unique product IDs
    const productIds = Array.from(
      new Set(rawDetails.map((d) => d.product_id).filter(Boolean)),
    );

    // Fetch product names
    const productList =
      productIds.length > 0
        ? await safeFetch<{
            product_id: number;
            product_name: string;
            short_description?: string;
          }>(
            `${DIRECTUS_BASE}/items/products?limit=-1&fields=product_id,product_name,short_description&filter=${encodeURIComponent(
              JSON.stringify({ product_id: { _in: productIds } }),
            )}`,
          )
        : (products as { product_id: number; product_name: string }[]);

    const productMap = new Map<number, string>();
    productList.forEach(
      (p: {
        product_id: number;
        product_name: string;
        short_description?: string;
      }) => {
        productMap.set(
          Number(p.product_id),
          p.short_description || p.product_name || `Item #${p.product_id}`,
        );
      },
    );

    // Group details by order_id
    const detailsByOrder = new Map<number, typeof rawDetails>();
    rawDetails.forEach((d) => {
      const arr = detailsByOrder.get(d.order_id) ?? [];
      arr.push(d);
      detailsByOrder.set(d.order_id, arr);
    });

    // ── 5. Build response ──────────────────────────────────────────────────
    const data = orders.map((order) => {
      const details = detailsByOrder.get(order.order_id) ?? [];
      const customerName =
        customerMap.get(String(order.customer_code ?? "").trim()) ||
        order.customer_code ||
        "Walk-in Customer";

      // Build items_label
      let items_label = "No items";
      if (details.length > 0) {
        const first = details[0];
        const qty =
          Number(first.ordered_quantity) > 0 ? first.ordered_quantity : 1;
        const name =
          productMap.get(first.product_id) ?? `Item #${first.product_id}`;
        items_label =
          details.length > 1
            ? `${qty}x ${name} +${details.length - 1} more`
            : `${qty}x ${name}`;
      }

      return {
        order_id: order.order_id,
        order_no: order.order_no,
        date: order.order_date || order.created_date,
        customer_name: customerName,
        customer_code: order.customer_code,
        items_label,
        type_label: order.order_status || "Walk-in",
        amount: order.net_amount ?? order.total_amount ?? null,
      };
    });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[walk-in-transactions] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
