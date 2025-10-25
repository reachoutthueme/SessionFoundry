import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ sessions: [] });
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at")
    .eq("facilitator_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Free plan: limit to 1 session
  if (user.plan !== "pro") {
    const { count, error: ce } = await supabaseAdmin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("facilitator_user_id", user.id);
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "Free plan allows 1 session. Upgrade to Pro for unlimited." }, { status: 402 });
    }
  }

  // Generate a simple, easy join code: 4 characters from a readable set (no 0/O/1/I/L)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function code(n = 4) {
    let s = "";
    for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  let data: any = null;
  let error: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const join = code(4);
    const res = await supabaseAdmin
      .from("sessions")
      .insert({ name, status: "Inactive", join_code: join, facilitator_user_id: user.id })
      .select()
      .single();
    data = res.data; error = res.error;
    if (!error) break;
    const msg = (error?.message || "").toLowerCase();
    if (!(msg.includes("duplicate") || msg.includes("unique"))) break;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data }, { status: 201 });
}
