import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";
import { getServerHooks } from "@/lib/activities/server";

// The only valid stocktake choices
const ALLOWED_CHOICES = ["stop", "less", "same", "more", "begin"] as const;
type StocktakeChoice = typeof ALLOWED_CHOICES[number];

// Schemas
const getQuerySchema = z.object({
  activity_id: z.string().min(1, "activity_id required"),
  session_id: z.string().min(1, "session_id required"),
});

const postBodySchema = z.object({
  activity_id: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1)),
  session_id: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1)),
  initiative_id: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1)),
  choice: z
    .preprocess((v) => String(v ?? "").trim().toLowerCase(), z.enum(ALLOWED_CHOICES)),
});

// Re-usable helper to fetch & assert activity belongs to session and is Active
async function assertActiveActivityInSession(activity_id: string, session_id: string) {
  const { data: actRow, error: ae } = await supabaseAdmin
    .from("activities")
    .select("session_id,type,status")
    .eq("id", activity_id)
    .maybeSingle();

  if (ae) {
    return { error: NextResponse.json({ error: ae.message }, { status: 500 }) };
  }
  if (!actRow || (actRow as any).session_id !== session_id) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if ((actRow as any).status !== "Active") {
    return { error: NextResponse.json({ error: "Activity not active" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = getQuerySchema.safeParse({
      activity_id: url.searchParams.get("activity_id") ?? "",
      session_id: url.searchParams.get("session_id") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }

    const { activity_id, session_id } = parsed.data;

    // Require participant cookie (no body override)
    const participant = await getParticipantInSession(req, session_id);
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure this activity belongs to the session and is Active
    const actCheck = await assertActiveActivityInSession(activity_id, session_id);
    if ("error" in actCheck) return actCheck.error;

    // Return any existing responses by this participant for this activity
    const { data, error } = await supabaseAdmin
      .from("stocktake_responses")
      .select("initiative_id,choice")
      .eq("activity_id", activity_id)
      .eq("participant_id", participant.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const res = NextResponse.json({ responses: data ?? [] });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let json: unknown = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const { activity_id, session_id, initiative_id, choice } = parsed.data;

    // Require participant cookie (no body override)
    const participant = await getParticipantInSession(req, session_id);
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Session must be Active
    const sStatus = await getSessionStatus(session_id);
    if (sStatus !== "Active") {
      return NextResponse.json(
        { error: "Session not accepting responses" },
        { status: 403 }
      );
    }

    // Ensure target activity belongs to this session and is Active
    const actCheck = await assertActiveActivityInSession(activity_id, session_id);
    if ("error" in actCheck) return actCheck.error;

    // Delegate to activity hook (recommended to upsert on unique (participant_id, activity_id, initiative_id))
    const hooks = getServerHooks("stocktake");
    if (!hooks || !hooks.saveResponse) {
      return NextResponse.json({ error: "Not supported" }, { status: 400 });
    }

    // Typesafe cast for choice
    const saved = await hooks.saveResponse({
      activity_id,
      initiative_id,
      choice: choice as StocktakeChoice,
      participant_id: participant.id,
    });

    if ("error" in saved) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    const res = NextResponse.json({ response: saved.response }, { status: 201 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}