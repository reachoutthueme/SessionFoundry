// app/api/activities/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  getUserFromRequest,
  userOwnsSession,
  getParticipantInSession,
} from "@/app/api/_util/auth";
import { validateConfig } from "@/lib/activities/schemas";
import { ActivityCreate } from "@/contracts";

// ---------- Schemas ----------
const GetQuerySchema = z.object({
  session_id: z.string().min(1, "session_id required"),
  limit: z
    .string()
    .optional()
    .transform(v => (v ? Math.min(Math.max(parseInt(v, 10) || 0, 1), 500) : undefined)),
  offset: z
    .string()
    .optional()
    .transform(v => (v ? Math.max(parseInt(v, 10) || 0, 0) : undefined)),
}).strict();

// POST body contract is shared via @/contracts

// ---------- GET: list activities ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parse = GetQuerySchema.safeParse({
    session_id: url.searchParams.get("session_id") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parse.success) {
    return NextResponse.json(
      { error: parse.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { session_id, limit, offset } = parse.data;

  // Allow either facilitator-owner OR a participant (via session-bound cookie)
  let allowed = false;
  const user = await getUserFromRequest(req);
  if (user) {
    allowed = await userOwnsSession(user.id, session_id);
  }
  if (!allowed) {
    const participant = await getParticipantInSession(req as any, session_id);
    allowed = !!participant; // participant in session can list activities
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build base query
  let q = supabaseAdmin
    .from("activities")
    .select(
      "id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at"
    )
    .eq("session_id", session_id)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (typeof limit === "number") q = q.limit(limit);
  if (typeof offset === "number") q = q.range(offset, offset + (limit ?? 50) - 1);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ activities: data ?? [] });
  // private caching for brief client reuse + SWR on client if desired
  res.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
  return res;
}

// ---------- POST: create activity ----------
export async function POST(req: Request) {
  // Parse & validate
  const raw = await req.json().catch(() => ({}));
  const parsed = ActivityCreate.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 }
    );
  }
  const { session_id, type, title, instructions, description, config, order_index } = parsed.data;

  // Auth
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const owns = await userOwnsSession(user.id, session_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Validate type-specific config
  const v = validateConfig(type, config ?? {});
  if (!v.ok) return NextResponse.json({ error: v.error || "Invalid config" }, { status: 400 });

  // Determine order_index (if not provided, place at end)
  let finalOrder = order_index ?? 0;
  if (order_index == null) {
    const { data: maxRow, error: maxErr } = await supabaseAdmin
      .from("activities")
      .select("order_index")
      .eq("session_id", session_id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!maxErr && maxRow && typeof (maxRow as any).order_index === "number") {
      finalOrder = (maxRow as any).order_index + 1;
    } else {
      finalOrder = 0;
    }
    // Note: to eliminate race conditions, add a UNIQUE constraint on (session_id, order_index)
    // and retry on conflict, or use a server-side RPC that selects+inserts atomically.
  }

  const toInsert = {
    session_id,
    type,
    title,
    instructions,
    description,
    config: v.value,
    order_index: finalOrder,
    status: "Draft" as const, // default on create
  };

  const { data, error } = await supabaseAdmin
    .from("activities")
    .insert(toInsert)
    .select(
      "id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ activity: data }, { status: 201 });
}
