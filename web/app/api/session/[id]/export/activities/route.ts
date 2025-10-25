import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: session_id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== 'pro') return NextResponse.json({ error: "Pro plan required for exports" }, { status: 402 });
  const { data: sess, error: se0 } = await supabaseAdmin.from('sessions').select('id,facilitator_user_id').eq('id', session_id).maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: activities, error } = await supabaseAdmin
    .from("activities")
    .select("id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at")
    .eq("session_id", session_id)
    .order("order_index", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    "order_index",
    "type",
    "title",
    "status",
    "instructions",
    "description",
    "starts_at",
    "ends_at",
    "config_json",
  ];
  const rows = (activities ?? []).map(a => [
    (a as any).order_index ?? "",
    (a as any).type ?? "",
    csvEscape((a as any).title ?? ""),
    (a as any).status ?? "",
    csvEscape((a as any).instructions ?? ""),
    csvEscape((a as any).description ?? ""),
    (a as any).starts_at ?? "",
    (a as any).ends_at ?? "",
    csvEscape(JSON.stringify((a as any).config ?? {})),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activities_${session_id}.csv"`,
    },
  });
}

function csvEscape(v: string) {
  const needs = /[",\n]/.test(v);
  const s = v.replace(/"/g, '""');
  return needs ? `"${s}"` : s;
}
