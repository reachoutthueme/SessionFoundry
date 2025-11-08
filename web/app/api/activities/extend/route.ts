import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

const Body = z.object({
  activity_id: z.string().min(1, "activity_id required"),
  minutes: z.number().int().min(1).max(120),
});

function noStore<T>(payload: T, init?: number | ResponseInit) {
  const res = NextResponse.json(payload as any, init as any);
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

export async function POST(req: Request) {
  // Auth
  const user = await getUserFromRequest(req);
  if (!user) return noStore({ error: "Sign in required" }, { status: 401 });

  // Parse
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return noStore({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { activity_id, minutes } = parsed.data;

  // ACL
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) return noStore({ error: "Not found" }, { status: 404 });

  // Load current activity timestamps
  const { data: act, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id, starts_at, ends_at")
    .eq("id", activity_id)
    .maybeSingle();
  if (ae) return noStore({ error: ae.message }, { status: 500 });
  if (!act) return noStore({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const prevEnds = act.ends_at ? new Date(act.ends_at as any).getTime() : now;
  const base = Number.isFinite(prevEnds) ? Math.max(prevEnds, now) : now;
  const nextIso = new Date(base + minutes * 60_000).toISOString();
  const startsIso = act.starts_at || new Date().toISOString();

  // Update
  const { data: updated, error: ue } = await supabaseAdmin
    .from("activities")
    .update({ status: "Active", starts_at: startsIso, ends_at: nextIso })
    .eq("id", activity_id)
    .select("id, starts_at, ends_at, status")
    .single();
  if (ue) return noStore({ error: ue.message }, { status: 500 });

  return noStore({ ok: true, activity: updated }, { status: 200 });
}

