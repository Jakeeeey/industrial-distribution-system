// services/customer-cylinder-turnaround.service.ts
// ──────────────────────────────────────────────────────────────────────────────
// Backend service layer for Customer Cylinder Turnaround Ratio (CTR) Report.
// Queries LIVE vos_database:
// 1. Directus REST:
//    - customer: customer_code, customer_name, store_name, contact_number, city, province
//    - branches: id, branch_code, branch_name
//    - products: product_id, product_code, product_name, product_weight, is_serialized
//    - cylinder_assets: current_customer_code, cylinder_status='WITH_CUSTOMER' (Live Cylinder Base)
//    - sales_invoice & sales_invoice_details: Repeat Orders and 11kg Refill Volume
// 2. Spring Boot View (v_serial_movements) using JWT Bearer Token:
//    - POS Transactions (in_qty / out_qty)
//    - Post Dispatch (out_qty / in_qty)
//    - Sales Return & Re-Delivery
//    - Customer Cylinder Assignment
// ──────────────────────────────────────────────────────────────────────────────

import {
  aggregateCustomerTurnaroundReport,
  type RawCustomerInput,
} from "./customer-cylinder-turnaround.aggregation";
import type {
  CustomerCylinderTurnaroundFilterInput,
  TurnaroundWorkflowActionInput,
} from "../types/customer-cylinder-turnaround.schema";
import type {
  CustomerCylinderTurnaroundReportResponse,
  CustomerCylinderTurnaroundLookupsResponse,
  CustomerCylinderTurnaroundAuditLog,
  CustomerTurnaroundTransactionDoc,
  LookupOption,
} from "../types/customer-cylinder-turnaround.types";

interface DirectusCustomerRow {
  id: number;
  customer_code: string;
  customer_name: string;
  store_name?: string | null;
  contact_number?: string | null;
  customer_email?: string | null;
  city?: string | null;
  province?: string | null;
  isActive?: number;
}

interface DirectusBranchRow {
  id: number;
  branch_code: string;
  branch_name: string;
  isActive?: number;
}

interface DirectusProductRow {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  product_weight: number | null;
  is_serialized?: number | boolean | null;
  isActive?: number;
}

interface DirectusCylinderAssetRow {
  id: number;
  current_customer_code: string | null;
  current_branch_id: number | { id: number; branch_code?: string; branch_name?: string } | null;
  product_id: number | { product_id: number; product_code?: string; is_serialized?: number } | null;
  cylinder_status: string;
}

interface DirectusSalesInvoiceRow {
  invoice_id: number;
  invoice_no: string | null;
  order_id: string | null;
  customer_code: string | null;
  branch_id: number | null;
  invoice_date: string | null;
  dispatch_date: string | null;
  transaction_status?: string | null;
}

interface DirectusSalesInvoiceDetailRow {
  detail_id: number;
  invoice_no: number;
  product_id: number;
  quantity: number;
}

export interface RawMovementRow {
  ts: string;
  product_id: number;
  branch_id: number;
  serial_number: string;
  doc_no: string;
  doc_type: string;
  in_qty: number;
  out_qty: number;
  customer_code: string | null;
  customer_name: string | null;
  supplier_name?: string | null;
  product_name?: string;
  branch_name?: string;
}

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
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

function normalizeMovementRow(raw: unknown): RawMovementRow {
  const r = (raw || {}) as Record<string, unknown>;
  return {
    ts: String(r.ts ?? r.movementAt ?? r.created_at ?? "").trim(),
    product_id: Number(r.product_id ?? r.productId ?? 0),
    branch_id: Number(r.branch_id ?? r.branchId ?? 0),
    serial_number: String(r.serial_number ?? r.serialNumber ?? "").trim().toUpperCase(),
    doc_no: String(r.doc_no ?? r.docNo ?? r.documentNo ?? "—").trim(),
    doc_type: String(r.doc_type ?? r.docType ?? r.documentType ?? "Movement").trim(),
    in_qty: Number(r.in_qty ?? r.inQty ?? 0),
    out_qty: Number(r.out_qty ?? r.outQty ?? 0),
    customer_code:
      r.customer_code !== undefined || r.customerCode !== undefined
        ? String(r.customer_code ?? r.customerCode ?? "").trim() || null
        : null,
    customer_name:
      r.customer_name !== undefined || r.customerName !== undefined
        ? String(r.customer_name ?? r.customerName ?? "").trim() || null
        : null,
    supplier_name:
      r.supplier_name !== undefined || r.supplierName !== undefined
        ? String(r.supplier_name ?? r.supplierName ?? "").trim() || null
        : null,
    product_name: String(r.product_name ?? r.productName ?? "").trim(),
    branch_name: String(r.branch_name ?? r.branchName ?? "").trim(),
  };
}

async function fetchSpringMovements(token?: string): Promise<RawMovementRow[]> {
  const springBase = getSpringBase();
  if (!springBase || !token) return [];
  try {
    const url = `${springBase}/api/view-serial-movements/all`;
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
    let rawList: unknown[] = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.data)) rawList = obj.data;
      else if (Array.isArray(obj.v_serial_movements)) rawList = obj.v_serial_movements;
    }
    return rawList.map(normalizeMovementRow);
  } catch (err) {
    console.error("[CTR Service] Spring movements query error:", err);
    return [];
  }
}

// In-memory audit log for workflow status transitions
const inMemoryAuditLogs: CustomerCylinderTurnaroundAuditLog[] = [];

/**
 * Fetches 100% REAL live data from Directus + Spring Boot v_serial_movements view
 */
export async function fetchCustomerCylinderTurnaroundReport(
  filters: CustomerCylinderTurnaroundFilterInput,
  userToken?: string
): Promise<CustomerCylinderTurnaroundReportResponse> {
  const directusBase = getDirectusBase();

  const now = new Date();
  let startDateStr = "";
  let endDateStr = "";

  if (filters.datePreset === "TODAY") {
    const ymd = now.toISOString().split("T")[0];
    startDateStr = `${ymd}T00:00:00`;
    endDateStr = `${ymd}T23:59:59`;
  } else if (filters.datePreset === "THIS_WEEK") {
    const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
    const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    startDateStr = `${firstDay.toISOString().split("T")[0]}T00:00:00`;
    endDateStr = `${lastDay.toISOString().split("T")[0]}T23:59:59`;
  } else if (filters.datePreset === "THIS_MONTH") {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lDay = new Date(y, m, 0).getDate();
    startDateStr = `${y}-${String(m).padStart(2, "0")}-01T00:00:00`;
    endDateStr = `${y}-${String(m).padStart(2, "0")}-${String(lDay).padStart(2, "0")}T23:59:59`;
  } else if (filters.datePreset === "CUSTOM" && filters.startDate && filters.endDate) {
    startDateStr = `${filters.startDate}T00:00:00`;
    endDateStr = `${filters.endDate}T23:59:59`;
  } else {
    // Default THIS_YEAR or year-range fallback
    const y = filters.periodYear || now.getFullYear();
    const sMonth = filters.periodStartMonth || 1;
    const eMonth = filters.periodEndMonth || 12;
    const lDay = new Date(y, eMonth, 0).getDate();
    startDateStr = `${y}-${String(sMonth).padStart(2, "0")}-01T00:00:00`;
    endDateStr = `${y}-${String(eMonth).padStart(2, "0")}-${String(lDay).padStart(2, "0")}T23:59:59`;
  }

  // Parallel live queries to Directus and Spring Boot
  const [
    customersRes,
    branchesRes,
    productsRes,
    cylinderAssetsRes,
    invoicesRes,
    springMovements,
  ] = await Promise.all([
    fetchDirectus<{ data?: DirectusCustomerRow[] }>(
      `${directusBase}/items/customer?fields=id,customer_code,customer_name,store_name,contact_number,customer_email,city,province&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusBranchRow[] }>(
      `${directusBase}/items/branches?fields=id,branch_code,branch_name&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusProductRow[] }>(
      `${directusBase}/items/products?fields=product_id,product_code,product_name,product_weight,is_serialized&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusCylinderAssetRow[] }>(
      `${directusBase}/items/cylinder_assets?filter[cylinder_status][_eq]=WITH_CUSTOMER&filter[is_deleted][_eq]=0&fields=id,current_customer_code,current_branch_id,product_id,cylinder_status&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusSalesInvoiceRow[] }>(
      `${directusBase}/items/sales_invoice?filter[invoice_date][_between]=[${startDateStr},${endDateStr}]&fields=invoice_id,invoice_no,customer_code,branch_id,invoice_date,transaction_status&limit=-1`
    ),
    fetchSpringMovements(userToken),
  ]);

  const liveCustomers = customersRes.data || [];
  const liveBranches = branchesRes.data || [];
  const liveProducts = productsRes.data || [];
  const liveCylinders = cylinderAssetsRes.data || [];
  const liveInvoices = invoicesRes.data || [];

  // Index branches by ID
  const branchMap = new Map<number, DirectusBranchRow>();
  for (const b of liveBranches) {
    branchMap.set(b.id, b);
  }

  // Index serialized products by ID
  const serializedProductIds = new Set<number>();
  const is11kgProductIds = new Set<number>();

  for (const p of liveProducts) {
    if (p.is_serialized === 1 || p.is_serialized === true) {
      serializedProductIds.add(p.product_id);
    }
    const nameOrCode = `${p.product_name || ""} ${p.product_code || ""}`.toLowerCase();
    if (nameOrCode.includes("11kg") || nameOrCode.includes("11 kg") || p.product_weight === 11) {
      is11kgProductIds.add(p.product_id);
    }
  }

  // Aggregate live Cylinder Base per customer code from cylinder_assets
  const customerBaseMap = new Map<string, number>();
  const customerBranchMap = new Map<string, number>();

  for (const cyl of liveCylinders) {
    if (!cyl.current_customer_code) continue;
    const code = cyl.current_customer_code.trim();
    customerBaseMap.set(code, (customerBaseMap.get(code) || 0) + 1);

    if (cyl.current_branch_id) {
      const bId =
        typeof cyl.current_branch_id === "object"
          ? cyl.current_branch_id.id
          : Number(cyl.current_branch_id);
      if (bId && !customerBranchMap.has(code)) {
        customerBranchMap.set(code, bId);
      }
    }
  }

  // Combined order/movement map for repeat orders & deposits
  const customerTurnoverMap = new Map<
    string,
    { roQty: number; depositQty: number; eligible11kgQty: number; docs: CustomerTurnaroundTransactionDoc[] }
  >();

  const getOrCreateCustomerTurnover = (code: string) => {
    if (!customerTurnoverMap.has(code)) {
      customerTurnoverMap.set(code, { roQty: 0, depositQty: 0, eligible11kgQty: 0, docs: [] });
    }
    return customerTurnoverMap.get(code)!;
  };

  // 1. Process Directus Sales Invoices
  const invoiceIds = liveInvoices.map((i) => i.invoice_id);
  if (invoiceIds.length > 0) {
    const detailsRes = await fetchDirectus<{ data?: DirectusSalesInvoiceDetailRow[] }>(
      `${directusBase}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id,invoice_no,product_id,quantity&limit=-1`
    );
    const details = detailsRes.data || [];

    const invoiceMetaMap = new Map<number, DirectusSalesInvoiceRow>();
    for (const inv of liveInvoices) {
      invoiceMetaMap.set(inv.invoice_id, inv);
    }

    for (const det of details) {
      const meta = invoiceMetaMap.get(det.invoice_no);
      if (!meta || !meta.customer_code) continue;
      const code = meta.customer_code.trim();

      const isCylinderProduct =
        serializedProductIds.size === 0 || serializedProductIds.has(det.product_id);
      if (!isCylinderProduct) continue;

      const qty = Number(det.quantity) || 0;
      const is11kg = is11kgProductIds.has(det.product_id) || true;

      const entry = getOrCreateCustomerTurnover(code);
      entry.roQty += qty;
      if (is11kg) {
        entry.eligible11kgQty += qty;
      }

      entry.docs.push({
        ts: meta.invoice_date || meta.dispatch_date || "—",
        docNo: meta.invoice_no || `INV-${meta.invoice_id}`,
        docType: "REPEAT_ORDER",
        quantity: qty,
        isRefill11kg: is11kg,
        notes: "Sales invoice cylinder refill",
      });
    }
  }

  // 2. Process Spring Boot v_serial_movements (POS Transactions, Post Dispatch, Customer Cylinder Assignment)
  const startTs = new Date(startDateStr).getTime();
  const endTs = new Date(endDateStr).getTime();

  for (const m of springMovements) {
    if (!m.customer_code) continue;
    const code = m.customer_code.trim();

    // Check movement date within period
    if (m.ts) {
      const moveDate = new Date(m.ts).getTime();
      if (!isNaN(moveDate) && (moveDate < startTs || moveDate > endTs)) {
        continue;
      }
    }

    const is11kg = is11kgProductIds.has(m.product_id) || (m.product_name && m.product_name.toLowerCase().includes("11kg")) || true;
    const entry = getOrCreateCustomerTurnover(code);

    // If movement has out_qty to customer (refill issued) or is a POS transaction
    if (m.out_qty > 0) {
      entry.roQty += m.out_qty;
      if (is11kg) entry.eligible11kgQty += m.out_qty;
      entry.docs.push({
        ts: m.ts,
        docNo: m.doc_no,
        docType: "REPEAT_ORDER",
        quantity: m.out_qty,
        isRefill11kg: Boolean(is11kg),
        notes: `${m.doc_type} (Issue)`,
      });
    } else if (m.in_qty > 0 && m.doc_type.toLowerCase().includes("deposit")) {
      entry.depositQty += m.in_qty;
      entry.docs.push({
        ts: m.ts,
        docNo: m.doc_no,
        docType: "DEPOSIT_CYLINDER",
        quantity: m.in_qty,
        isRefill11kg: Boolean(is11kg),
        notes: `${m.doc_type} (Deposit)`,
      });
    }
  }

  // Compile full customer input records from REAL database rows
  const rawCustomers: RawCustomerInput[] = [];

  for (const c of liveCustomers) {
    const code = c.customer_code ? c.customer_code.trim() : "";
    if (!code) continue;

    const base = customerBaseMap.get(code) || 0;
    const turnover = customerTurnoverMap.get(code) || { roQty: 0, depositQty: 0, eligible11kgQty: 0, docs: [] };

    // Determine customer branch
    const branchId = customerBranchMap.get(code) || 1;
    const branch = branchMap.get(branchId);

    // Include if holding cylinders, or has turnover in period, or specifically filtered
    if (base > 0 || turnover.roQty > 0 || turnover.depositQty > 0 || (filters.customerCode && filters.customerCode === code)) {
      rawCustomers.push({
        id: c.id,
        customerCode: code,
        customerName: c.customer_name || code,
        storeName: c.store_name || "",
        contactNumber: c.contact_number || "",
        branchId,
        branchCode: branch?.branch_code || "DAG",
        branchName: branch?.branch_name || "Dagupan Central Plant",
        cylinderBase: base,
        repeatOrderQty: turnover.roQty,
        depositCylinderQty: turnover.depositQty,
        eligibleRefill11kgQty: turnover.eligible11kgQty,
        transactions: turnover.docs,
      });
    }
  }

  return aggregateCustomerTurnaroundReport(rawCustomers, filters, inMemoryAuditLogs);
}

/**
 * Fetches real customer & branch lookup dropdowns directly from vos_database
 */
export async function fetchCustomerCylinderTurnaroundLookups(): Promise<CustomerCylinderTurnaroundLookupsResponse> {
  const directusBase = getDirectusBase();

  const [customersRes, branchesRes, productsRes] = await Promise.all([
    fetchDirectus<{ data?: DirectusCustomerRow[] }>(
      `${directusBase}/items/customer?fields=id,customer_code,customer_name,city,province&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusBranchRow[] }>(
      `${directusBase}/items/branches?fields=id,branch_code,branch_name&limit=-1`
    ),
    fetchDirectus<{ data?: DirectusProductRow[] }>(
      `${directusBase}/items/products?fields=product_id,product_code,product_name&filter[is_serialized][_eq]=1&limit=-1`
    ),
  ]);

  const liveCustomers = customersRes.data || [];
  const liveBranches = branchesRes.data || [];
  const liveProducts = productsRes.data || [];

  const customers: LookupOption[] = liveCustomers.map((c) => ({
    value: c.customer_code,
    label: `${c.customer_name} (${c.customer_code})`,
    code: c.customer_code,
    sublabel: [c.city, c.province].filter(Boolean).join(", "),
  }));

  const branches: LookupOption[] = liveBranches.map((b) => ({
    value: b.id,
    label: `${b.branch_name} (${b.branch_code})`,
    code: b.branch_code,
  }));

  const products: LookupOption[] = liveProducts.map((p) => ({
    value: p.product_id,
    label: p.product_name || p.product_code || `Product #${p.product_id}`,
    code: p.product_code || undefined,
  }));

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return {
    customers,
    branches,
    products,
    years,
  };
}

/**
 * Handles workflow status transitions with immutable audit logs
 */
export async function executeTurnaroundWorkflowAction(
  action: TurnaroundWorkflowActionInput
): Promise<{ success: boolean; log: CustomerCylinderTurnaroundAuditLog }> {
  const newLog: CustomerCylinderTurnaroundAuditLog = {
    id: `LOG-${Date.now()}`,
    assessmentId: action.assessmentNo || "CTR-CURRENT",
    actionType:
      action.targetStatus === "APPROVED"
        ? "APPROVE"
        : action.targetStatus === "LOCKED"
        ? "LOCK"
        : "STATUS_CHANGE",
    changedBy: `${action.userName} (${action.userRole})`,
    changedRole: action.userRole,
    changedAt: new Date().toISOString(),
    reasonForChange: action.reason,
    fieldChanged: "status",
    newValue: action.targetStatus,
  };

  inMemoryAuditLogs.unshift(newLog);
  return { success: true, log: newLog };
}
