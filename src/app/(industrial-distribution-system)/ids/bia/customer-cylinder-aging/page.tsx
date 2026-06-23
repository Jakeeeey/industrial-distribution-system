// src/app/(industrial-distribution-system)/ids/bia/customer-cylinder-aging/page.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Next.js Server Component page entry for Customer Cylinder Aging.
// Route: /ids/bia/customer-cylinder-aging
// Sidebar entry: http://localhost:3009/ids/bia/customer-cylinder-aging (Directus-managed)
//
// Pattern mirrors: ids/scm/supplier-management/purchase-order-posting/page.tsx
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
import CustomerCylinderAgingModule from "@/modules/industrial-distribution-system/bia/customer-cylinder-aging";

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

export default async function CustomerCylinderAgingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="
          sticky top-2 z-50 relative
          flex h-16 shrink-0 items-center justify-between
          border-b bg-background shadow-sm
          before:content-[''] before:absolute before:inset-x-0
          before:-top-2 before:h-2 before:bg-background
        "
      >
        <div className="flex h-full items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">
                  Business Intelligence & Analytics
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Customer Cylinder Aging</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex h-full items-center px-4">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <CustomerCylinderAgingModule />
        </div>
      </ScrollArea>
    </div>
  );
}
