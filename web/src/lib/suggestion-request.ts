export type Suggestion = { submissionId: string; category: "feature" | "metric"; message: string };
const MAX_BYTES = 8_192;
const reply = (status: number, error?: string) => Response.json(error ? { error } : { ok: true }, { status, headers: { "Cache-Control": "no-store" } });

export async function handleSuggestion(request: Request, save: (suggestion: Suggestion) => Promise<void>) {
  // Next.js can reconstruct request.url with an internal hostname behind a proxy.
  // Compare the browser Origin with the actual HTTP Host, as server actions do.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    sameOrigin = origin.host === host && (origin.protocol === "https:" ||
      origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
  } catch { /* Missing or malformed origins fail closed. */ }
  if (!sameOrigin) return reply(403, "Please submit your suggestion from ParcelSavvy.");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(415, "Please use the suggestion form.");
  const reader = request.body?.getReader();
  if (!reader) return reply(400, "Please enter a suggestion.");
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return reply(413, "Please keep your suggestion under 2,000 characters.");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch { return reply(400, "Your suggestion could not be read. Please try again."); }
  finally { reader.releaseLock(); }
  let data: unknown;
  try { data = JSON.parse(body); } catch { return reply(400, "Please use the suggestion form."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, "Please use the suggestion form.");
  const input = data as Record<string, unknown>;
  if (typeof input.website === "string" && input.website.trim()) return reply(200);
  if (typeof input.submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submissionId)
    || typeof input.category !== "string" || !["feature", "metric"].includes(input.category) || typeof input.message !== "string"
    || input.message.trim().length < 10 || input.message.trim().length > 2_000 || input.message.includes("\u0000")) {
    return reply(400, "Choose a suggestion type and enter 10–2,000 characters.");
  }
  try {
    await save({ submissionId: input.submissionId, category: input.category as Suggestion["category"], message: input.message.trim() });
    return reply(200);
  } catch { return reply(503, "We couldn’t save your suggestion. Your text is still here—please try again."); }
}
