import { ClusterGroupRaw } from "../types";

export const fetchPendingDeliveries = async (): Promise<ClusterGroupRaw[]> => {
  const res = await fetch(
    "/api/ids/scm/fleet-management/logistics-delivery/pending-deliveries",
  );
  if (!res.ok) throw new Error("Failed to fetch pending deliveries");
  const result = await res.json();
  return result.data || [];
};
