// src/app/api/ids/scm/physical-inventory/header/[id]/commit/route.ts
import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN =
  process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";

const TABLE_PH = "physical_inventory";
const TABLE_DETAILS = "physical_inventory_details";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PhysicalInventoryHeaderRow = {
  id: number;
  ph_no: string | null;
  cutOff_date: string | null;
  starting_date: string | null;
  price_type: number | null;
  stock_type: "GOOD" | "BAD" | null;
  branch_id: number | null;
  remarks: string | null;
  isComitted: number;
  isCancelled: number;
  committed_at: string | null;
  cancelled_at: string | null;
  total_amount: number | null;
  supplier_id: number | null;
  category_id: number | null;
  encoder_id: number | null;
};

type PhysicalInventoryDetailRow = {
  id: number;
  ph_id: number;
  product_id: number;
  unit_price: number | null;
  system_count: number | null;
  physical_count: number | null;
  variance: number | null;
  difference_cost: number | null;
  amount: number | null;
  offset_match: number | null;
};

function directusHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (DIRECTUS_TOKEN) {
    headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  }

  return headers;
}

async function directusGetSingle<T>(path: string): Promise<T> {
  if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method: "GET",
    headers: directusHeaders(),
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Directus GET failed with ${response.status}.`);
  }

  const json = JSON.parse(text) as { data: T };
  return json.data;
}

async function directusGetMany<T>(path: string): Promise<T[]> {
  if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method: "GET",
    headers: directusHeaders(),
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Directus GET failed with ${response.status}.`);
  }

  const json = JSON.parse(text) as { data: T[] };
  return Array.isArray(json.data) ? json.data : [];
}

async function directusPatch<T>(path: string, payload: unknown): Promise<T> {
  if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method: "PATCH",
    headers: directusHeaders(),
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Directus PATCH failed with ${response.status}.`);
  }

  const json = JSON.parse(text) as { data: T };
  return json.data;
}

async function directusPost<T>(path: string, payload: unknown): Promise<T> {
  if (!DIRECTUS_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method: "POST",
    headers: directusHeaders(),
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Directus POST failed with ${response.status}.`);
  }

  const json = JSON.parse(text) as { data: T };
  return json.data;
}

async function directusDelete(path: string, ids: number[]): Promise<void> {
  if (!DIRECTUS_URL || !ids.length) return;

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method: "DELETE",
    headers: directusHeaders(),
    cache: "no-store",
    body: JSON.stringify(ids),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Directus DELETE failed with ${response.status}.`);
  }
}

function sumHeaderTotalAmount(details: PhysicalInventoryDetailRow[]): number {
  return details.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const headerId = Number(id);

    if (!Number.isFinite(headerId) || headerId <= 0) {
      return NextResponse.json(
        { error: "Invalid header id." },
        { status: 400 },
      );
    }

    const header = await directusGetSingle<PhysicalInventoryHeaderRow>(
      `/items/${TABLE_PH}/${headerId}?fields=id,ph_no,cutOff_date,starting_date,price_type,stock_type,branch_id,remarks,isComitted,isCancelled,committed_at,cancelled_at,total_amount,supplier_id,category_id,encoder_id`,
    );

    if (!header) {
      return NextResponse.json(
        { error: "Physical Inventory not found." },
        { status: 404 },
      );
    }

    if (header.isCancelled === 1) {
      return NextResponse.json(
        { error: "Cancelled Physical Inventory cannot be committed." },
        { status: 400 },
      );
    }

    if (header.isComitted === 1) {
      return NextResponse.json(
        { error: "Physical Inventory is already committed." },
        { status: 400 },
      );
    }

    if (!(header.ph_no ?? "").trim()) {
      return NextResponse.json(
        { error: "PH No is required before commit." },
        { status: 400 },
      );
    }

    if (
      !header.branch_id ||
      !header.supplier_id ||
      !header.category_id ||
      !header.price_type
    ) {
      return NextResponse.json(
        {
          error:
            "Branch, supplier, category, and price type are required before commit.",
        },
        { status: 400 },
      );
    }

    if (!header.cutOff_date) {
      return NextResponse.json(
        { error: "Cutoff date is required before commit." },
        { status: 400 },
      );
    }

    const details = await directusGetMany<PhysicalInventoryDetailRow>(
      `/items/${TABLE_DETAILS}?filter=${encodeURIComponent(
        JSON.stringify({ ph_id: { _eq: headerId } }),
      )}&fields=id,ph_id,product_id,unit_price,system_count,physical_count,variance,difference_cost,amount,offset_match&sort=id&limit=-1`,
    );

    if (!details.length) {
      return NextResponse.json(
        { error: "Cannot commit a Physical Inventory without detail rows." },
        { status: 400 },
      );
    }

    // AG-COMMENT: Promote any scanned draft serials from cylinder_assets_draft to cylinder_assets master table
    const detailIds = details.map((d) => d.id);
    if (detailIds.length > 0) {
      const serialRows = await directusGetMany<{ serial_number: string }>(
        `/items/physical_inventory_details_serial?filter=${encodeURIComponent(
          JSON.stringify({ pi_detail_id: { _in: detailIds } }),
        )}&fields=serial_number&limit=-1`,
      );

      const uniqueSerials = Array.from(
        new Set(serialRows.map((s) => (s.serial_number || "").trim()).filter(Boolean)),
      );

      if (uniqueSerials.length > 0) {
        const draftCylinders = await directusGetMany<Record<string, unknown>>(
          `/items/cylinder_assets_draft?filter=${encodeURIComponent(
            JSON.stringify({ serial_number: { _in: uniqueSerials } }),
          )}&limit=-1`,
        );

        if (draftCylinders.length > 0) {
          const phNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
            .toISOString()
            .replace("Z", "+08:00");
          const postingDate = phNow.split("T")[0];

          const cylindersToInsert = draftCylinders.map((draft) => {
            const copy: Record<string, unknown> = {};
            for (const key in draft) {
              if (key !== "id") {
                copy[key] = draft[key];
              }
            }
            return {
              ...copy,
              remarks: `Physical Inventory ${header.ph_no || headerId}`,
              acquisition_date: draft.acquisition_date || postingDate,
              created_date: draft.created_date || phNow,
              modified_date: phNow,
              is_deleted: 0,
            };
          });

          // Insert into cylinder_assets master table
          await directusPost("/items/cylinder_assets", cylindersToInsert);

          // Delete promoted items from cylinder_assets_draft
          const draftIdsToDelete = draftCylinders.map((d) => Number(d.id));
          await directusDelete("/items/cylinder_assets_draft", draftIdsToDelete);
        }
      }
    }

    const total_amount = sumHeaderTotalAmount(details);

    const updated = await directusPatch<PhysicalInventoryHeaderRow>(
      `/items/${TABLE_PH}/${headerId}`,
      {
        isComitted: 1,
        isCancelled: 0,
        committed_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00'),
        total_amount,
      },
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to commit PI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
