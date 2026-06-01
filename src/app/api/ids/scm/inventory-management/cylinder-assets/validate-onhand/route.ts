import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!AUTH_DISABLED && !token) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized: Missing access token" },
      { status: 401 },
    );
  }

  if (!SPRING_API_BASE_URL) {
    return NextResponse.json(
      { ok: false, message: "SPRING_API_BASE_URL is not configured." },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const { serials } = body as { serials: (string | { serialNumber: string; branchId?: number | string })[] };

    if (!serials || !Array.isArray(serials) || serials.length === 0) {
      return NextResponse.json({ ok: true, invalidSerials: [] });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["Cookie"] = `vos_access_token=${token}`;
    }

    const invalidSerials: string[] = [];

    // Check each serial
    for (const item of serials) {
      const serial = typeof item === "string" ? item : item.serialNumber;
      const branchId = typeof item === "object" ? item.branchId : undefined;

      const targetUrl = new URL(
        `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`,
      );
      targetUrl.searchParams.set("serialNumber", serial);
      if (branchId !== undefined && branchId !== null && branchId !== "") {
        targetUrl.searchParams.set("branchId", String(branchId));
      }

      const springRes = await fetch(targetUrl.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const text = await springRes.text();
      console.log(`Spring API response for ${serial}: status=${springRes.status}, text=${text}`);

      if (!springRes.ok) {
        // If it returns a 404 or other error, treat as invalid
        invalidSerials.push(serial);
        continue;
      }

      interface ParsedResponse {
        productId?: unknown;
        content?: unknown[];
        data?: unknown[];
      }

      const parsed: unknown = text ? JSON.parse(text) : null;

      // Re-use logic similar to physical inventory
      let isValid = false;
      if (Array.isArray(parsed) && parsed.length > 0) {
        isValid = true;
      } else if (parsed && typeof parsed === "object" && "productId" in parsed) {
        isValid = true;
      } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as ParsedResponse).content) && (parsed as ParsedResponse).content!.length > 0) {
        isValid = true;
      } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as ParsedResponse).data) && (parsed as ParsedResponse).data!.length > 0) {
        isValid = true;
      }

      if (!isValid) {
        invalidSerials.push(serial);
      }

    }

    const pendingSerials: Record<string, string> = {};
    if (invalidSerials.length > 0) {
      const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (NEXT_PUBLIC_API_BASE_URL) {
        
        // 1. Check Sales Invoice (Highest Priority)
        const siFilter = {
          serial_no: { _in: invalidSerials }
        };
        const siUrl = new URL(`${NEXT_PUBLIC_API_BASE_URL}/items/sales_invoice_details`);
        siUrl.searchParams.set("fields", "serial_no,invoice_no.invoice_no");
        siUrl.searchParams.set("filter", JSON.stringify(siFilter));
        siUrl.searchParams.set("limit", "-1");

        try {
          const siRes = await fetch(siUrl.toString(), { method: "GET" });
          const siJson = await siRes.json();
          if (siJson.data && Array.isArray(siJson.data)) {
            for (const row of siJson.data) {
              if (row.serial_no && row.invoice_no?.invoice_no) {
                pendingSerials[row.serial_no] = `In Invoice: ${row.invoice_no.invoice_no}`;
              }
            }
          }
        } catch (e) {
          console.error("Failed to query directus for sales invoice serials", e);
        }

        // 2. Check POS Transactions (2nd Priority)
        const remainingAfterSI = invalidSerials.filter(s => !pendingSerials[s]);
        if (remainingAfterSI.length > 0) {
          const posFilter = {
            serial_number: { _in: remainingAfterSI }
          };
          const posUrl = new URL(`${NEXT_PUBLIC_API_BASE_URL}/items/pos_transaction_serial`);
          posUrl.searchParams.set("fields", "serial_number,pos_transaction_id");
          posUrl.searchParams.set("filter", JSON.stringify(posFilter));
          posUrl.searchParams.set("limit", "-1");

          try {
            const posRes = await fetch(posUrl.toString(), { method: "GET" });
            const posJson = await posRes.json();
            if (posJson.data && Array.isArray(posJson.data)) {
              for (const row of posJson.data) {
                if (row.serial_number && row.pos_transaction_id) {
                  pendingSerials[row.serial_number] = `POS: ${row.pos_transaction_id}`;
                }
              }
            }
          } catch (e) {
            console.error("Failed to query directus for POS transaction serials", e);
          }
        }

        // 3. Check Physical Inventory (3rd Priority)
        const remainingAfterPOS = invalidSerials.filter(s => !pendingSerials[s]);
        if (remainingAfterPOS.length > 0) {
          const piFilter = {
            serial_number: { _in: remainingAfterPOS },
            pi_detail_id: { ph_id: { isComitted: { _eq: 0 } } }
          };
          const piUrl = new URL(`${NEXT_PUBLIC_API_BASE_URL}/items/physical_inventory_details_serial`);
          piUrl.searchParams.set("fields", "serial_number,pi_detail_id.ph_id.ph_no");
          piUrl.searchParams.set("filter", JSON.stringify(piFilter));
          piUrl.searchParams.set("limit", "-1");

          try {
            const dRes = await fetch(piUrl.toString(), { method: "GET" });
            const dJson = await dRes.json();
            if (dJson.data && Array.isArray(dJson.data)) {
              for (const row of dJson.data) {
                if (row.serial_number && row.pi_detail_id?.ph_id?.ph_no) {
                  pendingSerials[row.serial_number] = `Pending in PI: ${row.pi_detail_id.ph_id.ph_no}`;
                }
              }
            }
          } catch (e) {
            console.error("Failed to query directus for pending PI serials", e);
          }
        }

        // 4. Check Stock Adjustment (4th Priority)
        const remainingAfterPI = invalidSerials.filter(s => !pendingSerials[s]);
        if (remainingAfterPI.length > 0) {
          const saFilter = {
            serial_number: { _in: remainingAfterPI }
          };
          const saUrl = new URL(`${NEXT_PUBLIC_API_BASE_URL}/items/stock_adjustment_serial`);
          saUrl.searchParams.set("fields", "serial_number,stock_adjustment_id.doc_no");
          saUrl.searchParams.set("filter", JSON.stringify(saFilter));
          saUrl.searchParams.set("limit", "-1");

          try {
            const saRes = await fetch(saUrl.toString(), { method: "GET" });
            const saJson = await saRes.json();
            if (saJson.data && Array.isArray(saJson.data)) {
              for (const row of saJson.data) {
                if (row.serial_number && row.stock_adjustment_id?.doc_no) {
                  pendingSerials[row.serial_number] = `Pending in SA: ${row.stock_adjustment_id.doc_no}`;
                }
              }
            }
          } catch (e) {
            console.error("Failed to query directus for pending SA serials", e);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, invalidSerials, pendingSerials });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Validation failed.";

    return NextResponse.json(
      { ok: false, message },
      { status: 502 },
    );
  }
}
