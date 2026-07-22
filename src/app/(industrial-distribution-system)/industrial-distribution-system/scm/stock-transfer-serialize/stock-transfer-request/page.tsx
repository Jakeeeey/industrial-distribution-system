import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cookies } from "next/headers"
import { decodeJwtPayload } from "@/lib/auth-utils"
import { StockTransferRequestView } from "@/modules/industrial-distribution-system/supply-chain-management/warehouse-management/stock-transfer"
import { NavUser } from "@/components/shared/app-sidebar/nav-user"

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
        <div className="flex h-full min-h-0 flex-col">
            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background print:hidden">
                <div className="flex items-center gap-2 px-4">
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
                                    <BreadcrumbLink href="#">SCM</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="#">Stock Transfer Serialize</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Stock Transfer Request
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                    </Breadcrumb>
                </div>

                <div className="ml-auto px-4">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <ScrollArea className="min-h-0 flex-1">
                <StockTransferRequestView salesmanName={headerUser.name} />
            </ScrollArea>
        </div>
    )
}