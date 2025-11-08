import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/sessions");
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Sessions</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin/sessions");
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  const status = typeof searchParams?.status === 'string' ? searchParams?.status : '';
  const owner = typeof searchParams?.owner === 'string' ? searchParams?.owner : '';
  const from = typeof searchParams?.from === 'string' ? searchParams?.from : '';
  const to = typeof searchParams?.to === 'string' ? searchParams?.to : '';

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (owner) qs.set('owner', owner);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const r = await fetch(`${origin}/api/admin/sessions/search?${qs.toString()}`, { cache: "no-store" });
  const j = r.ok ? await r.json() : { sessions: [] };
  const rows = Array.isArray(j.sessions) ? j.sessions : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sessions</h1>
      <form className="flex flex-wrap gap-2" action="/admin/sessions" method="get">
        <select name="status" defaultValue={status} className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm">
          <option value="">Any status</option>
          <option>Draft</option>
          <option>Active</option>
          <option>Completed</option>
          <option>Inactive</option>
        </select>
        <input name="owner" defaultValue={owner} placeholder="Owner user id" className="h-9 w-64 rounded-md border border-white/10 bg-[var(--panel)] px-3 text-sm outline-none" />
        <input type="datetime-local" name="from" defaultValue={from} className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input type="datetime-local" name="to" defaultValue={to} className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <button className="rounded-md border border-white/10 bg-white/5 px-3 text-sm">Filter</button>
      </form>

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Join code</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: any) => (
              <tr key={s.id} className="border-t border-white/10">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.facilitator_user_id || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.join_code}</td>
                <td className="px-3 py-2">{fmt(s.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-4 text-[var(--muted)]" colSpan={5}>No sessions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}
