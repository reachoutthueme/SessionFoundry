import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

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

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const r = await fetch(`${origin}/api/admin/users?q=${encodeURIComponent(q)}&page=${page}&per_page=${per_page}`, { cache: "no-store" });
  const j = r.ok ? await r.json() : { users: [], count: 0 };
  const rows = Array.isArray(j.users) ? j.users : [];

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

      <div className="rounded-md border border-white/10 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Last sign-in</th>
              <th className="px-3 py-2 text-left">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u: any) => (
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
    </div>
  );
}

function fmt(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}
