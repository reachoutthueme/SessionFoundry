import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/system/audit");
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin/system/audit");
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  const actor = s(searchParams?.actor);
  const entity_type = s(searchParams?.entity_type);
  const entity_id = s(searchParams?.entity_id);
  const action = s(searchParams?.action);
  const from = s(searchParams?.from);
  const to = s(searchParams?.to);

  const qs = new URLSearchParams();
  if (actor) qs.set('actor', actor);
  if (entity_type) qs.set('entity_type', entity_type);
  if (entity_id) qs.set('entity_id', entity_id);
  if (action) qs.set('action', action);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  const r = await fetch(`/api/admin/system/audit?${qs.toString()}`, { cache: "no-store" });
  const j = r.ok ? await r.json() : { logs: [] };
  const rows = Array.isArray(j.logs) ? j.logs : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <form className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6" action="/admin/system/audit" method="get">
        <input name="actor" defaultValue={actor} placeholder="Actor user id" className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input name="entity_type" defaultValue={entity_type} placeholder="Entity type" className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input name="entity_id" defaultValue={entity_id} placeholder="Entity id" className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input name="action" defaultValue={action} placeholder="Action" className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input type="datetime-local" name="from" defaultValue={from} className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <input type="datetime-local" name="to" defaultValue={to} className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm" />
        <button className="rounded-md border border-white/10 bg-white/5 px-3 text-sm">Filter</button>
      </form>

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-3 py-2">{fmt(r.created_at)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.actor_user_id || '-'}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2 text-sm">{r.entity_type || '-'}{r.entity_id ? `:${r.entity_id}` : ''}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-4 text-[var(--muted)]" colSpan={4}>No audit entries</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function s(v: unknown): string { return typeof v === 'string' ? v : ''; }
function fmt(v?: string) { if (!v) return '-'; const d = new Date(v); return isNaN(d.getTime()) ? '-' : d.toLocaleString(); }
