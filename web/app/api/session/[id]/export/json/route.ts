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

  const [sessionRes, actsRes, partsRes] = await Promise.all([
    supabaseAdmin.from('sessions').select('id,name,status,join_code,created_at').eq('id', session_id).maybeSingle(),
    supabaseAdmin.from('activities').select('id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at').eq('session_id', session_id).order('order_index', { ascending: true }),
    supabaseAdmin.from('participants').select('id,display_name').eq('session_id', session_id),
  ]);
  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 500 });
  if (actsRes.error) return NextResponse.json({ error: actsRes.error.message }, { status: 500 });
  if (partsRes.error) return NextResponse.json({ error: partsRes.error.message }, { status: 500 });

  const actIds = (actsRes.data ?? []).map(a => (a as any).id as string);
  const [subsRes, votesRes] = await Promise.all([
    actIds.length ? supabaseAdmin.from('submissions').select('id,activity_id,text,participant_id,created_at').in('activity_id', actIds) : Promise.resolve({ data: [], error: null } as any),
    actIds.length ? supabaseAdmin.from('votes').select('id,activity_id,submission_id,voter_id,value,created_at').in('activity_id', actIds) : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (subsRes.error) return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  if (votesRes.error) return NextResponse.json({ error: votesRes.error.message }, { status: 500 });

  const payload = {
    session: sessionRes.data,
    activities: actsRes.data ?? [],
    participants: partsRes.data ?? [],
    submissions: subsRes.data ?? [],
    votes: votesRes.data ?? [],
    exported_at: new Date().toISOString(),
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="session_${session_id}.json"`,
    },
  });
}
