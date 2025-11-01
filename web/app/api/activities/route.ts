import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession } from "@/app/api/_util/auth";
import { validateConfig } from "@/lib/activities/schemas";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ activities: [] });

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsSession(user.id, sessionId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const session_id = (body?.session_id ?? "").toString();
  const type = (body?.type ?? "").toString();
  const title = (body?.title ?? "").toString().trim();
  const instructions = (body?.instructions ?? "").toString();
  const description = (body?.description ?? "").toString();
  const config = body?.config ?? {};
  const order_index = Number.isFinite(body?.order_index) ? Number(body.order_index) : 0;

  if (!session_id || !title || (type !== "brainstorm" && type !== "stocktake" && type !== "assignment")) {
    return NextResponse.json({ error: "session_id, title, and valid type required" }, { status: 400 });
  }

  const cfg = body?.config ?? {};
  const v = validateConfig(type, cfg);
  if (!v.ok) return NextResponse.json({ error: v.error || "Invalid config" }, { status: 400 });

  const owns = await userOwnsSession(user.id, session_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dataToInsert: any = { session_id, type, title, instructions, description, config: v.value, order_index };
  const { data, error } = await supabaseAdmin
    .from("activities")
    .insert(dataToInsert)
    .select("id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data }, { status: 201 });
}
