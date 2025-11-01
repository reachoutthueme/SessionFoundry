import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

// Light schema without extra deps
const STATUS_SET = new Set(["Inactive", "Active", "Completed"]);
function normalizeStatus(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  // case-insensitive normalize to PascalCase
  const lower = trimmed.toLowerCase();
  if (lower === "inactive") return "Inactive";
  if (lower === "active") return "Active";
  if (lower === "completed") return "Completed";
  return null;
}
function validateName(n: unknown): string | null {
  if (typeof n !== "string") return null;
  const t = n.trim();
  if (!t) return null;
  if (t.length > 120) return null; // adjust as you like
  return t;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at,facilitator_user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const s: any = data || null;

  if (!s || s.facilitator_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // hide facilitator id
  delete s.facilitator_user_id;

  const res = NextResponse.json({ session: s });
  // small private cache can help when navigating
  res.headers.set("Cache-Control", "private, max-age=10, s-maxage=0");
  return res;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Verify ownership up front
  const { data: sess, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,facilitator_user_id")
    .eq("id", id)
    .maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as any));

  const patch: Record<string, any> = {};

  if ("status" in body) {
    const normalized = normalizeStatus(body.status);
    if (!normalized || !STATUS_SET.has(normalized)) {
      return NextResponse.json(
        { error: "Invalid status. Use Inactive, Active, or Completed." },
        { status: 400 }
      );
    }
    patch.status = normalized;
  }

  if ("name" in body) {
    const name = validateName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Invalid name (required, max 120 chars)" },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select("id,name,status,join_code,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ session: data });
}