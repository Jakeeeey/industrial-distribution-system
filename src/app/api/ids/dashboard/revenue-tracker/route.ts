// src/app/api/ids/dashboard/revenue-tracker/route.ts
// Temporarily disabled route to prevent Next.js validator from failing on fully commented-out files.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ message: "Revenue tracker is temporarily disabled" });
}
