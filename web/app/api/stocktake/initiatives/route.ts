import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activity_id = url.searchParams.get("activity_id");
  if (!activity_id) return NextResponse.json({ initiatives: [] });
  const { data, error } = await supabaseAdmin
    .from("stocktake_initiatives")
    .select("id, title")
    .eq("activity_id", activity_id)
    .order("title", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ initiatives: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const activity_id = (body?.activity_id ?? "").toString();
  const title = (body?.title ?? "").toString().trim();
  if (!activity_id || !title) return NextResponse.json({ error: "activity_id and title required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("stocktake_initiatives")
    .insert({ activity_id, title })
    .select("id, title")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ initiative: data }, { status: 201 });
}

