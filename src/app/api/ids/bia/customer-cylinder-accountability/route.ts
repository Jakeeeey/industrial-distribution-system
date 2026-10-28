// src/app/api/ids/bia/customer-cylinder-accountability/route.ts
// ==============================================================================
// BFF API Route: Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Re-exports canonical implementation from SCM cylinder-asset-management to ensure single source of truth.
// ==============================================================================

export { GET, dynamic, runtime } from "@/app/api/ids/scm/cylinder-asset-management/customer-cylinder-accountability/route";
