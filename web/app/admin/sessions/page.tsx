import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { searchAdminSessions } from "@/server/admin/sessions";

export const dynamic = "force-dynamic";

import BackgroundDecor from "@/components/ui/BackgroundDecor";

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
  const pageNum = Math.max(1, Number(searchParams?.page || 1) || 1);
  const perPage = Math.min(200, Math.max(1, Number(searchParams?.per_page || 50) || 50));

  const sort = typeof searchParams?.sort === 'string' ? searchParams.sort : 'created_at';
  const dir = (typeof searchParams?.dir === 'string' && (searchParams.dir === 'asc' || searchParams.dir === 'desc')) ? (searchParams.dir as 'asc'|'desc') : 'desc';
  const { sessions: rows, count } = await searchAdminSessions({ status, owner, from, to, page: pageNum, per_page: perPage, sort, dir });
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
    if (status) params.set('status', status);
    if (owner) params.set('owner', owner);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(pageNum));
    params.set('per_page', String(perPage));
    params.set('sort', key);
    params.set('dir', nextDir);
    return `/admin/sessions?${params.toString()}`;
  }

  function hdr(key: string, text: string) {
    const is = sort === key;
    const arrow = is ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return <Link className="inline-flex items-center gap-1" href={sortLink(key)}>{text}<span aria-hidden>{arrow}</span></Link>;
  }

  const sortLabel = (k: string) => (
    k === 'name' ? 'Name' :
    k === 'status' ? 'Status' :
    k === 'facilitator_user_id' ? 'Owner' :
    k === 'join_code' ? 'Join code' :
    k === 'created_at' ? 'Created' : k
  );

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <BackgroundDecor />
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

      <div className="text-xs text-[var(--muted)]">Sorted by <span className="font-medium text-[var(--text)]">{sortLabel(sort)}</span> • {dir.toUpperCase()}</div>

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th aria-sort={sort==='name'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='name'?'text-[var(--text)]':''}`}>{hdr('name', 'Name')}</th>
              <th aria-sort={sort==='status'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='status'?'text-[var(--text)]':''}`}>{hdr('status', 'Status')}</th>
              <th aria-sort={sort==='facilitator_user_id'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='facilitator_user_id'?'text-[var(--text)]':''}`}>{hdr('facilitator_user_id', 'Owner')}</th>
              <th aria-sort={sort==='join_code'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='join_code'?'text-[var(--text)]':''}`}>{hdr('join_code', 'Join code')}</th>
              <th aria-sort={sort==='created_at'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='created_at'?'text-[var(--text)]':''}`}>{hdr('created_at', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s: any) => (
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

      <div className="flex items-center justify-between text-sm">
        <div className="text-[var(--muted)]">Page {pageNum} • {count.toLocaleString()} total</div>
        <div className="flex gap-2">
          <Link
            href={(() => { const p = new URLSearchParams(); if (status) p.set('status', status); if (owner) p.set('owner', owner); if (from) p.set('from', from); if (to) p.set('to', to); p.set('page', String(Math.max(1, pageNum-1))); p.set('per_page', String(perPage)); p.set('sort', sort); p.set('dir', dir); return `/admin/sessions?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${pageNum <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={pageNum <= 1}
          >
            Prev
          </Link>
          <Link
            href={(() => { const p = new URLSearchParams(); if (status) p.set('status', status); if (owner) p.set('owner', owner); if (from) p.set('from', from); if (to) p.set('to', to); const hasNext = pageNum * perPage < count; const nextPage = hasNext ? pageNum+1 : pageNum; p.set('page', String(nextPage)); p.set('per_page', String(perPage)); p.set('sort', sort); p.set('dir', dir); return `/admin/sessions?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${pageNum * perPage >= count ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={pageNum * perPage >= count}
          >
            Next
          </Link>
        </div>
      </div>
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


