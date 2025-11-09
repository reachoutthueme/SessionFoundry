import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { listAdminUsers } from "@/server/admin/users";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  // Server-side admin gate
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/users");
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Users</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin/users");
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  const q = typeof searchParams?.q === 'string' ? searchParams?.q : '';
  const page = Number(searchParams?.page || 1) || 1;
  const per_page = Number(searchParams?.per_page || 20) || 20;
  const sort = typeof searchParams?.sort === 'string' ? searchParams.sort : 'created_at';
  const dir = (typeof searchParams?.dir === 'string' && (searchParams.dir === 'asc' || searchParams.dir === 'desc')) ? (searchParams.dir as 'asc'|'desc') : 'desc';

  const { users: rows, has_more } = await listAdminUsers(q, page, per_page);
  const sorted = [...rows].sort((a: any, b: any) => {
    const val = (k: string, x: any) => (x?.[k] ?? '');
    const av = val(sort, a);
    const bv = val(sort, b);
    let cmp = 0;
    if (sort === 'sessions_count') cmp = (Number(av) || 0) - (Number(bv) || 0);
    else if (sort === 'created_at' || sort === 'last_sign_in_at') cmp = new Date(av || 0).getTime() - new Date(bv || 0).getTime();
    else cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });

  function sortLink(key: string) {
    const nextDir: 'asc'|'desc' = sort === key ? (dir === 'asc' ? 'desc' : 'asc') : 'asc';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('per_page', String(per_page));
    params.set('sort', key);
    params.set('dir', nextDir);
    return `/admin/users?${params.toString()}`;
  }

  function hdr(key: string, text: string) {
    const is = sort === key;
    const arrow = is ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return <Link className="inline-flex items-center gap-1" href={sortLink(key)}>{text}<span aria-hidden>{arrow}</span></Link>;
  }

  const sortLabel = (k: string) => (
    k === 'email' ? 'Email' :
    k === 'id' ? 'User ID' :
    k === 'created_at' ? 'Created' :
    k === 'last_sign_in_at' ? 'Last sign-in' :
    k === 'sessions_count' ? 'Sessions' : k
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <form className="flex gap-2" action="/admin/users" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email or id"
          className="h-9 w-72 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
        />
        <button className="rounded-md border border-white/10 bg-white/5 px-3 text-sm">Search</button>
      </form>

      <div className="text-xs text-[var(--muted)]">Sorted by <span className="font-medium text-[var(--text)]">{sortLabel(sort)}</span> • {dir.toUpperCase()}</div>

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th aria-sort={sort==='email'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='email'?'text-[var(--text)]':''}`}>{hdr('email', 'Email')}</th>
              <th aria-sort={sort==='id'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='id'?'text-[var(--text)]':''}`}>{hdr('id', 'User ID')}</th>
              <th aria-sort={sort==='created_at'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='created_at'?'text-[var(--text)]':''}`}>{hdr('created_at', 'Created')}</th>
              <th aria-sort={sort==='last_sign_in_at'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='last_sign_in_at'?'text-[var(--text)]':''}`}>{hdr('last_sign_in_at', 'Last sign-in')}</th>
              <th aria-sort={sort==='sessions_count'? (dir==='asc'?'ascending':'descending') : 'none'} className={`px-3 py-2 text-left ${sort==='sessions_count'?'text-[var(--text)]':''}`}>{hdr('sessions_count', 'Sessions')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u: any) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="px-3 py-2">{u.email || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.id}</td>
                <td className="px-3 py-2">{fmt(u.created_at)}</td>
                <td className="px-3 py-2">{fmt(u.last_sign_in_at)}</td>
                <td className="px-3 py-2">{u.sessions_count ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-[var(--muted)]" colSpan={5}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-[var(--muted)]">Page {page}</div>
        <div className="flex gap-2">
          <Link
            href={(() => { const p = new URLSearchParams({ q, page: String(Math.max(1, page-1)), per_page: String(per_page), sort, dir }); return `/admin/users?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={page <= 1}
          >
            Prev
          </Link>
          <Link
            href={(() => { const p = new URLSearchParams({ q, page: String(page+1), per_page: String(per_page), sort, dir }); return `/admin/users?${p.toString()}`; })()}
            className={`rounded-md border px-3 py-1.5 ${!has_more ? 'pointer-events-none opacity-50' : 'hover:bg-white/5 border-white/10'}`}
            aria-disabled={!has_more}
          >
            Next
          </Link>
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
