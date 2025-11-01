import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession, getParticipantInSession } from "@/app/api/_util/auth";
import { z } from "zod";

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
const BodySchema = z.object({
  session_id: z.string().min(1, "session_id required"),
  // Do all string constraints while itÃ¢â‚¬â„¢s still a ZodString, then normalize
  name: z
    .string()
    .trim()
    .min(1, "name required")
    .max(80, "name too long")
    .transform((s) => s.replace(/\s+/g, " ")),
});

export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.includes("application/json") !== true) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { session_id, name } = parsed.data;

    const user = await getUserFromRequest(req);
    if (user) {
      const owns = await userOwnsSession(user.id, session_id);
      if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else {
      const part = await getParticipantInSession(req as any, session_id);
      if (!part) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
