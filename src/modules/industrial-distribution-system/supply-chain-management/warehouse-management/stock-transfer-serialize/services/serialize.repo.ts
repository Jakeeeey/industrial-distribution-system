import { fetchItems, createItems, bulkUpdateItems } from "../../stock-transfer/services/api";
import type { 
  StockTransferSerialRow,
} from "../types/serialize.types";
import type { 
  StockTransferRow,
  OrderGroup,
} from "../../stock-transfer/types/stock-transfer.types";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;

/**
 * Fetches current serial availability from v_serial_onhand view (Spring Boot API).
 */
export async function fetchSerialAvailability(serialNumber: string, branchId?: number, token?: string): Promise<StockTransferSerialRow[]> {
  if (!SPRING_API_BASE_URL) {
    console.error("[Serialize Repo] SPRING_API_BASE_URL is not defined");
    return [];
  }

  const url = `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/all?serialNumber=${encodeURIComponent(serialNumber.trim().toUpperCase())}`;
  
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...(token ? { 
          "Authorization": `Bearer ${token}`,
          "Cookie": `vos_access_token=${token}`
        } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[Serialize Repo] Spring API returned ${res.status} for ${url}`);
      throw new Error(`Spring API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.data || data.content || []);
    
    // Filter by branchId if provided, as the API might return for all branches
    interface SerialOnhandRaw {
      serialNumber?: string;
      serial_number?: string;
      branch_id?: number;
      branchId?: number;
      productId?: number;
      product_id?: number;
      qty_onhand?: number;
      [key: string]: unknown;
    }

    const filtered = items.filter((i: SerialOnhandRaw) => {
      const matchSerial = String(i.serialNumber || i.serial_number || "").trim().toUpperCase() === serialNumber.trim().toUpperCase();
      const matchBranch = branchId ? i.branch_id === branchId || i.branchId === branchId : true;
      return matchSerial && matchBranch;
    }).map((i: SerialOnhandRaw) => ({
      ...i,
      serial_number: i.serialNumber || i.serial_number,
      branch_id: i.branchId || i.branch_id,
      product_id: i.productId || i.product_id
    }));

    return filtered;
  } catch (error) {
    console.error("[Serialize Repo] Failed to fetch serial availability:", error);
    return [];
  }
}

/**
 * Records serial tracking entries in the stock_transfer_serial table.
 */
export async function insertSerialTracking(entries: StockTransferSerialRow[]): Promise<void> {
  if (entries.length === 0) return;
  await createItems("items/stock_transfer_serial", entries);
}

/**
 * Fetches recorded serials for a set of stock transfer IDs.
 */
export async function fetchRecordedSerials(transferIds: number[]): Promise<StockTransferSerialRow[]> {
  if (transferIds.length === 0) return [];

  const res = await fetchItems<StockTransferSerialRow>("items/stock_transfer_serial", {
    "filter[stock_transfer_id][_in]": transferIds.join(","),
    limit: -1,
  });
  
  return res.data;
}

interface TransferUpdatePayload {
  id: number;
  status?: string;
  received_quantity?: number;
  picked_quantity?: number;
  date_encoded?: string;
  date_received?: string;
  receiver_id?: number | null;
  dispatched_by?: number | null;
  dispatched_at?: string;
  approved_by?: number | null;
  rejected_by?: number | null;
  rejected_at?: string;
}

/**
 * Updates status and other fields for a batch of transfers.
 */
export async function bulkUpdateTransfers(items: TransferUpdatePayload[]): Promise<void> {
  if (items.length === 0) return;

  // Group by update payload to use bulk PATCH
  const grouped: Record<string, number[]> = {};
  items.forEach((item) => {
    const { id, ...data } = item;
    const key = JSON.stringify(data);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(id);
  });

  await Promise.all(
    Object.entries(grouped).map(([dataJson, ids]) =>
      bulkUpdateItems("items/stock_transfer", ids, JSON.parse(dataJson))
    )
  );
}

/**
 * Resolves the receiving target branch ID for a set of stock transfer IDs.
 * Used to identify the destination branch during Stock Transfer Receive.
 */
export async function fetchTransferTargetBranch(transferIds: number[]): Promise<number | null> {
  if (transferIds.length === 0) return null;

  interface TransferTargetBranchRow {
    target_branch?: number | { id?: number } | null;
  }

  const res = await fetchItems<TransferTargetBranchRow>("items/stock_transfer", {
    "filter[id][_in]": transferIds.join(","),
    "fields": "target_branch",
    "limit": 1,
  });

  const row = res.data?.[0];
  if (!row || !row.target_branch) return null;

  if (typeof row.target_branch === "object") {
    return row.target_branch.id ? Number(row.target_branch.id) : null;
  }
  return Number(row.target_branch) || null;
}

/**
 * Bulk updates current_branch_id in cylinder_assets for transferred serial numbers upon Receive.
 * Ensures cylinder_assets in Directus matches destination branch in Spring API ledger.
 */
export async function updateCylinderAssetsBranchForSerials(serials: string[], targetBranchId: number): Promise<void> {
  if (serials.length === 0 || !targetBranchId) return;

  const uniqueSerials = Array.from(new Set(serials.map(s => s.trim()))).filter(Boolean);
  if (uniqueSerials.length === 0) return;

  const upperSerials = uniqueSerials.map(s => s.toUpperCase());
  const lowerSerials = uniqueSerials.map(s => s.toLowerCase());

  interface CylinderAssetSimpleRow {
    id: number;
    serial_number?: string;
  }

  // Fetch matching cylinder assets by serial numbers (case-insensitive)
  const res = await fetchItems<CylinderAssetSimpleRow>("items/cylinder_assets", {
    "filter[_or][0][serial_number][_in]": upperSerials.join(","),
    "filter[_or][1][serial_number][_in]": lowerSerials.join(","),
    "fields": "id,serial_number",
    "limit": -1,
  });

  const matchingAssets = res.data || [];
  if (matchingAssets.length > 0) {
    const assetIds = matchingAssets.map(a => a.id);
    await bulkUpdateItems("items/cylinder_assets", assetIds, {
      current_branch_id: targetBranchId,
    });
  }
}

/**
 * Fetches stock transfers grouped by order_no with pagination and search support.
 * This version paginates by unique order numbers to ensure the sidebar fills correctly.
 */
export async function fetchStockTransferGroups(params: {
  status: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: OrderGroup[]; hasMore: boolean }> {
  const { status, search, limit = 10, offset = 0 } = params;

  // 1. Fetch unique order numbers matching the criteria
  // We use a larger limit for the inner fetch if needed, but the primary goal 
  // is to get the set of order_nos for this 'page' of orders.
  const distinctQueryParams: Record<string, string | number | boolean | undefined> = {
    "filter[status][_in]": status,
    // "filter[source_branch][division_id][_eq]": 1,
    "fields": "order_no,date_encoded",
    "sort": "-date_encoded",
    "limit": -1, // We'll handle the unique slicing in JS for simplicity with Directus
  };

  if (search) {
    distinctQueryParams["filter[_or][0][order_no][_icontains]"] = search;
    distinctQueryParams["filter[_or][1][source_branch][branch_name][_icontains]"] = search;
    distinctQueryParams["filter[_or][2][target_branch][branch_name][_icontains]"] = search;
  }

  const distinctRes = await fetchItems<StockTransferRow>("items/stock_transfer", distinctQueryParams);
  const allRows = distinctRes.data || [];
  
  // Get unique order numbers in order of date_encoded
  const uniqueOrderNos: string[] = [];
  const seen = new Set<string>();
  for (const row of allRows) {
    if (!seen.has(row.order_no)) {
      seen.add(row.order_no);
      uniqueOrderNos.push(row.order_no);
    }
  }

  // Slice for the current page of GROUPS
  const pagedOrderNos = uniqueOrderNos.slice(offset, offset + limit);
  const hasMore = uniqueOrderNos.length > offset + limit;

  if (pagedOrderNos.length === 0) {
    return { data: [], hasMore: false };
  }

  // 2. Fetch full details for the specific order numbers on this page
  const detailsQueryParams: Record<string, string | number | boolean | undefined> = {
    "filter[order_no][_in]": pagedOrderNos.join(","),
    "limit": -1,
    "sort": "-date_encoded",
    "fields": "*,product_id.*,product_id.is_serialized,source_branch.*,target_branch.*",
  };

  const detailsRes = await fetchItems<StockTransferRow>("items/stock_transfer", detailsQueryParams);
  const rawData = detailsRes.data || [];

  // Use the helper to group the details
  const { groupByOrderNo } = await import("../../stock-transfer/services/stock-transfer.helpers");
  const groups = groupByOrderNo(rawData);

  // Sort groups to match the order of pagedOrderNos
  const sortedGroups = pagedOrderNos.map(no => groups.find(g => g.orderNo === no)).filter(Boolean) as OrderGroup[];

  return {
    data: sortedGroups,
    hasMore,
  };
}
