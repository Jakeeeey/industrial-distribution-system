// src/app/api/ids/bia/customer-cylinder-accountability/route.ts
// ==============================================================================
// BFF API Route: Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Re-exports canonical implementation from SCM cylinder-asset-management to ensure single source of truth.
// ==============================================================================

// AG-WORKFLOW: Next.js / Turbopack requires route segment configs (dynamic, runtime)
// to be statically defined directly in the file, not re-exported.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { GET } from "@/app/api/ids/scm/cylinder-asset-management/customer-cylinder-accountability/route";
