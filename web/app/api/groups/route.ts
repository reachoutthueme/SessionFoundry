import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession, getParticipantInSession } from "@/app/api/_util/auth";
import { GroupCreate } from "@/contracts";
import { rateLimit } from "@/server/rateLimit";

/** GET /api/groups?session_id=...&limit=&cursor= */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get("session_id");
    if (!session_id) {
      return NextResponse.json({ groups: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const owns = await userOwnsSession(user.id, session_id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Optional: lightweight pagination (safe defaults)
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 50)));
    const cursor = url.searchParams.get("cursor"); // ISO string of created_at

    let q = supabaseAdmin
      .from("groups")
      .select("id, name, session_id, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (cursor) {
      q = q.gte("created_at", cursor);
    }

    const { data, error } = await q;
    if (error) {
      console.error("GET /groups error", { error });
      return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
    }

    const groups = data ?? [];
    const nextCursor =
      groups.length === limit ? groups[groups.length - 1]?.created_at ?? null : null;

    return NextResponse.json(
      { groups, nextCursor },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /groups unhandled", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/groups  { session_id, name } */
export async function POST(req: Request) {
  try {
    // CSRF: same-origin + double-submit header check
    const url = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";
    const base = `${url.protocol}//${url.host}`;
    const sameOrigin = origin === base || (referer && referer.startsWith(base));
    if (!sameOrigin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: "CSRF mismatch" }, { status: 403 });
    }
    if (req.headers.get("content-type")?.includes("application/json") !== true) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = GroupCreate.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { session_id, name } = parsed.data;

    // Allow either facilitator-owner OR a participant in the session
    const user = await getUserFromRequest(req);
    let allowed = false;
    let limiterKey = "";
    if (user) {
      allowed = await userOwnsSession(user.id, session_id);
      if (allowed) limiterKey = `group:create:user:${user.id}`;
    }
    if (!allowed) {
      const participant = await getParticipantInSession(req as any, session_id);
      if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      allowed = true;
      limiterKey = `group:create:participant:${participant.id}`;
    }

    // Basic rate limit to prevent abuse
    const rl = rateLimit(limiterKey, { limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many group creations. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("groups")
      .insert({ session_id, name })
      .select("id, name, session_id, created_at")
      .single();

    if (error) {
      // Friendly duplicate handling if you add a unique constraint on (session_id, lower(name))
      // Postgres duplication code: 23505
      if ((error as any)?.code === "23505") {
        return NextResponse.json({ error: "A group with that name already exists" }, { status: 409 });
      }
      console.error("POST /groups insert error", { error });
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    const res = NextResponse.json({ group: data }, { status: 201 });
    res.headers.set("Location", `/api/groups/${data.id}`);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("POST /groups unhandled", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
