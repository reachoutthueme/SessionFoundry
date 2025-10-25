import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw = (body?.join_code ?? "").toString();
  const join_code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  const display_name = (body?.display_name ?? "").toString().trim() || null;
  if (!join_code) return NextResponse.json({ error: "join_code required" }, { status: 400 });

  const { data: ses, error: se } = await supabaseAdmin
    .from("sessions")
    .select("id, name, status, join_code")
    .eq("join_code", join_code)
    .single();
  if (se || !ses) return NextResponse.json({ error: "Invalid join code" }, { status: 404 });

  const { data: part, error: pe } = await supabaseAdmin
    .from("participants")
    .insert({ session_id: ses.id, display_name })
    .select("id, session_id, display_name, group_id")
    .single();
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const res = NextResponse.json({ session: ses, participant: part });
  // Set a per-session participant cookie (scoped to path /)
  res.cookies.set(`sf_pid_${ses.id}`, part.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
