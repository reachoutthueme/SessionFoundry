import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activity_id = url.searchParams.get("activity_id");
  if (!activity_id) return NextResponse.json({ initiatives: [] });
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabaseAdmin
    .from("stocktake_initiatives")
    .select("id, title")
    .eq("activity_id", activity_id)
    .order("title", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ initiatives: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const activity_id = (body?.activity_id ?? "").toString();
  const title = (body?.title ?? "").toString().trim();
  if (!activity_id || !title) return NextResponse.json({ error: "activity_id and title required" }, { status: 400 });
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabaseAdmin
    .from("stocktake_initiatives")
    .insert({ activity_id, title })
    .select("id, title")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ initiative: data }, { status: 201 });
}
