'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockTransferBase } from '../../shared/hooks/use-stock-transfer-base';
import { stockTransferLifecycleService } from '../../services/stock-transfer.lifecycle';
import { toast } from 'sonner';
import type { OrderGroup, OrderGroupItem, ProductRow } from '../../types/stock-transfer.types';

/**
 * Hook for managing the "Stock Transfer Dispatch" phase (Manual Entry).
 */
export function useStockTransferDispatchManual() {
  const base = useStockTransferBase({
    statuses: ['For Picking', 'Picking', 'Picked']
  });

  const [fetchingAvailable, setFetchingAvailable] = useState(false);
  const [scannedInventory, setScannedInventory] = useState<Record<number, number>>({});
  const [scannedQtys, setScannedQtys] = useState<Record<number, number>>({});

  const updateScannedQty = useCallback((id: number, qty: number, maxQty: number) => {
    setScannedQtys(prev => {
      const validQty = Math.max(0, Math.min(qty, maxQty));
      return { ...prev, [id]: validQty };
    });
  }, []);

  const orderGroups = useMemo(() => {
    return base.baseOrderGroups.map((group: OrderGroup) => {
      const enrichedItems = group.items.map((st: OrderGroupItem) => {
        const product = st.product_id as ProductRow;
        const pid = product?.product_id || st.product_id;

        const uom = typeof product?.unit_of_measurement === 'object' ? product.unit_of_measurement : null;
        const unitName = (uom?.unit_name || '').toLowerCase();
        const unitId = Number(uom?.unit_id || 0);
        const loosePack = unitName.includes('loose') || unitName.includes('pieces') || unitName.includes('pcs') || unitName.includes('tie') || unitId === 4;

        const rawAvailable = scannedInventory[pid as number] ?? (st as OrderGroupItem).qtyAvailable ?? 0;

        return {
          ...st,
          scannedQty: scannedQtys[st.id] ?? 0,
          qtyAvailable: Math.max(0, rawAvailable),
          isLoosePack: loosePack,
        };
      });

      return {
        ...group,
        items: enrichedItems
      };
    });
  }, [base.baseOrderGroups, scannedQtys, scannedInventory]);

  const selectedGroup = useMemo(() => {
    if (!base.selectedOrderNo) return null;
    return orderGroups.find((g: OrderGroup) => g.orderNo === base.selectedOrderNo) || null;
  }, [base.selectedOrderNo, orderGroups]);

  // Fetch initial inventory for selected order
  useEffect(() => {
    if (!base.selectedOrderNo || !selectedGroup) return;

    const fetchInitialInventory = async () => {
      setFetchingAvailable(true);
      try {
        const newAvailable: Record<number, number> = { ...scannedInventory };
        const sourceBranch = selectedGroup.sourceBranch!;
        const sourceBranchName = base.getBranchName(sourceBranch);

        // Fetch all uncached product inventories in a single request
        const itemsToFetch = selectedGroup.items.filter((item: OrderGroupItem) => {
          const product = item.product_id as ProductRow;
          const pid = product?.product_id || item.product_id;
          return pid && scannedInventory[pid as number] === undefined;
        });

        if (itemsToFetch.length > 0) {
          const params = new URLSearchParams({
            branchName: sourceBranchName,
            branchId: String(sourceBranch),
            current: '0'
          });

          const proxyUrl = `/api/ids/scm/warehouse-management/stock-transfer/inventory-proxy?${params.toString()}`;
          const res = await fetch(proxyUrl);

          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);

            itemsToFetch.forEach((item: OrderGroupItem) => {
              const product = item.product_id as ProductRow;
              const pid = product?.product_id || item.product_id;

              const inventoryList = list.filter((inv: Record<string, string | number>) =>
                String(inv.productId ?? inv.product_id) === String(pid) &&
                String(inv.branchId ?? inv.branch_id) === String(sourceBranch)
              );

              const availableCount = inventoryList.reduce((acc: number, inv: Record<string, string | number>) => acc + Number(inv.runningInventory ?? inv.running_inventory ?? 0), 0);
              const unitCount = Number(product?.unit_of_measurement_count || 1) || 1;
              newAvailable[pid as number] = Math.max(0, Math.floor(availableCount / unitCount));
            });

            setScannedInventory(newAvailable);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial available quantities:', err);
      } finally {
        setFetchingAvailable(false);
      }
    };

    fetchInitialInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.selectedOrderNo]);

  const dispatchOrder = async (
    orderNo: string,
    discrepancyOptions?: {
      globalReason?: string;
      globalRemarks?: string;
      itemReasons?: Record<number, { reason: string; remarks?: string }>;
    }
  ) => {
    const group = orderGroups.find((g: OrderGroup) => g.orderNo === orderNo);
    if (!group) return;

    // Build item payload — include all items with picked_quantity
    // This supports partial dispatch: items with 0 qty still get status updated with discrepancy reasons
    const itemsPayload = group.items.map((i: OrderGroupItem) => {
      const itemReasonObj = discrepancyOptions?.itemReasons?.[i.id];
      const reason = itemReasonObj?.reason || discrepancyOptions?.globalReason;
      const remarks = itemReasonObj?.remarks || discrepancyOptions?.globalRemarks;

      return {
        id: i.id,
        status: 'For Loading',
        picked_quantity: scannedQtys[i.id] ?? 0,
        ...(reason ? { discrepancy_reason: reason } : {}),
        ...(remarks ? { discrepancy_remarks: remarks } : {})
      };
    });

    base.setProcessing(true);
    try {
      await stockTransferLifecycleService.submitStatusUpdate({
        items: itemsPayload,
        status: 'For Loading',
        ...(discrepancyOptions?.globalReason ? { discrepancy_reason: discrepancyOptions.globalReason } : {}),
        ...(discrepancyOptions?.globalRemarks ? { discrepancy_remarks: discrepancyOptions.globalRemarks } : {})
      });

      toast.success(`Order ${orderNo} successfully dispatched.`);
      base.setSelectedOrderNo(null);
      await base.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong while dispatching.';
      toast.error(msg);
    } finally {
      base.setProcessing(false);
    }
  };

  const markAsPicked = async (orderNo: string) => {
    base.setProcessing(true);
    try {
      const group = orderGroups.find((g: OrderGroup) => g.orderNo === orderNo);
      if (group) {
        await stockTransferLifecycleService.submitStatusUpdate({
          items: group.items.map((i: OrderGroupItem) => ({
            id: i.id,
            status: 'Picked',
            picked_quantity: scannedQtys[i.id] ?? i.picked_quantity ?? 0
          })),
          status: 'Picked'
        });
        toast.success(`Successfully marked as Done Picking.`);
        await base.refresh();
      }
    } catch {
      toast.error('Failed to update status to Picked');
    } finally {
      base.setProcessing(false);
    }
  };

  return {
    ...base,
    orderGroups,
    selectedGroup,
    dispatchOrder,
    fetchingAvailable,
    scannedQtys,
    updateScannedQty,
    markAsPicked,
  };
}
