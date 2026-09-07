import { checkDatabaseHealth } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const database = await checkDatabaseHealth({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });

  return Response.json(
    { status: database === "ok" ? "ok" : "error", database },
    {
      status: database === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
