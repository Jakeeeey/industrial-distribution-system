// src/app/api/ids/scm/lpg-billing-management/lpg-billing-consolidation/route.ts
//
// API handler for the LPG Billing Consolidation module.
// Supports:
//   GET  ?type=headers | workspace | wiwo-details | audit-trail | attachments
//   PATCH ?action=adjust-meter-reading | adjust-wiwo-detail | approve-header

import { NextRequest, NextResponse } from "next/server";
import {
  fetchConsolidationHeaders,
  fetchConsolidationWorkspace,
  fetchWiwoDetails,
  fetchAuditTrail,
  fetchAttachments,
  adjustMeterReading,
  adjustWiwoDetail,
  approveConsolidationHeader,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/lpg-billing-consolidation/services";
import {
  MeterReadingAdjustSchema,
  WiwoDetailAdjustSchema,
  ApproveHeaderSchema,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/lpg-billing-consolidation/types/billing-consolidation.schema";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";
import type { HeaderStatus } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/lpg-billing-consolidation/types/billing-consolidation.types";

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ids/scm/lpg-billing-management/lpg-billing-consolidation
 *
 * Query params:
 *   type=headers            — paginated list of billing headers
 *   type=workspace          — full workspace for a header (transactions + readings + WIWO)
 *   type=wiwo-details       — WIWO cylinder details for a WIWO header
 *   type=audit-trail        — audit log entries for a child transaction
 *   type=attachments        — photo attachments for a child transaction
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // ── Headers List ──────────────────────────────────────────────────────────
    if (type === "headers" || !type) {
      const status = (searchParams.get("status") || "ALL") as HeaderStatus | "ALL";
      const search = searchParams.get("search") || undefined;
      const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
      const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 15;

      const result = await fetchConsolidationHeaders({ status, search, page, limit });
      return NextResponse.json(result);
    }

    // ── Full Workspace (Header + All Transactions Enriched) ───────────────────
    if (type === "workspace") {
      const headerId = Number(searchParams.get("headerId") ?? 0);
      if (!headerId) {
        return NextResponse.json({ error: "headerId is required" }, { status: 400 });
      }
      const result = await fetchConsolidationWorkspace(headerId);
      return NextResponse.json(result);
    }

    // ── WIWO Details ──────────────────────────────────────────────────────────
    if (type === "wiwo-details") {
      const wiwoHeaderId = Number(searchParams.get("wiwoHeaderId") ?? 0);
      if (!wiwoHeaderId) {
        return NextResponse.json({ error: "wiwoHeaderId is required" }, { status: 400 });
      }
      const result = await fetchWiwoDetails(wiwoHeaderId);
      return NextResponse.json({ data: result });
    }

    // ── Audit Trail ───────────────────────────────────────────────────────────
    if (type === "audit-trail") {
      const transactionId = Number(searchParams.get("transactionId") ?? 0);
      if (!transactionId) {
        return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
      }
      const data = await fetchAuditTrail(transactionId);
      return NextResponse.json({ data });
    }

    // ── Attachments ───────────────────────────────────────────────────────────
    if (type === "attachments") {
      const transactionId = Number(searchParams.get("transactionId") ?? 0);
      if (!transactionId) {
        return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
      }
      const data = await fetchAttachments(transactionId);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/ids/scm/lpg-billing-management/lpg-billing-consolidation?action=...
 *
 * Actions:
 *   action=adjust-meter-reading  — reviewer corrects a meter current reading
 *   action=adjust-wiwo-detail    — reviewer corrects a cylinder returned gross weight
 *   action=approve-header        — reviewer approves the billing header (→ POSTED)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    // ── Adjust Meter Reading ──────────────────────────────────────────────────
    if (action === "adjust-meter-reading") {
      const parsed = MeterReadingAdjustSchema.safeParse({
        ...body,
        modified_by: body.modified_by ?? userId ?? 0,
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 422 }
        );
      }

      const result = await adjustMeterReading(parsed.data);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Adjust WIWO Detail ────────────────────────────────────────────────────
    if (action === "adjust-wiwo-detail") {
      const parsed = WiwoDetailAdjustSchema.safeParse({
        ...body,
        modified_by: body.modified_by ?? userId ?? 0,
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 422 }
        );
      }

      const result = await adjustWiwoDetail(parsed.data);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Approve Header ────────────────────────────────────────────────────────
    if (action === "approve-header") {
      const parsed = ApproveHeaderSchema.safeParse({
        ...body,
        approved_by: body.approved_by ?? userId ?? 0,
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 422 }
        );
      }

      await approveConsolidationHeader(parsed.data);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
