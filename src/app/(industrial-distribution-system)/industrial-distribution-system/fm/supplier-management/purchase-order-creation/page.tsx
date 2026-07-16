// src/app/(supply-chain-management)/scm/supplier-management/purchase-order-creation/page.tsx
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

// ✅ FIX: nav-user is under scm/_components (not supplier-management/_components)
import { NavUser } from "@/components/shared/app-sidebar/nav-user";

import { cookies } from "next/headers";

import CreatePurchaseOrderModule from "@/modules/industrial-distribution-system/supply-chain-management/supplier-management/purchase-order-creation/CreatePurchaseOrderModule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, RefreshCw } from "lucide-react";

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

        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
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

export default async function Page() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const payload = token ? decodeJwtPayload(token) : null;
    const encoderId = Number(payload?.sub) || undefined;

    const headerUser = buildHeaderUserFromToken(token);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header
                className="
          sticky top-2 z-50 relative
          flex h-16 shrink-0 items-center justify-between
          border-b bg-background shadow-sm
          before:content-[''] before:absolute before:inset-x-0 before:-top-2 before:h-2 before:bg-background
        "
            >
                <div className="flex h-full items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">INDUSTRIAL-DISTRIBUTION-SYSTEM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">FM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">Supplier Management</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Purchase Order Creation
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="flex h-full items-center px-4">
                    <NavUser user={headerUser} />
                </div>
            </header>

            {/* ✅ Wrap with Tabs to separate Standard PO and Cylinder Refill PO */}
            <Tabs defaultValue="standard-po" className="flex-1 flex flex-col min-h-0">
                {/* Clean floating tabs list with top and horizontal margin/padding */}
                <div className="px-6 pt-6 flex items-center justify-between shrink-0">
                    <TabsList className="h-10 bg-muted/60 p-1 rounded-xl gap-1 border border-border/45 shadow-inner">
                        <TabsTrigger 
                            value="standard-po" 
                            className="rounded-lg h-8 px-4 text-xs font-bold gap-2 transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm hover:text-foreground/80"
                        >
                            <ClipboardList className="h-3.5 w-3.5 transition-transform group-data-[state=active]:scale-110" />
                            Standard Purchase Order
                        </TabsTrigger>
                        <TabsTrigger 
                            value="refill-po" 
                            className="rounded-lg h-8 px-4 text-xs font-bold gap-2 transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm hover:text-foreground/80"
                        >
                            <RefreshCw className="h-3.5 w-3.5 transition-transform group-data-[state=active]:rotate-45" />
                            Cylinder Refill PO
                        </TabsTrigger>
                    </TabsList>
                    
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-muted/30 px-3 py-1 rounded-full border border-border/20">
                        <span>Status</span>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-emerald-500 font-bold">Online</span>
                    </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="px-6 py-4">
                        <TabsContent value="standard-po" className="mt-0 outline-none animate-in fade-in-50 duration-200">
                            <CreatePurchaseOrderModule encoderId={encoderId} preparerName={headerUser.name} />
                        </TabsContent>
                        <TabsContent value="refill-po" className="mt-0 outline-none animate-in fade-in-50 duration-200">
                            <CreatePurchaseOrderModule encoderId={encoderId} preparerName={headerUser.name} isRefill={true} />
                        </TabsContent>
                    </div>
                </ScrollArea>
            </Tabs>
        </div>
    );
}

