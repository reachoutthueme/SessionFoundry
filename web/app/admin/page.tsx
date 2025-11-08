import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { getAdminOverviewMetrics } from "@/server/admin/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Server-side auth: verify current user via access token cookie
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin");

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin");

  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  // Direct server call (no HTTP hop)
  const { kpis: k, health } = await getAdminOverviewMetrics();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <p className="text-sm text-[var(--muted)]">Only visible to admins.</p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Sessions (7d)" value={k.sessions_last_7d ?? 0} />
        <KpiCard label="Sessions (28d)" value={k.sessions_last_28d ?? 0} />
        <KpiCard label="Completion rate (28d)" value={((k.completion_rate_28d ?? 0) * 100).toFixed(0) + "%"} />
        <KpiCard label="Avg participants / session (28d)" value={(k.avg_participants_per_session_28d ?? 0).toFixed(1)} />
        <KpiCard label="Avg submissions / session (28d)" value={(k.avg_submissions_per_session_28d ?? 0).toFixed(1)} />
      </div>

      {/* Health */}
      <div className="rounded-md border border-white/10 bg-white/5 p-4">
        <div className="font-medium mb-2">System health</div>
        <ul className="text-sm text-[var(--muted)] space-y-1">
          <li>
            Database: <Status ok={!!health.db_ok} title={
              health.db_ok
                ? "Connected as service role; count query succeeded"
                : "Could not run admin DB query; check URL/key/connectivity"
            } />
          </li>
          <li>
            Env: Supabase URL: <Status ok={!!(health.env?.supabase_url)} title={
              (health.env?.supabase_url)
                ? "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is set"
                : "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL"
            } />
          </li>
          <li>
            Env: Supabase Key: <Status ok={!!(health.env?.supabase_key)} title={
              (health.env?.supabase_key)
                ? "SUPABASE_SERVICE_ROLE_KEY is set (server only)"
                : "Missing SUPABASE_SERVICE_ROLE_KEY"
            } />
          </li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="text-[var(--muted)] text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Status({ ok, title }: { ok: boolean; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-2 ${ok ? 'text-green-300' : 'text-rose-300'}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-green-400' : 'bg-rose-400'}`} />
      {ok ? 'OK' : 'Issue'}
    </span>
  );
}
