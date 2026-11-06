// services/branch-operational-performance.service.ts
// ──────────────────────────────────────────────────────────────────────────────
// Backend service orchestrator:
// 1. Queries Directus for tables (sales_invoice, cylinder_assets, post_dispatch_plan,
//    post_dispatch_budgeting, chart_of_accounts, customer, branches, products).
// 2. Queries Spring Boot endpoints with JWT token for SQL views (v_serial_movements, v_serial_onhand).
// 3. Performs pure aggregation and returns unified report response.
// ──────────────────────────────────────────────────────────────────────────────

import {
  computeBranchOperationalMetrics,
  type RawSalesInvoice,
  type RawCylinderAsset,
  type RawMovementRow,
  type RawPostDispatchPlan,
  type RawPostDispatchBudgeting,
  type RawCustomer,
  type RawProduct,
  type RawBranch,
} from "./branch-operational-performance.aggregation";
import type {
  BranchOperationalFilterInput,
} from "../types/branch-operational-performance.schema";
import type {
  BranchOperationalReportResponse,
  ReportLookupsResponse,
} from "../types/branch-operational-performance.types";

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");
  if (!raw) return "http://127.0.0.1:8055";
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getSpringBase(): string {
  const raw = (process.env.SPRING_API_BASE_URL || "").trim().replace(/\/$/, "");
  return raw;
}

function getDirectusToken(): string {
  return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
}

function directusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchDirectus<T = unknown>(url: string): Promise<T> {
  try {
    const res = await fetch(url, { headers: directusHeaders(), cache: "no-store" });
    if (!res.ok) return { data: [] } as unknown as T;
    return (await res.json()) as T;
  } catch {
    return { data: [] } as unknown as T;
  }
}

async function fetchSpring<T = unknown>(url: string, token?: string): Promise<T[]> {
  if (!url || !token) return [];
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as Record<string, unknown> | unknown[];
    if (Array.isArray(json)) return json as T[];
    if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as T[];
      if (Array.isArray(obj.v_serial_movements)) return obj.v_serial_movements as T[];
      if (Array.isArray(obj.v_serial_onhand)) return obj.v_serial_onhand as T[];
    }
    return [];
  } catch (err) {
    console.error("[Branch Operational Report] Spring query error:", err);
    return [];
  }
}

export async function getBranchOperationalLookups(): Promise<ReportLookupsResponse> {
  const base = getDirectusBase();

  const [branchesRes, custRes] = await Promise.all([
    fetchDirectus<{ data: RawBranch[] }>(`${base}/items/branches?filter[isActive][_eq]=1&limit=-1&fields=id,branch_name,branch_code`),
    fetchDirectus<{ data: RawCustomer[] }>(`${base}/items/customer?filter[isActive][_eq]=1&limit=200&fields=customer_code,customer_name,store_name`),
  ]);

  const branches = (branchesRes.data || []).map((b) => ({
    value: String(b.id),
    label: `${b.branch_name ?? "Branch"} (${b.branch_code ?? ""})`,
    code: b.branch_code,
  }));

  const custodians = (custRes.data || []).map((c) => ({
    value: c.customer_code,
    label: `${c.customer_name || c.store_name} (${c.customer_code})`,
    code: c.customer_code,
  }));

  return { branches, custodians };
}

export async function getBranchOperationalDashboard(
  filters: BranchOperationalFilterInput,
  jwtToken?: string
): Promise<BranchOperationalReportResponse> {
  const base = getDirectusBase();
  const springBase = getSpringBase();
  const branchParam = filters.branchId ? `&filter[branch_id][_eq]=${filters.branchId}` : "";
  const branchAssetParam = filters.branchId ? `&filter[current_branch_id][_eq]=${filters.branchId}` : "";
  const branchStartPointParam = filters.branchId ? `&filter[starting_point][_eq]=${filters.branchId}` : "";

  // Spring Boot URLs with query params
  const springMovementsUrl = springBase
    ? `${springBase}/api/view-serial-movements/all`
    : "";
  const springOnhandUrl = springBase
    ? `${springBase}/api/view-serial-onhand/all`
    : "";

  // Parallel fetching from Directus and Spring Boot
  const [
    salesInvoicesRes,
    cylinderAssetsRes,
    postDispatchRes,
    postDispatchBudgetingRes,
    branchesRes,
    productsRes,
    customersRes,
    rawSpringMovements,
    rawSpringOnhand,
  ] = await Promise.all([
    fetchDirectus<{ data: RawSalesInvoice[] }>(
      `${base}/items/sales_invoice?limit=-1&filter[invoice_date][_gte]=${filters.startDate}&filter[invoice_date][_lte]=${filters.endDate} 23:59:59&filter[isPosted][_eq]=1${branchParam}&fields=invoice_id,invoice_no,invoice_date,branch_id,customer_code,net_amount,total_amount,isReplaced`
    ),
    fetchDirectus<{ data: RawCylinderAsset[] }>(
      `${base}/items/cylinder_assets?limit=-1&filter[is_deleted][_eq]=0${branchAssetParam}&fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,cost,modified_date,created_date`
    ),
    fetchDirectus<{ data: RawPostDispatchPlan[] }>(
      `${base}/items/post_dispatch_plan?limit=-1&filter[date_encoded][_gte]=${filters.startDate}&filter[date_encoded][_lte]=${filters.endDate} 23:59:59${branchStartPointParam}&fields=id,doc_no,amount,total_distance,status,starting_point,time_of_arrival,date_encoded`
    ),
    fetchDirectus<{ data: RawPostDispatchBudgeting[] }>(
      `${base}/items/post_dispatch_budgeting?limit=-1&fields=id,post_dispatch_plan_id,coa_id,amount,remarks`
    ),
    fetchDirectus<{ data: RawBranch[] }>(`${base}/items/branches?limit=-1&fields=id,branch_name,branch_code`),
    fetchDirectus<{ data: RawProduct[] }>(`${base}/items/products?filter[is_serialized][_eq]=1&limit=-1&fields=product_id,product_name,product_code,estimated_unit_cost,cost_per_unit`),
    fetchDirectus<{ data: RawCustomer[] }>(`${base}/items/customer?limit=-1&fields=customer_code,customer_name,store_name`),
    fetchSpring<RawMovementRow>(springMovementsUrl, jwtToken),
    fetchSpring<Record<string, unknown>>(springOnhandUrl, jwtToken),
  ]);

  const branchesMap = new Map<number, RawBranch>(
    (branchesRes.data || []).map((b) => [b.id, b])
  );
  const productsMap = new Map<number, RawProduct>(
    (productsRes.data || []).map((p) => [p.product_id, p])
  );
  const customersMap = new Map<string, RawCustomer>(
    (customersRes.data || []).map((c) => [c.customer_code, c])
  );

  const selectedBranch = filters.branchId ? branchesMap.get(filters.branchId) : null;
  const selectedCustodian = filters.custodianCode ? customersMap.get(filters.custodianCode) : null;

  // Filter Spring movements and onhand by branch & date window if applied
  const filteredMovements = rawSpringMovements.filter((m) => {
    const branchId = Number(m.branchId ?? m.branch_id ?? 0);
    if (filters.branchId && branchId !== filters.branchId) return false;
    const ts = String(m.ts ?? m.movementAt ?? "");
    const dateStr = ts.split(/[ T]/)[0];
    if (dateStr && (dateStr < filters.startDate || dateStr > filters.endDate)) return false;
    return true;
  });

  const filteredOnhand = rawSpringOnhand.filter((o) => {
    const branchId = Number(o.branchId ?? o.branch_id ?? 0);
    if (filters.branchId && branchId !== filters.branchId) return false;
    return true;
  });

  const aggregated = computeBranchOperationalMetrics({
    salesInvoices: salesInvoicesRes.data || [],
    cylinderAssets: cylinderAssetsRes.data || [],
    serialMovements: filteredMovements,
    serialOnhand: filteredOnhand,
    postDispatchPlans: postDispatchRes.data || [],
    postDispatchBudgeting: postDispatchBudgetingRes.data || [],
    customersMap,
    productsMap,
    branchesMap,
    cutoffDate: filters.endDate,
  });

  // Apply optional post-aggregation filters on incidents
  let filteredIncidents = aggregated.incidents;
  if (filters.custodianCode) {
    filteredIncidents = filteredIncidents.filter((i) => i.custodianCode === filters.custodianCode);
  }
  if (filters.incidentType) {
    filteredIncidents = filteredIncidents.filter((i) => i.incidentType === filters.incidentType);
  }
  if (filters.recoveryStatus) {
    filteredIncidents = filteredIncidents.filter((i) => i.recoveryStatus === filters.recoveryStatus);
  }
  if (filters.chargeStatus) {
    filteredIncidents = filteredIncidents.filter((i) => i.chargeStatus === filters.chargeStatus);
  }

  return {
    filters: {
      ...filters,
      branchLabel: selectedBranch ? `${selectedBranch.branch_name} (${selectedBranch.branch_code})` : undefined,
      custodianLabel: selectedCustodian ? `${selectedCustodian.customer_name || selectedCustodian.store_name}` : undefined,
    },
    generatedAt: new Date().toISOString(),
    dataFreshnessTimestamp: new Date().toLocaleString(),
    cutoffDate: `${filters.endDate} 23:59:59`,
    kpis: aggregated.kpis,
    charts: aggregated.charts,
    incidents: filteredIncidents,
  };
}
