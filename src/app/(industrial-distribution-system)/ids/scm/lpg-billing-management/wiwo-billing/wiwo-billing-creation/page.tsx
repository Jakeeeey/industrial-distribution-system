// RULE DEV: WiwoBillingModule replaced with ComingSoon temporarily — import removed to fix lint warning
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { cookies } from "next/headers";
import WiwoBillingModule from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/wiwo-billing/wiwo-billing-creation/WiwoBillingModule";


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

function pickString(
  obj: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
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

export const metadata = {
  title: "WIWO LPG Validation & Billing | IDS",
  description: "Weigh-In / Weigh-Out Dual Validation & Commercial LPG Billing.",
};

export default async function WiwoBillingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUserFromToken(token);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
        </div>
        <div className="flex items-center gap-4">
          <NavUser user={headerUser} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-0 min-w-0 flex-1 flex flex-col bg-background">
        <WiwoBillingModule/>
      </main>
    </div>
  );
}
