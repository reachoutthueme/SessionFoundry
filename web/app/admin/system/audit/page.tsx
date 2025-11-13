import { cookies } from "next/headers";
import BackgroundDecor from "@/components/ui/BackgroundDecor";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { getAuditLogs } from "@/server/admin/audit";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/system/audit");
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="relative min-h-dvh overflow-hidden">
        <BackgroundDecor />
        <div className="space-y-4">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
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

  const page = Math.max(1, Number(searchParams?.page || 1) || 1);
  const per_page = Math.min(200, Math.max(1, Number(searchParams?.per_page || 50) || 50));
  const sort = typeof searchParams?.sort === 'string' ? searchParams.sort : 'created_at';
  const dir = (typeof searchParams?.dir === 'string' && (searchParams.dir === 'asc' || searchParams.dir === 'desc')) ? (searchParams.dir as 'asc'|'desc') : 'desc';
  const { logs: rows, count } = await getAuditLogs({ actor, entity_type, entity_id, action, from, to, page, per_page, sort, dir });
  const sorted = [...rows].sort((a: any, b: any) => {
    const val = (k: string, x: any) => (x?.[k] ?? '');
    const av = val(sort, a);
    const bv = val(sort, b);
    let cmp = 0;
    if (sort === 'created_at') cmp = new Date(av || 0).getTime() - new Date(bv || 0).getTime();
    else cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });

  function sortLink(key: string) {
    const nextDir: 'asc'|'desc' = sort === key ? (dir === 'asc' ? 'desc' : 'asc') : 'asc';
    const params = new URLSearchParams();
    if (actor) params.set('actor', actor);
    if (entity_type) params.set('entity_type', entity_type);
    if (entity_id) params.set('entity_id', entity_id);
    if (action) params.set('action', action);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(page));
    params.set('per_page', String(per_page));
    params.set('sort', key);
    params.set('dir', nextDir);
    return `/admin/system/audit?${params.toString()}`;
  }

  function hdr(key: string, text: string) {
    const is = sort === key;
    const arrow = is ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return <Link className="inline-flex items-center gap-1" href={sortLink(key)}>{text}<span aria-hidden>{arrow}</span></Link>;
  }

  const sortLabel = (k: string) => (
    k === 'created_at' ? 'Time' :
    k === 'actor_user_id' ? 'Actor' :
    k === 'action' ? 'Action' :
    k === 'entity_type' ? 'Entity' : k
  );

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <BackgroundDecor />
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

      <div className="text-xs text-[var(--muted)]">Sorted by <span className="font-medium text-[var(--text)]">{sortLabel(sort)}</span> • {dir.toUpperCase()}</div>

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th aria-sort={sort==='created_at'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='created_at'?'text-[var(--text)]':''}`}>{hdr('created_at', 'Time')}</th>
              <th aria-sort={sort==='actor_user_id'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='actor_user_id'?'text-[var(--text)]':''}`}>{hdr('actor_user_id', 'Actor')}</th>
              <th aria-sort={sort==='action'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='action'?'text-[var(--text)]':''}`}>{hdr('action', 'Action')}</th>
              <th aria-sort={sort==='entity_type'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='entity_type'?'text-[var(--text)]':''}`}>{hdr('entity_type', 'Entity')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: any) => (
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

      <div className="flex items-center justify-between text-sm">
        <div className="text-[var(--muted)]">Page {page} • {count.toLocaleString()} total</div>
        <div className="flex gap-2">
          <Link
            href={(() => { const p = new URLSearchParams(); if (actor) p.set('actor', actor); if (entity_type) p.set('entity_type', entity_type); if (entity_id) p.set('entity_id', entity_id); if (action) p.set('action', action); if (from) p.set('from', from); if (to) p.set('to', to); p.set('page', String(Math.max(1, page-1))); p.set('per_page', String(per_page)); p.set('sort', sort); p.set('dir', dir); return `/admin/system/audit?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={page <= 1}
          >
            Prev
          </Link>
          <Link
            href={(() => { const p = new URLSearchParams(); if (actor) p.set('actor', actor); if (entity_type) p.set('entity_type', entity_type); if (entity_id) p.set('entity_id', entity_id); if (action) p.set('action', action); if (from) p.set('from', from); if (to) p.set('to', to); const hasNext = page * per_page < count; const nextPage = hasNext ? page+1 : page; p.set('page', String(nextPage)); p.set('per_page', String(per_page)); p.set('sort', sort); p.set('dir', dir); return `/admin/system/audit?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${page * per_page >= count ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={page * per_page >= count}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
}

function s(v: unknown): string { return typeof v === 'string' ? v : ''; }
function fmt(v?: string) { if (!v) return '-'; const d = new Date(v); return isNaN(d.getTime()) ? '-' : d.toLocaleString(); }

