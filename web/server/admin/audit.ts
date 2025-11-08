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

export async function getAuditLogs(params: { actor?: string; entity_type?: string; entity_id?: string; action?: string; from?: string; to?: string; limit?: number; }): Promise<{ logs: AuditRow[] }>
{
  if (!isSupabaseAdminConfigured()) return { logs: [] };
  const { actor = "", entity_type = "", entity_id = "", action = "", from, to, limit = 50 } = params || {};

  let q = supabaseAdmin
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));

  if (actor) q = q.eq("actor_user_id", actor);
  if (entity_type) q = q.eq("entity_type", entity_type);
  if (entity_id) q = q.eq("entity_id", entity_id);
  if (action) q = q.eq("action", action);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error } = await q;
  if (error) return { logs: [] };
  return { logs: rows || [] };
}

