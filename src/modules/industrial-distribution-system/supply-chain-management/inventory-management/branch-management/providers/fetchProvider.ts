import type { Branch, BranchAudit, PaginationMeta, BranchSortKey, BranchStatusFilter, Province, City, Barangay, User } from "../types";

const API_URL = "/api/ids/scm/inventory-management/branch-management";

export interface BranchPageQuery {
    page: number;
    limit: number;
    sort: BranchSortKey;
    status: BranchStatusFilter;
    q: string;
}

export async function fetchBranches(query: BranchPageQuery): Promise<{ branches: Branch[]; meta: PaginationMeta }> {
    const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
        sort: query.sort,
        status: query.status,
    });
    if (query.q.trim()) params.set("q", query.q.trim());

    const res = await fetch(`${API_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
}

/**
 * The edit dialog is the only consumer of the full user list, so it loads on demand instead of
 * on every branch page request.
 */
export async function fetchBranchUsers(): Promise<User[]> {
    const res = await fetch(`${API_URL}?options=users`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch users");
    const data = await res.json();
    return data.users || [];
}

/** Returns null when the audit columns are not available for this record. */
export async function fetchBranchAudit(id: number): Promise<BranchAudit | null> {
    const res = await fetch(`${API_URL}?id=${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.audit || null;
}

export async function saveBranch(branchData: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchData),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || "Failed to save branch");
    }
    return res.json();
}

/** 
 * Philippine Location APIs (PSGC)
 * Utilizes the internal /api/psgc proxy route to avoid browser CORS and 301 redirect issues,
 * with resilient direct fallbacks (ensuring trailing slashes) for robust client-side loading.
 */

export async function fetchProvinces(): Promise<Province[]> {
    // 1. Try internal server-side proxy
    try {
        const res = await fetch("/api/psgc/provinces");
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to direct fetch
    }

    // 2. Direct upstream fallback with trailing slash
    try {
        const res = await fetch("https://psgc.gitlab.io/api/provinces/");
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to secondary upstream
    }

    // 3. Secondary cloud upstream fallback
    try {
        const res = await fetch("https://psgc.cloud/api/provinces");
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {}

    return [];
}

export async function fetchCities(provinceCode: string): Promise<City[]> {
    if (!provinceCode) return [];

    // 1. Try internal server-side proxy
    try {
        const res = await fetch(`/api/psgc/provinces/${provinceCode}/cities-municipalities`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to direct fetch
    }

    // 2. Direct upstream fallback with trailing slash
    try {
        const res = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to secondary upstream
    }

    // 3. Secondary cloud upstream fallback
    try {
        const res = await fetch(`https://psgc.cloud/api/provinces/${provinceCode}/cities-municipalities`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {}

    return [];
}

export async function fetchBarangays(cityCode: string): Promise<Barangay[]> {
    if (!cityCode) return [];

    // 1. Try internal server-side proxy
    try {
        const res = await fetch(`/api/psgc/cities-municipalities/${cityCode}/barangays`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to direct fetch
    }

    // 2. Direct upstream fallback with trailing slash
    try {
        const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {
        // Fallback to secondary upstream
    }

    // 3. Secondary cloud upstream fallback
    try {
        const res = await fetch(`https://psgc.cloud/api/cities-municipalities/${cityCode}/barangays`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
        }
    } catch {}

    return [];
}

export async function updateBranch(id: number, branchData: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(API_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...branchData }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || "Failed to update branch");
    }
    return res.json();
}

export async function deleteBranch(id: number): Promise<unknown> {
    const res = await fetch(`${API_URL}?id=${id}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || "Failed to delete branch");
    }
    return res.json();
}
