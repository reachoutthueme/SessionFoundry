import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { canExportSession } from "@/server/policies";
import { rateLimit } from "@/server/rateLimit";
import { sanitizeForFilename, maskJoinCode } from "@/server/exports/deckBuilder";

type SessionRow = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  created_at: string;
  facilitator_user_id?: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: session_id } = await params;

  // AuthZ + plan
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const can = await canExportSession(user, session_id);
  if (!can) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rl = rateLimit(`export:json:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many export requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) },
    });
  }

  // Load session (without exposing facilitator id)
  const { data: sess, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at")
    .eq("id", session_id)
    .maybeSingle<Pick<SessionRow, "id" | "name" | "status" | "join_code" | "created_at">>();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch related data in parallel
  const [actsRes, partsRes] = await Promise.all([
    supabaseAdmin
      .from("activities")
      .select(
        "id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at"
      )
      .eq("session_id", session_id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("participants")
      .select("id,display_name")
      .eq("session_id", session_id),
  ]);

  if (actsRes.error) return NextResponse.json({ error: actsRes.error.message }, { status: 500 });
  if (partsRes.error) return NextResponse.json({ error: partsRes.error.message }, { status: 500 });

  const actIds = (actsRes.data ?? []).map((a: any) => a.id as string);

  const [subsRes, votesRes] = await Promise.all([
    actIds.length
      ? supabaseAdmin
          .from("submissions")
          .select("id,activity_id,text,participant_id,created_at")
          .in("activity_id", actIds)
      : Promise.resolve({ data: [], error: null } as any),
    actIds.length
      ? supabaseAdmin
          .from("votes")
          .select("id,activity_id,submission_id,voter_id,value,created_at")
          .in("activity_id", actIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (subsRes.error) return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  if (votesRes.error) return NextResponse.json({ error: votesRes.error.message }, { status: 500 });

  // Optionally mask join code before export
  const maskedSession = {
    ...sess,
    join_code: maskJoinCode(sess.join_code),
  };

  const payload = {
    session: maskedSession,
    activities: actsRes.data ?? [],
    participants: partsRes.data ?? [],
    submissions: subsRes.data ?? [],
    votes: votesRes.data ?? [],
    exported_at: new Date().toISOString(),
  };

  const filename = `session_${sanitizeForFilename(sess.name || "session")}_${sanitizeForFilename(sess.id)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// helpers imported from deckBuilder
