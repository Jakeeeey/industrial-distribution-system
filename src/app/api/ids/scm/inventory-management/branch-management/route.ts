import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload } from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

// Branch Management is scoped to the Industrial division only.
const INDUSTRIAL_DIVISION_ID = 1;

const AUDIT_FIELDS = "created_by,created_at,updated_by,updated_at";

const LIST_FIELDS = [
    "id",
    "branch_name",
    "branch_code",
    "branch_description",
    "branch_head.user_id",
    "branch_head.user_fname",
    "branch_head.user_lname",
    "branch_head.user_email",
    "state_province",
    "city",
    "brgy",
    "phone_number",
    "postal_code",
    "date_added",
    "isMoving",
    "isReturn",
    "isBadStock",
    "isActive",
    "division_id",
].join(",");

const SORT_FIELDS: Record<string, string> = {
    name: "branch_name",
    code: "branch_code",
    date: "date_added",
};

// Newest-first reads better for a dated column; the text columns sort naturally ascending.
const DEFAULT_SORT_ORDER: Record<string, "asc" | "desc"> = {
    name: "asc",
    code: "asc",
    date: "desc",
};

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];
const SEARCH_COLUMNS = [
    "branch_name",
    "branch_code",
    "state_province",
    "city",
    "brgy",
    "branch_description",
    "phone_number",
];

function directusHeaders() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (DIRECTUS_TOKEN) h.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

// Directus DATETIME columns in this system hold Philippine wall clock with no offset, so audit
// writes must be naive "+8" strings ("2026-09-03 13:07:29") and reads must not pass through
// Date/ISO localisation.
function getManilaTimeString(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function getActorUserId(req: NextRequest): number | null {
    const token =
        req.cookies.get("vos_access_token")?.value ||
        req.cookies.get("springboot_token")?.value ||
        req.cookies.get("token")?.value;

    const payload = token ? decodeJwtPayload(token) : null;
    const userId = Number(payload?.sub);

    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function directusFetch(path: string, init?: RequestInit) {
    return fetch(`${DIRECTUS_BASE}/items/branches${path}`, {
        cache: "no-store",
        headers: directusHeaders(),
        ...init,
    });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    try {
        // Audit metadata for a single branch. Kept off the list query so the table still loads
        // if these columns have not been registered in Directus yet.
        const id = searchParams.get("id");
        if (id) {
            const res = await directusFetch(`/${encodeURIComponent(id)}?fields=id,${AUDIT_FIELDS}`);
            if (!res.ok) return NextResponse.json({ audit: null });
            const json = await res.json();
            return NextResponse.json({ audit: json.data ?? null });
        }

        // Dropdown options for branch head/managers
        if (searchParams.get("options") === "users") {
            const res = await fetch(`${DIRECTUS_BASE}/items/user?limit=-1&fields=user_id,user_fname,user_lname&sort=user_fname`, {
                cache: "no-store",
                headers: directusHeaders(),
            });
            if (!res.ok) {
                const err = await res.text();
                return NextResponse.json({ error: "Failed to fetch users", details: err }, { status: res.status });
            }
            const json = await res.json();
            return NextResponse.json({ users: json.data || [] });
        }

        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const requestedLimit = parseInt(searchParams.get("limit") || "10");
        const limit = ALLOWED_PAGE_SIZES.includes(requestedLimit) ? requestedLimit : 10;
        const requestedSort = searchParams.get("sort") || "name";
        const sortKey = requestedSort in SORT_FIELDS ? requestedSort : "name";
        const requestedOrder = searchParams.get("order");
        const order: "asc" | "desc" =
            requestedOrder === "asc" || requestedOrder === "desc" ? requestedOrder : DEFAULT_SORT_ORDER[sortKey];

        // Directus filter object: division_id = 1 is strictly enforced per IDS guide rule
        const andFilters: Record<string, unknown>[] = [
            { division_id: { _eq: INDUSTRIAL_DIVISION_ID } }
        ];

        // Search query across multiple relevant columns
        const q = (searchParams.get("q") || "").trim();
        if (q) {
            andFilters.push({
                _or: SEARCH_COLUMNS.map((column) => ({
                    [column]: { _icontains: q }
                }))
            });
        }

        // Status conditions - handle both integer (1/0) and boolean (true/false) as well as NULLs in SQL
        const status = searchParams.get("status") || "All";
        switch (status) {
            case "Active":
                andFilters.push({
                    _or: [{ isActive: { _eq: 1 } }, { isActive: { _eq: true } }]
                });
                break;
            case "Inactive":
                andFilters.push({
                    _or: [
                        { isActive: { _neq: 1 } },
                        { isActive: { _eq: 0 } },
                        { isActive: { _eq: false } },
                        { isActive: { _null: true } }
                    ]
                });
                break;
            case "Moving":
                andFilters.push({
                    _or: [{ isMoving: { _eq: 1 } }, { isMoving: { _eq: true } }]
                });
                break;
            case "Not Moving":
                andFilters.push({
                    _or: [
                        { isMoving: { _neq: 1 } },
                        { isMoving: { _eq: 0 } },
                        { isMoving: { _eq: false } },
                        { isMoving: { _null: true } }
                    ]
                });
                break;
            case "Badstock":
                andFilters.push({
                    _or: [
                        { isBadStock: { _eq: 1 } },
                        { isBadStock: { _eq: true } },
                        { branch_code: { _icontains: "-BS" } }
                    ]
                });
                break;
            default:
                // "All": Do not filter by status; return all division_id = 1 records
                break;
        }

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", `${order === "desc" ? "-" : ""}${SORT_FIELDS[sortKey]}`);
        params.set("meta", "filter_count");
        params.set("fields", LIST_FIELDS);
        params.set("filter", JSON.stringify({ _and: andFilters }));

        const res = await directusFetch(`?${params.toString()}`);
        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json({ error: "Failed to fetch branches", details: err }, { status: res.status });
        }

        const json = await res.json();
        const branches = (json.data || []).map((row: Record<string, unknown>) => {
            const head = row.branch_head as { user_id?: number; user_fname?: string; user_lname?: string; user_email?: string } | null;
            return {
                ...row,
                branch_head: head?.user_id ?? null,
                branch_head_name: head ? `${head.user_fname ?? ""} ${head.user_lname ?? ""}`.trim() : null,
                branch_head_email: head?.user_email ?? null,
            };
        });

        const total = json.meta?.filter_count ?? branches.length;
        return NextResponse.json({
            branches,
            meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (err: unknown) {
        const error = err as Error;
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            branch_name,
            branch_code,
            branch_description,
            branch_head,
            state_province,
            city,
            brgy,
            phone_number,
            postal_code,
            isMoving,
            isActive,
            division_id,
        } = body;

        const date_added = new Date().toISOString().split("T")[0];
        const created_at = getManilaTimeString();
        const created_by = getActorUserId(req);

        const location = {
            branch_head,
            state_province,
            city,
            brgy,
            phone_number,
            postal_code,
            date_added,
            isMoving: isMoving ? 1 : 0,
            isActive: isActive ? 1 : 0,
            division_id: division_id ? Number(division_id) : INDUSTRIAL_DIVISION_ID,
        };

        // First Save: Normal Branch (Good Stock)
        const branch1 = {
            ...location,
            branch_name,
            branch_code,
            branch_description,
            isReturn: 0,
            isBadStock: 0,
            created_at,
            updated_at: created_at,
            created_by,
            updated_by: created_by,
        };

        // Second Save: Bad Stock Branch
        const branch2 = {
            ...location,
            branch_name: `${branch_name} - Bad Stock`,
            branch_code: `${branch_code}-BS`,
            branch_description: `Bad Stock for ${branch_description}`,
            isReturn: 1,
            isBadStock: 1,
            created_at,
            updated_at: created_at,
            created_by,
            updated_by: created_by,
        };

        // Execute saves in sequence (or parallel, but sequence is safer for partial failures)
        const res1 = await directusFetch("", { method: "POST", body: JSON.stringify(branch1) });
        if (!res1.ok) {
            const err = await res1.text();
            return NextResponse.json({ error: "Failed to save primary branch", details: err }, { status: 500 });
        }

        const res2 = await directusFetch("", { method: "POST", body: JSON.stringify(branch2) });
        if (!res2.ok) {
            const err = await res2.text();
            return NextResponse.json({ error: "Failed to save bad stock branch", details: err }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Branch and Bad Stock branch created successfully" });
    } catch (err: unknown) {
        const error = err as Error;
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
        }

        // The creation stamp is immutable; only the server sets the audit trail.
        delete updateData.created_at;
        delete updateData.created_by;
        delete updateData.updated_at;
        delete updateData.updated_by;

        const updated_by = getActorUserId(req);
        updateData.updated_at = getManilaTimeString();
        updateData.updated_by = updated_by;

        // 1. Fetch current branch to check if it's a "Normal" branch
        const currentRes = await directusFetch(`/${encodeURIComponent(id)}`);
        if (!currentRes.ok) {
            const err = await currentRes.text();
            return NextResponse.json({ error: "Failed to fetch current branch", details: err }, { status: currentRes.status });
        }

        const currentData = await currentRes.json();
        const currentBranch = currentData.data;

        // Convert boolean to number for Directus
        if (updateData.isMoving !== undefined) updateData.isMoving = updateData.isMoving ? 1 : 0;
        if (updateData.isActive !== undefined) updateData.isActive = updateData.isActive ? 1 : 0;

        // 2. Update the target branch
        const res = await directusFetch(`/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(updateData),
        });

        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json({ error: "Failed to update branch", details: err }, { status: res.status });
        }

        // 3. Sync with Bad Stock branch if this is a "Normal" (Good Stock) branch
        const isNormalBranch = !currentBranch.isBadStock || currentBranch.isBadStock == 0 || currentBranch.isBadStock === false;
        if (isNormalBranch && !String(currentBranch.branch_code || "").endsWith("-BS")) {
            const badStockCode = `${currentBranch.branch_code}-BS`;
            const findBSFilter = JSON.stringify({
                _or: [
                    { branch_code: { _eq: badStockCode } },
                    { branch_name: { _eq: `${currentBranch.branch_name} - Bad Stock` } }
                ]
            });
            const findBSRes = await directusFetch(`?filter=${encodeURIComponent(findBSFilter)}`);

            if (findBSRes.ok) {
                const bsData = await findBSRes.json();
                if (bsData.data && bsData.data.length > 0) {
                    const badStockId = bsData.data[0].id;

                    const bsUpdate: Record<string, unknown> = { ...updateData };
                    if (updateData.branch_name) bsUpdate.branch_name = `${updateData.branch_name} - Bad Stock`;
                    if (updateData.branch_code) bsUpdate.branch_code = `${updateData.branch_code}-BS`;
                    if (updateData.branch_description) bsUpdate.branch_description = `Bad Stock for ${updateData.branch_description}`;
                    bsUpdate.isBadStock = 1;
                    bsUpdate.isReturn = 1;

                    await directusFetch(`/${badStockId}`, {
                        method: "PATCH",
                        body: JSON.stringify(bsUpdate),
                    });
                }
            }
        }

        const data = await res.json();
        return NextResponse.json({ success: true, data: data.data });
    } catch (err: unknown) {
        const error = err as Error;
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
        }

        // 1. Fetch current branch to check if it's a "Normal" branch
        const currentRes = await directusFetch(`/${encodeURIComponent(id)}`);
        if (!currentRes.ok) {
            const err = await currentRes.text();
            return NextResponse.json({ error: "Failed to fetch current branch", details: err }, { status: currentRes.status });
        }

        const currentData = await currentRes.json();
        const currentBranch = currentData.data;

        // 2. Identify paired Bad Stock branch if deleting a "Normal" branch
        const idsToDelete = [id];
        const isNormalBranch = !currentBranch.isBadStock || currentBranch.isBadStock == 0 || currentBranch.isBadStock === false;
        if (isNormalBranch && !String(currentBranch.branch_code || "").endsWith("-BS")) {
            const badStockCode = `${currentBranch.branch_code}-BS`;
            const findBSFilter = JSON.stringify({
                _or: [
                    { branch_code: { _eq: badStockCode } },
                    { branch_name: { _eq: `${currentBranch.branch_name} - Bad Stock` } }
                ]
            });
            const findBSRes = await directusFetch(`?filter=${encodeURIComponent(findBSFilter)}`);
            if (findBSRes.ok) {
                const bsData = await findBSRes.json();
                if (bsData.data && bsData.data.length > 0) {
                    idsToDelete.push(bsData.data[0].id);
                }
            }
        }

        // 3. Delete identified records
        const deleteRes = await directusFetch("", {
            method: "DELETE",
            body: JSON.stringify(idsToDelete),
        });

        if (!deleteRes.ok) {
            const err = await deleteRes.text();
            return NextResponse.json({ error: "Failed to delete branch(es)", details: err }, { status: deleteRes.status });
        }

        return NextResponse.json({ success: true, message: "Branch(es) deleted successfully" });
    } catch (err: unknown) {
        const error = err as Error;
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}
