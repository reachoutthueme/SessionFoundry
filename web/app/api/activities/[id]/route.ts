import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsActivity(user.id, id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  // Allow a controlled set of fields to be updated
  const updatable = [
    "title",
    "instructions",
    "description",
    "config",
    "order_index",
    "status",
    "starts_at",
    "ends_at",
  ] as const;

  const patch: Record<string, any> = {};
  for (const k of updatable) {
    if (k in body) patch[k] = body[k as keyof typeof body];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If activating an assignment activity, generate assignments to groups
  try {
    if (patch.status === 'Active') {
      const { data: act } = await supabaseAdmin
        .from('activities')
        .select('id,session_id,type,config')
        .eq('id', id)
        .maybeSingle();
      if (act && (act as any).type === 'assignment') {
        const cfg = { ...((act as any).config || {}), ...(patch.config || {}) } as any;
        const prompts: string[] = Array.isArray(cfg.prompts) ? cfg.prompts.filter((s:string)=> (s||'').trim().length>0) : [];
        if (prompts.length > 0) {
          const { data: groups } = await supabaseAdmin
            .from('groups')
            .select('id')
            .eq('session_id', (act as any).session_id);
          const assignments = { ...(cfg.assignments || {}) } as Record<string,string>;
          let i = 0;
          (groups||[]).forEach((g:any)=>{
            const gid = g.id as string; if (!gid) return;
            if (!assignments[gid]) { assignments[gid] = prompts[i % prompts.length]; i++; }
          });
          patch.config = { ...cfg, assignments };
        }
      }
    }
  } catch {}

  const { data, error } = await supabaseAdmin
    .from("activities")
    .update(patch)
    .eq("id", id)
    .select("id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}
