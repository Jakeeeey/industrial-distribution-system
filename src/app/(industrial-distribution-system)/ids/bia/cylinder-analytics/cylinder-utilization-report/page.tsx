// src/app/(industrial-distribution-system)/ids/bia/cylinder-analytics/cylinder-utilization-report/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Next.js Server Component page entry for the Cylinder Utilization Report.
// Route: /ids/bia/cylinder-analytics/cylinder-utilization-report
//
// Shell mirrors ids/bia/customer-cylinder-aging/page.tsx: the standard IDS header
// (sidebar trigger + breadcrumb + NavUser) with the client module rendered inside a
// ScrollArea. NavUser is built from the Vos access token cookie, exactly as the
// sibling BIA report pages do.
//
// Sidebar visibility and module authorization are Directus-managed: this route only
// becomes reachable once a `modules` row carries
// base_path = /ids/bia/cylinder-analytics/cylinder-utilization-report.
// ──────────────────────────────────────────────────────────────────────────────

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { cookies } from "next/headers";
import CylinderUtilizationReportModule from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildHeaderUser(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;
  const first = pickString(payload, ["Firstname", "FirstName", "firstName", "first_name"]);
  const last = pickString(payload, ["LastName", "Lastname", "lastName", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);
  return {
    name: [first, last].filter(Boolean).join(" ") || email || "User",
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function CylinderUtilizationReportPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Standard IDS Page Header ─────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
        <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" />
          <div className="min-w-0 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList className="min-w-0 overflow-hidden">
                <BreadcrumbItem className="hidden shrink-0 md:block">
                  <BreadcrumbLink href="#">IDS</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="hidden shrink-0 md:block">
                  <BreadcrumbLink href="#">BIA</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="hidden shrink-0 lg:block">
                  <BreadcrumbLink href="#">Cylinder Analytics</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden lg:block shrink-0" />
                <BreadcrumbItem className="min-w-0 overflow-hidden">
                  <BreadcrumbPage className="max-w-[56vw] truncate sm:max-w-[60vw] md:max-w-none">
                    Cylinder Utilization Report
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
        <div className="flex h-full shrink-0 items-center overflow-hidden px-2 sm:px-4">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <CylinderUtilizationReportModule />
        </div>
      </ScrollArea>
    </div>
  );
}
