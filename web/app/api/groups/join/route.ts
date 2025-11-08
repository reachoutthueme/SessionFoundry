import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";
import { rateLimit } from "@/server/rateLimit";

const BodySchema = z.object({
  session_id: z.string().min(1, "session_id required"),
  group_id: z.string().min(1, "group_id required"),
}).strict();

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  try {
    // CSRF: same-origin + double-submit header check
    const url = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";
    const base = `${url.protocol}//${url.host}`;
    const sameOrigin = origin === base || (referer && referer.startsWith(base));
    if (!sameOrigin) {
      return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }
    const csrfHeader = req.headers.get("x-csrf") || "";
    const cookieHeader = req.headers.get("cookie") || "";
    const csrfCookie = (() => {
      const parts = cookieHeader.split(";").map((p) => p.trim());
      for (const p of parts) {
        if (p.startsWith("sf_csrf=")) return decodeURIComponent(p.slice("sf_csrf=".length));
      }
      return "";
    })();
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return noStore(NextResponse.json({ error: "CSRF mismatch" }, { status: 403 }));
    }
    // Content type guard
    if (!req.headers.get("content-type")?.includes("application/json")) {
      return noStore(NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 }));
    }

    // Parse & validate
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message ?? "Invalid request";
      return noStore(NextResponse.json({ error: msg }, { status: 400 }));
    }
    const { session_id, group_id } = parsed.data;

    // Participant must be from the same session (derived from cookie)
    const participant = await getParticipantInSession(req, session_id);
    if (!participant) {
      return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }

    // Revalidate participant row
    const { data: part, error: pe } = await supabaseAdmin
      .from("participants")
      .select("id, session_id, display_name, group_id")
      .eq("id", participant.id)
      .maybeSingle();

    if (pe) {
      console.error("participants fetch error", pe);
      return noStore(NextResponse.json({ error: "Failed to fetch participant" }, { status: 500 }));
    }
    if (!part || part.session_id !== session_id) {
      return noStore(NextResponse.json({ error: "participant/session mismatch" }, { status: 400 }));
    }

    // Session must be Active (or adjust to allow 'Draft' if you want pre-assignment)
    const sStatus = await getSessionStatus(session_id);
    if (sStatus !== "Active") {
      return noStore(NextResponse.json({ error: "Session not accepting group changes" }, { status: 409 }));
    }

    // Ensure group exists AND belongs to this session
    const { data: grp, error: ge } = await supabaseAdmin
      .from("groups")
      .select("id, session_id")
      .eq("id", group_id)
      .maybeSingle();

    if (ge) {
      console.error("groups fetch error", ge);
      return noStore(NextResponse.json({ error: "Failed to validate group" }, { status: 500 }));
    }
    if (!grp || grp.session_id !== session_id) {
      return noStore(NextResponse.json({ error: "Invalid group for this session" }, { status: 400 }));
    }

    // Optional: rate limit group switching to prevent spam
    const rl = rateLimit(`group:join:${participant.id}`, { limit: 60, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return noStore(NextResponse.json({ error: "Too many changes" }, { status: 429 }));
    }

    // Update participant -> group
    const { data, error } = await supabaseAdmin
      .from("participants")
      .update({ group_id })
      .eq("id", participant.id)
      .select("id, session_id, display_name, group_id")
      .single();

    if (error) {
      console.error("participants update error", error);
      return noStore(NextResponse.json({ error: "Failed to update participant" }, { status: 500 }));
    }

    return noStore(NextResponse.json({ participant: data }, { status: 200 }));
  } catch (e) {
    console.error("POST /participants/group unhandled", e);
    return noStore(NextResponse.json({ error: "Server error" }, { status: 500 }));
  }
}
