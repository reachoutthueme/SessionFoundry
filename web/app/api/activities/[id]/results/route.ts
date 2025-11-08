import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";
import { rateLimit } from "@/server/rateLimit";
import { getActivityMeta, getServerHooks } from "@/lib/activities/server";

const IdSchema = z.string().min(1).max(128);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const parse = IdSchema.safeParse(id);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
  }
  const activity_id = parse.data;

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rl = rateLimit(`results:activity:${user.id}:${activity_id}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
  }

  const meta = await getActivityMeta(activity_id);
  if (!meta) {
    const res = NextResponse.json({ submissions: [] });
    res.headers.set("Cache-Control", "private, max-age=0, no-store");
    return res;
  }

  const hooks = getServerHooks(meta.type);
  if (!hooks || typeof hooks.aggregateResults !== "function") {
    const res = NextResponse.json({ submissions: [] });
    res.headers.set("Cache-Control", "private, max-age=0, no-store");
    return res;
  }

  try {
    const payload = await hooks.aggregateResults(activity_id, meta.session_id);

    // Build activity envelope and only add optional fields if they exist.
    const activity: Record<string, any> = {
      id: activity_id,
      session_id: meta.session_id,
      type: meta.type,
    };
    if ("status" in meta) activity.status = (meta as any).status ?? undefined;
    if ("title" in meta) activity.title = (meta as any).title ?? undefined;

    const res = NextResponse.json({ activity, ...payload });
    res.headers.set("Cache-Control", "private, max-age=0, no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load results" },
      { status: 500 }
    );
  }
}
