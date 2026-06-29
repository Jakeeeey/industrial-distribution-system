// src/app/(industrial-distribution-system)/ids/bia/rto-operation/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Next.js Server Component page entry for BIA RTO Operation.
// Route: /ids/bia/rto-operation
// Sidebar entry: managed via Directus navigation configuration.
// Pattern mirrors: ids/bia/customer-cylinder-aging/page.tsx
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
import RTOOperationModule from "@/modules/industrial-distribution-system/bia/rto-operation";

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
  const last  = pickString(payload, ["LastName", "Lastname", "lastName", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);
  return {
    name: [first, last].filter(Boolean).join(" ") || email || "User",
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function RTOOperationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Standard IDS Page Header ── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
        <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
          />
          <div className="min-w-0 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList className="min-w-0 overflow-hidden">
                <BreadcrumbItem className="hidden md:block shrink-0">
                  <BreadcrumbLink href="#">
                    Business Intelligence & Analytics
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                <BreadcrumbItem className="min-w-0 overflow-hidden">
                  <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                    RTO Operation
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
        <div className="flex h-full items-center px-2 sm:px-4 shrink-0 overflow-hidden">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <RTOOperationModule />
        </div>
      </ScrollArea>
    </div>
  );
}
