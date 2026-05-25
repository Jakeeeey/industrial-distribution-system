import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const COLLECTIONS = {
  CUSTOMER: "customer",
  BANK_ACCOUNTS: "customer_bank_account",
  CUSTOMER_SALESMEN: "customer_salesmen",
  SALESMAN: "salesman",
  CUSTOMER_CLASSIFICATION: "customer_classification",
};

type DirectusRecord = Record<string, unknown>;

interface DirectusResponse<T> {
  data?: T[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
}

function getRecordId(record: DirectusRecord, key = "id"): string | null {
  const value = record[key];
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return null;
}

function getRecordString(
  record: DirectusRecord | undefined,
  key: string,
): string | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return null;
}

function coerceNumber(value: unknown): number | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(num) ? num : null;
}

function getPointCoordinates(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object") return null;
  const coords = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = coerceNumber(coords[0]);
  const lat = coerceNumber(coords[1]);
  if (lon === null || lat === null) return null;
  return [lon, lat];
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch (e) {
      if (i === retries - 1) throw e;
    }
  }
  return fetch(url, options);
}

function parseGeometry(locationStr?: string | null) {
  if (!locationStr || locationStr.trim() === "") return null;
  const coords = locationStr.split(",").map((c) => parseFloat(c.trim()));
  if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
    return { type: "Point", coordinates: [coords[1], coords[0]] };
  }
  return null;
}

function normalizeTin(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeEmptyToNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

async function fetchClassificationName(
  classificationId: number | string | null | undefined,
  token?: string,
): Promise<string | null> {
  if (!classificationId) return null;
  const res = await fetchWithRetry(
    `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER_CLASSIFICATION}/${classificationId}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.classification_name
    ? String(json.data.classification_name)
    : null;
}

function isWalkInName(name: string | null | undefined) {
  return Boolean(name && name.toLowerCase().includes("walk"));
}

async function isWalkInClassification(
  classificationId: number | string | null | undefined,
  token?: string,
) {
  const name = await fetchClassificationName(classificationId, token);
  return isWalkInName(name);
}

async function findCustomerByTin(
  tin: string,
  token?: string,
  excludeId?: string | number,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.append("filter[customer_tin][_eq]", tin);
  if (excludeId) params.append("filter[id][_neq]", String(excludeId));
  params.append("limit", "1");

  const res = await fetchWithRetry(
    `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}?${params.toString()}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) throw new Error(`Directus error checking TIN`);
  const json = await res.json();
  return json?.data || [];
}

export async function GET(req: NextRequest) {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const { searchParams } = new URL(req.url);

    // Directus Proxy handling if requested
    const directusCollection = searchParams.get("directusCollection");
    if (directusCollection) {
      const proxyParams = new URLSearchParams(searchParams.toString());
      proxyParams.delete("directusCollection");
      const target = `${DIRECTUS_URL}/items/${encodeURIComponent(directusCollection)}${proxyParams.toString() ? `?${proxyParams.toString()}` : ""}`;
      const res = await fetch(target, { method: "GET", headers });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "content-type": res.headers.get("content-type") || "application/json",
        },
      });
    }

    const id = searchParams.get("id");
    if (id) {
      const [customerRes, bankRes] = await Promise.all([
        fetchWithRetry(`${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${id}`, {
          cache: "no-store",
          headers,
        }),
        fetchWithRetry(
          `${DIRECTUS_URL}/items/${COLLECTIONS.BANK_ACCOUNTS}?filter[customer_id][_eq]=${id}`,
          { cache: "no-store", headers },
        ),
      ]);

      if (!customerRes.ok) throw new Error(`Customer not found: ${id}`);
      const customerData = await customerRes.json();
      const bankData = await bankRes.json();

      return NextResponse.json({
        ...customerData.data,
        bank_accounts: bankData.data || [],
      });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const pageSizeParam =
      searchParams.get("pageSize") || searchParams.get("limit") || "10";
    const pageSize = parseInt(pageSizeParam);
    const searchQuery = searchParams.get("q") || "";
    const statusFilter = searchParams.get("status") || "all";
    const storeTypeFilter = searchParams.get("storeType") || "all";
    const classificationFilter = searchParams.get("classification") || "all";

    // Support unlimited fetch: limit=-1 or pageSize=-1
    const isUnlimited = pageSize === -1;
    const offset = isUnlimited ? 0 : (page - 1) * pageSize;

    const params = new URLSearchParams();
    params.append("limit", isUnlimited ? "-1" : pageSize.toString());
    if (!isUnlimited) {
      params.append("offset", offset.toString());
      params.append("meta", "*");

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all")
        params.append(
          "filter[isActive][_eq]",
          statusFilter === "active" ? "1" : "0",
        );
      if (storeTypeFilter !== "all")
        params.append("filter[store_type][_eq]", storeTypeFilter);
      if (classificationFilter !== "all")
        params.append("filter[classification][_eq]", classificationFilter);
    } else {
      // As requested: "no pagesize no status no other paramter" when limit=-1
      // Just the limit is enough, no other filters or metadata requested for this mode.
    }

    const customersUrl = `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}?${params.toString()}`;
    const customersRes = await fetchWithRetry(customersUrl, {
      cache: "no-store",
      headers,
    });

    if (!customersRes.ok) throw new Error(`Directus error fetching customers`);
    const customersJson =
      (await customersRes.json()) as DirectusResponse<DirectusRecord>;
    const customers = Array.isArray(customersJson.data)
      ? customersJson.data
      : [];

    // Fetch relations
    const customerIds = customers
      .map((customer) => getRecordId(customer))
      .filter((id): id is string => Boolean(id));
    let bankAccounts: DirectusRecord[] = [];
    let customerSalesmen: DirectusRecord[] = [];
    let salesmen: DirectusRecord[] = [];

    if (customerIds.length > 0) {
      const idsQuery = customerIds.join(",");

      const [bankRes, csRes] = await Promise.all([
        fetchWithRetry(
          `${DIRECTUS_URL}/items/${COLLECTIONS.BANK_ACCOUNTS}?filter[customer_id][_in]=${idsQuery}`,
          { cache: "no-store", headers },
        ),
        fetchWithRetry(
          `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER_SALESMEN}?filter[customer_id][_in]=${idsQuery}`,
          { cache: "no-store", headers },
        ),
      ]);

      if (bankRes.ok) {
        const bankJson =
          (await bankRes.json()) as DirectusResponse<DirectusRecord>;
        bankAccounts = Array.isArray(bankJson.data) ? bankJson.data : [];
      }
      if (csRes.ok) {
        const csJson = (await csRes.json()) as DirectusResponse<DirectusRecord>;
        customerSalesmen = Array.isArray(csJson.data) ? csJson.data : [];
        const salesmanIds = Array.from(
          new Set(
            customerSalesmen
              .map((cs) => getRecordId(cs, "salesman_id"))
              .filter((id): id is string => Boolean(id)),
          ),
        );

        if (salesmanIds.length > 0) {
          const salesmanRes = await fetchWithRetry(
            `${DIRECTUS_URL}/items/${COLLECTIONS.SALESMAN}?filter[id][_in]=${salesmanIds.join(",")}`,
            { cache: "no-store", headers },
          );
          if (salesmanRes.ok) {
            const salesJson =
              (await salesmanRes.json()) as DirectusResponse<DirectusRecord>;
            salesmen = Array.isArray(salesJson.data) ? salesJson.data : [];
          }
        }
      }
    }

    const enrichedCustomers = customers.map((customer) => {
      const customerId = getRecordId(customer);
      const myBanks = bankAccounts.filter(
        (acc) => getRecordId(acc, "customer_id") === customerId,
      );
      const mySalesmenLinks = customerSalesmen.filter(
        (cs) => getRecordId(cs, "customer_id") === customerId,
      );
      const firstLink = mySalesmenLinks[0];

      let mappedSalesmanName = "N/A";
      let mappedSalesmanCode = null;

      const linkSalesmanId = firstLink
        ? getRecordId(firstLink, "salesman_id")
        : null;
      if (linkSalesmanId) {
        const salesmanData = salesmen.find(
          (salesman) => getRecordId(salesman) === linkSalesmanId,
        );
        const salesmanName = getRecordString(salesmanData, "salesman_name");
        const salesmanCode = getRecordString(salesmanData, "salesman_code");
        if (salesmanName) {
          mappedSalesmanName = salesmanName || "Unknown Salesman";
        }
        mappedSalesmanCode = salesmanCode ? String(salesmanCode) : null;
      }

      const locationValue = customer.location;
      let mappedLocation: unknown = locationValue;
      const coords = getPointCoordinates(locationValue);
      if (coords) {
        const [lon, lat] = coords;
        mappedLocation = `${lat}, ${lon}`;
      }

      return {
        ...customer,
        location: mappedLocation,
        bank_accounts: myBanks,
        salesman_name: mappedSalesmanName,
        salesman_code: mappedSalesmanCode,
      };
    });

    return NextResponse.json({
      customers: enrichedCustomers,
      bank_accounts: bankAccounts,
      metadata: {
        total_count: customersJson.meta?.total_count || 0,
        filter_count:
          customersJson.meta?.filter_count ??
          customersJson.meta?.total_count ??
          0,
        page,
        pageSize,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Failed to fetch customers",
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const body = await req.json();
    const newCustomerData = { ...body };
    delete newCustomerData.bank_accounts;

    if (
      newCustomerData.status === undefined &&
      newCustomerData.profile_status !== undefined
    ) {
      newCustomerData.status = newCustomerData.profile_status;
    }
    delete newCustomerData.profile_status;

    if (newCustomerData.location !== undefined) {
      const geoJson = parseGeometry(String(newCustomerData.location || ""));
      newCustomerData.location = geoJson
        ? geoJson
        : newCustomerData.location === "" || newCustomerData.location === null
          ? null
          : newCustomerData.location;
    }

    const isWalkIn = await isWalkInClassification(
      newCustomerData.classification,
      token,
    );
    const normalizedTin = normalizeTin(newCustomerData.customer_tin);

    if (!isWalkIn) {
      if (!normalizedTin)
        return NextResponse.json(
          { error: "TIN is required unless classification is Walk-in" },
          { status: 400 },
        );
      if (
        !String(newCustomerData.province ?? "").trim() ||
        !String(newCustomerData.city ?? "").trim() ||
        !String(newCustomerData.brgy ?? "").trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Delivery address is required unless classification is Walk-in",
          },
          { status: 400 },
        );
      }

      const dup = await findCustomerByTin(normalizedTin, token);
      if (dup.length > 0)
        return NextResponse.json(
          { error: "TIN must be unique" },
          { status: 409 },
        );
      newCustomerData.customer_tin = normalizedTin;
    } else {
      newCustomerData.customer_tin = normalizeEmptyToNull(
        newCustomerData.customer_tin,
      );
      newCustomerData.province = normalizeEmptyToNull(newCustomerData.province);
      newCustomerData.city = normalizeEmptyToNull(newCustomerData.city);
      newCustomerData.brgy = normalizeEmptyToNull(newCustomerData.brgy);
    }

    const createRes = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}`,
      { method: "POST", headers, body: JSON.stringify(newCustomerData) },
    );
    if (!createRes.ok) throw new Error(`Directus customer create failed`);
    const createJson = await createRes.json();
    const newId = createJson.data.id;

    const generatedCode = `MAIN-${String(newId).padStart(4, "0")}`;
    const patchRes = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${newId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ customer_code: generatedCode }),
      },
    );
    if (!patchRes.ok) return NextResponse.json(createJson.data);
    return NextResponse.json((await patchRes.json()).data);
  } catch (error) {
    console.error("Customer history create error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id)
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 },
      );

    if (
      updateData.status === undefined &&
      updateData.profile_status !== undefined
    ) {
      updateData.status = updateData.profile_status;
    }
    delete updateData.profile_status;

    if (!updateData.customer_code || updateData.customer_code.trim() === "")
      delete updateData.customer_code;

    if (updateData.location !== undefined) {
      const geoJson = parseGeometry(updateData.location);
      updateData.location = geoJson ? geoJson : null;
    }

    const shouldValidate =
      updateData.customer_tin !== undefined ||
      updateData.classification !== undefined ||
      updateData.province !== undefined;
    if (shouldValidate) {
      const existingRes = await fetchWithRetry(
        `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${id}`,
        { cache: "no-store", headers },
      );
      const existing = existingRes.ok ? (await existingRes.json()).data : null;

      const classificationId =
        updateData.classification ?? existing?.classification ?? null;
      const isWalkIn = await isWalkInClassification(classificationId, token);
      const resolvedTin =
        updateData.customer_tin !== undefined
          ? normalizeTin(updateData.customer_tin)
          : normalizeTin(existing?.customer_tin);

      if (!isWalkIn) {
        if (!resolvedTin)
          return NextResponse.json(
            { error: "TIN is required unless classification is Walk-in" },
            { status: 400 },
          );
        const dup = await findCustomerByTin(resolvedTin, token, id);
        if (dup.length > 0)
          return NextResponse.json(
            { error: "TIN must be unique" },
            { status: 409 },
          );
        updateData.customer_tin = resolvedTin;
      } else {
        if (updateData.customer_tin !== undefined)
          updateData.customer_tin = normalizeEmptyToNull(
            updateData.customer_tin,
          );
        if (updateData.province !== undefined)
          updateData.province = normalizeEmptyToNull(updateData.province);
        if (updateData.city !== undefined)
          updateData.city = normalizeEmptyToNull(updateData.city);
        if (updateData.brgy !== undefined)
          updateData.brgy = normalizeEmptyToNull(updateData.brgy);
      }
    }

    const res = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${id}`,
      { method: "PATCH", headers, body: JSON.stringify(updateData) },
    );
    if (!res.ok) throw new Error(`Directus customer update failed`);
    return NextResponse.json((await res.json()).data);
  } catch (error) {
    console.error("Customer history update error:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 },
      );
    const res = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Failed to delete customer`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer history delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 },
    );
  }
}
