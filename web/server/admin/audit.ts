import "server-only";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export async function getAuditLogs(params: { actor?: string; entity_type?: string; entity_id?: string; action?: string; from?: string; to?: string; page?: number; per_page?: number; }): Promise<{ logs: AuditRow[]; count: number; page: number; per_page: number }>
{
  if (!isSupabaseAdminConfigured()) return { logs: [], count: 0, page: 1, per_page: 50 };
  const { actor = "", entity_type = "", entity_id = "", action = "", from, to, page = 1, per_page = 50 } = params || {};

  // Count
  let qc = supabaseAdmin
    .from("audit_log")
    .select("id", { count: "exact", head: true });

  if (actor) qc = qc.eq("actor_user_id", actor);
  if (entity_type) qc = qc.eq("entity_type", entity_type);
  if (entity_id) qc = qc.eq("entity_id", entity_id);
  if (action) qc = qc.eq("action", action);
  if (from) qc = qc.gte("created_at", from);
  if (to) qc = qc.lte("created_at", to);
  const { count = 0 } = await qc;

  // Rows
  const fromIdx = (page - 1) * per_page;
  const toIdx = fromIdx + per_page - 1;
  let q = supabaseAdmin
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (actor) q = q.eq("actor_user_id", actor);
  if (entity_type) q = q.eq("entity_type", entity_type);
  if (entity_id) q = q.eq("entity_id", entity_id);
  if (action) q = q.eq("action", action);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error } = await q;
  if (error) return { logs: [], count: 0, page, per_page };
  return { logs: rows || [], count, page, per_page };
}
