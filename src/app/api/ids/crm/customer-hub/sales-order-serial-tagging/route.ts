import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * Decodes the base64url payload of a JWT without verifying the signature.
 */
function decodeJwtPayload(token: string): { id?: unknown; sub?: unknown; userId?: unknown; user_id?: unknown } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    if (!base64Url) return null;

    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT payload:", error);
    return null;
  }
}

function getUserIdFromToken(req: NextRequest): number | null {
  const token =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.cookies.get("vos_access_token")?.value;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const idValue = payload.id ?? payload.sub ?? payload.userId ?? payload.user_id;
  if (idValue === undefined || idValue === null) return null;
  const num = Number(idValue);
  const userId = isNaN(num) ? null : num;
  console.log("Current user loggedin ID:", userId);
  return userId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDirectus<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${DIRECTUS_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getDirectusHeaders(),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Directus error: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Resolves the customer codes linked to the salesman of the logged-in user.
 * Returns null if the user is not associated with any salesman (e.g., admin).
 * Returns an array (which may be empty) of customer codes if the user is a salesman.
 */
async function getSalesmanCustomerCodes(userId: number | null): Promise<string[] | null> {
  if (!userId) return null;

  const salesmenRes = await fetchDirectus(
    `/items/salesman?filter[_or][0][employee_id][_eq]=${userId}&filter[_or][1][encoder_id][_eq]=${userId}&filter[isActive][_eq]=1&fields=id`
  );
  const salesmen = salesmenRes.data || [];
  if (salesmen.length === 0) return null;

  const salesmanIds = salesmen.map((s: { id: number | string }) => s.id);
  const customerSalesmenRes = await fetchDirectus(
    `/items/customer_salesmen?filter[salesman_id][_in]=${salesmanIds.join(",")}&limit=-1&fields=customer_id`
  );
  const customerSalesmen = customerSalesmenRes.data || [];
  const customerIds = customerSalesmen
    .map((cs: { customer_id: number | string | { id?: number | string } }) => {
      if (cs.customer_id && typeof cs.customer_id === "object") {
        return cs.customer_id.id;
      }
      return cs.customer_id;
    })
    .filter(Boolean);

  if (customerIds.length === 0) return [];

  const customersRes = await fetchDirectus(
    `/items/customer?filter[id][_in]=${customerIds.join(",")}&fields=customer_code&limit=-1`
  );
  const customers = customersRes.data || [];
  return customers.map((c: { customer_code: string }) => c.customer_code).filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json({ error: "Action query parameter is required" }, { status: 400 });
    }

    switch (action) {
      case "list-orders": {
        interface RawSalesOrder {
          order_id: number;
          order_no: string;
          customer_code: string;
          branch_id: number;
          order_status: string;
          created_date: string;
        }

        // Modified: Changed order status filter from "For Shipping" to "En Route"
        const ordersRes = await fetchDirectus(`/items/sales_order?filter[branch_id][_in]=196,197&filter[order_status][_eq]=En%20Route&fields=order_id,order_no,customer_code,branch_id,order_status,created_date&sort=-created_date&limit=-1`);
        let rawOrders = (ordersRes.data || []) as RawSalesOrder[];

        const userId = getUserIdFromToken(req);
        const allowedCustomerCodes = await getSalesmanCustomerCodes(userId);
        if (allowedCustomerCodes !== null) {
          rawOrders = rawOrders.filter((o) => allowedCustomerCodes.includes(o.customer_code));
        }

        const uniqueCustCodes = Array.from(new Set(rawOrders.map((o) => o.customer_code).filter(Boolean)));

        const customerMap = new Map<string, string>();
        if (uniqueCustCodes.length > 0) {
          interface RawCustomer {
            customer_code: string;
            customer_name?: string;
            store_name?: string;
          }
          const custRes = await fetchDirectus(`/items/customer?filter[customer_code][_in]=${uniqueCustCodes.map(c => encodeURIComponent(c)).join(",")}&fields=customer_code,customer_name,store_name`);
          const customers = (custRes.data || []) as RawCustomer[];
          for (const c of customers) {
            customerMap.set(c.customer_code, c.customer_name || c.store_name || c.customer_code);
          }
        }

        // Fetch Branch Names
        const branchMap = new Map<number, string>();
        try {
          const branchesRes = await fetchDirectus(`/items/branches?filter[id][_in]=196,197&fields=id,branch_name`);
          const branchesList = (branchesRes.data || []) as { id: number; branch_name: string }[];
          for (const b of branchesList) {
            branchMap.set(Number(b.id), b.branch_name);
          }
        } catch (branchErr) {
          console.warn("Could not retrieve branch names:", branchErr);
        }

        const orderIds = rawOrders.map((o) => o.order_id);
        const targetQtyMap = new Map<number, number>();
        const taggedQtyMap = new Map<number, number>();

        if (orderIds.length > 0) {
          try {
            // Fetch required target quantities (allocated if > 0, otherwise ordered)
            interface RawDetail {
              order_id: number;
              ordered_quantity?: number | string;
              allocated_quantity?: number | string;
            }
            const detailsRes = await fetchDirectus(`/items/sales_order_details?filter[order_id][_in]=${orderIds.join(",")}&fields=order_id,ordered_quantity,allocated_quantity&limit=-1`);
            const rawDetails = (detailsRes.data || []) as RawDetail[];
            for (const d of rawDetails) {
              const oId = Number(d.order_id);
              const target = Number(d.allocated_quantity || 0) > 0
                ? Number(d.allocated_quantity)
                : Number(d.ordered_quantity || 0);
              targetQtyMap.set(oId, (targetQtyMap.get(oId) || 0) + target);
            }

            // Fetch tagged serial counts from sales_order_details_serial
            interface RawDetailsSerialCount {
              sales_order_id: number | string;
            }
            const serialsRes = await fetchDirectus(`/items/sales_order_details_serial?filter[sales_order_id][_in]=${orderIds.join(",")}&fields=sales_order_id&limit=-1`);
            const rawSerials = (serialsRes.data || []) as RawDetailsSerialCount[];
            for (const s of rawSerials) {
              const oId = Number(s.sales_order_id);
              taggedQtyMap.set(oId, (taggedQtyMap.get(oId) || 0) + 1);
            }
          } catch (qtyErr) {
            console.warn("Could not calculate tagging status counts:", qtyErr);
          }
        }

        const orders = rawOrders.map((o) => {
          const targetQty = targetQtyMap.get(o.order_id) || 0;
          const taggedQty = taggedQtyMap.get(o.order_id) || 0;
          let taggingStatus: "tagged" | "partially tagged" | "not tagged" = "not tagged";

          if (targetQty > 0) {
            if (taggedQty >= targetQty) {
              taggingStatus = "tagged";
            } else if (taggedQty > 0) {
              taggingStatus = "partially tagged";
            }
          }

          return {
            order_id: o.order_id,
            order_no: o.order_no,
            customer_code: o.customer_code,
            customer_name: customerMap.get(o.customer_code) || o.customer_code || "Unknown Customer",
            branch_id: o.branch_id,
            branch_name: branchMap.get(o.branch_id) || `Branch ${o.branch_id}`,
            order_status: o.order_status,
            created_date: o.created_date,
            tagging_status: taggingStatus,
          };
        });

        return NextResponse.json({ data: orders });
      }

      case "order-details": {
        const orderId = searchParams.get("orderId");
        if (!orderId) {
          return NextResponse.json({ error: "orderId is required" }, { status: 400 });
        }

        // Fetch Sales Order Header
        const orderRes = await fetchDirectus(`/items/sales_order/${orderId}?fields=*`);
        const order = orderRes.data || {};

        if (!order.order_id) {
          return NextResponse.json({ error: "Sales Order not found" }, { status: 404 });
        }

        // Authorization check for salesman
        const userId = getUserIdFromToken(req);
        const allowedCustomerCodes = await getSalesmanCustomerCodes(userId);
        if (allowedCustomerCodes !== null && (!order.customer_code || !allowedCustomerCodes.includes(order.customer_code))) {
          return NextResponse.json({ error: "Unauthorized access to this Sales Order" }, { status: 403 });
        }

        // Fetch Customer Details
        let customerName = "Unknown Customer";
        if (order.customer_code) {
          const custRes = await fetchDirectus(`/items/customer?filter[customer_code][_eq]=${encodeURIComponent(order.customer_code)}&fields=customer_name,store_name`);
          const customer = custRes.data?.[0] || {};
          customerName = customer.customer_name || customer.store_name || order.customer_code;
        }

        // Fetch Branch Name
        let branchName = `Branch ${order.branch_id}`;
        if (order.branch_id) {
          try {
            const branchRes = await fetchDirectus(`/items/branches/${order.branch_id}?fields=branch_name`);
            if (branchRes.data?.branch_name) {
              branchName = branchRes.data.branch_name;
            }
          } catch (e) {
            console.warn("Could not fetch branch details:", e);
          }
        }

        // Fetch Sales Order details line items
        const detailsRes = await fetchDirectus(`/items/sales_order_details?filter[order_id][_eq]=${orderId}&fields=detail_id,product_id,ordered_quantity,allocated_quantity,served_quantity&limit=-1`);

        interface RawOrderDetailItem {
          detail_id: number;
          product_id: number | { product_id: number } | null;
          ordered_quantity?: number | string;
          allocated_quantity?: number | string;
          served_quantity?: number | string;
        }

        const rawItems = (detailsRes.data || []) as RawOrderDetailItem[];

        // Fetch products info from the products collection to resolve names and units (handles directus scalar configuration)
        const productMap = new Map<number, { product_name?: string; product_code?: string; unit_name?: string }>();
        const productIds = Array.from(
          new Set(
            rawItems
              .map((item) => {
                const pid = typeof item.product_id === "object" && item.product_id !== null
                  ? item.product_id.product_id
                  : item.product_id;
                return pid ? Number(pid) : null;
              })
              .filter((pid): pid is number => pid !== null)
          )
        );

        if (productIds.length > 0) {
          try {
            interface DirectusProduct {
              product_id: number | string;
              product_name?: string;
              product_code?: string;
              unit_of_measurement?: string | number | { unit_name?: string } | null;
            }
            const productsRes = await fetchDirectus(`/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name,product_code,unit_of_measurement.unit_name&limit=-1`);
            const productsList = (productsRes.data || []) as DirectusProduct[];
            for (const p of productsList) {
              const uom = p.unit_of_measurement;
              const unit = typeof uom === "object" && uom !== null
                ? uom.unit_name
                : uom;
              productMap.set(Number(p.product_id), {
                product_name: p.product_name,
                product_code: p.product_code,
                unit_name: typeof unit === "string" ? unit : undefined,
              });
            }
          } catch (e) {
            console.warn("Could not fetch product details from products collection:", e);
          }
        }

        // Fetch all tagged serials for this order in a single batch query to avoid N+1 queries
        interface RawDetailsSerial {
          sales_order_detail_id: string | number;
          serial_number: string;
        }
        const allTaggedRes = await fetchDirectus(`/items/sales_order_details_serial?filter[sales_order_id][_eq]=${orderId}&fields=sales_order_detail_id,serial_number&limit=-1`);
        const allTagged = (allTaggedRes.data || []) as RawDetailsSerial[];

        const taggedMap = new Map<number, { serial_number: string; status: string }[]>();
        for (const t of allTagged) {
          const dId = Number(t.sales_order_detail_id);
          if (!isNaN(dId)) {
            if (!taggedMap.has(dId)) {
              taggedMap.set(dId, []);
            }
            taggedMap.get(dId)!.push({
              serial_number: t.serial_number,
              status: "tagged",
            });
          }
        }

        // Format items
        const items = [];
        for (const item of rawItems) {
          const prodId = typeof item.product_id === "object" && item.product_id !== null
            ? Number(item.product_id.product_id)
            : Number(item.product_id);

          const prodInfo = productMap.get(prodId);
          const prodName = prodInfo?.product_name || `Product ID: ${prodId}`;
          const prodCode = prodInfo?.product_code || "";
          const unit = prodInfo?.unit_name || "";

          const taggedSerialsList = taggedMap.get(Number(item.detail_id)) || [];

          items.push({
            detail_id: item.detail_id,
            product_id: prodId,
            product_code: prodCode,
            product_name: prodName,
            unit: unit || "Pcs",
            ordered_qty: Number(item.ordered_quantity || 0),
            allocated_qty: Number(item.allocated_quantity || 0),
            served_qty: Number(item.served_quantity || 0),
            tagged_qty: taggedSerialsList.length,
            tagged_serials: taggedSerialsList,
          });
        }

        return NextResponse.json({
          data: {
            order: {
              order_id: order.order_id,
              order_no: order.order_no,
              customer_code: order.customer_code,
              customer_name: customerName,
              branch_id: order.branch_id,
              branch_name: branchName,
              order_status: order.order_status,
            },
            items,
          },
        });
      }

      case "mapped-serials": {
        const orderId = searchParams.get("orderId");
        if (!orderId) {
          return NextResponse.json({ error: "orderId is required" }, { status: 400 });
        }

        // Authorization check for salesman
        const userId = getUserIdFromToken(req);
        const allowedCustomerCodes = await getSalesmanCustomerCodes(userId);
        if (allowedCustomerCodes !== null) {
          const orderRes = await fetchDirectus(`/items/sales_order/${orderId}?fields=customer_code`);
          const order = orderRes.data || {};
          if (!order.customer_code || !allowedCustomerCodes.includes(order.customer_code)) {
            return NextResponse.json({ error: "Unauthorized access to this Sales Order mappings" }, { status: 403 });
          }
        }

        // 1. Fetch dispatch plan details for this Sales Order
        const dpdRes = await fetchDirectus(`/items/dispatch_plan_details?filter[sales_order_id][_eq]=${orderId}&fields=dispatch_id`);
        const dpd = dpdRes.data?.[0];
        if (!dpd) {
          return NextResponse.json({ data: [] }); // No dispatch plan associated yet
        }

        // 2. Fetch dispatch plan to get the dispatch_no
        const dpRes = await fetchDirectus(`/items/dispatch_plan/${dpd.dispatch_id}?fields=dispatch_no`);
        const dispatchNo = dpRes.data?.dispatch_no;
        if (!dispatchNo) {
          return NextResponse.json({ data: [] });
        }

        // 3. Fetch consolidator linked to this dispatch
        const cdispRes = await fetchDirectus(`/items/consolidator_dispatches?filter[dispatch_no][_eq]=${encodeURIComponent(dispatchNo)}&fields=consolidator_id`);
        const cdisp = cdispRes.data?.[0];
        if (!cdisp) {
          return NextResponse.json({ data: [] });
        }

        const consolidatorId = typeof cdisp.consolidator_id === "object" && cdisp.consolidator_id !== null
          ? cdisp.consolidator_id.id
          : cdisp.consolidator_id;

        if (!consolidatorId) {
          return NextResponse.json({ data: [] });
        }

        // 4. Fetch consolidator details to get the detail IDs
        const cdRes = await fetchDirectus(`/items/consolidator_details?filter[consolidator_id][_eq]=${consolidatorId}&fields=id,product_id`);
        const consolidatorDetails = cdRes.data || [];
        const detailIds = consolidatorDetails.map((cd: { id: string | number }) => cd.id);

        if (detailIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        // 5. Fetch serial mappings associated with these details
        const csmRes = await fetchDirectus(`/items/consolidator_serial_mappings?filter[detail_id][_in]=${detailIds.join(",")}&fields=serial_number,detail_id.id,detail_id.product_id&limit=-1`);
        const mappings = csmRes.data || [];

        // Map them to include product ID with robust fallback handling
        interface DirectusSerialMappingDetailObj {
          id?: string | number;
          detail_id?: string | number;
          product_id?: string | number | { product_id?: string | number; id?: string | number } | null;
        }

        interface DirectusSerialMapping {
          serial_number: string;
          detail_id: string | number | DirectusSerialMappingDetailObj | null;
        }

        const serialNumbers = mappings.map((m: DirectusSerialMapping) => m.serial_number).filter(Boolean);
        const statusMap = new Map<string, string>();

        if (serialNumbers.length > 0) {
          try {
            interface AssetMin {
              serial_number: string;
              cylinder_status?: string;
            }
            const encodedSerials = serialNumbers.map((s: string) => encodeURIComponent(s.trim().toUpperCase())).join(",");
            const assetsRes = await fetchDirectus(`/items/cylinder_assets?filter[serial_number][_in]=${encodedSerials}&fields=serial_number,cylinder_status&limit=-1`);
            const assets = (assetsRes.data || []) as AssetMin[];
            for (const asset of assets) {
              if (asset.serial_number) {
                statusMap.set(asset.serial_number.toUpperCase(), asset.cylinder_status || "LOADED");
              }
            }
          } catch (assetErr) {
            console.warn("Could not retrieve status for mapping serials: ", assetErr);
          }
        }

        const serials = (mappings as DirectusSerialMapping[]).map((mapping) => {
          const detailObj = typeof mapping.detail_id === "object" && mapping.detail_id !== null
            ? mapping.detail_id as DirectusSerialMappingDetailObj
            : null;

          const detailId = detailObj
            ? (detailObj.id ?? detailObj.detail_id)
            : mapping.detail_id;

          let prodId = detailObj ? detailObj.product_id : null;

          if (!prodId) {
            const matchedDetail = consolidatorDetails.find(
              (cd: { id: string | number }) => String(cd.id) === String(detailId)
            );
            prodId = matchedDetail?.product_id;
          }

          if (typeof prodId === "object" && prodId !== null) {
            const prodObj = prodId as { product_id?: string | number; id?: string | number };
            prodId = prodObj.product_id ?? prodObj.id;
          }

          const cylStatus = mapping.serial_number
            ? (statusMap.get(mapping.serial_number.toUpperCase()) || "LOADED")
            : "LOADED";

          return {
            serial_number: mapping.serial_number,
            product_id: prodId ? Number(prodId) : null,
            cylinder_status: cylStatus,
          };
        });

        return NextResponse.json({ data: serials });
      }

      case "customer-assets": {
        const customerCode = searchParams.get("customerCode");
        if (!customerCode) {
          return NextResponse.json({ error: "customerCode is required" }, { status: 400 });
        }

        // Authorization check for salesman
        const userId = getUserIdFromToken(req);
        const allowedCustomerCodes = await getSalesmanCustomerCodes(userId);
        if (allowedCustomerCodes !== null && !allowedCustomerCodes.includes(customerCode)) {
          return NextResponse.json({ error: "Unauthorized access to this Customer's assets" }, { status: 403 });
        }

        // Fetch cylinder assets currently with the customer
        const assetsRes = await fetchDirectus(
          `/items/cylinder_assets?filter[cylinder_status][_eq]=WITH_CUSTOMER&filter[current_customer_code][_eq]=${encodeURIComponent(customerCode)}&fields=id,serial_number,product_id.product_name,modified_date,created_date&limit=-1`
        );
        interface DirectusCylinderAsset {
          id: number | string;
          serial_number: string;
          product_id: string | number | { product_name?: string };
          modified_date?: string;
          created_date?: string;
        }

        const assets = (assetsRes.data as DirectusCylinderAsset[] || []).map((asset) => {
          const prodName = typeof asset.product_id === "object" ? asset.product_id?.product_name : `Product ID: ${asset.product_id}`;
          const basisDate = asset.modified_date || asset.created_date || new Date().toISOString();
          const daysAtSite = Math.max(0, Math.floor((Date.now() - new Date(basisDate).getTime()) / (1000 * 60 * 60 * 24)));

          return {
            id: Number(asset.id),
            serial_number: asset.serial_number,
            product_name: prodName || `Product ID: ${asset.product_id}`,
            days_at_site: daysAtSite,
          };
        });

        return NextResponse.json({ data: assets });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error("GET route error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromToken(req);
    const body = await req.json();

    const { orderId, customerCode, serials } = body;

    if (!orderId || !customerCode || !Array.isArray(serials) || serials.length === 0) {
      return NextResponse.json({ error: "orderId, customerCode, and an array of serials are required" }, { status: 400 });
    }

    // 1. Fetch Sales Order to get starting branch and customer code
    const orderRes = await fetchDirectus(`/items/sales_order/${orderId}?fields=branch_id,customer_code`);
    const order = orderRes.data || {};
    const branchId = order.branch_id || null;
    const finalCustomerCode = order.customer_code || customerCode;

    // Authorization check for salesman
    const allowedCustomerCodes = await getSalesmanCustomerCodes(userId);
    if (allowedCustomerCodes !== null && !allowedCustomerCodes.includes(finalCustomerCode)) {
      return NextResponse.json({ error: "Unauthorized access to target Customer" }, { status: 403 });
    }

    // Fetch Customer Name
    let customerName = "";
    if (finalCustomerCode) {
      try {
        interface CustData {
          customer_name?: string;
          store_name?: string;
        }
        const custRes = await fetchDirectus(`/items/customer?filter[customer_code][_eq]=${encodeURIComponent(finalCustomerCode)}&fields=customer_name,store_name`);
        const customer = (custRes.data?.[0] || {}) as CustData;
        customerName = customer.customer_name || customer.store_name || finalCustomerCode;
      } catch (custErr) {
        console.warn("Could not retrieve customer details:", custErr);
      }
    }

    // 2. Fetch Dispatch Plan details to associate vehicle, driver, and plan
    let dispatchPlanId = null;
    let vehicleId = null;
    let driverId = null;

    try {
      const dpdRes = await fetchDirectus(`/items/dispatch_plan_details?filter[sales_order_id][_eq]=${orderId}&fields=dispatch_id`);
      const dpd = dpdRes.data?.[0];
      if (dpd?.dispatch_id) {
        const dpRes = await fetchDirectus(`/items/dispatch_plan/${dpd.dispatch_id}?fields=dispatch_id,vehicle_id,driver_id`);
        const dp = dpRes.data;
        if (dp) {
          dispatchPlanId = dp.dispatch_id || null;
          vehicleId = dp.vehicle_id || null;
          driverId = dp.driver_id || null;
        }
      }
    } catch (dpErr) {
      console.warn("Could not retrieve dispatch plan mappings: ", dpErr);
    }

    // 2b. Fetch Sales Order Details to map detail_id to product_id and product_name
    const detailToProductMap = new Map<number, { product_id: number; product_name: string }>();
    try {
      const detailsRes = await fetchDirectus(
        `/items/sales_order_details?filter[order_id][_eq]=${orderId}&fields=detail_id,product_id&limit=-1`
      );
      const rawItems = (detailsRes.data || []) as {
        detail_id: number;
        product_id: number | { product_id: number } | null;
      }[];

      // Extract unique product IDs
      const productIds = Array.from(
        new Set(
          rawItems
            .map((item) => {
              const pid = typeof item.product_id === "object" && item.product_id !== null
                ? item.product_id.product_id
                : item.product_id;
              return pid ? Number(pid) : null;
            })
            .filter((pid): pid is number => pid !== null)
        )
      );

      // Fetch products info to get names
      const productNamesMap = new Map<number, string>();
      if (productIds.length > 0) {
        interface DirectusProductInfo {
          product_id: number | string;
          product_name?: string;
        }
        const productsRes = await fetchDirectus(
          `/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name&limit=-1`
        );
        const productsList = (productsRes.data || []) as DirectusProductInfo[];
        for (const p of productsList) {
          productNamesMap.set(Number(p.product_id), p.product_name || `Product ID: ${p.product_id}`);
        }
      }

      // Populate detailToProductMap
      for (const item of rawItems) {
        const pid = typeof item.product_id === "object" && item.product_id !== null
          ? Number(item.product_id.product_id)
          : Number(item.product_id);

        if (item.detail_id && pid) {
          const pName = productNamesMap.get(pid) || `Product ID: ${pid}`;
          detailToProductMap.set(Number(item.detail_id), { product_id: pid, product_name: pName });
        }
      }
    } catch (detailsErr) {
      console.warn("Could not retrieve sales order details mapping:", detailsErr);
    }

    const deliveryDate = new Date().toISOString().split("T")[0];

    // 3. Map all serials in database
    const results = [];
    for (const serialObj of serials) {
      const { sales_order_detail_id, serial_number } = serialObj;
      if (!sales_order_detail_id || !serial_number) continue;

      // Check if already mapped to this detail line to avoid duplicates
      const checkRes = await fetchDirectus(
        `/items/sales_order_details_serial?filter[sales_order_detail_id][_eq]=${sales_order_detail_id}&filter[serial_number][_eq]=${encodeURIComponent(serial_number)}&fields=id`
      );
      if (checkRes.data && checkRes.data.length > 0) {
        continue; // Already mapped, skip
      }

      // Find the cylinder asset ID
      const assetRes = await fetchDirectus(
        `/items/cylinder_assets?filter[serial_number][_eq]=${encodeURIComponent(serial_number)}&fields=id`
      );
      const asset = assetRes.data?.[0];
      const cylinderAssetId = asset ? Number(asset.id) : null;

      const prodInfo = detailToProductMap.get(Number(sales_order_detail_id)) || null;

      // Insert mapping link with enriched details
      await fetchDirectus(`/items/sales_order_details_serial`, {
        method: "POST",
        body: JSON.stringify({
          sales_order_detail_id,
          sales_order_id: Number(orderId),
          product_id: prodInfo?.product_id || null,
          product_name: prodInfo?.product_name || null,
          cylinder_assets_id: cylinderAssetId,
          serial_number,
          customer_code: finalCustomerCode,
          customer_name: customerName,
          branch_id: branchId,
          dispatch_plan_id: dispatchPlanId,
          vehicle_id: vehicleId,
          driver_id: driverId,
          delivery_date: deliveryDate,
          created_by: userId,
        }),
      });

      if (asset) {
        // Update cylinder_assets table
        await fetchDirectus(`/items/cylinder_assets/${asset.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            cylinder_status: "WITH_CUSTOMER",
            current_customer_code: finalCustomerCode,
            current_branch_id: branchId,
          }),
        });
      }

      results.push(serial_number);
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: unknown) {
    console.error("POST route error:", error);
    const msg = error instanceof Error ? error.message : "Failed to tag cylinder serials";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
