import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  // Server-side admin gate
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin/system");
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">System</h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm">
          Admin backend is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, then redeploy.
        </div>
      </div>
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin/system");
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const r = await fetch(`${origin}/api/admin/system/health`, { cache: "no-store" });
  const j = r.ok ? await r.json() : { db_checks: {}, totals: {}, env: {} };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">System</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="DB: sessions" ok={!!j.db_checks?.sessions} extra={fmtCount(j.totals?.sessions)} />
        <Card label="DB: activities" ok={!!j.db_checks?.activities} extra={fmtCount(j.totals?.activities)} />
        <Card label="DB: submissions" ok={!!j.db_checks?.submissions} extra={fmtCount(j.totals?.submissions)} />
      </div>

      <div className="rounded-md border border-white/10 bg-white/5 p-4">
        <div className="font-medium mb-2">Environment</div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[var(--muted)]">
          {Object.entries(j.env || {}).map(([k, v]: any) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-64 truncate font-mono text-xs">{k}</span>
              <Status ok={!!v} />
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function fmtCount(n?: number) {
  const v = typeof n === 'number' ? n : 0;
  return v.toLocaleString();
}

function Card({ label, ok, extra }: { label: string; ok: boolean; extra?: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 flex items-center justify-between">
        <Status ok={ok} />
        {extra !== undefined && <div className="text-sm">{extra}</div>}
      </div>
    </div>
  );
}

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${ok ? 'text-green-300' : 'text-rose-300'}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-green-400' : 'bg-rose-400'}`} />
      {ok ? 'OK' : 'Issue'}
    </span>
  );
}
