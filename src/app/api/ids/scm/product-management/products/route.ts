import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const COLLECTION = "products";

function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const sort = searchParams.get("sort") || "-created_at";

    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    params.set("meta", "filter_count,total_count");
    params.set("fields", "product_id,isActive,product_brand,product_code,product_name,description,short_description,unit_of_measurement,unit_of_measurement_count,product_category,cost_per_unit,price_per_unit,is_serialized,product_image,status,created_at,created_by,updated_at,updated_by,last_updated,parent_id,uom_ids");
    params.set("sort", sort);

    let filterIdx = 0;

    if (q) {
      params.set(`filter[_and][${filterIdx}][_or][0][product_name][_contains]`, q);
      params.set(`filter[_and][${filterIdx}][_or][1][product_code][_contains]`, q);
      filterIdx++;
    }

    if (category && category !== "all") {
      params.set(`filter[_and][${filterIdx}][product_category][_eq]`, category);
      filterIdx++;
    }

    if (brand && brand !== "all") {
      params.set(`filter[_and][${filterIdx}][product_brand][_eq]`, brand);
      filterIdx++;
    }

    if (status && status !== "all") {
      params.set(`filter[_and][${filterIdx}][status][_eq]`, status);
      filterIdx++;
    }

    // Filter only industrial brand products and active products
    params.set(`filter[_and][${filterIdx}][product_brand][is_industrial][_eq]`, "1");
    filterIdx++;
    params.set(`filter[_and][${filterIdx}][isActive][_eq]`, "1");
    filterIdx++;

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}?${params.toString()}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// AG-COMMENT: Helper to obtain Philippine Time (Asia/Manila UTC+8) in ISO format (YYYY-MM-DDTHH:mm:ss)
function getManilaTimeString(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
}

// AG-COMMENT: Helper to extract authenticated user ID from JWT cookies or Authorization header
function extractUserIdFromRequest(req: NextRequest, explicitUserId?: number | string | null): number {
  if (explicitUserId !== undefined && explicitUserId !== null && !isNaN(Number(explicitUserId)) && Number(explicitUserId) > 0) {
    return Number(explicitUserId);
  }

  try {
    const token = req.cookies.get("vos_access_token")?.value ||
                  req.cookies.get("springboot_token")?.value ||
                  req.cookies.get("token")?.value ||
                  (req.headers.get("authorization")?.startsWith("Bearer ")
                    ? req.headers.get("authorization")?.substring(7)
                    : req.headers.get("authorization"));

    if (token) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payloadPart = parts[1];
        const pad = "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const b64 = (payloadPart + pad).replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(b64, "base64").toString("utf8");
        const payload = JSON.parse(jsonStr);

        const rawId = payload.user_id ?? payload.userId ?? payload.id ?? payload.sub;
        if (rawId !== undefined && rawId !== null) {
          const num = Number(rawId);
          if (!isNaN(num) && num > 0) return num;
        }
      }
    }
  } catch (err) {
    console.error("[Products API] Error decoding JWT token for user ID:", err);
  }

  return 1;
}

// AG-COMMENT: Handles creation of new product records and auto-generating serialized variants with full audit trail (created_by, updated_by, created_at, updated_at in PH time) & density_factor safeguards.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate that product_code is provided and non-empty
    if (!body.product_code || typeof body.product_code !== "string" || !body.product_code.trim()) {
      return NextResponse.json({ error: "Product code is required and cannot be empty." }, { status: 400 });
    }

    // AG-COMMENT: Validate that description is provided and non-empty
    if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "Description is required and cannot be empty." }, { status: 400 });
    }

    const trimmedCode = body.product_code.trim();

    // Check if we are creating a parent product (no parent_id and no uom_ids)
    const hasParentId = body.parent_id !== undefined && body.parent_id !== null && body.parent_id !== "" && body.parent_id !== 0;
    const hasUomIds = body.uom_ids !== undefined && body.uom_ids !== null && body.uom_ids !== "";
    const isParent = !hasParentId && !hasUomIds;

    const isSerialized = body.is_serialized === 1 || body.is_serialized === "1" || body.is_serialized === true;

    // Collect all candidate codes that would be created (parent code + auto-generated variant codes)
    const candidateCodes: string[] = [trimmedCode];
    if (isParent && isSerialized) {
      const variants = ["EMPTY", "SWAP", "OUTRIGHT", "DEPOSIT", "REFILL"];
      variants.forEach((variant) => {
        candidateCodes.push(`${trimmedCode} ${variant}`.trim());
      });
    }

    // Fetch existing product codes from Directus to enforce strict global uniqueness
    const existingProductsRes = await fetch(
      `${DIRECTUS_URL}/items/${COLLECTION}?limit=-1&fields=product_id,product_code`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (existingProductsRes.ok) {
      const existingJson = await existingProductsRes.json();
      const existingProducts: { product_id: number; product_code: string }[] = existingJson.data ?? [];

      // Build set of existing normalized upper-cased product codes
      const existingCodesSet = new Set<string>();
      for (const p of existingProducts) {
        if (p.product_code) {
          existingCodesSet.add(p.product_code.trim().toUpperCase());
        }
      }

      // Reject if any candidate product code already exists globally
      for (const code of candidateCodes) {
        if (existingCodesSet.has(code.toUpperCase())) {
          return NextResponse.json(
            { error: `Product Code "${code}" already exists. Product Code must be strictly unique globally.` },
            { status: 400 }
          );
        }
      }
    }

    // AG-COMMENT: Obtain Philippine Time (Asia/Manila UTC+8) timestamp
    const manilaTime = getManilaTimeString();

    // AG-COMMENT: Dynamically resolve created_by and updated_by fields from body or authenticated user JWT token
    const userId = extractUserIdFromRequest(req, body.created_by || body.updated_by);
    const createdBy = userId;
    const updatedBy = userId;

    // AG-COMMENT: Default density_factor to null if omitted
    const densityFactor = (body.density_factor !== undefined && body.density_factor !== null && Number(body.density_factor) > 0)
      ? Number(body.density_factor)
      : null;

    // Fetch units table to resolve unit_id by matching unit_shortcut
    const unitsRes = await fetch(
      `${DIRECTUS_URL}/items/units?limit=-1&fields=unit_id,unit_shortcut`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const unitsJson = unitsRes.ok ? await unitsRes.json() : {};
    const allUnits: { unit_id: number; unit_shortcut: string }[] = unitsJson.data ?? [];

    // Build a case-insensitive unit_shortcut → unit_id map
    const unitShortcutMap = new Map<string, number>();
    for (const u of allUnits) {
      if (u.unit_shortcut) unitShortcutMap.set(u.unit_shortcut.trim().toUpperCase(), u.unit_id);
    }

    const resolvedParentUomId = isSerialized ? (unitShortcutMap.get("FULL") ?? 16) : (body.unit_of_measurement || 16);

    const parentPayload = {
      ...body,
      product_code: trimmedCode,
      unit_of_measurement: resolvedParentUomId,
      date_added: manilaTime,
      created_at: manilaTime,
      updated_at: manilaTime,
      last_updated: manilaTime,
      status: "Approved",
      created_by: createdBy,
      updated_by: updatedBy,
      density_factor: densityFactor
    };

    // Create the primary product first
    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(parentPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const parentData = await response.json();
    const parentProduct = parentData.data;

    // If it is a parent product, automatically generate the standard children variations
    if (isParent && parentProduct && parentProduct.product_id && isSerialized) {
      const variants = ["EMPTY", "SWAP", "OUTRIGHT", "DEPOSIT", "REFILL"];
      const parentId = parentProduct.product_id;

      const children = variants.map(variant => {
        // Resolve unit_id from units table where unit_shortcut matches the variant; fallback to 16
        const resolvedUomId = unitShortcutMap.get(variant.toUpperCase()) ?? 16;

        return {
          ...body,
          parent_id: parentId,
          uom_ids: variant,
          product_name: parentProduct.product_name || body.product_name,
          description: `${parentProduct.description || body.description || ""} ${variant}`.trim(),
          product_code: `${parentProduct.product_code || body.product_code || ""} ${variant}`.trim(),
          isActive: 1,
          unit_of_measurement: resolvedUomId,
          date_added: manilaTime,
          created_at: manilaTime,
          updated_at: manilaTime,
          last_updated: manilaTime,
          status: "Approved",
          created_by: createdBy,
          updated_by: updatedBy,
          density_factor: densityFactor
        };
      });

      const childrenRes = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(children),
      });

      if (!childrenRes.ok) {
        const childError = await childrenRes.text();
        console.error("[Products API] Failed to auto-generate child products:", childError);
      }
    }

    return NextResponse.json(parentData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// AG-COMMENT: Handles updating product records, updating audit metadata (updated_by, updated_at in PH time), enforcing uniqueness, and propagating product code changes to child variants.
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await req.json();
    const manilaTime = getManilaTimeString();

    // AG-COMMENT: Dynamically resolve updated_by field from request body, JWT token cookie/header, or fallback 1
    const updatedBy = extractUserIdFromRequest(req, body.updated_by);

    // AG-COMMENT: Attach updated_by audit trail and timestamp in Philippine Time (UTC+8)
    const updatePayload = {
      ...body,
      updated_by: updatedBy,
      updated_at: manilaTime,
      last_updated: manilaTime
    };

    // AG-COMMENT: Clean up density_factor if undefined or null to preserve existing database column value
    if (updatePayload.density_factor === undefined || updatePayload.density_factor === null) {
      delete updatePayload.density_factor;
    }

    // Fetch existing child variants if this item is a parent product
    const childrenFetchRes = await fetch(
      `${DIRECTUS_URL}/items/${COLLECTION}?filter[parent_id][_eq]=${id}&fields=product_id,product_code,uom_ids`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const childVariants: { product_id: number; product_code: string; uom_ids?: string }[] = childrenFetchRes.ok
      ? (await childrenFetchRes.json()).data ?? []
      : [];

    const excludedIdsSet = new Set<string>([String(id)]);
    childVariants.forEach(cv => excludedIdsSet.add(String(cv.product_id)));

    // If updating product_code, enforce strict global uniqueness against other products
    if (body.product_code && typeof body.product_code === "string" && body.product_code.trim()) {
      const trimmedCode = body.product_code.trim();

      const existingProductsRes = await fetch(
        `${DIRECTUS_URL}/items/${COLLECTION}?limit=-1&fields=product_id,product_code`,
        { headers: getHeaders(), cache: "no-store" }
      );

      if (existingProductsRes.ok) {
        const existingJson = await existingProductsRes.json();
        const existingProducts: { product_id: number; product_code: string }[] = existingJson.data ?? [];

        // Check parent code collision
        const duplicate = existingProducts.find(
          (p) => !excludedIdsSet.has(String(p.product_id)) && p.product_code && p.product_code.trim().toUpperCase() === trimmedCode.toUpperCase()
        );

        if (duplicate) {
          return NextResponse.json(
            { error: `Product Code "${trimmedCode}" already exists on another product. Product Code must be strictly unique globally.` },
            { status: 400 }
          );
        }

        // Check candidate variant codes collision if child variants exist
        if (childVariants.length > 0) {
          for (const cv of childVariants) {
            const variantSuffix = cv.uom_ids || "VARIANT";
            const candidateVariantCode = `${trimmedCode} ${variantSuffix}`.trim().toUpperCase();

            const variantDup = existingProducts.find(
              (p) => !excludedIdsSet.has(String(p.product_id)) && p.product_code && p.product_code.trim().toUpperCase() === candidateVariantCode
            );

            if (variantDup) {
              return NextResponse.json(
                { error: `Variant Product Code "${candidateVariantCode}" already exists on another product.` },
                { status: 400 }
              );
            }
          }
        }
      }

      updatePayload.product_code = trimmedCode;
    }

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    // AG-COMMENT: Propagate parent updates (product_code, product_name, description, category, brand, status, isActive) to child variants
    if (childVariants.length > 0) {
      for (const cv of childVariants) {
        const variantSuffix = cv.uom_ids || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const childPayload: Record<string, any> = {
          updated_by: updatePayload.updated_by,
          updated_at: manilaTime,
          last_updated: manilaTime
        };

        if (body.product_code && typeof body.product_code === "string") {
          childPayload.product_code = `${body.product_code.trim()} ${variantSuffix}`.trim();
        }
        if (body.product_name) {
          childPayload.product_name = body.product_name;
        }
        if (body.description) {
          childPayload.description = `${body.description.trim()} ${variantSuffix}`.trim();
        }
        if (body.product_category !== undefined) {
          childPayload.product_category = body.product_category;
        }
        if (body.product_brand !== undefined) {
          childPayload.product_brand = body.product_brand;
        }
        if (body.status !== undefined) {
          childPayload.status = body.status;
        }
        if (body.isActive !== undefined) {
          childPayload.isActive = body.isActive;
        }

        await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${cv.product_id}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify(childPayload),
        });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const ids = searchParams.get("ids"); // For bulk delete

    if (ids) {
      const idList = ids.split(",");
      const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          keys: idList,
          data: {
            isActive: 0,
            status: "Inactive"
          }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error }, { status: response.status });
      }
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        isActive: 0,
        status: "Inactive"
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
