import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Server-side auth: verify current user via access token cookie
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) redirect("/login?redirect=/admin");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) redirect("/login?redirect=/admin");

  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) redirect("/");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <p className="text-sm text-[var(--muted)]">Only visible to admins.</p>
      <div className="rounded-md border border-white/10 bg-white/5 p-4">
        <div className="text-sm">User: {user.email || user.id}</div>
        <div className="text-sm">Welcome to the admin area.</div>
      </div>
    </div>
  );
}

