// services/cylinder-circulation.aggregation.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure business logic and calculation engine for Cylinder Circulation:
// - Sorts events chronologically per cylinder
// - Detects circulation breaks (missing return, unverified transit, location conflicts, etc.)
// - Computes stage dwell times and cycle turnaround velocity
// - Aggregates KPI summary cards and chart data structures
// - Defaults sorting to latest cylinder serial first (DESC)
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CylinderCirculationItem,
  CylinderCirculationKPIs,
  CylinderCirculationChartsData,
  CirculationBreakType,
  CustodianType,
  CylinderStatusType,
  CylinderConditionType,
  SerialMovementRecord,
  ChartStatusPoint,
  ChartStagePoint,
} from "../types/cylinder-circulation.types";
import type { CylinderCirculationFilterInput } from "../types/cylinder-circulation.schema";

export interface RawMovementRow {
  ts: string;
  product_id: number;
  branch_id: number;
  serial_number: string;
  doc_no: string;
  doc_type: string;
  in_qty: number;
  out_qty: number;
  customer_code?: string | null;
  customer_name?: string | null;
  supplier_name?: string | null;
  product_name: string;
  branch_name: string;
  uom_ids?: string | null;
}

export interface RawCylinderAssetRow {
  id: number;
  product_id: number | { product_id: number; product_name?: string; product_code?: string };
  serial_number: string;
  cylinder_status: string;
  cylinder_condition: string;
  current_branch_id: number | { id: number; branch_name?: string; branch_code?: string } | null;
  current_customer_code?: string | null;
  current_supplier_id?: number | null;
  tare_weight?: number | null;
  modified_date?: string | null;
  created_date?: string | null;
}

export interface RawProductRow {
  product_id: number;
  product_name: string;
  product_code?: string;
  is_serialized?: number | boolean;
}

export interface RawBranchRow {
  id: number;
  branch_name: string;
  branch_code: string;
}

function calculateDaysDifference(earlier: string, later: string): number {
  const d1 = new Date(earlier).getTime();
  const d2 = new Date(later).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  const diffDays = Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24));
  return Math.round(diffDays * 10) / 10;
}

export function computeCirculationReport(
  movements: RawMovementRow[],
  assets: RawCylinderAssetRow[],
  products: RawProductRow[],
  branches: RawBranchRow[],
  filters: CylinderCirculationFilterInput
): {
  cylinders: CylinderCirculationItem[];
  kpis: CylinderCirculationKPIs;
  charts: CylinderCirculationChartsData;
} {
  const branchMap = new Map<number, string>();
  for (const b of branches) {
    branchMap.set(b.id, b.branch_name);
  }

  const productMap = new Map<number, { name: string; code?: string }>();
  for (const p of products) {
    productMap.set(p.product_id, { name: p.product_name, code: p.product_code });
  }

  // Group movement rows by upper-cased serial_number
  const movementsBySerial = new Map<string, RawMovementRow[]>();
  for (const m of movements) {
    if (!m.serial_number || m.serial_number.trim() === "") continue;
    const key = m.serial_number.trim().toUpperCase();
    if (!movementsBySerial.has(key)) {
      movementsBySerial.set(key, []);
    }
    movementsBySerial.get(key)!.push(m);
  }

  const nowIso = new Date().toISOString();
  const cutoffTimestamp = filters.endDate ? new Date(filters.endDate).toISOString() : nowIso;

  // Prepare normalized search tokens for multi-cylinder selection
  const rawTokens: string[] = [];
  if (filters.serialNumbers && filters.serialNumbers.length > 0) {
    rawTokens.push(...filters.serialNumbers);
  }
  if (filters.serialNumber?.trim()) {
    rawTokens.push(...filters.serialNumber.split(","));
  }
  const searchTokens = rawTokens.map((s) => s.trim().toUpperCase()).filter(Boolean);

  const resultItems: CylinderCirculationItem[] = [];

  // Track stage aggregations for charts
  const stageVolumeCounter: Record<string, { count: number; totalDays: number }> = {
    Warehouse: { count: 0, totalDays: 0 },
    "Customer Site": { count: 0, totalDays: 0 },
    "In Transit": { count: 0, totalDays: 0 },
    "Supplier Refill": { count: 0, totalDays: 0 },
  };

  for (const asset of assets) {
    const rawSerial = asset.serial_number ? asset.serial_number.trim() : "";
    if (!rawSerial) continue;
    const upperSerial = rawSerial.toUpperCase();

    const prodId: number =
      (typeof asset.product_id === "object"
        ? asset.product_id?.product_id
        : asset.product_id) || 0;

    const branchId: number =
      (typeof asset.current_branch_id === "object"
        ? asset.current_branch_id?.id
        : asset.current_branch_id) || 0;

    // Apply primary branch and product filters
    if (filters.branchId && branchId !== filters.branchId) continue;
    if (filters.productId && prodId !== filters.productId) continue;

    // Multi-cylinder serial search filter
    if (searchTokens.length > 0) {
      const isMatched = searchTokens.some((tok) => upperSerial.includes(tok));
      if (!isMatched) continue;
    }

    const prodInfo = productMap.get(prodId) || {
      name:
        typeof asset.product_id === "object" ? asset.product_id?.product_name || "LPG" : "LPG",
      code: typeof asset.product_id === "object" ? asset.product_id?.product_code : undefined,
    };

    const branchName =
      branchMap.get(branchId) ||
      (typeof asset.current_branch_id === "object"
        ? asset.current_branch_id?.branch_name
        : "") ||
      "Headquarters";

    // Sort this cylinder's movements chronologically ascending
    const serialMoves = movementsBySerial.get(upperSerial) || [];
    serialMoves.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    // Enrich movements with stage and dwell calculations
    let prevMove: RawMovementRow | null = null;
    const enrichedHistory: SerialMovementRecord[] = [];
    let detectedBreak: CirculationBreakType = "HEALTHY";
    let breakReason = "";
    let consecutiveOutCount = 0;
    let totalCycleDaysSum = 0;
    let cycleCount = 0;

    for (let i = 0; i < serialMoves.length; i++) {
      const cur = serialMoves[i];
      const dwellDays = prevMove ? calculateDaysDifference(prevMove.ts, cur.ts) : 0;

      let stage = "Warehouse";
      if (cur.out_qty === 1) {
        if (cur.doc_type.includes("Refill") || cur.doc_type.includes("Supplier")) {
          stage = "Supplier Refill";
        } else if (cur.doc_type.includes("Transfer")) {
          stage = "In Transit";
        } else {
          stage = "Customer Site";
        }
        consecutiveOutCount++;
      } else if (cur.in_qty === 1) {
        stage = "Warehouse";
        if (consecutiveOutCount > 0) {
          totalCycleDaysSum += dwellDays;
          cycleCount++;
        }
        consecutiveOutCount = 0;
      }

      // Break Rule 1: Two consecutive dispatches without return
      let rowFlagged = false;
      let rowBreakReason = "";
      if (cur.out_qty === 1 && prevMove && prevMove.out_qty === 1) {
        rowFlagged = true;
        rowBreakReason = `Consecutive dispatch without recorded inbound return scan (${prevMove.doc_no} → ${cur.doc_no})`;
        if (detectedBreak === "HEALTHY") {
          detectedBreak = "BREAK_MISSING_RETURN";
          breakReason = rowBreakReason;
        }
      }

      // Break Rule 2: Location conflict
      if (
        prevMove &&
        cur.branch_id !== prevMove.branch_id &&
        !cur.doc_type.includes("Transfer") &&
        !prevMove.doc_type.includes("Transfer")
      ) {
        rowFlagged = true;
        rowBreakReason = `Scanned at ${cur.branch_name} while previously at ${prevMove.branch_name} with no transfer document`;
        if (detectedBreak === "HEALTHY") {
          detectedBreak = "BREAK_LOCATION_CONFLICT";
          breakReason = rowBreakReason;
        }
      }

      if (stageVolumeCounter[stage]) {
        stageVolumeCounter[stage].count++;
        stageVolumeCounter[stage].totalDays += dwellDays;
      }

      enrichedHistory.push({
        ts: cur.ts,
        productId: cur.product_id,
        branchId: cur.branch_id,
        serialNumber: cur.serial_number,
        docNo: cur.doc_no,
        docType: cur.doc_type,
        inQty: cur.in_qty,
        outQty: cur.out_qty,
        customerCode: cur.customer_code,
        customerName: cur.customer_name,
        supplierName: cur.supplier_name,
        productName: cur.product_name,
        branchName: cur.branch_name,
        uomIds: cur.uom_ids,
        dwellDays,
        stageName: stage,
        isFlaggedBreak: rowFlagged,
        breakReason: rowBreakReason,
      });

      prevMove = cur;
    }

    // Determine latest event
    const lastEvent = enrichedHistory.length > 0 ? enrichedHistory[enrichedHistory.length - 1] : null;
    const lastEventTimestamp = lastEvent?.ts || asset.modified_date || asset.created_date || nowIso;
    const daysInCurrentStatus = calculateDaysDifference(lastEventTimestamp, cutoffTimestamp);

    // If no movements occurred yet, attribute initial baseline dwell to stage counter
    if (enrichedHistory.length === 0) {
      let baselineStage = "Warehouse";
      if (asset.cylinder_status === "WITH_CUSTOMER") baselineStage = "Customer Site";
      else if (asset.cylinder_status === "LOADED" || asset.cylinder_status === "IN_TRANSIT")
        baselineStage = "In Transit";
      else if (asset.cylinder_status === "WITH_SUPPLIER") baselineStage = "Supplier Refill";

      if (stageVolumeCounter[baselineStage]) {
        stageVolumeCounter[baselineStage].count++;
        stageVolumeCounter[baselineStage].totalDays += daysInCurrentStatus;
      }
    }

    // Break Rule 3: Stalled transit (> 3 days in transit with no receive)
    if (
      lastEvent &&
      lastEvent.docType.includes("Stock Transfer (Dispatch)") &&
      daysInCurrentStatus > 3
    ) {
      if (detectedBreak === "HEALTHY") {
        detectedBreak = "BREAK_UNVERIFIED_TRANSIT";
        breakReason = `Dispatched in transfer ${lastEvent.docNo} over ${daysInCurrentStatus} days ago with no target branch receiving scan`;
      }
    }

    // Break Rule 4: Missing return while in customer custody (> 60 days)
    if (asset.cylinder_status === "WITH_CUSTOMER" && daysInCurrentStatus > 60) {
      if (detectedBreak === "HEALTHY") {
        detectedBreak = "BREAK_MISSING_RETURN";
        breakReason = `With customer ${asset.current_customer_code || "Unknown"} for ${daysInCurrentStatus} days without turnaround`;
      }
    }

    // Break Rule 5: Status Mismatch between physical last scan and asset master
    if (lastEvent) {
      if (lastEvent.inQty === 1 && asset.cylinder_status === "WITH_CUSTOMER") {
        if (detectedBreak === "HEALTHY") {
          detectedBreak = "BREAK_STATUS_MISMATCH";
          breakReason = `Last scan received inbound at warehouse (${lastEvent.docNo}), but cylinder asset status remains WITH_CUSTOMER`;
        }
      }
    }

    // Determine custodian details
    let custType: CustodianType = "Branch";
    let custCode = String(branchId);
    let custName = branchName;

    if (asset.cylinder_status === "WITH_CUSTOMER" || (lastEvent && lastEvent.customerCode)) {
      custType = "Customer";
      custCode = asset.current_customer_code || lastEvent?.customerCode || "";
      custName = lastEvent?.customerName || asset.current_customer_code || "Customer";
    } else if (lastEvent && lastEvent.docType.includes("Transfer (Dispatch)")) {
      custType = "Driver";
      custCode = lastEvent.docNo;
      custName = "In Transit Logistics";
    } else if (asset.cylinder_status === "WITH_SUPPLIER" || (lastEvent && lastEvent.supplierName)) {
      custType = "Supplier";
      custCode = String(asset.current_supplier_id || "");
      custName = lastEvent?.supplierName || "Supplier Plant";
    }

    const averageCycleDays = cycleCount > 0 ? Math.round((totalCycleDaysSum / cycleCount) * 10) / 10 : 0;

    // Filter by circulation break status
    if (filters.circulationStatus === "BREAKS_ONLY" && detectedBreak === "HEALTHY") {
      continue;
    }
    if (
      filters.circulationStatus &&
      filters.circulationStatus !== "ALL" &&
      filters.circulationStatus !== "BREAKS_ONLY" &&
      detectedBreak !== filters.circulationStatus
    ) {
      continue;
    }

    resultItems.push({
      id: asset.id,
      serialNumber: rawSerial,
      productId: prodId,
      productName: prodInfo.name,
      productCode: prodInfo.code,
      tareWeight: asset.tare_weight,
      cylinderStatus: (asset.cylinder_status as CylinderStatusType) || "AVAILABLE",
      cylinderCondition: (asset.cylinder_condition as CylinderConditionType) || "GOOD",
      currentBranchId: branchId,
      currentBranchName: branchName,
      currentCustodianType: custType,
      currentCustodianCode: custCode,
      currentCustodianName: custName,
      lastEventTimestamp,
      lastEventDocNo: lastEvent?.docNo || "—",
      lastEventDocType: lastEvent?.docType || "Initial Registration",
      circulationStatus: detectedBreak,
      breakDescription: breakReason,
      totalMovementsCount: enrichedHistory.length,
      daysInCurrentStatus,
      averageCycleDays,
      movementsHistory: enrichedHistory,
    });
  }

  // DEFAULT SORTING: Latest cylinder serial / most recently active first (DESC)
  resultItems.sort((a, b) => {
    const timeA = new Date(a.lastEventTimestamp).getTime();
    const timeB = new Date(b.lastEventTimestamp).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return Number(b.id) - Number(a.id);
  });

  // Calculate aggregated KPIs
  const totalTrackedCylinders = resultItems.length;
  const healthyCylinders = resultItems.filter((i) => i.circulationStatus === "HEALTHY").length;
  const circulationBreaksCount = totalTrackedCylinders - healthyCylinders;
  const breakPercentage =
    totalTrackedCylinders > 0
      ? Math.round((circulationBreaksCount / totalTrackedCylinders) * 1000) / 10
      : 0;
  const withCustomerCount = resultItems.filter((i) => i.currentCustodianType === "Customer").length;
  const inTransitCount = resultItems.filter(
    (i) => i.currentCustodianType === "Driver" || i.cylinderStatus === "LOADED"
  ).length;
  const inWarehouseCount = resultItems.filter((i) => i.currentCustodianType === "Branch").length;

  const validAvgCycles = resultItems.filter((i) => i.averageCycleDays > 0);
  const avgTurnaroundDays =
    validAvgCycles.length > 0
      ? Math.round(
          (validAvgCycles.reduce((acc, c) => acc + c.averageCycleDays, 0) /
            validAvgCycles.length) *
            10
        ) / 10
      : 0;

  // Chart data: Distribution of circulation break types
  const statusCounts: Record<string, number> = {
    Healthy: 0,
    "Missing Return": 0,
    "Stalled Transit": 0,
    "Location Conflict": 0,
    "Status Mismatch": 0,
  };

  for (const item of resultItems) {
    if (item.circulationStatus === "HEALTHY") statusCounts["Healthy"]++;
    else if (item.circulationStatus === "BREAK_MISSING_RETURN") statusCounts["Missing Return"]++;
    else if (item.circulationStatus === "BREAK_UNVERIFIED_TRANSIT") statusCounts["Stalled Transit"]++;
    else if (item.circulationStatus === "BREAK_LOCATION_CONFLICT") statusCounts["Location Conflict"]++;
    else statusCounts["Status Mismatch"]++;
  }

  const statusDistribution: ChartStatusPoint[] = [
    { name: "Healthy", value: statusCounts["Healthy"], fill: "hsl(142.1 76.2% 36.3%)" }, // emerald
    { name: "Missing Return", value: statusCounts["Missing Return"], fill: "hsl(0 84.2% 60.2%)" }, // rose
    { name: "Stalled Transit", value: statusCounts["Stalled Transit"], fill: "hsl(38 92% 50%)" }, // amber
    { name: "Location Conflict", value: statusCounts["Location Conflict"], fill: "hsl(262.1 83.3% 57.8%)" }, // purple
    { name: "Status Mismatch", value: statusCounts["Status Mismatch"], fill: "hsl(199 89% 48%)" }, // cyan
  ].filter((p) => p.value > 0);

  // Chart data: Stage Turnaround Velocity
  const stageTurnaround: ChartStagePoint[] = Object.entries(stageVolumeCounter).map(
    ([stage, data]) => ({
      stage,
      volume: data.count,
      avgDwellDays: data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0,
    })
  );

  return {
    cylinders: resultItems,
    kpis: {
      totalTrackedCylinders,
      healthyCylinders,
      circulationBreaksCount,
      breakPercentage,
      withCustomerCount,
      inTransitCount,
      inWarehouseCount,
      avgTurnaroundDays,
    },
    charts: {
      statusDistribution,
      stageTurnaround,
    },
  };
}
