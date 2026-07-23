// src/app/(industrial-distribution-system)/ids/scm/lpg-billing-management/lpg-billing-consolidation/page.tsx
// Page shell for the LPG Billing Consolidation module.
// Uses the standard IDS SCM page layout: sticky header with breadcrumb + NavUser,
// followed by the module content that fills the remaining height.

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { LpgBillingConsolidationModule } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/lpg-billing-consolidation/LpgBillingConsolidationModule";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export const metadata = {
  title: "Billing Consolidation | LPG Billing | SCM",
  description:
    "Review and approve final LPG Metered and WIWO billing records. Validate meter readings and cylinder weights against field photos before invoicing.",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;

  const first = pickString(payload, [
    "Firstname",
    "FirstName",
    "firstName",
    "firstname",
    "first_name",
  ]);
  const last = pickString(payload, [
    "LastName",
    "Lastname",
    "lastName",
    "lastname",
    "last_name",
  ]);
  const email = pickString(payload, ["email", "Email"]);

  const name = [first, last].filter(Boolean).join(" ") || email || "User";

  return {
    name,
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function LpgBillingConsolidationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUserFromToken(token);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Sticky Top Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background border-b border-border/40">
        <div className="flex items-center gap-2 px-4 min-w-0 flex-1">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4 shrink-0"
          />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 overflow-hidden">
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="#">INDUSTRIAL-DISTRIBUTION-SYSTEM</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="#">SCM</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="#">Lpg Billing Management</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="min-w-0 overflow-hidden">
                <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                  Lpg Billing Consolidation
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="ml-auto px-4 shrink-0">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* ── Module Content (fills remaining height, no extra scroll) ───────── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <LpgBillingConsolidationModule />
      </div>
    </div>
  );
}

