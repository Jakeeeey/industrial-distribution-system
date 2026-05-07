import { useState, useCallback } from "react";
import { Consolidator, ConsolidatorDetail, ConsolidatorSerialMapping } from "../types";
import { toast } from "sonner";

export function useActivePicking(userId: number | null = null) {
    const [branches, setBranches] = useState<{ id: number, branch_name: string }[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);

    const [pickings, setPickings] = useState<Consolidator[]>([]);
    const [totalPickings, setTotalPickings] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoadingPickings, setIsLoadingPickings] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    
    const [activePickingId, setActivePickingId] = useState<number | null>(null);
    const [details, setDetails] = useState<ConsolidatorDetail[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const [serialsMap, setSerialsMap] = useState<Record<number, ConsolidatorSerialMapping[]>>({});
    const [isLoadingSerials, setIsLoadingSerials] = useState<Record<number, boolean>>({});

    const [isProcessingSerial, setIsProcessingSerial] = useState(false);

    const fetchBranches = useCallback(async (divisionId: number = 1) => {
        setIsLoadingBranches(true);
        try {
            const res = await fetch(`/api/ids/active-picking/branches?divisionId=${divisionId}`);
            if (!res.ok) throw new Error("Failed to fetch branches");
            const data = await res.json();
            setBranches(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load branches");
        } finally {
            setIsLoadingBranches(false);
        }
    }, []);

    const fetchPickings = useCallback(async (divisionId: number = 1, status: string = "Picking", targetPage: number = 1, search: string = "") => {
        setIsLoadingPickings(true);
        try {
            const res = await fetch(`/api/ids/active-picking?divisionId=${divisionId}&status=${status}&page=${targetPage}&limit=10&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error("Failed to fetch pickings");
            const data = await res.json();
            setPickings(data.data);
            setTotalPickings(data.meta.total);
            setPage(targetPage);
            setSearchQuery(search);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load pickings");
        } finally {
            setIsLoadingPickings(false);
        }
    }, []);

    const fetchDetails = useCallback(async (consolidatorId: number, branchId: number = 196) => {
        setIsLoadingDetails(true);
        setActivePickingId(consolidatorId);
        try {
            const res = await fetch(`/api/ids/active-picking/details/${consolidatorId}?branchId=${branchId}`);
            if (!res.ok) throw new Error("Failed to fetch details");
            const data = await res.json();
            setDetails(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load picking details");
            setDetails([]);
        } finally {
            setIsLoadingDetails(false);
        }
    }, []);

    const fetchSerials = useCallback(async (detailId: number) => {
        setIsLoadingSerials(prev => ({ ...prev, [detailId]: true }));
        try {
            const res = await fetch(`/api/ids/active-picking/details/${detailId}/serials`);
            if (!res.ok) throw new Error("Failed to fetch serials");
            const data = await res.json();
            setSerialsMap(prev => ({ ...prev, [detailId]: data }));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingSerials(prev => ({ ...prev, [detailId]: false }));
        }
    }, []);

    const removeSerial = useCallback(async (mappingId: number, detailId: number) => {
        try {
            const res = await fetch(`/api/ids/active-picking/serials/${mappingId}?detailId=${detailId}&userId=${userId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete serial");

            // Update quantity
            setDetails(prev => prev.map(d => d.id === detailId ? { ...d, picked_quantity: data.newQuantity } : d));
            
            // Remove from map
            setSerialsMap(prev => ({
                ...prev,
                [detailId]: prev[detailId]?.filter(m => m.id !== mappingId) || []
            }));

            toast.success("Serial removed");
            return true;
        } catch (error) {
            const err = error as Error;
            toast.error(err.message);
            return false;
        }
    }, [userId]);

    const processSerial = useCallback(async (consolidatorId: number, serialNumber: string, branchId: number) => {
        setIsProcessingSerial(true);
        try {
            const res = await fetch(`/api/ids/active-picking/pick`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consolidatorId, serial_number: serialNumber, userId, branchId })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.details || data.error || "Failed to process serial");
                return false;
            }

            const detailId = data.detailId;

            // Update details with new quantity from server
            setDetails(prev => prev.map(d => {
                if (d.id === detailId) {
                    return { ...d, picked_quantity: data.newQuantity };
                }
                return d;
            }));

            // Refresh serials for this detail
            fetchSerials(detailId);

            toast.success("Serial matched and picked successfully");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Network error while processing serial");
            return false;
        } finally {
            setIsProcessingSerial(false);
        }
    }, [fetchSerials, userId]);

    const completePicking = useCallback(async (consolidatorId: number, status: string = "Picked") => {
        try {
            const res = await fetch(`/api/ids/active-picking/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consolidatorId, status })
            });
            if (!res.ok) throw new Error("Failed to complete picking");
            
            toast.success(`Picking ${status} successfully`);
            
            // Refresh pickings
            fetchPickings(1, "Picking", page, searchQuery);
            setActivePickingId(null);
            setDetails([]);
            return true;
        } catch (error) {
            const err = error as Error;
            toast.error(err.message);
            return false;
        }
    }, [fetchPickings, page, searchQuery]);

    return {
        userId,
        branches,
        isLoadingBranches,
        fetchBranches,

        pickings,
        totalPickings,
        page,
        setPage,
        searchQuery,
        setSearchQuery,
        isLoadingPickings,
        fetchPickings,
        
        activePickingId,
        details,
        isLoadingDetails,
        fetchDetails,
        
        serialsMap,
        isLoadingSerials,
        fetchSerials,
        removeSerial,

        isProcessingSerial,
        processSerial,
        completePicking
    };
}
