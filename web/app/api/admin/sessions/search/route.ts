import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

function noStore(res: NextResponse) { res.headers.set("Cache-Control", "no-store"); return res; }

export async function GET(req: NextRequest) {
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  if (!isAdminUser({ id: data.user.id, email: data.user.email ?? null })) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || ""; // Draft/Active/Completed/Inactive
  const owner = url.searchParams.get("owner") || ""; // facilitator_user_id
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  let q = supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,facilitator_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (owner) q = q.eq("facilitator_user_id", owner);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data: rows, error: qe } = await q;
  if (qe) return noStore(NextResponse.json({ error: qe.message }, { status: 500 }));
  return noStore(NextResponse.json({ sessions: rows || [] }));
}

