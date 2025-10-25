import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ groups: [] });
  const { data, error } = await supabaseAdmin
    .from("groups")
    .select("id, name, session_id, created_at")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const session_id = (body?.session_id ?? "").toString();
  const name = (body?.name ?? "").toString().trim();
  if (!session_id || !name) return NextResponse.json({ error: "session_id and name required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("groups")
    .insert({ session_id, name })
    .select("id, name, session_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data }, { status: 201 });
}

