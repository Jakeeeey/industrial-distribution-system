import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cookies } from "next/headers"
import { NavUser } from "@/components/shared/app-sidebar/nav-user"
import { decodeJwtPayload } from "@/lib/auth-utils"
import DispatchingPage from "@/modules/industrial-distribution-system/supply-chain-management/warehouse-management/stock-transfer-serialize/dispatching/DispatchingPage"

export default async function Page() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;
    const payload = token ? decodeJwtPayload(token) : null;

    const headerUser = {
        name: payload ? `${payload.FirstName} ${payload.LastName}`.trim() : "System User",
        email: payload?.email || "user@vos.com",
        avatar: "",
    };

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 print:hidden">
                <div className="flex items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">IDS</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">SCM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">Warehouse Management</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">Stock Transfer Serialize</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Stock Transfer Serialize Dispatching
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="ml-auto">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full overflow-hidden">
                <DispatchingPage />
            </main>
        </div>
    )
}
