import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await ctx.params;

  // Aggregate votes per submission (avg/stdev/count) and join submission text
  const { data, error } = await supabaseAdmin
    .rpc("sf_results_for_session", { p_session_id: sessionId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}
