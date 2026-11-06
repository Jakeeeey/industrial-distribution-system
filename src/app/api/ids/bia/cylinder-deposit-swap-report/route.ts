// src/app/api/ids/bia/cylinder-deposit-swap-report/route.ts
// ==============================================================================
// BFF API Route: Cylinder Deposit and Swap Report (VoSync BIA Subsystem)
// Re-exports canonical implementation from SCM cylinder-asset-management to ensure
// single source of truth and strict enforcement of serialized cylinders (is_serialized = 1).
// ==============================================================================

// AG-WORKFLOW: Next.js / Turbopack requires route segment configs (dynamic, runtime)
// to be statically defined directly in the file, not re-exported.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { GET } from "@/app/api/ids/scm/cylinder-asset-management/cylinder-deposit-swap-report/route";
