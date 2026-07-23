// src/app/dashboard/page.tsx
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
import ComingSoon from "@/app/(industrial-distribution-system)/ids/scm/_components/ComingSoon";

const headerUser = {
  name: "Jake Dave M. De Guzman",
  email: "jakedavedeguzman@vertex.com",
  avatar: "/avatars/shadcn.jpg",
};

export default function Page() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background">
        <div className="flex items-center gap-2 px-4">
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
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Warehouse Unit Conversion
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
        <ComingSoon />
      </ScrollArea>
    </div>
  );
}
