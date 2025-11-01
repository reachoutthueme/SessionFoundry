import { NextResponse } from "next/server";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";
import { getActivityMeta, getServerHooks } from "@/lib/activities/server";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activity_id } = await ctx.params;

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = await getActivityMeta(activity_id);
  if (!meta) return NextResponse.json({ submissions: [] });
  const hooks = getServerHooks(meta.type);
  if (!hooks) return NextResponse.json({ submissions: [] });
  try {
    const payload = await hooks.aggregateResults(activity_id, meta.session_id);
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load results' }, { status: 500 });
  }
}
