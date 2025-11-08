import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export type AuditInput = {
  actor_user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  user_agent?: string | null;
};

export async function writeAudit(entry: AuditInput): Promise<void> {
  try {
    const row = {
      actor_user_id: entry.actor_user_id || null,
      action: String(entry.action || "").slice(0, 200),
      entity_type: entry.entity_type ? String(entry.entity_type).slice(0, 100) : null,
      entity_id: entry.entity_id ? String(entry.entity_id).slice(0, 200) : null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ? String(entry.ip).slice(0, 100) : null,
      user_agent: entry.user_agent ? String(entry.user_agent).slice(0, 300) : null,
    } as any;
    await supabaseAdmin.from("audit_log").insert(row);
  } catch {
    // best effort; don't crash callers
  }
}

