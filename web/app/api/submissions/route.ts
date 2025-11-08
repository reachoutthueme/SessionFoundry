import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  getParticipantInSession,
  getSessionStatus,
  userOwnsSession,
  getUserFromRequest,
} from "@/app/api/_util/auth";
import { getServerHooks } from "@/lib/activities/server";
import { SubmissionCreate } from "@/contracts";
import { rateLimit } from "@/server/rateLimit";

/** Minimal cookie reader that avoids next/headers types entirely */
function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") || "";
  if (!header) return undefined;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return undefined;
}

// GET supports activity_id or resolves latest Active/Voting brainstorm/assignment by session_id
export async function GET(req: Request) {
  const url = new URL(req.url);
  const activityId = url.searchParams.get("activity_id");
  const sessionId = url.searchParams.get("session_id");
  const groupOnly = url.searchParams.get("group_only") === "1";

  let resolvedActivity: string | null = activityId;
  if (!resolvedActivity && sessionId) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", sessionId)
      .in("type", ["brainstorm", "assignment"] as any)
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    resolvedActivity = acts?.[0]?.id ?? null;
  }

  if (!resolvedActivity) return NextResponse.json({ submissions: [] });

  // Determine session id (needed for auth decisions)
  let sid = sessionId || "";
  if (!sid) {
    const { data: act0 } = await supabaseAdmin
      .from("activities")
      .select("session_id")
      .eq("id", resolvedActivity)
      .maybeSingle();
    sid = (act0 as any)?.session_id || "";
  }

  // Authorization: facilitator owner OR participant of this session
  let facilitatorCanViewAll = false;
  let participant: Awaited<ReturnType<typeof getParticipantInSession>> | null = null;
  {
    const user = await getUserFromRequest(req).catch(() => null);
    if (user && sid) {
      facilitatorCanViewAll = await userOwnsSession(user.id, sid);
    }
  }
  if (!facilitatorCanViewAll) {
    participant = await getParticipantInSession(req, sid);
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Try to select with group_id and participant_id if present; fall back otherwise
  let rows: any[] = [];
  {
    const r1 = await supabaseAdmin
      .from("submissions")
      .select("id,text,created_at,participant_id,group_id")
      .eq("activity_id", resolvedActivity)
      .order("created_at", { ascending: true });
    if (r1.error) {
      const r2 = await supabaseAdmin
        .from("submissions")
        .select("id,text,created_at,participant_id")
        .eq("activity_id", resolvedActivity)
        .order("created_at", { ascending: true });
      if (r2.error)
        return NextResponse.json({ error: r2.error.message }, { status: 500 });
      rows = r2.data as any[];
    } else {
      rows = r1.data as any[];
    }
  }

  // Determine current activity status for filtering rules
  let activityStatus: string | null = null;
  {
    const { data: a0 } = await supabaseAdmin
      .from("activities")
      .select("status")
      .eq("id", resolvedActivity)
      .maybeSingle();
    activityStatus = (a0 as any)?.status ?? null;
  }

  if (
    groupOnly ||
    (!facilitatorCanViewAll && !(participant && activityStatus === "Voting"))
  ) {
    // Find this participant's group via cookie
    const pid = sid ? getCookie(req, `sf_pid_${sid}`) : undefined;
    let currentGroup: string | null = null;
    if (pid) {
      const { data: p } = await supabaseAdmin
        .from("participants")
        .select("group_id")
        .eq("id", pid)
        .maybeSingle();
      currentGroup = (p as any)?.group_id || null;
    }
    if (currentGroup) {
      const hasGroupId =
        rows.length > 0 &&
        Object.prototype.hasOwnProperty.call(rows[0], "group_id");
      if (hasGroupId) {
        rows = rows.filter((r) => (r as any).group_id === currentGroup);
      } else {
        // Filter by participant_id belonging to this group
        const { data: ps } = await supabaseAdmin
          .from("participants")
          .select("id")
          .eq("session_id", sid)
          .eq("group_id", currentGroup);
        const allowed = new Set((ps || []).map((x) => String((x as any).id)));
        rows = rows.filter((r) =>
          allowed.has(String(((r as any).participant_id as string) || ""))
        );
      }
    } else {
      // If we cannot resolve group, show only this participant's own items (best effort)
      const pidSelf = sid ? getCookie(req, `sf_pid_${sid}`) : undefined;
      if (pidSelf)
        rows = rows.filter(
          (r) => String(((r as any).participant_id as string) || "") === pidSelf
        );
    }
  }

  return NextResponse.json({ submissions: rows });
}

// POST accepts activity_id, or session_id (resolves latest Active/Voting brainstorm activity)
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = SubmissionCreate.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  let { text, activity_id, session_id } = parsed.data as { text: string; activity_id?: string; session_id?: string };
  activity_id = activity_id || "";
  session_id = session_id || "";

  if (!activity_id && session_id) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", session_id)
      .eq("type", "brainstorm")
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    activity_id = acts?.[0]?.id ?? "";
  }
  if (!activity_id)
    return NextResponse.json(
      { error: "activity_id or session_id required" },
      { status: 400 }
    );

  // Resolve session_id from activity if not provided
  if (!session_id) {
    const { data: act0 } = await supabaseAdmin
      .from("activities")
      .select("session_id")
      .eq("id", activity_id)
      .maybeSingle();
    session_id = (act0 as any)?.session_id || session_id;
  }

  // participant + group from cookie (required)
  const participant = await getParticipantInSession(req, session_id || "");
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const participant_id = participant.id;
  const group_id: string | null = participant.group_id ?? null;

  // Gentle submission rate-limit per participant
  const rl = rateLimit(`submission:create:${participant_id}`, { limit: 120, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many submissions, please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
  }

  // ensure session is Active for writing
  const sStatus = await getSessionStatus(session_id || "");
  if (sStatus !== "Active")
    return NextResponse.json(
      { error: "Session not accepting submissions" },
      { status: 403 }
    );

  // Activity type-specific submission handling via server hooks
  const metaRes = await supabaseAdmin
    .from("activities")
    .select("type,status")
    .eq("id", activity_id)
    .maybeSingle();
  const type = (metaRes.data as any)?.type as string | undefined;
  const aStatus = (metaRes.data as any)?.status as string | undefined;
  if (!type || (type !== "brainstorm" && type !== "assignment")) {
    return NextResponse.json(
      { error: "This activity does not accept text submissions" },
      { status: 400 }
    );
  }
  if (aStatus !== "Active") {
    return NextResponse.json({ error: "Activity not active" }, { status: 403 });
  }
  const hooks = getServerHooks(type);
  if (!hooks || !hooks.saveSubmission || !hooks.canSubmit) {
    return NextResponse.json(
      { error: "Submissions not supported" },
      { status: 400 }
    );
  }
  const gate = await hooks.canSubmit({
    session_id,
    activity_id,
    participant_id,
    group_id,
  });
  if (!gate.ok)
    return NextResponse.json(
      { error: gate.error || "Not allowed" },
      { status: 400 }
    );
  const saved = await hooks.saveSubmission({
    activity_id,
    text,
    participant_id,
    group_id,
  });
  if ("error" in saved)
    return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ submission: saved.submission }, { status: 201 });
}
