import type {
  SalesOrderDetailLite,
  SalesOrderSummary,
  SalesOrderCustomerLite,
} from "../types";

// Walk-in classifications commonly have ID 6, 7, or a custom ID.
// This list should match classification IDs in your Directus database.
const WALK_IN_CLASSIFICATION_IDS = [6, 7, 11]; // 11 observed in your data for "Walk-in"

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function isWalkInOrder(
  order: SalesOrderSummary,
  customerMap?: Map<string, SalesOrderCustomerLite>,
): boolean {
  // Primary: Check customer classification if available
  if (customerMap && order.customer_code) {
    const customer = customerMap.get(String(order.customer_code));
    if (
      customer &&
      customer.classification !== null &&
      customer.classification !== undefined
    ) {
      return WALK_IN_CLASSIFICATION_IDS.includes(
        Number(customer.classification),
      );
    }
  }

  // Fallback: Check text tokens (for legacy data or alternate indicators)
  const WALK_IN_TOKENS = ["walk-in", "walk in", "walkin", "walk_in"];
  const haystack = [
    order.sales_type,
    order.receipt_type,
    order.order_status,
    order.remarks,
  ]
    .map(normalize)
    .join(" ");

  return WALK_IN_TOKENS.some((token) => haystack.includes(token));
}

export function getOrderTypeLabel(order: SalesOrderSummary): string {
  return (
    order.sales_type || order.receipt_type || order.order_status || "Walk-in"
  );
}

export function getOrderAmount(order: SalesOrderSummary): number | null {
  const candidates = [
    order.net_amount,
    order.total_amount,
    order.allocated_amount,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }

  return null;
}

export function formatItemSummary(details: SalesOrderDetailLite[]): string {
  if (!details || details.length === 0) return "—";

  const normalized = details.map((detail) => {
    const qtyRaw =
      detail.ordered_quantity ??
      detail.allocated_quantity ??
      detail.served_quantity ??
      1;
    const qty =
      Number.isFinite(Number(qtyRaw)) && Number(qtyRaw) > 0
        ? Number(qtyRaw)
        : 1;

    let label = "Unknown Item";
    if (typeof detail.product_id === "object" && detail.product_id) {
      label =
        detail.product_id.product_name ||
        detail.product_id.description ||
        detail.product_id.product_code ||
        "Unknown Item";
    } else if (detail.product_id) {
      label = `Item #${detail.product_id}`;
    }

    return { qty, label };
  });

  const [first, ...rest] = normalized;
  const restCount = rest.length;

  if (!first) return "—";

  return restCount > 0
    ? `${first.qty}x ${first.label} +${restCount} more`
    : `${first.qty}x ${first.label}`;
}
