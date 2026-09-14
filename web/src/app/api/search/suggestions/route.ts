import { searchPropertySuggestions } from "@/lib/supabase/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const result = await searchPropertySuggestions(q);
  if (result.status === "ok") {
    return Response.json(
      { status: "ok", ...result.data },
      { status: 200, headers },
    );
  }
  return Response.json(
    { status: result.status },
    { status: result.status === "invalid" ? 400 : 503, headers },
  );
}
