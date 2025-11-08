import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

function noStore(res: NextResponse) { res.headers.set("Cache-Control", "no-store"); return res; }

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return noStore(NextResponse.json({ error: "Admin backend not configured" }, { status: 500 }));
  }
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  if (!isAdminUser({ id: data.user.id, email: data.user.email ?? null })) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

  const url = new URL(req.url);
  const actor = url.searchParams.get("actor") || "";
  const entity_type = url.searchParams.get("entity_type") || "";
  const entity_id = url.searchParams.get("entity_id") || "";
  const action = url.searchParams.get("action") || "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  let q = supabaseAdmin
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (actor) q = q.eq("actor_user_id", actor);
  if (entity_type) q = q.eq("entity_type", entity_type);
  if (entity_id) q = q.eq("entity_id", entity_id);
  if (action) q = q.eq("action", action);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error: qe } = await q;
  if (qe) return noStore(NextResponse.json({ error: qe.message }, { status: 500 }));
  return noStore(NextResponse.json({ logs: rows || [] }));
}
