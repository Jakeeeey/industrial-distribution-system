import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { fetchProvider } from "../providers/fetchProvider";
import { SalesOrderTaggingDetails, MappedSerial, CustomerAsset } from "../types";
import { toast } from "sonner";

export interface ScannedItem {
  sales_order_detail_id: number;
  product_id: number;
  product_name: string;
  serial_number: string;
}

export function useCylinderTagging(orderId: string | null) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orderDetails, setOrderDetails] = useState<SalesOrderTaggingDetails | null>(null);
  const [mappedSerials, setMappedSerials] = useState<MappedSerial[]>([]);
  const [customerAssets, setCustomerAssets] = useState<CustomerAsset[]>([]);
  const [scannedList, setScannedList] = useState<ScannedItem[]>([]);

  // Sync refs to avoid recreation of handleScan/submitTagging callbacks
  const scannedListRef = useRef<ScannedItem[]>(scannedList);
  const customerAssetsRef = useRef<CustomerAsset[]>(customerAssets);

  useEffect(() => {
    scannedListRef.current = scannedList;
  }, [scannedList]);

  useEffect(() => {
    customerAssetsRef.current = customerAssets;
  }, [customerAssets]);

  // Memoize mappings for O(1) fast lookup during rapid scans
  const mappedSerialsMap = useMemo(() => {
    const map = new Map<string, MappedSerial>();
    for (const m of mappedSerials) {
      if (m.serial_number) {
        map.set(m.serial_number.trim().toUpperCase(), m);
      }
    }
    return map;
  }, [mappedSerials]);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch sales order details
      const details = await fetchProvider.getOrderDetails(id);
      setOrderDetails(details);

      // 2. Fetch consolidator mapped serials loaded for this delivery
      const mappings = await fetchProvider.getMappedSerials(id);
      setMappedSerials(mappings);

      // 3. Fetch current customer cylinder assets
      if (details.order.customer_code) {
        const assets = await fetchProvider.getCustomerAssets(details.order.customer_code);
        setCustomerAssets(assets);
      } else {
        setCustomerAssets([]);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to load order tagging information.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      setOrderDetails(null);
      setMappedSerials([]);
      setCustomerAssets([]);
      setScannedList([]);
      loadData(orderId);
    } else {
      setLoading(false);
      setOrderDetails(null);
      setMappedSerials([]);
      setCustomerAssets([]);
      setScannedList([]);
    }
  }, [orderId, loadData]);

  const handleScan = useCallback((serialInput: string) => {
    const serial = serialInput.trim().toUpperCase();
    if (!serial) return;

    if (!orderDetails) {
      toast.error("No active Sales Order details loaded.");
      return;
    }

    const currentScannedList = scannedListRef.current;

    // 1. Check if already scanned in current session
    if (currentScannedList.some((s) => s.serial_number === serial)) {
      toast.error(`Serial "${serial}" is already in the list to be tagged.`);
      return;
    }

    // 2. Check if already tagged in the database (previously submitted)
    const alreadyTagged = orderDetails.items.find((item) =>
      item.tagged_serials.some((ts) => ts.serial_number.toUpperCase() === serial)
    );
    if (alreadyTagged) {
      toast.error(`Serial "${serial}" has already been tagged to this order.`);
      return;
    }

    // 2b. Check if already in the customer's custody (current holdings)
    const currentCustomerAssets = customerAssetsRef.current;
    if (currentCustomerAssets.some((asset) => (asset.serial_number || "").trim().toUpperCase() === serial)) {
      toast.error(`Serial "${serial}" is already in the customer's custody.`);
      return;
    }

    // 3. Check if serial is in the consolidator mappings (loaded on the delivery truck)
    const mapping = mappedSerialsMap.get(serial);
    if (!mapping) {
      toast.error(`Serial "${serial}" is not allocated or loaded for this delivery.`);
      return;
    }

    // 3b. Check if already tagged/delivered under another order (cylinder_status is WITH_CUSTOMER)
    if (mapping.cylinder_status === "WITH_CUSTOMER") {
      toast.error(`Serial "${serial}" has already been delivered (Other Order).`);
      return;
    }

    // 4. Find the matching line item details for this product that still has capacity
    const matchingItems = orderDetails.items.filter((item) => Number(item.product_id) === Number(mapping.product_id));
    if (matchingItems.length === 0) {
      toast.error(`Product of serial "${serial}" is not in this Sales Order.`);
      return;
    }

    // Locate the first detail item with remaining capacity (tagged count + session scan count < allocated/ordered limit)
    let selectedItem = null;
    for (const item of matchingItems) {
      const limit = item.allocated_qty > 0 ? item.allocated_qty : item.ordered_qty;
      const sessionCount = currentScannedList.filter((s) => s.sales_order_detail_id === item.detail_id).length;
      if (item.tagged_qty + sessionCount < limit) {
        selectedItem = item;
        break;
      }
    }

    if (!selectedItem) {
      toast.error(`All quantities for "${matchingItems[0].product_name}" have already been scanned.`);
      return;
    }

    // 5. Add to session scanned list
    setScannedList((prev) => [
      ...prev,
      {
        sales_order_detail_id: selectedItem.detail_id,
        product_id: selectedItem.product_id,
        product_name: selectedItem.product_name,
        serial_number: serial,
      },
    ]);

    toast.success(`Verified: Scanned ${serial} for ${selectedItem.product_name}`);
  }, [orderDetails, mappedSerialsMap]);

  const handleRemove = useCallback((serialNumber: string) => {
    setScannedList((prev) => prev.filter((s) => s.serial_number !== serialNumber));
    toast.info(`Removed ${serialNumber} from tagging list.`);
  }, []);

  const clearScanned = useCallback(() => {
    setScannedList([]);
  }, []);

  const submitTagging = useCallback(async () => {
    if (!orderId || !orderDetails) {
      toast.error("No active Sales Order to tag.");
      return;
    }
    const currentScannedList = scannedListRef.current;
    if (currentScannedList.length === 0) {
      toast.error("Scan at least one cylinder serial before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = currentScannedList.map((s) => ({
        sales_order_detail_id: s.sales_order_detail_id,
        serial_number: s.serial_number,
      }));

      await fetchProvider.saveTagging(
        orderDetails.order.order_id,
        orderDetails.order.customer_code,
        payload
      );

      toast.success(`Successfully tagged ${currentScannedList.length} cylinder(s) to customer.`);
      setScannedList([]);
      
      // Reload order details & customer assets to update the UI views
      await loadData(orderId);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to submit cylinder tags.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [orderId, orderDetails, loadData]);

  return {
    loading,
    submitting,
    error,
    orderDetails,
    mappedSerials,
    customerAssets,
    scannedList,
    handleScan,
    handleRemove,
    clearScanned,
    submitTagging,
    refreshData: () => orderId && loadData(orderId),
  };
}
