import { NextResponse, NextRequest } from "next/server";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/auth-utils";

function nowPH(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
}

export async function POST(req: NextRequest) {
  try {
    const { assets } = await req.json();

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: "Invalid assets data" }, { status: 400 });
    }

    const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const directusToken = process.env.DIRECTUS_STATIC_TOKEN;

    if (!directusBase || !directusToken) {
      throw new Error("Directus configuration missing");
    }

    const token = req.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);
    const timestamp = nowPH();

    // AG-COMMENT: Check if any of the serials already exist in cylinder_assets_draft to perform upsert (PATCH vs POST)
    const serialsList = assets.map((a: { serial_number: string }) => String(a.serial_number || "").trim()).filter(Boolean);
    const encodedSerials = encodeURIComponent(JSON.stringify(serialsList));
    const checkUrl = `${directusBase.replace(/\/$/, "")}/items/cylinder_assets_draft?filter={"serial_number":{"_in":${encodedSerials}}}&fields=id,serial_number&limit=-1`;

    const checkRes = await fetch(checkUrl, {
      headers: {
        Authorization: `Bearer ${directusToken}`,
        "Content-Type": "application/json",
      },
    });

    const existingMap = new Map<string, number>();
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (Array.isArray(checkData.data)) {
        checkData.data.forEach((item: { id: number; serial_number: string }) => {
          existingMap.set(String(item.serial_number || "").toUpperCase(), item.id);
        });
      }
    }

    const toInsert: Record<string, unknown>[] = [];
    const updatePromises: Promise<Response>[] = [];

    for (const asset of assets) {
      const snUpper = String(asset.serial_number || "").toUpperCase();
      const existingId = existingMap.get(snUpper);

      if (existingId) {
        // AG-COMMENT: Update existing draft row and refresh modified_by + modified_date
        const patchUrl = `${directusBase.replace(/\/$/, "")}/items/cylinder_assets_draft/${existingId}`;
        const patchBody = {
          product_id: asset.product_id,
          cylinder_status: asset.cylinder_status || "AVAILABLE",
          cylinder_condition: asset.cylinder_condition || "GOOD",
          current_branch_id: asset.current_branch_id,
          expiration_date: asset.expiration_date,
          tare_weight: asset.tare_weight,
          remarks: asset.remarks || "Registered via Stock Adjustment",
          modified_by: userId || undefined,
          modified_date: timestamp,
        };
        updatePromises.push(
          fetch(patchUrl, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${directusToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patchBody),
          })
        );
      } else {
        // AG-COMMENT: New draft cylinder asset with full audit fields and remarks
        toInsert.push({
          product_id: asset.product_id,
          serial_number: asset.serial_number,
          cylinder_status: asset.cylinder_status || "AVAILABLE",
          cylinder_condition: asset.cylinder_condition || "GOOD",
          current_branch_id: asset.current_branch_id,
          expiration_date: asset.expiration_date,
          tare_weight: asset.tare_weight,
          remarks: asset.remarks || "Registered via Stock Adjustment",
          created_by: userId || undefined,
          created_date: timestamp,
          modified_by: userId || undefined,
          modified_date: timestamp,
        });
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    if (toInsert.length > 0) {
      const insertUrl = `${directusBase.replace(/\/$/, "")}/items/cylinder_assets_draft`;
      const res = await fetch(insertUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directusToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toInsert),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Directus registration error:", errorData);
        return NextResponse.json(
          { error: errorData.errors?.[0]?.message || "Failed to register cylinders in Directus" },
          { status: res.status }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register Assets API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
