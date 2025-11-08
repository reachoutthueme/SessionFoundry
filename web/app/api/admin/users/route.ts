import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  // Admin auth via access token cookie
  if (!isSupabaseAdminConfigured()) {
    return noStore(NextResponse.json({ error: "Admin backend not configured" }, { status: 500 }));
  }
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  const admin = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(admin)) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || 20)));

  // List users via Supabase Admin API (paginated)
  const { data: list, error: le } = await (supabaseAdmin as any).auth.admin.listUsers({ page, perPage });
  if (le) return noStore(NextResponse.json({ error: le.message || "Failed to list users" }, { status: 500 }));

  let users: any[] = Array.isArray(list?.users) ? list.users : [];
  if (q) {
    users = users.filter((u) => {
      const email = String(u.email || "").toLowerCase();
      const id = String(u.id || "").toLowerCase();
      return email.includes(q) || id.includes(q);
    });
  }

  // Attach sessions count for users on this page (best-effort)
  const ids = users.map((u) => u.id).filter(Boolean);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: rows } = await supabaseAdmin
      .from("sessions")
      .select("facilitator_user_id, count:id")
      .in("facilitator_user_id", ids);
    counts = Object.fromEntries((rows || []).map((r: any) => [r.facilitator_user_id, Number(r.count || 0)]));
  }

  const results = users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    sessions_count: counts[u.id] || 0,
  }));

  return noStore(NextResponse.json({ page, per_page: perPage, count: results.length, users: results }));
}
