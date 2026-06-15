import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  WiwoHeader,
  WiwoDetail,
  MeteredWiwoTransaction,
  WiwoListParams,
  CylinderAsset,
  CustomerSiteCylinder,
  OnboardCylinderInput,
  CustomerSite,
  MeterReading
  ,LpgTransactionHeader
} from "../types";

const DIRECTUS_URL = getDirectusBase();

const FIELDS_TX =
  "*,customer.customer_name,site.site_name,site.default_price_per_kg," +
  "meter_reading_id.id,meter_reading_id.previous_reading,meter_reading_id.current_reading,meter_reading_id.kg_consumed,meter_reading_id.price_per_kg,meter_reading_id.reading_date," +
  "wiwo_header_id.id,wiwo_header_id.wiwo_no,wiwo_header_id.transaction_date,wiwo_header_id.wiwo_status";

function withUser(userId: number | null | undefined, fields: ("created_by" | "posted_by" | "modified_by" | "cancelled_by")[]) {
  if (!userId) return {};
  return Object.fromEntries(fields.map(f => [f, userId]));
}

export async function fetchTransactionHeaders(params: {
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<LpgTransactionHeader[]> {
  const limit = params.limit ?? 100;
  const filters: Record<string, unknown> = {};
  if (params.status) filters.status = { _eq: params.status };
  if (params.search) {
    filters._or = [
      { header_no: { _icontains: params.search } },
      { customer_id: { _icontains: params.search } },
      { site: { site_name: { _icontains: params.search } } },
    ];
  }

  let qs =
    `fields=*,customer_site_id.id,customer_site_id.site_name,` +
    `customer_site_id.customer_code,customer_site_id.default_price_per_kg,` +
    `customer_site_id.last_meter_reading,customer_site_id.default_target_lpg_kg` +
    `&sort=-period_from,-header_id&limit=${limit}`;
  if (Object.keys(filters).length) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{
    data: (Omit<LpgTransactionHeader, "customer_site_id" | "customer_id"> & {
      customer_site_id: number | CustomerSite;
      customer_id?: string;
    })[];
  }>(
    `${DIRECTUS_URL}/items/lpg_transaction_headers?${qs}`
  );

  const headers = res.data ?? [];
  const customerCodes = Array.from(new Set(headers.map(h => h.customer_id).filter(Boolean)));
  const siteIds = Array.from(new Set(headers.map(h => typeof h.customer_site_id === "object" ? h.customer_site_id?.id : h.customer_site_id).filter(Boolean)));
  
  let customerMap: Record<string, string> = {};
  if (customerCodes.length > 0) {
    try {
      const filterObj = { customer_code: { _in: customerCodes } };
      const custRes = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(
        `${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter=${encodeURIComponent(JSON.stringify(filterObj))}`
      );
      customerMap = Object.fromEntries((custRes.data ?? []).map(c => [c.customer_code, c.customer_name]));
    } catch (e) {
      console.warn("Failed to fetch customer names", e);
    }
  }

  let siteMap: Record<number, CustomerSite> = {};
  if (siteIds.length > 0) {
    try {
      const filterObj = { id: { _in: siteIds } };
      const siteRes = await directusFetch<{ data: CustomerSite[] }>(
        `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=id,site_name,customer_code,default_price_per_kg,last_meter_reading,default_target_lpg_kg&filter=${encodeURIComponent(JSON.stringify(filterObj))}`
      );
      siteMap = Object.fromEntries((siteRes.data ?? []).map(s => [s.id, s]));
    } catch (e) {
      console.warn("Failed to fetch site names", e);
    }
  }

  return headers.map((header) => {
    const rawSiteId = typeof header.customer_site_id === "object" ? header.customer_site_id?.id : header.customer_site_id;
    const site = rawSiteId ? siteMap[rawSiteId as number] : undefined;
    const customer_id = header.customer_id;
    const customer_name = customer_id ? customerMap[customer_id] : undefined;
    return {
      ...header,
      customer_id,
      customer_name,
      customer_site_id: rawSiteId,
      site,
    } as LpgTransactionHeader;
  });
}

export async function createTransactionHeader(payload: {
  siteId: number;
  periodFrom: string;
  periodTo: string;
  remarks?: string;
  userId: number;
}): Promise<LpgTransactionHeader> {
  if (!payload.periodFrom || !payload.periodTo || payload.periodFrom > payload.periodTo) {
    throw new Error("A valid billing period is required.");
  }

  const siteRes = await directusFetch<{ data: CustomerSite }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${payload.siteId}?fields=id,site_name,customer_code,default_price_per_kg,last_meter_reading,default_target_lpg_kg`
  );
  const site = siteRes.data;
  if (!site?.customer_code) throw new Error("Customer site not found.");

  const overlapFilter = {
    customer_site_id: { _eq: payload.siteId },
    status: { _neq: "CANCELLED" },
    period_from: { _lte: payload.periodTo },
    period_to: { _gte: payload.periodFrom },
  };
  const overlapRes = await directusFetch<{ data: { header_id: number }[] }>(
    `${DIRECTUS_URL}/items/lpg_transaction_headers?fields=header_id&filter=${encodeURIComponent(JSON.stringify(overlapFilter))}&limit=1`
  );
  if (overlapRes.data?.length) {
    throw new Error("This site already has an active transaction header overlapping the selected period.");
  }

  const headerNo = `LPGH-${payload.periodFrom.replaceAll("-", "")}-${payload.siteId}-${Date.now().toString().slice(-4)}`;
  const res = await directusFetch<{ data: LpgTransactionHeader }>(
    `${DIRECTUS_URL}/items/lpg_transaction_headers`,
    {
      method: "POST",
      body: JSON.stringify({
        header_no: headerNo,
        customer_id: site.customer_code,
        customer_site_id: payload.siteId,
        period_from: payload.periodFrom,
        period_to: payload.periodTo,
        status: "DRAFT",
        is_billed: 0,
        remarks: payload.remarks || null,
        created_by: payload.userId,
      }),
    }
  );
  return { ...res.data, site };
}

// Helper to manually hydrate site/customer name data securely
async function hydrateTransactions(txs: MeteredWiwoTransaction[]): Promise<MeteredWiwoTransaction[]> {
  if (txs.length === 0) return txs;

  const customerCodes = Array.from(new Set(txs.map(t => t.customer_code).filter(Boolean)));
  const siteIds = Array.from(new Set(txs.map(t => {
    const rawSite = t.lpg_site_id;
    return typeof rawSite === "object" && rawSite !== null ? (rawSite as { id: number }).id : rawSite;
  }).filter(Boolean)));

  let customerMap: Record<string, string> = {};
  if (customerCodes.length > 0) {
    try {
      const filterObj = { customer_code: { _in: customerCodes } };
      const custRes = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(
        `${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter=${encodeURIComponent(JSON.stringify(filterObj))}`
      );
      customerMap = Object.fromEntries((custRes.data ?? []).map(c => [c.customer_code, c.customer_name]));
    } catch (e) {
      console.warn("Failed to fetch customer names in hydrateTransactions", e);
    }
  }

  let siteMap: Record<number, CustomerSite> = {};
  if (siteIds.length > 0) {
    try {
      const filterObj = { id: { _in: siteIds } };
      const siteRes = await directusFetch<{ data: CustomerSite[] }>(
        `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=id,site_name,customer_code,default_price_per_kg,last_meter_reading,default_target_lpg_kg&filter=${encodeURIComponent(JSON.stringify(filterObj))}`
      );
      siteMap = Object.fromEntries((siteRes.data ?? []).map(s => [s.id, s]));
    } catch (e) {
      console.warn("Failed to fetch site names in hydrateTransactions", e);
    }
  }

  return txs.map(t => {
    const rawSite = t.lpg_site_id;
    const siteId = typeof rawSite === "object" && rawSite !== null ? (rawSite as { id: number }).id : rawSite;
    const siteObj = siteId ? siteMap[siteId] : undefined;
    const customerName = t.customer_code ? customerMap[t.customer_code] : undefined;

    return {
      ...t,
      lpg_site_id: siteId,
      customer: t.customer_code ? {
        customer_code: t.customer_code,
        customer_name: customerName || "",
      } : undefined,
      site: siteObj ? {
        id: siteObj.id,
        site_name: siteObj.site_name,
        default_price_per_kg: siteObj.default_price_per_kg,
      } : undefined,
    } as MeteredWiwoTransaction;
  });
}

// ─── Transactions List ────────────────────────────────────────────────────────
export async function fetchWiwoBillingTransactions(params: WiwoListParams): Promise<{
  data: MeteredWiwoTransaction[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  type FilterVal = { _eq?: string | number } | { _icontains?: string } | Array<Record<string, { _icontains: string }>>;
  const filters: Record<string, FilterVal> = {};
  if (params.status) filters.status = { _eq: params.status };
  // AG-CHANGE: Filter by transaction_header_id when viewing a POSTED header's linked transactions
  if (params.transactionHeaderId) filters.transaction_header_id = { _eq: params.transactionHeaderId };
  if (params.salesInvoiceId) filters.sales_invoice_id = { _eq: params.salesInvoiceId };
  if (params.search) {
    filters._or = [
      { transaction_no: { _icontains: params.search } },
      { customer_code: { _icontains: params.search } },
    ];
  }

  let qs = `fields=${FIELDS_TX}&sort=-transaction_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{ data: MeteredWiwoTransaction[]; meta?: { total_count: number } }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`
  );
  const txs = res.data ?? [];
  const hydrated = await hydrateTransactions(txs);
  return { data: hydrated, total: res.meta?.total_count ?? 0 };
}

export async function fetchWiwoBillingTransactionById(id: number): Promise<MeteredWiwoTransaction | null> {
  const res = await directusFetch<{ data: MeteredWiwoTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}?fields=${FIELDS_TX}`
  );
  const tx = res.data ?? null;
  if (tx) {
    const [hydrated] = await hydrateTransactions([tx]);
    if (hydrated.wiwo_header_id) {
      // Enrich with wiwo details
      const headerId = typeof hydrated.wiwo_header_id === "object" ? (hydrated.wiwo_header_id as unknown as WiwoHeader).id : hydrated.wiwo_header_id;
      const detailRes = await directusFetch<{ data: WiwoDetail[] }>(
        `${DIRECTUS_URL}/items/lpg_wiwo_details?filter[wiwo_header_id][_eq]=${headerId}&limit=-1`
      );
      if (hydrated.wiwo_header_id && typeof hydrated.wiwo_header_id === "object") {
        (hydrated.wiwo_header_id as unknown as WiwoHeader).details = detailRes.data ?? [];
      }
    }
    return hydrated;
  }
  return null;
}

// ─── Reference Lookups ────────────────────────────────────────────────────────
export async function fetchCustomers(): Promise<{ customer_code: string; customer_name: string }[]> {
  const res = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(
    `${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter[isActive][_eq]=1&limit=-1&sort=customer_name`
  );
  return res.data ?? [];
}

export async function fetchSites(customerCode?: string): Promise<CustomerSite[]> {
  let qs = "fields=id,site_name,customer_code,default_price_per_kg,last_meter_reading,default_target_lpg_kg&filter[is_active][_eq]=1&sort=site_name&limit=-1";
  if (customerCode) qs += `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}`;
  const res = await directusFetch<{ data: CustomerSite[] }>(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites?${qs}`);
  return res.data ?? [];
}

export async function checkSiteOnboarded(siteId: number): Promise<boolean> {
  const query = {
    lpg_site_id: { _eq: siteId },
    transaction_type: { _eq: "ONBOARDING_BASELINE" },
    status: { _neq: "CANCELLED" },
  };
  const res = await directusFetch<{ data: unknown[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?filter=${encodeURIComponent(JSON.stringify(query))}&limit=1&fields=id`
  );
  return (res.data ?? []).length > 0;
}

export async function fetchInvoicesForCustomer(customerCode?: string): Promise<{ invoice_id: number; invoice_no: string; total_amount: number; invoice_date: string; transaction_status: string; isOnboardingBaseline?: boolean; hasMeteredTransaction?: boolean }[]> {
  const filters: Record<string, unknown> = {
    transaction_status: { _eq: "En Route" }
  };
  if (customerCode) {
    filters.customer_code = { _eq: customerCode };
  }

  // Fetch header-invoice linkings to exclude POSTED ones
  const postedInvoiceIds = new Set<number>();
  try {
    const linkRes = await directusFetch<{ data: { sales_invoice_id: number; status: string }[] }>(
      `${DIRECTUS_URL}/items/lpg_transaction_header_invoices?fields=sales_invoice_id,status&limit=-1`
    );
    (linkRes.data ?? []).forEach(item => {
      if (item.status === "POSTED") {
        postedInvoiceIds.add(item.sales_invoice_id);
      }
    });
  } catch (e) {
    console.warn("Failed to fetch lpg_transaction_header_invoices", e);
  }

  // Fetch invoices linked to ONBOARDING_BASELINE transactions
  const onboardingInvoiceIds = new Set<number>();
  try {
    const obRes = await directusFetch<{ data: { sales_invoice_id: number }[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?fields=sales_invoice_id&filter[transaction_type][_eq]=ONBOARDING_BASELINE&filter[status][_neq]=CANCELLED&limit=-1`
    );
    (obRes.data ?? []).forEach(tx => {
      if (tx.sales_invoice_id) {
        onboardingInvoiceIds.add(tx.sales_invoice_id);
      }
    });
  } catch (e) {
    console.warn("Failed to fetch onboarding baseline transaction invoice IDs", e);
  }

  // Fetch invoices that have any transaction in lpg_metered_wiwo_transactions (to support routine check)
  const meteredTransactionInvoiceIds = new Set<number>();
  try {
    const txRes = await directusFetch<{ data: { sales_invoice_id: number }[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?fields=sales_invoice_id&filter[status][_neq]=CANCELLED&limit=-1`
    );
    (txRes.data ?? []).forEach(tx => {
      if (tx.sales_invoice_id) {
        meteredTransactionInvoiceIds.add(tx.sales_invoice_id);
      }
    });
  } catch (e) {
    console.warn("Failed to fetch metered transaction invoice IDs", e);
  }

  // Fetch invoices with POSTED transaction status in lpg_metered_wiwo_transactions to exclude them
  const postedTxInvoiceIds = new Set<number>();
  try {
    const txPostedRes = await directusFetch<{ data: { sales_invoice_id: number }[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?fields=sales_invoice_id&filter[status][_eq]=POSTED&limit=-1`
    );
    (txPostedRes.data ?? []).forEach(tx => {
      if (tx.sales_invoice_id) {
        postedTxInvoiceIds.add(tx.sales_invoice_id);
      }
    });
  } catch (e) {
    console.warn("Failed to fetch posted transaction invoice IDs", e);
  }

  const url = `/items/sales_invoice?limit=-1&fields=invoice_id,invoice_no,invoice_date,total_amount,transaction_status,customer_code,order_id,salesman_id&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  const res = await directusFetch<{ data: { invoice_id: number; invoice_no: string; total_amount: number; invoice_date: string; transaction_status: string }[] }>(`${DIRECTUS_URL}${url}`);
  
  const invoices = res.data ?? [];
  return invoices
    .filter(inv => !postedInvoiceIds.has(inv.invoice_id) && !postedTxInvoiceIds.has(inv.invoice_id))
    .map(inv => ({
      ...inv,
      isOnboardingBaseline: onboardingInvoiceIds.has(inv.invoice_id),
      hasMeteredTransaction: meteredTransactionInvoiceIds.has(inv.invoice_id)
    }));
}

export async function fetchAvailableCylinders(): Promise<CylinderAsset[]> {
  const qs = "fields=id,serial_number,tare_weight,cylinder_status,cylinder_condition,product_id,product_id.product_name,product.product_name&filter[cylinder_status][_in]=AVAILABLE,LOADED&filter[cylinder_condition][_eq]=GOOD&limit=200";
  const res = await directusFetch<{ data: CylinderAsset[] }>(`${DIRECTUS_URL}/items/cylinder_assets?${qs}`);
  const cylinders = res.data ?? [];

  // Normalize product relation
  for (const asset of cylinders) {
    const rawProd = (asset.product || asset.product_id) as { product_id?: number; id?: number; product_name?: string } | undefined;
    if (rawProd && typeof rawProd === "object") {
      asset.product = {
        id: rawProd.product_id || rawProd.id || 0,
        product_name: rawProd.product_name || ""
      };
      if (typeof asset.product_id === "object") {
        asset.product_id = (asset.product_id as unknown as { product_id?: number; id?: number }).product_id || (asset.product_id as unknown as { product_id?: number; id?: number }).id;
      }
    }
  }

  const missingProductCyls = cylinders.filter(c => !c.product && typeof c.product_id === "number");
  if (missingProductCyls.length > 0) {
    const productIds = Array.from(new Set(missingProductCyls.map(c => c.product_id).filter(Boolean)));
    if (productIds.length > 0) {
      try {
        const pRes = await directusFetch<{ data: { product_id: number; product_name: string }[] }>(
          `${DIRECTUS_URL}/items/products?fields=product_id,product_name&filter=${JSON.stringify({ product_id: { _in: productIds } })}`
        );
        const products = pRes.data || [];
        for (const asset of cylinders) {
          if (!asset.product && typeof asset.product_id === "number") {
            const p = products.find(prod => prod.product_id === asset.product_id);
            if (p) {
              asset.product = {
                id: p.product_id,
                product_name: p.product_name
              };
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch product names in bulk:", err);
      }
    }
  }

  return cylinders;
}

export async function validateSerialForOnboarding(serialNumber: string): Promise<CylinderAsset | null> {
  // 1. Check if it exists in consolidator_serial_mappings
  const mappingRes = await directusFetch<{ data: { serial_number: string }[] }>(
    `${DIRECTUS_URL}/items/consolidator_serial_mappings?filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&limit=1`
  );
  if (!mappingRes.data || mappingRes.data.length === 0) {
    throw new Error(`Serial ${serialNumber} not found in consolidator serial mappings.`);
  }

  // 2. Fetch from cylinder_assets
  const qs = `fields=id,serial_number,tare_weight,cylinder_status,cylinder_condition,product_id,product_id.product_name,product.product_name&filter[serial_number][_eq]=${encodeURIComponent(serialNumber)}&limit=1`;
  const assetRes = await directusFetch<{ data: CylinderAsset[] }>(`${DIRECTUS_URL}/items/cylinder_assets?${qs}`);
  const asset = assetRes.data?.[0];

  if (!asset) {
    throw new Error(`Serial ${serialNumber} not found in cylinder assets.`);
  }

  if (asset.cylinder_condition !== "GOOD") {
    throw new Error(`Cylinder ${serialNumber} condition is ${asset.cylinder_condition}, must be GOOD.`);
  }

  if (asset.cylinder_status !== "AVAILABLE" && asset.cylinder_status !== "LOADED") {
    throw new Error(`Cylinder ${serialNumber} status is ${asset.cylinder_status}, must be AVAILABLE or LOADED.`);
  }

  // Normalize product relation
  if (asset) {
    const rawProd = (asset.product || asset.product_id) as { product_id?: number; id?: number; product_name?: string } | undefined;
    if (rawProd && typeof rawProd === "object") {
      asset.product = {
        id: rawProd.product_id || rawProd.id || 0,
        product_name: rawProd.product_name || ""
      };
      if (typeof asset.product_id === "object") {
        asset.product_id = (asset.product_id as unknown as { product_id?: number; id?: number }).product_id || (asset.product_id as unknown as { product_id?: number; id?: number }).id;
      }
    } else if (asset.product_id && typeof asset.product_id === "number") {
      try {
        const prodRes = await directusFetch<{ data: { product_id: number; product_name: string } }>(
          `${DIRECTUS_URL}/items/products/${asset.product_id}?fields=product_id,product_name`
        );
        if (prodRes?.data) {
          asset.product = {
            id: prodRes.data.product_id,
            product_name: prodRes.data.product_name
          };
        }
      } catch (err) {
        console.error("Failed to fetch product details for cylinder asset:", err);
      }
    }
  }

  return asset;
}

export async function fetchActiveSiteCylinders(siteId: number): Promise<CustomerSiteCylinder[]> {
  const qs = `filter[lpg_site_id][_eq]=${siteId}&filter[site_cylinder_status][_in]=CONNECTED,STANDBY&filter[site_cylinder_status][_neq]=REMOVED&filter[removed_date][_null]=true&fields=*,cylinder_asset_id.*&limit=-1`;
  interface RawSiteCylinder extends Omit<CustomerSiteCylinder, 'cylinder_asset_id'> {
    cylinder_asset_id: CylinderAsset | number;
  }
  const res = await directusFetch<{ data: RawSiteCylinder[] }>(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders?${qs}`);
  return (res.data ?? []).map((row) => {
    const assetObj = typeof row.cylinder_asset_id === "object" ? row.cylinder_asset_id as CylinderAsset : undefined;
    const assetId = typeof row.cylinder_asset_id === "object" ? (row.cylinder_asset_id as CylinderAsset).id : row.cylinder_asset_id;
    return {
      ...row,
      cylinder_asset: assetObj,
      cylinder_asset_id: assetId,
    } as CustomerSiteCylinder;
  });
}

// Monogamy Verification
export async function verifyCylinderMonogamy(cylinderAssetId: number): Promise<boolean> {
  const query = {
    cylinder_asset_id: { _eq: cylinderAssetId },
    removed_date: { _null: true },
    site_cylinder_status: { _in: ["CONNECTED", "STANDBY"] },
  };
  const res = await directusFetch<{ data: unknown[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_site_cylinders?filter=${encodeURIComponent(JSON.stringify(query))}&limit=1`
  );
  return (res.data ?? []).length === 0;
}

// Helper to create zero-amount Sales Order
export async function createZeroAmountSalesOrder(
  customerCode: string,
  remarks: string,
  items: { product_id: number; quantity: number }[]
): Promise<{ id: number; order_no: string }> {
  const today = new Date().toISOString().split("T")[0];
  const orderNo = `SO-${Date.now().toString().slice(-6)}`;

  const orderRes = await directusFetch<{ data: { order_id: number; order_no: string } }>(
    `${DIRECTUS_URL}/items/sales_order`,
    {
      method: "POST",
      body: JSON.stringify({
        order_no: orderNo,
        customer_code: customerCode,
        branch_id: 1,
        order_date: today,
        order_status: "Draft",
        remarks: remarks,
        po_no: "N/A",
        total_amount: 0,
        discount_amount: 0,
        net_amount: 0,
        allocated_amount: 0,
      }),
    }
  );

  const orderId = orderRes.data.order_id;
  const orderNumber = orderRes.data.order_no ?? orderNo;

  if (items.length > 0) {
    const detailsPayload = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      unit_price: 0,
      ordered_quantity: item.quantity,
      quantity: item.quantity,
      allocated_quantity: item.quantity,
      served_quantity: item.quantity,
      gross_amount: 0,
      net_amount: 0,
      allocated_amount: 0,
      remarks: "WIWO zero-amount logistics",
    }));

    await directusFetch(`${DIRECTUS_URL}/items/sales_order_details`, {
      method: "POST",
      body: JSON.stringify(detailsPayload),
    });
  }

  return { id: orderId, order_no: orderNumber };
}

// Helper to create invoice
export async function createSalesInvoice(
  customerCode: string,
  amount: number,
  remarks: string,
  userId?: number
): Promise<{ id: number; invoice_no: string }> {
  const today = new Date().toISOString().split("T")[0];
  const ts = Date.now().toString().slice(-6);
  const invoiceNo = `SI-${ts.slice(0, 3)}-${ts.slice(3, 6)}`;

  // AG-CHANGE: Updated VAT calculation to use VAT-inclusive formulas (amount / 1.12)
  const vat = parseFloat((amount - (amount / 1.12)).toFixed(2));
  const net = amount;

  let salesmanId: number | null = null;
  if (userId) {
    try {
      const smRes = await directusFetch<{ data: { id: number }[] }>(
        `${DIRECTUS_URL}/items/salesman?filter[user_id][_eq]=${userId}&fields=id&limit=1`
      );
      if (smRes.data && smRes.data.length > 0) {
        salesmanId = smRes.data[0].id;
      }
    } catch (err) {
      console.error("Failed to resolve salesman_id for user:", err);
    }
  }

  const invRes = await directusFetch<{ data: { invoice_id: number; invoice_no: string } }>(
    `${DIRECTUS_URL}/items/sales_invoice`,
    {
      method: "POST",
      body: JSON.stringify({
        invoice_no: invoiceNo,
        order_id: invoiceNo,
        customer_code: customerCode,
        invoice_date: today,
        gross_amount: amount,
        vat_amount: vat,
        net_amount: net,
        total_amount: net,
        transaction_status: "POSTED",
        remarks: remarks,
        salesman_id: salesmanId,
        price_type: "D",
        discount_amount: 0,
        isReceipt: 1,
      }),
    }
  );

  return { id: invRes.data.invoice_id, invoice_no: invRes.data.invoice_no ?? invoiceNo };
}

// ─── Flow A: Onboarding Baseline Setup ────────────────────────────────────────
export async function processOnboardingBaseline(payload: {
  transactionHeaderId: number;
  customerCode: string;
  siteId: number;
  transactionDate: string;
  cylinders: OnboardCylinderInput[];
  salesInvoiceId?: number | null;
  salesInvoiceNo?: string | null;
  userId?: number;
}): Promise<MeteredWiwoTransaction> {
  // 1. Monogamy validation
  for (const cyl of payload.cylinders) {
    const isSingle = await verifyCylinderMonogamy(cyl.cylinderAssetId);
    if (!isSingle) {
      throw new Error(`Cylinder asset ${cyl.cylinderAssetId} is already connected/standby at another customer site.`);
    }
  }

  const cylinderAssetIds = payload.cylinders.map(c => c.cylinderAssetId);

  // Fetch product info from cylinder_assets
  const cylAssetsRes = await directusFetch<{ data: CylinderAsset[] }>(
    `${DIRECTUS_URL}/items/cylinder_assets?filter[id][_in]=${cylinderAssetIds.join(",")}&fields=id,serial_number,tare_weight,product_id`
  );
  const assets = cylAssetsRes.data ?? [];

  // Group items for zero amount sales order
  const groupCounts: Record<number, number> = {};
  assets.forEach((a) => {
    if (a.product_id) {
      groupCounts[a.product_id] = (groupCounts[a.product_id] || 0) + 1;
    }
  });
  const items = Object.entries(groupCounts).map(([pid, qty]) => ({
    product_id: Number(pid),
    quantity: qty,
  }));

  // Create logistics zero-amount sales order
  const so = await createZeroAmountSalesOrder(
    payload.customerCode,
    "Initial cylinder onboarding deployment",
    items
  );

  // Install cylinders
  const siteCylIds: number[] = [];
  for (const asset of assets) {
    const cylInput = payload.cylinders.find(c => c.cylinderAssetId === asset.id);
    const targetKg = cylInput ? cylInput.targetKg : 50;

    const siteCylRes = await directusFetch<{ data: { id: number } }>(
      `${DIRECTUS_URL}/items/lpg_customer_site_cylinders`,
      {
        method: "POST",
        body: JSON.stringify({
          lpg_site_id: payload.siteId,
          customer_code: payload.customerCode,
          cylinder_asset_id: asset.id,
          site_cylinder_status: "CONNECTED",
          previous_lpg_kg: targetKg,
          current_lpg_kg: targetKg,
          installed_date: payload.transactionDate,
          removed_date: null,
          ...withUser(payload.userId, ["created_by"]),
        }),
      }
    );
    siteCylIds.push(siteCylRes.data.id);

    // Update cylinder status to WITH_CUSTOMER
    await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${asset.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cylinder_status: "WITH_CUSTOMER",
        current_customer_code: payload.customerCode,
      }),
    });
  }

  // Use provided sales invoice or fallback (we should require it, but for safety keep null)
  const invoiceId = payload.salesInvoiceId ?? null;
  const invoiceNo = payload.salesInvoiceNo ?? null;

  // Create WIWO Header
  const wiwoNo = `WIWO-ONB-${Date.now().toString().slice(-6)}`;
  const headerRes = await directusFetch<{ data: { id: number } }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers`,
    {
      method: "POST",
      body: JSON.stringify({
        wiwo_no: wiwoNo,
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        transaction_date: payload.transactionDate,
        wiwo_type: "DEPLOYMENT_ONLY",
        total_returned_cylinders: 0,
        total_deployed_cylinders: assets.length,
        total_billable_kg: 0.000,
        wiwo_status: "DRAFT",
        sales_invoice_id: invoiceId,
        sales_invoice_no: invoiceNo,
        remarks: "Onboarding baseline initial setup",
        ...withUser(payload.userId, ["created_by", "posted_by"]),
        posted_date: new Date().toISOString(),
      }),
    }
  );

  const headerId = headerRes.data.id;

  const totalGrossWeight = payload.cylinders.reduce((sum, c) => sum + Number(c.targetKg || 0), 0);

  // Create WIWO details for new deployment
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const cylInput = payload.cylinders.find(c => c.cylinderAssetId === asset.id);
    const targetKg = cylInput ? Number(cylInput.targetKg || 0) : 50;
    const pricePerKg = cylInput ? cylInput.pricePerKg : 0;

    await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_details`, {
      method: "POST",
      body: JSON.stringify({
        wiwo_header_id: headerId,
        line_no: i + 1,
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        line_type: "NEW_DEPLOYMENT",
        site_cylinder_id: siteCylIds[i],
        cylinder_asset_id: asset.id,
        product_id: asset.product_id,
        serial_number: asset.serial_number,
        tare_weight_kg: asset.tare_weight ?? 0,
        previous_lpg_kg: targetKg,
        returned_gross_weight_kg: targetKg,
        remaining_lpg_kg: targetKg - (asset.tare_weight ?? 0),
        consumed_lpg_kg: 0,
        billable_kg: 0,
        is_billable: 0,
        price_per_kg: pricePerKg,
        result_site_cylinder_status: "CONNECTED",
        result_asset_status: "WITH_CUSTOMER",
        ...withUser(payload.userId, ["created_by"]),
      }),
    });
  }

  // Create Parent Transaction
  const txNo = `TX-ONB-${Date.now().toString().slice(-6)}`;
  const parentTx = await directusFetch<{ data: MeteredWiwoTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
    {
      method: "POST",
      body: JSON.stringify({
        transaction_no: txNo,
        transaction_header_id: payload.transactionHeaderId,
        transaction_type: "ONBOARDING_BASELINE",
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        sales_order_id: so.id,
        sales_order_no: so.order_no,
        sales_invoice_id: invoiceId,
        sales_invoice_no: invoiceNo,
        wiwo_header_id: headerId,
        transaction_date: payload.transactionDate,
        metered_kg: 0,
        wiwo_kg: totalGrossWeight,
        variance_kg: 0,
        billable_source: "NONE",
        billable_kg: 0,
        status: "DRAFT",
        remarks: "Onboarding baseline initial setup draft.",
        ...withUser(payload.userId, ["created_by", "posted_by"]),
        posted_date: new Date().toISOString(),
      }),
    }
  );

  // Link invoice to header
  if (invoiceId) {
    await directusFetch(`${DIRECTUS_URL}/items/lpg_transaction_header_invoices`, {
      method: "POST",
      body: JSON.stringify({
        header_id: payload.transactionHeaderId,
        sales_invoice_id: invoiceId,
        invoice_role: "SOURCE_DELIVERY",
        linked_by: payload.userId,
      }),
    });
  }

  return parentTx.data;
}

// ─── Flow B: Regular Routine Swap Loop ────────────────────────────────────────
export interface RoutineSwapLineInput {
  siteCylinderId: number; // The active cylinder being swapped out
  returnedGrossWeight: number;
  isSwapped: boolean;
}

export interface NewDeploymentLineInput {
  cylinderAssetId: number; // Selected from available warehouse inventory
  targetKg: number;
  serialPhotoId?: string;
  weightPhotoId?: string;
}

export async function processRegularSwap(payload: {
  transactionHeaderId: number;
  customerCode: string;
  siteId: number;
  transactionDate: string;
  previousMeterReading: number;
  currentMeterReading: number;
  pricePerKg: number;
  returnedCylinders: RoutineSwapLineInput[];
  newCylinders: NewDeploymentLineInput[];
  varianceReasonCode?: string;
  remarks?: string;
  userId?: number;
  transactionId?: number;
  isNoSwap?: boolean;
  meteredKg?: number;
  salesInvoiceId?: number | null;
  salesInvoiceNo?: string | null;
  idempotencyKey?: string;
  attachments?: {
    siteCylinderId: number | null;
    cylinderAssetId: number;
    attachmentType: "SERIAL_IMAGE" | "WEIGHT_IMAGE";
    directusFileId: string;
  }[];
}): Promise<MeteredWiwoTransaction> {
  // Idempotency Check
  if (payload.idempotencyKey) {
    try {
      const existingRes = await directusFetch<{ data: MeteredWiwoTransaction[] }>(
        `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?filter[idempotency_key][_eq]=${payload.idempotencyKey}`
      );
      if (existingRes.data && existingRes.data.length > 0) {
        return existingRes.data[0]; // Return the already processed transaction
      }
    } catch (err) {
      // Ignore if idempotency_key field doesn't exist yet, or query fails
      console.warn("Idempotency check failed (possibly missing field):", err);
    }
  }

  // Evidence validation for returned cylinders
  const attachments = payload.attachments || [];
  for (const ret of payload.returnedCylinders) {
    if (ret.returnedGrossWeight != null) {
      const hasSerial = attachments.some(a => a.siteCylinderId === ret.siteCylinderId && a.attachmentType === "SERIAL_IMAGE");
      const hasWeight = attachments.some(a => a.siteCylinderId === ret.siteCylinderId && a.attachmentType === "WEIGHT_IMAGE");
      if (!hasSerial || !hasWeight) {
        throw new Error(`Missing required evidence (Serial/Weight photos) for returned cylinder assignment ${ret.siteCylinderId}.`);
      }
    }
  }
  // Input validations:
  // Completeness Checks & Negative Boundaries
  const meteredKg = payload.meteredKg !== undefined ? payload.meteredKg : Math.max(0, payload.currentMeterReading - payload.previousMeterReading);

  // Gather returned cylinder records
  const returnedDetails: {
    sc: CustomerSiteCylinder;
    returnedGross: number;
    tare: number;
    remaining: number;
    consumed: number;
    isSwapped: boolean;
  }[] = [];

  for (const ret of payload.returnedCylinders) {
    if (ret.returnedGrossWeight == null) {
      throw new Error("Returned gross weight is required for all returned cylinders.");
    }
    // Fetch site cylinder info
    interface RawCustomerSiteCylinder extends Omit<CustomerSiteCylinder, 'cylinder_asset_id'> {
      cylinder_asset_id?: CylinderAsset;
    }
    const siteCylRes = await directusFetch<{ data: RawCustomerSiteCylinder }>(
      `${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${ret.siteCylinderId}?fields=*,cylinder_asset_id.*`
    );
    const sc = siteCylRes.data;
    if (!sc || sc.removed_date != null) {
      throw new Error(`Cylinder assignment ${ret.siteCylinderId} is not active at the site.`);
    }

    const tare = Number(sc.cylinder_asset_id?.tare_weight ?? 0);
    const opening = Number(sc.current_lpg_kg ?? 0);
    const openingNet = Math.max(0, opening - tare);

    // Guard remaining weight to not exceed the opening net LPG kg
    let remaining = ret.returnedGrossWeight - tare;
    if (remaining > openingNet) {
      remaining = openingNet;
    }
    const consumed = openingNet - remaining;

    if (remaining < 0 || consumed < 0) {
      throw new Error(
        `Negative boundaries violated: Cylinder ${sc.cylinder_asset_id?.serial_number} computed remaining = ${remaining} kg, consumed = ${consumed} kg. Please check scale entries.`
      );
    }

    returnedDetails.push({
      sc: {
        ...sc,
        cylinder_asset: sc.cylinder_asset_id,
        cylinder_asset_id: sc.cylinder_asset_id?.id ?? 0,
      },
      returnedGross: ret.returnedGrossWeight,
      tare,
      remaining,
      consumed,
      isSwapped: ret.isSwapped,
    });
  }

  // Monogamy validation for new deployments
  for (const dep of payload.newCylinders) {
    if (!Number.isFinite(dep.targetKg) || dep.targetKg <= 0) {
      throw new Error(`A valid gross weight is required for new cylinder asset ${dep.cylinderAssetId}.`);
    }
    if (!dep.serialPhotoId || !dep.weightPhotoId) {
      throw new Error(`Serial and weight photos are required for new cylinder asset ${dep.cylinderAssetId}.`);
    }
    const isSingle = await verifyCylinderMonogamy(dep.cylinderAssetId);
    if (!isSingle) {
      throw new Error(`New cylinder asset ${dep.cylinderAssetId} is actively assigned elsewhere.`);
    }

    const assetRes = await directusFetch<{ data: CylinderAsset }>(
      `${DIRECTUS_URL}/items/cylinder_assets/${dep.cylinderAssetId}?fields=id,serial_number,tare_weight,cylinder_status,cylinder_condition`
    );
    const asset = assetRes.data;
    if (!asset || asset.cylinder_condition !== "GOOD") {
      throw new Error(`New cylinder asset ${dep.cylinderAssetId} must be in GOOD condition.`);
    }
    if (asset.cylinder_status !== "AVAILABLE" && asset.cylinder_status !== "LOADED") {
      throw new Error(`New cylinder ${asset.serial_number} must be AVAILABLE or LOADED.`);
    }
    if (dep.targetKg < Number(asset.tare_weight ?? 0)) {
      throw new Error(
        `New cylinder ${asset.serial_number} gross weight cannot be below its tare weight of ${asset.tare_weight} kg.`
      );
    }
  }

  // Sum WIWO Consumed KG
  const totalWiwoKg = returnedDetails.reduce((sum, item) => sum + item.consumed, 0);

  // Exec MAX Rule
  const billableKg = Math.max(meteredKg, totalWiwoKg);
  const varianceKg = Math.abs(meteredKg - totalWiwoKg);
  const billableSource = meteredKg >= totalWiwoKg ? "METERED" : "WIWO";

  // Mismatch remarks requirement (2% Tolerance)
  const referenceKg = Math.max(meteredKg, totalWiwoKg, 0.0001);
  const diffPercentage = varianceKg / referenceKg;
  if (diffPercentage > 0.02 && !payload.remarks?.trim()) {
    throw new Error(
      `Metered KG (${meteredKg}) differs from WIWO KG (${totalWiwoKg}) by more than 2%. An explanation is required in the remarks field.`
    );
  }

  // Create zero-amount Sales Order for logistical cylinder actions
  // Fetch details of new assets
  const newCylIds = payload.newCylinders.map((n) => n.cylinderAssetId);
  const groupCounts: Record<number, number> = {};
  if (newCylIds.length > 0) {
    const newAssetsRes = await directusFetch<{ data: CylinderAsset[] }>(
      `${DIRECTUS_URL}/items/cylinder_assets?filter[id][_in]=${newCylIds.join(",")}&fields=id,product_id`
    );
    newAssetsRes.data?.forEach((a) => {
      if (a.product_id) {
        groupCounts[a.product_id] = (groupCounts[a.product_id] || 0) + 1;
      }
    });
  }
  const items = Object.entries(groupCounts).map(([pid, qty]) => ({
    product_id: Number(pid),
    quantity: qty,
  }));

  const so = await createZeroAmountSalesOrder(
    payload.customerCode,
    `Replacement cylinder deployment zero-amount SO for transaction`,
    items
  );

  // 1. Process returned cylinders database actions (mark EMPTY/RETURNED and removed_date OR update in-place weight)
  for (const retItem of returnedDetails) {
    const isSwapped = retItem.isSwapped;
    const siteCylUpdate: Record<string, string | number | null> = {
        previous_lpg_kg: retItem.sc.current_lpg_kg,
        current_lpg_kg: retItem.returnedGross,
        ...withUser(payload.userId, ["modified_by"]),
    };
    
    if (isSwapped) {
        siteCylUpdate.site_cylinder_status = "REMOVED";
        siteCylUpdate.removed_date = payload.transactionDate;
    }

    await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${retItem.sc.id}`, {
      method: "PATCH",
      body: JSON.stringify(siteCylUpdate),
    });

    if (isSwapped) {
      await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${retItem.sc.cylinder_asset_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cylinder_status: "EMPTY",
          current_customer_code: null,
        }),
      });
    }
  }

  // 2. Process newly installed cylinders database actions
  const installedCylIds: number[] = [];
  for (const dep of payload.newCylinders) {
    const installedRes = await directusFetch<{ data: { id: number } }>(
      `${DIRECTUS_URL}/items/lpg_customer_site_cylinders`,
      {
        method: "POST",
        body: JSON.stringify({
          lpg_site_id: payload.siteId,
          customer_code: payload.customerCode,
          cylinder_asset_id: dep.cylinderAssetId,
          site_cylinder_status: "CONNECTED",
          previous_lpg_kg: dep.targetKg,
          current_lpg_kg: dep.targetKg,
          installed_date: payload.transactionDate,
          removed_date: null,
          ...withUser(payload.userId, ["created_by"]),
        }),
      }
    );
    installedCylIds.push(installedRes.data.id);

    // Set cylinder asset to WITH_CUSTOMER
    await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${dep.cylinderAssetId}`, {
      method: "PATCH",
      body: JSON.stringify({
        cylinder_status: "WITH_CUSTOMER",
        current_customer_code: payload.customerCode,
      }),
    });
  }

  // Use provided sales invoice (fallback to null if not provided)
  const invoiceId = payload.salesInvoiceId ?? null;
  const invoiceNo = payload.salesInvoiceNo ?? null;

  let meterReadingId: number | null = null;
  if (payload.transactionId) {
    const existingTx = await fetchWiwoBillingTransactionById(payload.transactionId);
    if (existingTx && existingTx.meter_reading_id) {
      meterReadingId = typeof existingTx.meter_reading_id === "object"
        ? (existingTx.meter_reading_id as unknown as { id: number }).id
        : existingTx.meter_reading_id;
    }
  }

  if (!meterReadingId) {
    // Create Meter reading
    const meterReadingRes = await directusFetch<{ data: { id: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings`,
      {
        method: "POST",
        body: JSON.stringify({
          lpg_site_id: payload.siteId,
          customer_code: payload.customerCode,
          reading_date: payload.transactionDate,
          previous_reading: payload.previousMeterReading,
          current_reading: payload.currentMeterReading,
          kg_consumed: meteredKg,
          price_per_kg: payload.pricePerKg,
          raw_consumption: meteredKg,
          reading_status: "POSTED",
          ...withUser(payload.userId, ["created_by"]),
        }),
      }
    );
    meterReadingId = meterReadingRes.data.id;
  }

  // Create WIWO Header
  const wiwoNo = `WIWO-${Date.now().toString().slice(-6)}`;
  // AG-CHANGE: Updated calculation to VAT-inclusive formula where net = total and gross = net
  const netAmount = Number((totalWiwoKg * payload.pricePerKg).toFixed(2));
  const grossAmount = netAmount;
  const vatAmount = Number((netAmount - (netAmount / 1.12)).toFixed(2));

  const headerRes = await directusFetch<{ data: { id: number } }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers`,
    {
      method: "POST",
      body: JSON.stringify({
        wiwo_no: wiwoNo,
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        transaction_date: payload.transactionDate,
        wiwo_type: "CONSUMPTION_SWAP",
        total_returned_cylinders: returnedDetails.length,
        total_deployed_cylinders: payload.newCylinders.length,
        total_billable_kg: totalWiwoKg,
        price_per_kg: payload.pricePerKg,
        gross_amount: grossAmount,
        vat_amount: vatAmount,
        net_amount: netAmount,
        wiwo_status: "POSTED",
        sales_invoice_id: invoiceId,
        sales_invoice_no: invoiceNo,
        remarks: payload.remarks || "",
        ...withUser(payload.userId, ["created_by", "posted_by"]),
        posted_date: new Date().toISOString(),
      }),
    }
  );
  const wiwoHeaderId = headerRes.data.id;

  // Create details line items
  let lineNo = 1;
  // Returned cylinder detail lines
  for (const retItem of returnedDetails) {
    await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_details`, {
      method: "POST",
      body: JSON.stringify({
        wiwo_header_id: wiwoHeaderId,
        line_no: lineNo++,
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        line_type: "CONSUMPTION_RETURN",
        site_cylinder_id: retItem.sc.id,
        cylinder_asset_id: retItem.sc.cylinder_asset_id,
        product_id: retItem.sc.cylinder_asset?.product_id ?? 1,
        serial_number: retItem.sc.cylinder_asset?.serial_number ?? "",
        tare_weight_kg: retItem.tare,
        previous_lpg_kg: Number(retItem.sc.previous_lpg_kg ?? 0),
        returned_gross_weight_kg: retItem.returnedGross,
        remaining_lpg_kg: retItem.remaining,
        consumed_lpg_kg: retItem.consumed,
        billable_kg: retItem.consumed,
        price_per_kg: payload.pricePerKg,
        // AG-CHANGE: Detail line items updated to VAT-inclusive pricing formula
        gross_amount: parseFloat((retItem.consumed * payload.pricePerKg).toFixed(2)),
        vat_amount: parseFloat(((retItem.consumed * payload.pricePerKg) - (retItem.consumed * payload.pricePerKg) / 1.12).toFixed(2)),
        net_amount: parseFloat((retItem.consumed * payload.pricePerKg).toFixed(2)),
        is_billable: 1,
        result_site_cylinder_status: retItem.isSwapped ? "REMOVED" : "CONNECTED",
        result_asset_status: retItem.isSwapped ? "EMPTY" : "WITH_CUSTOMER",
        ...withUser(payload.userId, ["created_by"]),
      }),
    });
  }

  // Deployed cylinders detail lines
  for (let i = 0; i < payload.newCylinders.length; i++) {
    const dep = payload.newCylinders[i];
    const assetRes = await directusFetch<{ data: CylinderAsset }>(
      `${DIRECTUS_URL}/items/cylinder_assets/${dep.cylinderAssetId}?fields=*`
    );
    const asset = assetRes.data;

    await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_details`, {
      method: "POST",
      body: JSON.stringify({
        wiwo_header_id: wiwoHeaderId,
        line_no: lineNo++,
        lpg_site_id: payload.siteId,
        customer_code: payload.customerCode,
        line_type: "NEW_DEPLOYMENT",
        site_cylinder_id: installedCylIds[i],
        cylinder_asset_id: dep.cylinderAssetId,
        product_id: asset.product_id ?? 1,
        serial_number: asset.serial_number,
        tare_weight_kg: asset.tare_weight ?? 0,
        previous_lpg_kg: dep.targetKg,
        returned_gross_weight_kg: 0,
        remaining_lpg_kg: 0,
        consumed_lpg_kg: 0,
        billable_kg: 0,
        is_billable: 0,
        result_site_cylinder_status: "CONNECTED",
        result_asset_status: "WITH_CUSTOMER",
        ...withUser(payload.userId, ["created_by"]),
      }),
    });
  }

  // Update site reading status
  await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${payload.siteId}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_meter_reading: payload.currentMeterReading,
      last_reading_date: payload.transactionDate,
    }),
  });

  let parentTxData: MeteredWiwoTransaction;
  if (payload.transactionId) {
    const parentRes = await directusFetch<{ data: MeteredWiwoTransaction }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${payload.transactionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sales_order_id: so.id,
          transaction_header_id: payload.transactionHeaderId,
          sales_order_no: so.order_no,
          wiwo_header_id: wiwoHeaderId,
          wiwo_kg: totalWiwoKg,
          variance_kg: varianceKg,
          variance_reason_code: payload.varianceReasonCode || "NONE",
          billable_source: billableSource,
          billable_kg: billableKg,
          price_per_kg: payload.pricePerKg,
          gross_amount: grossAmount,
          vat_amount: vatAmount,
          net_amount: netAmount,
          sales_invoice_id: invoiceId,
          sales_invoice_no: invoiceNo,
          status: "POSTED",
          remarks: payload.remarks || "",
          ...withUser(payload.userId, ["posted_by", "modified_by"]),
          posted_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
        }),
      }
    );
    parentTxData = parentRes.data;

    if (invoiceId && !payload.transactionId) {
      // In case we want to attach invoice on patch, but let's do it on POST mostly.
    }
  } else {
    // Create parent Transaction record
    const txNo = `TX-WIWO-${Date.now().toString().slice(-6)}`;
    const parentRes = await directusFetch<{ data: MeteredWiwoTransaction }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
      {
        method: "POST",
        body: JSON.stringify({
          transaction_no: txNo,
          transaction_header_id: payload.transactionHeaderId,
          transaction_type: "REGULAR_BILLING",
          lpg_site_id: payload.siteId,
          customer_code: payload.customerCode,
          sales_order_id: so.id,
          sales_order_no: so.order_no,
          meter_reading_id: meterReadingId,
          wiwo_header_id: wiwoHeaderId,
          transaction_date: payload.transactionDate,
          metered_kg: meteredKg,
          wiwo_kg: totalWiwoKg,
          variance_kg: varianceKg,
          variance_reason_code: payload.varianceReasonCode || "NONE",
          billable_source: billableSource,
          billable_kg: billableKg,
          price_per_kg: payload.pricePerKg,
          gross_amount: grossAmount,
          vat_amount: vatAmount,
          net_amount: netAmount,
          sales_invoice_id: invoiceId,
          sales_invoice_no: invoiceNo,
          status: "POSTED",
          remarks: payload.remarks || "",
          idempotency_key: payload.idempotencyKey,
          ...withUser(payload.userId, ["created_by", "posted_by"]),
          posted_date: new Date().toISOString(),
        }),
      }
    );
    parentTxData = parentRes.data;

    // Link / Update invoice status to POSTED on the header linking table
    if (invoiceId) {
      try {
        const checkRes = await directusFetch<{ data: { id: number }[] }>(
          `${DIRECTUS_URL}/items/lpg_transaction_header_invoices?filter[header_id][_eq]=${payload.transactionHeaderId}&filter[sales_invoice_id][_eq]=${invoiceId}&limit=1`
        );
        const existingLink = checkRes.data?.[0];
        if (existingLink) {
          await directusFetch(
            `${DIRECTUS_URL}/items/lpg_transaction_header_invoices/${existingLink.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                status: "POSTED",
                linked_by: payload.userId,
              }),
            }
          );
        } else {
          await directusFetch(`${DIRECTUS_URL}/items/lpg_transaction_header_invoices`, {
            method: "POST",
            body: JSON.stringify({
              header_id: payload.transactionHeaderId,
              sales_invoice_id: invoiceId,
              invoice_role: "SOURCE_DELIVERY",
              linked_by: payload.userId,
              status: "POSTED",
            }),
          });
        }
      } catch (e) {
        console.warn("Failed to update lpg_transaction_header_invoices status to POSTED", e);
      }
    }
  }

  // Save attachments (Blocking Evidence Capture)
  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      await directusFetch(`${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments`, {
        method: "POST",
        body: JSON.stringify({
          transaction_id: parentTxData.id,
          site_cylinder_id: att.siteCylinderId || null,
          cylinder_asset_id: att.cylinderAssetId || null,
          attachment_type: att.attachmentType,
          directus_file_id: att.directusFileId,
          ...withUser(payload.userId, ["created_by"]),
        }),
      });
    }
  }

  return parentTxData;
}

// ─── Flow C: Rollback & Cancellation Flow ─────────────────────────────────────
export async function cancelWiwoBillingTransaction(
  transactionId: number,
  payload: {
    cancelledBy: number;
    cancelledReason: string;
  }
): Promise<void> {
  const today = new Date().toISOString();

  // Fetch transaction details
  const tx = await fetchWiwoBillingTransactionById(transactionId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }
  if (tx.status === "CANCELLED") {
    throw new Error("Transaction is already cancelled.");
  }

  const wiwoHeader = tx.wiwo_header_id as unknown as WiwoHeader | null | undefined;
  const wiwoHeaderId = wiwoHeader?.id ?? tx.wiwo_header_id;

  if (wiwoHeaderId) {
    // Update WIWO header status to CANCELLED
    await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_headers/${wiwoHeaderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        wiwo_status: "CANCELLED",
        cancelled_by: payload.cancelledBy,
        cancelled_date: today,
        cancelled_reason: payload.cancelledReason,
      }),
    });

    // Retrieve WIWO lines
    const detailRes = await directusFetch<{ data: WiwoDetail[] }>(
      `${DIRECTUS_URL}/items/lpg_wiwo_details?filter[wiwo_header_id][_eq]=${wiwoHeaderId}&limit=-1`
    );
    const lines = detailRes.data ?? [];

    for (const line of lines) {
      if (line.line_type === "CONSUMPTION_RETURN") {
        // Revert lpg_customer_site_cylinders record removed_date and status
        if (line.site_cylinder_id) {
          await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${line.site_cylinder_id}`, {
            method: "PATCH",
            body: JSON.stringify({
              site_cylinder_status: "CONNECTED",
              removed_date: null,
            }),
          });
        }

        // Revert master asset to WITH_CUSTOMER and re-link customer code
        await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${line.cylinder_asset_id}`, {
          method: "PATCH",
          body: JSON.stringify({
            cylinder_status: "WITH_CUSTOMER",
            current_customer_code: tx.customer_code,
          }),
        });
      } else if (line.line_type === "NEW_DEPLOYMENT") {
        // Delete or mark connection removed
        if (line.site_cylinder_id) {
          await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${line.site_cylinder_id}`, {
            method: "DELETE",
          });
        }

        // Set cylinder status back to AVAILABLE/LOADED in the warehouse
        await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${line.cylinder_asset_id}`, {
          method: "PATCH",
          body: JSON.stringify({
            cylinder_status: "AVAILABLE",
            current_customer_code: null,
          }),
        });
      }
    }
  }

  // Revert site's last meter reading if meter reading existed
  if (tx.meter_reading_id) {
    const readingId = (tx.meter_reading_id as unknown as MeterReading | null | undefined)?.id ?? tx.meter_reading_id;
    // Void / delete the reading
    await directusFetch(`${DIRECTUS_URL}/items/lpg_meter_readings/${readingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reading_status: "VOIDED",
      }),
    });

    // Reset last meter reading on site
    if (tx.meter_reading_id && typeof tx.meter_reading_id === "object") {
      const prevVal = (tx.meter_reading_id as unknown as MeterReading).previous_reading;
      await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${tx.lpg_site_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          last_meter_reading: prevVal,
        }),
      });
    }
  }

  // Revert Sales Order status
  if (tx.sales_order_id) {
    const orderId = (tx.sales_order_id as unknown as { id: number } | null | undefined)?.id ?? tx.sales_order_id;
    await directusFetch(`${DIRECTUS_URL}/items/sales_order/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        order_status: "Cancelled",
      }),
    });
  }

  // Revert/Void the invoice
  if (tx.sales_invoice_id) {
    const invoiceId = (tx.sales_invoice_id as unknown as { id: number } | null | undefined)?.id ?? tx.sales_invoice_id;
    await directusFetch(`${DIRECTUS_URL}/items/sales_invoice/${invoiceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        transaction_status: "CANCELLED",
        remarks: `Voided via rollback of WIWO billing: ${payload.cancelledReason}`,
      }),
    });
  }

  // Finally mark the parent transaction as CANCELLED
  await directusFetch(`${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${transactionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CANCELLED",
      cancelled_by: payload.cancelledBy,
      cancelled_date: today,
      cancelled_reason: payload.cancelledReason,
    }),
  });
}
