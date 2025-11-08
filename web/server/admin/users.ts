import "server-only";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  sessions_count?: number;
};

export async function listAdminUsers(q: string, page: number, perPage: number): Promise<{ users: AdminUserRow[]; count: number; page: number; per_page: number }>
{
  if (!isSupabaseAdminConfigured()) return { users: [], count: 0, page, per_page: perPage };

  const { data: list, error: le } = await (supabaseAdmin as any).auth.admin.listUsers({ page, perPage });
  if (le) return { users: [], count: 0, page, per_page: perPage };

  let users: any[] = Array.isArray(list?.users) ? list.users : [];
  if (q) {
    const qq = q.trim().toLowerCase();
    users = users.filter((u) => {
      const email = String(u.email || "").toLowerCase();
      const id = String(u.id || "").toLowerCase();
      return email.includes(qq) || id.includes(qq);
    });
  }

  const ids = users.map((u) => u.id).filter(Boolean);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: rows } = await supabaseAdmin
      .from("sessions")
      .select("facilitator_user_id, count:id")
      .in("facilitator_user_id", ids);
    counts = Object.fromEntries((rows || []).map((r: any) => [r.facilitator_user_id, Number(r.count || 0)]));
  }

  const results: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
    sessions_count: counts[u.id] || 0,
  }));

  return { users: results, count: results.length, page, per_page: perPage };
}

