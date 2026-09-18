import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";

type Inbox = { items: { id: number; category: "feature" | "metric"; message: string; created_at: string }[]; has_more: boolean };
export default async function SuggestionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const client = await requireAdmin();
  const { page: rawPage } = await searchParams;
  const page = rawPage && /^\d{1,3}$/.test(rawPage) ? Number(rawPage) : 0;
  const { data, error } = await client.rpc("admin_suggestions", { p_page: page });
  const inbox = data as Inbox | null;
  return <>
    <p><Link href="/admin">← Administration</Link></p>
    <h1>Suggestions</h1>
    <p>Private suggestions from visitors, newest first. Nothing here is published or emailed.</p>
    {error || !inbox || !Array.isArray(inbox.items) ? <p role="alert">Suggestions are temporarily unavailable. <Link href="/admin/suggestions">Try again</Link>.</p> : <>
      {!inbox.items.length && <p>No suggestions on this page yet.</p>}
      <ul className="admin-list">{inbox.items.map(item => <li key={item.id}>
        <h2>{item.category === "metric" ? "Number or comparison" : "Feature"}</h2>
        <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central</time>
        <p className="suggestion-message">{item.message}</p>
      </li>)}</ul>
      {(page > 0 || inbox.has_more) && <nav className="pagination" aria-label="Suggestion pages">
        <span>{page > 0 && <Link href={`/admin/suggestions?page=${page - 1}`}>← Newer</Link>}</span>
        <span>Page {page + 1}</span>
        <span>{inbox.has_more && page < 999 && <Link href={`/admin/suggestions?page=${page + 1}`}>Older →</Link>}</span>
      </nav>}
    </>}
  </>;
}
