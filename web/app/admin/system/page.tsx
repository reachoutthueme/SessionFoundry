import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { getSystemHealth } from "@/server/admin/system";
 

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  // Server-side admin gate
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/system");

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="relative min-h-dvh overflow-hidden">
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">System</h1>
          <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
            Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
          </div>
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin/system");
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  const j = await getSystemHealth();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">System</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card label="DB: sessions" ok={!!j.db_checks?.sessions} okTitle={j.db_checks?.sessions ? "Admin SELECT count(*) succeeded" : "Failed DB check for sessions table"} extra={fmtCount(j.totals?.sessions)} />
          <Card label="DB: activities" ok={!!j.db_checks?.activities} okTitle={j.db_checks?.activities ? "Admin SELECT count(*) succeeded" : "Failed DB check for activities table"} extra={fmtCount(j.totals?.activities)} />
          <Card label="DB: submissions" ok={!!j.db_checks?.submissions} okTitle={j.db_checks?.submissions ? "Admin SELECT count(*) succeeded" : "Failed DB check for submissions table"} extra={fmtCount(j.totals?.submissions)} />
        </div>

        <div className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="font-medium mb-2">Environment</div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[var(--muted)]">
            {Object.entries(j.env || {}).map(([k, v]: any) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-64 truncate font-mono text-xs">{k}</span>
                <Status ok={!!v} title={v ? `${k} is set` : `${k} is missing`} />
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

function fmtCount(n?: number) {
  const v = typeof n === 'number' ? n : 0;
  return v.toLocaleString();
}

function Card({ label, ok, extra, okTitle }: { label: string; ok: boolean; extra?: string | number; okTitle?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 flex items-center justify-between">
        <Status ok={ok} title={okTitle} />
        {extra !== undefined && <div className="text-sm">{extra}</div>}
      </div>
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
