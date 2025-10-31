import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  // find activity for this initiative
  const { data: initRow, error: ie } = await supabaseAdmin
    .from('stocktake_initiatives')
    .select('activity_id')
    .eq('id', id)
    .maybeSingle();
  if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
  const activity_id = (initRow as any)?.activity_id as string | undefined;
  if (!activity_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabaseAdmin.from("stocktake_initiatives").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
