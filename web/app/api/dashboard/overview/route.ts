import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ sessions: [], stats: { participants: 0, brainstorm: 0, stocktake: 0 } });

  const { data: sessions, error: se } = await supabaseAdmin
    .from('sessions')
    .select('id,name,status,join_code,created_at')
    .eq('facilitator_user_id', user.id)
    .order('created_at', { ascending: false });
  if (se) return NextResponse.json({ error: se.message }, { status: 500 });

  const sessionIds = (sessions ?? []).map(s => (s as any).id as string);
  let participants = 0, brainstorm = 0, stocktake = 0;

  if (sessionIds.length) {
    const [partsRes, actsRes] = await Promise.all([
      supabaseAdmin.from('participants').select('id,session_id').in('session_id', sessionIds),
      supabaseAdmin.from('activities').select('id,session_id,type').in('session_id', sessionIds),
    ]);
    if (!partsRes.error) participants = (partsRes.data || []).length;
    if (!actsRes.error) {
      const acts = actsRes.data || [];
      brainstorm = acts.filter((a: any)=> a.type === 'brainstorm').length;
      stocktake = acts.filter((a: any)=> a.type === 'stocktake').length;
    }
  }

  const res = NextResponse.json({ sessions: sessions ?? [], stats: { participants, brainstorm, stocktake } });
  res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=30');
  return res;
}

