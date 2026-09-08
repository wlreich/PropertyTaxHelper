import { diagnoseDatabaseHealth } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await diagnoseDatabaseHealth({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });

  return Response.json(
    { status: result.database === "ok" ? "ok" : "error", ...result },
    {
      status: result.database === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
