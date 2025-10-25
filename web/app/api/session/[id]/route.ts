import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at,facilitator_user_id")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const s: any = data || null;
  if (s) delete s.facilitator_user_id;
  return NextResponse.json({ session: s });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const patch: Record<string, any> = {};
  if (typeof body?.status === 'string') {
    const status = (body.status as string).trim();
    const allowed = new Set(["Inactive", "Active", "Completed"]);
    if (!allowed.has(status)) {
      return NextResponse.json({ error: "Invalid status. Use Inactive, Active, or Completed." }, { status: 400 });
    }
    patch.status = status;
  }
  if (typeof body?.name === 'string') {
    const name = (body.name as string).trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    patch.name = name;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const { data: sess, error: se0 } = await supabaseAdmin.from('sessions').select('id,facilitator_user_id').eq('id', id).maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select("id,name,status,join_code,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
