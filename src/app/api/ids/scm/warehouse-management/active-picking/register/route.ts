// Deleted per revision
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
