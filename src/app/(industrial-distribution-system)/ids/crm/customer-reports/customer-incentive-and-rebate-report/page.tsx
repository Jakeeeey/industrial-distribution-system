// src/app/(industrial-distribution-system)/ids/crm/customer-reports/customer-incentive-and-rebate-report/page.tsx
// Route shell for CRM -> Customer Reports -> Customer Incentive & Rebate
// Report. The module itself holds every behaviour; this file only frames it.
//
// The base_path registered in the Directus `modules` collection must match
// this route exactly — middleware.ts compares the two, and a mismatch
// redirects to /main-dashboard?error=unauthorized_access.

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
import CustomerIncentiveRebateReportModule from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
        // A malformed token must not blank the page; the header just shows
        // the generic user label instead.
        return null;
    }
}

function pickString(payload: Record<string, unknown> | null, keys: string[]): string {
    for (const key of keys) {
        const value = payload?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
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

export default async function CustomerIncentiveRebateReportPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const headerUser = buildHeaderUser(token);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background shadow-sm overflow-hidden sm:h-16">
                <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
                    <SidebarTrigger className="-ml-1 shrink-0" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 hidden shrink-0 sm:block data-[orientation=vertical]:h-4"
                    />
                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumb>
                            <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden shrink-0 md:block">
                                    <BreadcrumbLink href="#">CRM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden shrink-0 lg:block">
                                    <BreadcrumbLink href="#">Customer Reports</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden lg:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="max-w-[56vw] truncate sm:max-w-[60vw] md:max-w-none">
                                        Customer Incentive &amp; Rebate Report
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>
                <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
                <CustomerIncentiveRebateReportModule />
            </main>
        </div>
    );
}
