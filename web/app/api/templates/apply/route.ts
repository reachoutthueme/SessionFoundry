import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { templates } from "../data";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== 'pro') return NextResponse.json({ error: "Pro plan required for templates" }, { status: 402 });
  const body = await req.json().catch(()=>({}));
  const template_id = (body?.template_id ?? '').toString();
  const session_id = (body?.session_id ?? '').toString();
  if (!template_id || !session_id) return NextResponse.json({ error: "template_id and session_id required" }, { status: 400 });

  // Ensure ownership of session
  const { data: sess, error: se0 } = await supabaseAdmin.from('sessions').select('id,facilitator_user_id').eq('id', session_id).maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const t = templates.find(x => x.id === template_id);
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Create activities in order
  let order = 0;
  const created: any[] = [];
  for (const a of t.activities) {
    const { data: act, error: ae } = await supabaseAdmin
      .from('activities')
      .insert({ session_id, type: a.type, title: a.title, instructions: a.instructions || '', description: a.description || '', config: a.config || {}, order_index: order++ })
      .select('id,type,title')
      .single();
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    created.push(act);
    if (a.type === 'stocktake' && Array.isArray(a.initiatives) && a.initiatives.length) {
      const rows = a.initiatives.map(title => ({ activity_id: (act as any).id as string, title }));
      const { error: ie } = await supabaseAdmin.from('stocktake_initiatives').insert(rows);
      if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, activities: created });
}
