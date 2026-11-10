'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSerializeBase } from './use-serialize-base';
import { serializeLifecycleService } from '../services/api-serialize';
import { soundFX } from '../../active-picking/utils/audioProvider';
import { toast } from 'sonner';
import type { OrderGroup, OrderGroupItem, ProductRow } from '../../stock-transfer/types/stock-transfer.types';
import type { SerialScanLog, SerialOrderGroupItem } from '../types/serialize.types';

const LOCAL_STORAGE_KEY = 'scm_serialize_receive_scans_v1';

export function useSerializeReceive() {
  const base = useSerializeBase({ 
    statuses: ['For Loading'] 
  });

  // AG-COMMENT: Ticket 1 - Track scan error banner state for visual feedback
  const [scanError, setScanError] = useState<{ serial: string; message: string } | null>(null);

  const [receivedSerialsState, setReceivedSerialsState] = useState<Record<string, SerialScanLog[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [manualQuantitiesState, setManualQuantitiesState] = useState<Record<string, Record<number, number>>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_manual');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(receivedSerialsState));
      localStorage.setItem(LOCAL_STORAGE_KEY + '_manual', JSON.stringify(manualQuantitiesState));
    }
  }, [receivedSerialsState, manualQuantitiesState]);

  const orderGroups = useMemo(() => {
    return base.baseOrderGroups.map((group: OrderGroup) => {
      const enrichedItems = group.items.map((st: OrderGroupItem) => {
        const product = st.product_id as ProductRow;
        const pid = (typeof st.product_id === 'object' ? st.product_id.product_id : st.product_id) as number;
        const isSerialized = product?.is_serialized === 1;
        
        if (isSerialized) {
          const scanLogs = receivedSerialsState[group.orderNo] || [];
          const itemSerials = scanLogs
            .filter(s => s.status === 'SUCCESS' && s.productId === pid)
            .map(s => s.serialNumber);

          return {
            ...st,
            receivedQty: itemSerials.length,
            receivedSerialQty: itemSerials.length,
            receivedSerials: itemSerials,
          } as SerialOrderGroupItem;
        } else {
          const manualQty = manualQuantitiesState[group.orderNo]?.[pid] || 0;
          return {
            ...st,
            receivedQty: manualQty,
          } as SerialOrderGroupItem;
        }
      });

      return { ...group, items: enrichedItems };
    });
  }, [base.baseOrderGroups, receivedSerialsState, manualQuantitiesState]);

  const selectedGroup = useMemo(() => {
    if (!base.selectedOrderNo) return null;
    return orderGroups.find((g) => g.orderNo === base.selectedOrderNo) || null;
  }, [base.selectedOrderNo, orderGroups]);

  const updateManualQty = (productId: number, delta: number) => {
    if (!base.selectedOrderNo) return;
    
    setManualQuantitiesState(prev => {
      const orderNo = base.selectedOrderNo!;
      const currentOrderManual = prev[orderNo] || {};
      const currentQty = currentOrderManual[productId] || 0;
      
      const item = selectedGroup?.items.find(i => {
        const pid = (typeof i.product_id === 'object' ? i.product_id.product_id : i.product_id) as number;
        return pid === productId;
      });
      
      if (!item) return prev;
      
      const targetQty = item.allocated_quantity || 0;
      const newQty = Math.max(0, Math.min(targetQty, currentQty + delta));
      
      return {
        ...prev,
        [orderNo]: {
          ...currentOrderManual,
          [productId]: newQty
        }
      };
    });
  };

  const handleSerialInput = async (serial: string) => {
    if (!base.selectedOrderNo || !selectedGroup) {
      soundFX.error();
      toast.error("Please select an order first.");
      return;
    }

    const serialTrimmed = serial.trim();
    if (serialTrimmed.length < 1) {
      return;
    }

    // Clear any previous scan error
    setScanError(null);

    // Identify serialized products in this order for context in case of error
    const firstSerializedItem = selectedGroup.items.find(i => {
      const p = i.product_id as ProductRow;
      return typeof p === 'object' && p?.is_serialized === 1;
    });
    const defaultProductName = firstSerializedItem 
      ? ((firstSerializedItem.product_id as ProductRow)?.product_name || "serialized item") 
      : "order item";

    try {
      const currentScans = receivedSerialsState[base.selectedOrderNo!] || [];
      if (currentScans.some(s => s.status === 'SUCCESS' && s.serialNumber === serialTrimmed)) {
        soundFX.duplicate();
        const dupMsg = `Serial '${serialTrimmed}' already scanned in this order.`;
        setScanError({ serial: serialTrimmed, message: dupMsg });
        toast.warning(dupMsg);
        return;
      }

      // In the Receive phase, we match against the Dispatched serials.
      const transferIds = selectedGroup.items.map(i => i.id).filter(id => id !== undefined);
      const lookupResult = await serializeLifecycleService.lookupReceiveSerial(serialTrimmed, transferIds);
      
      // AG-COMMENT: Ticket 1 - Check structured result without throwing raw errors to eliminate Next.js Console Error overlay
      if (!lookupResult.success) {
        soundFX.error();
        const errBannerMsg = `Invalid Serial Number: '${serialTrimmed}' not found for ${defaultProductName}`;
        setScanError({ serial: serialTrimmed, message: errBannerMsg });
        toast.error(errBannerMsg);
        return;
      }

      const match = lookupResult.data;
      
      // AG-COMMENT: Ticket 1 - Enforce exact case matching on client side as an extra safeguard
      if (match.serialNumber !== serialTrimmed) {
        soundFX.error();
        const caseMsg = `Invalid Serial Number: '${serialTrimmed}' case does not match dispatched tag '${match.serialNumber}'`;
        setScanError({ serial: serialTrimmed, message: caseMsg });
        toast.error(caseMsg);
        return;
      }

      const itemInOrder = selectedGroup.items.find(i => i.id === match.stockTransferId);

      if (!itemInOrder) {
        soundFX.error();
        const notInOrderMsg = `Invalid Serial Number: '${serialTrimmed}' does not belong to this order.`;
        setScanError({ serial: serialTrimmed, message: notInOrderMsg });
        toast.error(notInOrderMsg);
        return;
      }

      const product = itemInOrder.product_id as ProductRow;
      const pid = typeof product === 'object' ? product.product_id : product as number;
      const productName = typeof product === 'object' ? product.product_name : `Product ${pid}`;
      const isSerializedVal = typeof product === 'object' && product !== null ? product.is_serialized : undefined;

      if (isSerializedVal === 0) {
        soundFX.error();
        const nonSerMsg = `Product ${productName} is not serialized. Use manual input.`;
        setScanError({ serial: serialTrimmed, message: nonSerMsg });
        toast.error(nonSerMsg);
        return;
      }

      const targetQty = itemInOrder.allocated_quantity || 0;
      const currentReceivedQty = (itemInOrder as SerialOrderGroupItem).receivedSerialQty || 0;

      if (currentReceivedQty >= targetQty) {
        soundFX.error();
        const limitMsg = `Quantity limit reached for ${productName}.`;
        setScanError({ serial: serialTrimmed, message: limitMsg });
        toast.error(limitMsg);
        return;
      }

      const newScan: SerialScanLog = {
        serialNumber: match.serialNumber,
        productId: pid,
        productName: productName,
        timestamp: Date.now(),
        status: 'SUCCESS'
      };

      setReceivedSerialsState(prev => ({
        ...prev,
        [base.selectedOrderNo!]: [newScan, ...(prev[base.selectedOrderNo!] || [])]
      }));

      // AG-COMMENT: Ticket 1 - Play success tone upon valid scan
      soundFX.success();
      toast.success(`Serial ${match.serialNumber} verified.`);
    } catch (err) {
      soundFX.error();
      const fallbackMsg = err instanceof Error ? err.message : String(err);
      setScanError({ serial: serialTrimmed, message: fallbackMsg });
      toast.error(fallbackMsg);
    }
  };

  // AG-COMMENT: Ticket 2 - Action to remove / unscan an inadvertently scanned serial from receive verification queue
  const handleRemoveSerial = (serialNumber: string) => {
    if (!base.selectedOrderNo) return;
    const orderNo = base.selectedOrderNo;

    setReceivedSerialsState(prev => {
      const orderScans = prev[orderNo] || [];
      const updated = orderScans.filter(s => s.serialNumber !== serialNumber);
      return {
        ...prev,
        [orderNo]: updated,
      };
    });

    if (scanError?.serial === serialNumber) {
      setScanError(null);
    }

    soundFX.duplicate();
    toast.info(`Serial '${serialNumber}' removed from receive queue.`);
  };

  const receiveOrder = async (orderNo: string) => {
    const group = orderGroups.find((g) => g.orderNo === orderNo);
    if (!group) return;

    base.setProcessing(true);
    try {
      const scanLogs = (receivedSerialsState[orderNo] || []).filter(s => s.status === 'SUCCESS');
      
      const serialsPayload = scanLogs.map(s => ({
        stock_transfer_id: group.items.find(i => {
          const pid = (typeof i.product_id === 'object' ? i.product_id.product_id : i.product_id) as number;
          return pid === s.productId;
        })?.id || 0,
        serial_number: s.serialNumber
      })).filter(p => p.stock_transfer_id > 0);

      await serializeLifecycleService.submitStatusUpdate({
        items: group.items.map(i => ({ 
          id: i.id, 
          status: 'Received',
          received_quantity: (i as SerialOrderGroupItem).receivedQty || 0
        })),
        status: 'Received',
        serials: serialsPayload,
        scanType: 'RECEIVE'
      });

      toast.success(`Order ${orderNo} received.`);
      base.setSelectedOrderNo(null);
      setReceivedSerialsState(prev => {
        const next = { ...prev };
        delete next[orderNo];
        return next;
      });
      setManualQuantitiesState(prev => {
        const next = { ...prev };
        delete next[orderNo];
        return next;
      });
      await base.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      base.setProcessing(false);
    }
  };

  return {
    ...base,
    orderGroups,
    selectedGroup,
    handleSerialInput,
    handleRemoveSerial,
    updateManualQty,
    receiveOrder,
    scanError,
    setScanError,
    recentScans: (base.selectedOrderNo ? receivedSerialsState[base.selectedOrderNo] : []) || [],
  };
}
