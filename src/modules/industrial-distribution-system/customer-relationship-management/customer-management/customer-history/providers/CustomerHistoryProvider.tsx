"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  CustomerHistoryData,
  CustomerMetrics,
  Transaction,
  AssetLedgerEntry,
} from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RealCustomer {
  id: number;
  customer_code?: string | null;
  customer_name: string;
  store_name?: string | null;
  contact_number?: string | null;
  customer_email?: string | null;
  classification?: number | null;
  store_type?: number | null;
  profile_status?: string | null;
  status?: string | null;
}

interface ClassificationItem {
  id: number;
  classification_name: string;
}

interface CustomerHistoryContextType {
  data: CustomerHistoryData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  selectedCustomer: CustomerHistoryData | null;
  setSelectedCustomer: (customer: CustomerHistoryData | null) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const CustomerHistoryContext = createContext<
  CustomerHistoryContextType | undefined
>(undefined);

// ─── Dummy data builders ──────────────────────────────────────────────────────

function buildDummyTransactions(customerId: string): Transaction[] {
  // Seed by customer id to produce stable dummy data per customer
  const seed = customerId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = (seed % 4) + 2;
  const statuses: Array<Transaction["status"]> = [
    "Paid",
    "Paid",
    "Terms",
    "Partially Paid",
    "Unpaid",
  ];

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, 4 - i, 25 - i * 12);
    const orderedQty = 1 + (i % 2);
    const deliveredQty =
      i === count - 1 && seed % 3 === 0 ? orderedQty - 1 : orderedQty;
    const emptiesReturned = i === 0 ? 0 : 1;
    const totalAmount = i === count - 1 ? 2450 : 950;
    return {
      id: `TXN-${String(seed + i).padStart(4, "0")}`,
      date: date.toISOString().slice(0, 10),
      refNo: `TXN-${String(seed + i).padStart(4, "0")}`,
      orderDetails:
        i === count - 1 ? `1x 11kg New Deposit` : `${orderedQty}x 11kg Refill`,
      orderedQty,
      deliveredQty,
      emptiesReturned,
      tankBalance: Math.max(0, (seed % 3) - i),
      totalAmount,
      status: statuses[i % statuses.length],
    };
  });
}

function buildDummyMetrics(
  customerId: string,
  transactions: Transaction[],
): CustomerMetrics {
  const seed = customerId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const totalOrdered = transactions.reduce((s, t) => s + t.orderedQty, 0);
  const totalDelivered = transactions.reduce((s, t) => s + t.deliveredQty, 0);
  const deployed = transactions.reduce((s, t) => s + t.orderedQty, 0);
  const returned = transactions.reduce((s, t) => s + t.emptiesReturned, 0);
  const outstanding = transactions
    .filter((t) => t.status !== "Paid")
    .reduce((s, t) => s + t.totalAmount, 0);

  return {
    totalOrdered,
    totalDelivered,
    totalDeliveries: transactions.length,
    onTimeDeliveries: Math.max(1, transactions.length - (seed % 2)),
    cumulativeDeployed: deployed,
    cumulativeReturned: returned,
    outstandingBalance: outstanding,
    avgVisitDays: 21 + (seed % 14),
    timeGap: seed % 3,
    volumeGap:
      totalOrdered === totalDelivered
        ? "Full (0 Gap)"
        : `${totalOrdered - totalDelivered} unit(s)`,
    currentUsage: outstanding === 0 ? "Cash Only" : "On Terms",
  };
}

function buildDummyAssetLedger(
  customerId: string,
  transactions: Transaction[],
): AssetLedgerEntry[] {
  return transactions.map((t, i) => ({
    id: `AL-${customerId}-${i}`,
    date: t.date,
    deployed: t.orderedQty,
    returned: t.emptiesReturned,
    reference: t.refNo,
  }));
}

function resolveClassificationLabel(
  customer: RealCustomer,
  classificationMap: Map<string, string>,
): string {
  if (
    customer.classification === null ||
    customer.classification === undefined
  ) {
    return "Unclassified";
  }

  const label = classificationMap.get(String(customer.classification));
  if (label) return label;

  return `Classification ${customer.classification}`;
}

function mapToHistoryData(
  customer: RealCustomer,
  classificationMap: Map<string, string>,
): CustomerHistoryData {
  const code = customer.customer_code || String(customer.id);
  const transactions = buildDummyTransactions(code);
  const metrics = buildDummyMetrics(code, transactions);
  const assetLedger = buildDummyAssetLedger(code, transactions);
  const tier = resolveClassificationLabel(customer, classificationMap);

  return {
    id: code,
    name: customer.customer_name,
    tier,
    contact: customer.customer_email ?? "",
    phone: customer.contact_number ?? "—",
    metrics,
    transactions,
    assetLedger,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface CustomerHistoryProviderProps {
  children: ReactNode;
  initialCustomerId?: string | null;
}

export function CustomerHistoryProvider({
  children,
  initialCustomerId,
}: CustomerHistoryProviderProps) {
  const [data, setData] = useState<CustomerHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerHistoryData | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch ALL customers & classification reference list
      const [res, classRes] = await Promise.all([
        fetch(
          "/api/ids/crm/customer-history?directusCollection=customer&limit=-1&t=" +
            Date.now(),
          { cache: "no-store" },
        ),
        fetch(
          "/api/ids/crm/customer/references?type=classification&t=" +
            Date.now(),
          {
            cache: "no-store",
          },
        ),
      ]);

      if (!res.ok) throw new Error(`Failed to load customers: ${res.status}`);

      const json = await res.json();
      const customers: RealCustomer[] = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
          ? json
          : [];

      let classificationMap = new Map<string, string>();
      if (classRes.ok) {
        const classJson = await classRes.json();
        const items: ClassificationItem[] = Array.isArray(classJson.data)
          ? classJson.data
          : [];
        classificationMap = new Map(
          items.map((item) => [
            String(item.id),
            String(item.classification_name),
          ]),
        );
      }

      const historyData = customers.map((customer) =>
        mapToHistoryData(customer, classificationMap),
      );
      setData(historyData);

      // Auto-select: prefer the one matching initialCustomerId (customer_code or numeric id), else first
      if (initialCustomerId) {
        const decodedId = String(initialCustomerId).trim().toLowerCase();
        const match = historyData.find(
          (c) =>
            c.id.toLowerCase() === decodedId ||
            c.name.toLowerCase().includes(decodedId),
        );
        setSelectedCustomer(match ?? historyData[0] ?? null);
      } else if (historyData.length > 0) {
        setSelectedCustomer((prev) => prev ?? historyData[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initialCustomerId]);

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(), 0);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  return (
    <CustomerHistoryContext.Provider
      value={{
        data,
        loading,
        error,
        refetch: fetchCustomers,
        selectedCustomer,
        setSelectedCustomer,
      }}
    >
      {children}
    </CustomerHistoryContext.Provider>
  );
}

export function useCustomerHistoryContext() {
  const context = useContext(CustomerHistoryContext);
  if (!context)
    throw new Error(
      "useCustomerHistoryContext must be used within a CustomerHistoryProvider",
    );
  return context;
}
