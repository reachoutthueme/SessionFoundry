import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession } from "@/app/api/_util/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsSession(user.id, sessionId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Aggregate votes per submission (avg/stdev/count) and join submission text
  const { data, error } = await supabaseAdmin
    .rpc("sf_results_for_session", { p_session_id: sessionId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}
