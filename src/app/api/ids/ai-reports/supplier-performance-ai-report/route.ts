/**
 * Supplier Performance Report Data Fetcher API Route
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Direct aggregation query against:
 * - purchase_order
 * - purchase_order_products
 * - purchase_order_receiving
 * - return_to_supplier
 * - rts_items
 * - suppliers
 *
 * Revisions:
 * - Filters output to ONLY existing records (vendors with orders due, received qty, or RTS returns)
 * - Captures structured RTS logs (doc_no, transaction_date, returned quantity, item/master remarks)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    SupplierSummaryRow,
    ReportExecutiveKPIs,
    SupplierPerformanceReportPayload,
    AiTierSlug,
    RtsLogEntry,
} from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    if (!cleaned) throw new Error('DIRECTUS_URL is not configured.');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
    if (!token) throw new Error('DIRECTUS_STATIC_TOKEN is not configured.');
    return token;
}

function directusHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getDirectusToken()}`,
    };
}

async function fetchDirectusCollection<T>(collection: string, queryParams: string = ''): Promise<T[]> {
    const base = getDirectusBase();
    const url = `${base}/items/${collection}?${queryParams}`;
    const res = await fetch(url, {
        headers: directusHeaders(),
        cache: 'no-store',
    });
    if (!res.ok) {
        console.error(`[SupplierPerformance] Failed to fetch ${collection}: status ${res.status}`);
        return [];
    }
    const json = await res.json().catch(() => ({ data: [] }));
    return (json?.data || []) as T[];
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const branchId = searchParams.get('branchId') || '';
        const supplierId = searchParams.get('supplierId') || '';

        // 1. Fetch Active Suppliers
        let supplierFilter = 'filter[isActive][_eq]=1&limit=-1';
        if (supplierId) {
            supplierFilter += `&filter[id][_eq]=${encodeURIComponent(supplierId)}`;
        }
        const suppliersList = await fetchDirectusCollection<{
            id: number;
            supplier_name: string;
            contact_person: string | null;
            payment_terms: string | null;
            delivery_terms: string | null;
        }>('suppliers', supplierFilter);

        // 2. Fetch Posted Purchase Orders
        let poFilter = 'filter[is_posted][_eq]=1&limit=-1';
        if (branchId) {
            poFilter += `&filter[branch_id][_eq]=${encodeURIComponent(branchId)}`;
        }
        if (startDate) {
            poFilter += `&filter[date][_gte]=${encodeURIComponent(startDate)}`;
        }
        if (endDate) {
            poFilter += `&filter[date][_lte]=${encodeURIComponent(endDate)}`;
        }
        const purchaseOrders = await fetchDirectusCollection<{
            purchase_order_id: number;
            purchase_order_no: string;
            supplier_name: number;
            date: string;
            expected_received_date: string | null;
            lead_time_receiving: string | null;
            date_received: string | null;
            branch_id: number;
        }>('purchase_order', poFilter);

        // 3. Fetch Purchase Order Products (Ordered quantities & Prices)
        const poProducts = await fetchDirectusCollection<{
            purchase_order_id: number;
            product_id: number;
            ordered_quantity: number;
            unit_price: number;
            approved_price: number | null;
        }>('purchase_order_products', 'limit=-1');

        // 4. Fetch Purchase Order Receiving (Actual deliveries)
        const poReceivings = await fetchDirectusCollection<{
            purchase_order_id: number;
            product_id: number;
            received_quantity: number;
            received_date: string | null;
            receipt_date: string | null;
            unit_price: number;
            isPosted: number;
        }>('purchase_order_receiving', 'limit=-1');

        // 5. Fetch Posted Return to Supplier (RTS) headers and items
        const rtsList = await fetchDirectusCollection<{
            id: number;
            doc_no: string;
            supplier_id: number;
            branch_id: number;
            transaction_date: string;
            remarks: string | null;
            is_posted: number;
        }>('return_to_supplier', 'filter[is_posted][_eq]=1&limit=-1');

        const rtsItems = await fetchDirectusCollection<{
            rts_id: number;
            product_id: number;
            quantity: number;
            item_remarks: string | null;
        }>('rts_items', 'limit=-1');

        // Map PO Lines and Receivings by purchase_order_id
        const poLinesByPoId = new Map<number, typeof poProducts>();
        for (const line of poProducts) {
            const list = poLinesByPoId.get(line.purchase_order_id) || [];
            list.push(line);
            poLinesByPoId.set(line.purchase_order_id, list);
        }

        const receivingByPoId = new Map<number, typeof poReceivings>();
        for (const rec of poReceivings) {
            const list = receivingByPoId.get(rec.purchase_order_id) || [];
            list.push(rec);
            receivingByPoId.set(rec.purchase_order_id, list);
        }

        // Map RTS Headers by ID
        const rtsHeaderMap = new Map<number, (typeof rtsList)[0]>();
        for (const rts of rtsList) {
            rtsHeaderMap.set(rts.id, rts);
        }

        // Map Structured RTS Logs by supplier_id
        const rtsLogsBySupplierId = new Map<number, RtsLogEntry[]>();

        // First, iterate items to associate quantity and line remarks
        const processedRtsIds = new Set<number>();

        for (const item of rtsItems) {
            const header = rtsHeaderMap.get(item.rts_id);
            if (header) {
                processedRtsIds.add(header.id);
                const supId = header.supplier_id;
                const list = rtsLogsBySupplierId.get(supId) || [];

                const reason =
                    item.item_remarks?.trim() ||
                    header.remarks?.trim() ||
                    `Return order documented under ${header.doc_no}`;

                list.push({
                    docNo: header.doc_no,
                    date: header.transaction_date ? String(header.transaction_date).slice(0, 10) : 'N/A',
                    quantity: Number(item.quantity) || 0,
                    reason,
                });
                rtsLogsBySupplierId.set(supId, list);
            }
        }

        // Also ensure headers without child items are still logged
        for (const rts of rtsList) {
            if (!processedRtsIds.has(rts.id)) {
                const list = rtsLogsBySupplierId.get(rts.supplier_id) || [];
                list.push({
                    docNo: rts.doc_no,
                    date: rts.transaction_date ? String(rts.transaction_date).slice(0, 10) : 'N/A',
                    quantity: 0,
                    reason: rts.remarks?.trim() || `Return document ${rts.doc_no} (no item breakdown)`,
                });
                rtsLogsBySupplierId.set(rts.supplier_id, list);
            }
        }

        // Aggregate Metrics per Supplier
        const allSupplierRows: SupplierSummaryRow[] = suppliersList.map((sup) => {
            const supplierPos = purchaseOrders.filter((po) => po.supplier_name === sup.id);
            const totalOrdersDue = supplierPos.length;

            let onTimeOrders = 0;
            let inFullOrders = 0;
            let otifOrders = 0;
            let totalReceivedQuantity = 0;
            let splitDeliveryCount = 0;
            let costVarianceSum = 0;
            let costVarianceCount = 0;

            for (const po of supplierPos) {
                const lines = poLinesByPoId.get(po.purchase_order_id) || [];
                const receivings = receivingByPoId.get(po.purchase_order_id) || [];

                if (receivings.length > lines.length) {
                    splitDeliveryCount++;
                }

                // Total ordered vs Total received
                const totalOrderedQty = lines.reduce((acc, curr) => acc + (Number(curr.ordered_quantity) || 0), 0);
                const poReceivedQty = receivings.reduce((acc, curr) => acc + (Number(curr.received_quantity) || 0), 0);
                totalReceivedQuantity += poReceivedQty;

                // Evaluate In-Full
                const isInFull = totalOrderedQty > 0 && poReceivedQty >= totalOrderedQty;
                if (isInFull) inFullOrders++;

                // Evaluate On-Time
                const targetDateStr = po.expected_received_date || po.lead_time_receiving;
                let isOnTime = false;
                if (targetDateStr && receivings.length > 0) {
                    const latestReceipt = receivings.reduce((latest, curr) => {
                        const date = curr.received_date || curr.receipt_date || '';
                        return date > latest ? date : latest;
                    }, '');
                    if (latestReceipt && latestReceipt.slice(0, 10) <= targetDateStr.slice(0, 10)) {
                        isOnTime = true;
                    }
                }
                if (isOnTime) onTimeOrders++;

                // OTIF condition: Both On-Time AND In-Full
                if (isOnTime && isInFull) {
                    otifOrders++;
                }

                // Cost Variance Calculation
                for (const line of lines) {
                    const approvedPrice = Number(line.approved_price) || Number(line.unit_price) || 0;
                    const matchingRecs = receivings.filter((r) => r.product_id === line.product_id);
                    for (const mr of matchingRecs) {
                        const actualPrice = Number(mr.unit_price) || approvedPrice;
                        if (approvedPrice > 0) {
                            const variancePct = ((actualPrice - approvedPrice) / approvedPrice) * 100;
                            costVarianceSum += variancePct;
                            costVarianceCount++;
                        }
                    }
                }
            }

            // Defect / Rejection data from RTS
            const rtsLogs = rtsLogsBySupplierId.get(sup.id) || [];
            const totalReturnedQuantity = rtsLogs.reduce((acc, curr) => acc + curr.quantity, 0);
            const rtsRemarks = rtsLogs.map((r) => r.reason).filter(Boolean);

            const otifPercentage = totalOrdersDue > 0 ? Math.round((otifOrders / totalOrdersDue) * 100) : null;
            const rejectionRatePercentage =
                totalReceivedQuantity > 0
                    ? Number(((totalReturnedQuantity / totalReceivedQuantity) * 100).toFixed(2))
                    : totalReturnedQuantity > 0
                    ? 100
                    : null;
            const averageCostVariancePercentage =
                costVarianceCount > 0 ? Number((costVarianceSum / costVarianceCount).toFixed(2)) : 0;

            // Risk Scoring
            const riskDrivers: string[] = [];
            if (otifPercentage !== null && otifPercentage < 75) {
                riskDrivers.push(`Low OTIF (${otifPercentage}%)`);
            }
            if (rejectionRatePercentage !== null && rejectionRatePercentage > 3) {
                riskDrivers.push(`High rejection rate (${rejectionRatePercentage}%)`);
            }
            if (averageCostVariancePercentage > 2) {
                riskDrivers.push(`Cost overrun (+${averageCostVariancePercentage}%)`);
            }
            if (splitDeliveryCount > 2) {
                riskDrivers.push(`Frequent split deliveries (${splitDeliveryCount})`);
            }

            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (riskDrivers.length >= 2 || (otifPercentage !== null && otifPercentage < 60)) {
                riskLevel = 'HIGH';
            } else if (riskDrivers.length === 1) {
                riskLevel = 'MEDIUM';
            }

            return {
                supplierId: sup.id,
                supplierName: sup.supplier_name,
                contactPerson: sup.contact_person,
                paymentTerms: sup.payment_terms,
                deliveryTerms: sup.delivery_terms,
                totalOrdersDue,
                onTimeOrders,
                inFullOrders,
                otifOrders,
                otifPercentage,
                totalReceivedQuantity,
                totalReturnedQuantity,
                rejectionRatePercentage,
                averageCostVariancePercentage,
                rtsCount: rtsLogs.length,
                splitDeliveryCount,
                rtsRemarks,
                rtsLogs,
                riskLevel,
                riskDrivers,
            };
        });

        // REVISION 1: Filter to ONLY suppliers with existing transactional activity!
        const existingRecordRows = allSupplierRows.filter(
            (s) => s.totalOrdersDue > 0 || s.totalReceivedQuantity > 0 || s.rtsCount > 0
        );

        // Compute Executive High-Level KPIs over existing records
        const validOtifRows = existingRecordRows.filter((s) => s.otifPercentage !== null);
        const validRejectionRows = existingRecordRows.filter((s) => s.rejectionRatePercentage !== null);

        const averageOtifRate =
            validOtifRows.length > 0
                ? Math.round(validOtifRows.reduce((a, b) => a + (b.otifPercentage || 0), 0) / validOtifRows.length)
                : null;

        const averageRejectionRate =
            validRejectionRows.length > 0
                ? Number(
                      (
                          validRejectionRows.reduce((a, b) => a + (b.rejectionRatePercentage || 0), 0) /
                          validRejectionRows.length
                      ).toFixed(2)
                  )
                : null;

        const highRiskVendorsCount = existingRecordRows.filter((s) => s.riskLevel === 'HIGH').length;
        const totalRtsReturns = existingRecordRows.reduce((a, b) => a + b.rtsCount, 0);

        const kpis: ReportExecutiveKPIs = {
            totalSuppliersEvaluated: existingRecordRows.length,
            averageOtifRate,
            averageRejectionRate,
            highRiskVendorsCount,
            totalRtsReturns,
            dataFreshnessTimestamp: new Date().toISOString(),
        };

        const userTier = {
            tierLevel: 3,
            tierSlug: 'executive' as AiTierSlug,
            tierName: 'Executive',
        };

        const responsePayload: SupplierPerformanceReportPayload = {
            filter: { startDate, endDate, branchId, supplierId },
            kpis,
            suppliers: existingRecordRows,
            userTier,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
        console.error('[SupplierPerformance API Error]:', errorMsg);
        return NextResponse.json({ error: 'Failed to generate supplier performance report', details: errorMsg }, { status: 500 });
    }
}
