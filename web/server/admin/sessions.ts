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

export async function searchAdminSessions(params: { status?: string; owner?: string; from?: string; to?: string; page?: number; per_page?: number; }): Promise<{ sessions: AdminSessionRow[]; count: number; page: number; per_page: number }>
{
  if (!isSupabaseAdminConfigured()) return { sessions: [], count: 0, page: 1, per_page: 50 };
  const { status = "", owner = "", from, to, page = 1, per_page = 50 } = params || {};

  // Count total first
  let qc = supabaseAdmin
    .from("sessions")
    .select("id", { count: "exact", head: true });

  if (status) qc = qc.eq("status", status);
  if (owner) qc = qc.eq("facilitator_user_id", owner);
  if (from) qc = qc.gte("created_at", from);
  if (to) qc = qc.lte("created_at", to);
  const qcRes = await qc;
  const count = Number(qcRes.count ?? 0);

  // Fetch current page
  const fromIdx = (page - 1) * per_page;
  const toIdx = fromIdx + per_page - 1;
  let q = supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,facilitator_user_id,created_at")
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (status) q = q.eq("status", status);
  if (owner) q = q.eq("facilitator_user_id", owner);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error } = await q;
  if (error) return { sessions: [], count: 0, page, per_page };
  return { sessions: rows || [], count: Number(count || 0), page, per_page };
}
