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

// Lightweight types for Directus items used in this route to avoid `any`
type CustomerItem = Record<string, unknown> & {
  id?: string | number;
  location?: unknown;
  customer_tin?: unknown;
  classification?: unknown;
  store_type?: unknown;
  province?: unknown;
  city?: unknown;
  brgy?: unknown;
  customer_code?: string | null;
};

type BankAccount = Record<string, unknown> & { customer_id?: string | number };
type CustomerSalesman = Record<string, unknown> & {
  customer_id?: string | number;
  salesman_id?: string | number;
};
type Salesman = Record<string, unknown> & {
  id?: string | number;
  salesman_name?: string | null;
  salesman_code?: string | null;
};

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

async function fetchStoreTypeName(
  storeTypeId: number | string | null | undefined,
  token?: string,
): Promise<string | null> {
  if (!storeTypeId) return null;
  const res = await fetchWithRetry(
    `${DIRECTUS_URL}/items/store_type/${storeTypeId}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.store_type ? String(json.data.store_type) : null;
}

async function isHouseholdStoreType(
  storeTypeId: number | string | null | undefined,
  token?: string,
) {
  const name = await fetchStoreTypeName(storeTypeId, token);
  return Boolean(name && name.toLowerCase().includes("household"));
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
      if (statusFilter !== "all") {
        params.append("filter[status][_eq]", statusFilter.toUpperCase());
      }
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
    const customersJson = await customersRes.json();
    const customers: CustomerItem[] =
      (customersJson.data as CustomerItem[]) || [];

    // Fetch relations
    const customerIds = customers
      .map((c) => String(c.id ?? ""))
      .filter(Boolean);
    let bankAccounts: BankAccount[] = [];
    let customerSalesmen: CustomerSalesman[] = [];
    let salesmen: Salesman[] = [];

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

      if (bankRes.ok)
        bankAccounts = ((await bankRes.json()).data as BankAccount[]) || [];
      if (csRes.ok) {
        customerSalesmen =
          ((await csRes.json()).data as CustomerSalesman[]) || [];
        const salesmanIds = Array.from(
          new Set(customerSalesmen.map((cs) => cs.salesman_id).filter(Boolean)),
        );

        if (salesmanIds.length > 0) {
          const salesmanRes = await fetchWithRetry(
            `${DIRECTUS_URL}/items/${COLLECTIONS.SALESMAN}?filter[id][_in]=${salesmanIds.join(",")}`,
            { cache: "no-store", headers },
          );
          if (salesmanRes.ok)
            salesmen = ((await salesmanRes.json()).data as Salesman[]) || [];
        }
      }
    }

    const enrichedCustomers = customers.map((customer) => {
      const myBanks = bankAccounts.filter(
        (acc) => String(acc.customer_id) === String(customer.id),
      );
      const mySalesmenLinks = customerSalesmen.filter(
        (cs) => String(cs.customer_id) === String(customer.id),
      );
      const firstLink = mySalesmenLinks[0] as CustomerSalesman | undefined;

      let mappedSalesmanName = "N/A";
      let mappedSalesmanCode: string | null = null;

      if (firstLink) {
        const salesmanData = salesmen.find(
          (s) => String(s.id) === String(firstLink.salesman_id),
        );
        if (salesmanData) {
          mappedSalesmanName = String(
            salesmanData.salesman_name ?? "Unknown Salesman",
          );
          mappedSalesmanCode = salesmanData.salesman_code
            ? String(salesmanData.salesman_code)
            : null;
        }
      }

      let mappedLocation: unknown = customer.location;
      if (
        mappedLocation &&
        typeof mappedLocation === "object" &&
        "coordinates" in mappedLocation
      ) {
        const coordsCandidate = (mappedLocation as Record<string, unknown>)
          .coordinates;
        if (
          Array.isArray(coordsCandidate) &&
          coordsCandidate.length >= 2 &&
          typeof coordsCandidate[0] === "number" &&
          typeof coordsCandidate[1] === "number"
        ) {
          const coords = coordsCandidate as number[];
          mappedLocation = `${coords[1]}, ${coords[0]}`;
        }
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

    if (newCustomerData.status !== undefined) {
      newCustomerData.status = String(newCustomerData.status).toUpperCase();
      newCustomerData.profile_status = newCustomerData.status;
    } else if (newCustomerData.profile_status !== undefined) {
      newCustomerData.profile_status = String(
        newCustomerData.profile_status,
      ).toUpperCase();
      newCustomerData.status = newCustomerData.profile_status;
    }

    if (newCustomerData.location !== undefined) {
      const geoJson = parseGeometry(String(newCustomerData.location || ""));
      newCustomerData.location = geoJson
        ? geoJson
        : newCustomerData.location === "" || newCustomerData.location === null
          ? null
          : newCustomerData.location;
    }

    const isWalkInClass = await isWalkInClassification(
      newCustomerData.classification,
      token,
    );
    const isHouseholdStore = await isHouseholdStoreType(
      newCustomerData.store_type,
      token,
    );
    const isWalkIn = isWalkInClass || isHouseholdStore;
    const normalizedTin = normalizeTin(newCustomerData.customer_tin);

    if (
      !String(newCustomerData.province ?? "").trim() ||
      !String(newCustomerData.city ?? "").trim() ||
      !String(newCustomerData.brgy ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "Delivery address is required" },
        { status: 400 },
      );
    }

    if (!isWalkIn) {
      if (!normalizedTin)
        return NextResponse.json(
          { error: "TIN is required for business accounts" },
          { status: 400 },
        );

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
    }

    // console.log("[POST] Creating customer with payload:", JSON.stringify(newCustomerData, null, 2));

    const createRes = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}`,
      { method: "POST", headers, body: JSON.stringify(newCustomerData) },
    );
    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      console.error("[POST] Directus error response:", errText);
      throw new Error(`Directus customer create failed: ${errText}`);
    }
    const createJson = await createRes.json();
    const newId = createJson.data.id;

    const generatedCode = isWalkIn
      ? `WALK-IN-${String(newId).padStart(8, "0")}`
      : `MAIN-${String(newId).padStart(4, "0")}`;
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
    return NextResponse.json(
      {
        error: "Failed to create customer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
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

    if (updateData.status !== undefined) {
      updateData.status = String(updateData.status).toUpperCase();
      updateData.profile_status = updateData.status;
    } else if (updateData.profile_status !== undefined) {
      updateData.profile_status = String(
        updateData.profile_status,
      ).toUpperCase();
      updateData.status = updateData.profile_status;
    }

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
      const storeTypeId = updateData.store_type ?? existing?.store_type ?? null;
      const isWalkInClass = await isWalkInClassification(
        classificationId,
        token,
      );
      const isHouseholdStore = await isHouseholdStoreType(storeTypeId, token);
      const isWalkIn = isWalkInClass || isHouseholdStore;
      const resolvedTin =
        updateData.customer_tin !== undefined
          ? normalizeTin(updateData.customer_tin)
          : normalizeTin(existing?.customer_tin);

      if (!isWalkIn) {
        if (!resolvedTin)
          return NextResponse.json(
            { error: "TIN is required for business accounts" },
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
      }
    }

    // console.log("[PATCH] Updating customer id =", id, "with payload:", JSON.stringify(updateData, null, 2));

    const res = await fetchWithRetry(
      `${DIRECTUS_URL}/items/${COLLECTIONS.CUSTOMER}/${id}`,
      { method: "PATCH", headers, body: JSON.stringify(updateData) },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[PATCH] Directus error response:", errText);
      throw new Error(`Directus customer update failed: ${errText}`);
    }
    return NextResponse.json((await res.json()).data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update customer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
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
    return NextResponse.json(
      {
        error: "Failed to delete customer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
