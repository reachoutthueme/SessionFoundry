import "server-only";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export type AdminSessionRow = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  facilitator_user_id: string | null;
  created_at: string;
};

export async function searchAdminSessions(params: { status?: string; owner?: string; from?: string; to?: string; limit?: number; }): Promise<{ sessions: AdminSessionRow[] }>
{
  if (!isSupabaseAdminConfigured()) return { sessions: [] };
  const { status = "", owner = "", from, to, limit = 50 } = params || {};

  let q = supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,facilitator_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));

  if (status) q = q.eq("status", status);
  if (owner) q = q.eq("facilitator_user_id", owner);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error } = await q;
  if (error) return { sessions: [] };
  return { sessions: rows || [] };
}

