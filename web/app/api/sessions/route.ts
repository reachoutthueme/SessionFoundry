import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

// --- small helpers ---
function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/[\u0000-\u001F\u007F]/g, ""); // strip control chars
  if (!t || t.length > 120) return null;
  return t;
}

function genJoinCode(len = 4): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  // Prefer crypto if available (Node 18+ has globalThis.crypto in Next.js route handlers)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const arr = new Uint32Array(len);
    globalThis.crypto.getRandomValues(arr);
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[arr[i] % alphabet.length];
    return s;
  }
  // Fallback (less ideal)
  let s = "";
  for (let i = 0; i < len; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ sessions: [] });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200); // 1..200
  const cursor = url.searchParams.get("cursor"); // ISO string of created_at to paginate

  let query = supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at")
    .eq("facilitator_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to signal next page

  if (cursor) {
    // get records created before the cursor (pagination)
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = data ?? [];
  const hasMore = list.length > limit;
  const items = hasMore ? list.slice(0, limit) : list;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  const res = NextResponse.json({ sessions: items, nextCursor });
  res.headers.set("Cache-Control", "private, max-age=10, s-maxage=0");
  return res;
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = sanitizeName(body?.name);
  if (!name) return NextResponse.json({ error: "Name required (max 120 chars)" }, { status: 400 });

  // Free plan: limit to 1 session
  if (user.plan !== "pro") {
    const { count, error: ce } = await supabaseAdmin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("facilitator_user_id", user.id);
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
    if ((count ?? 0) >= 1) {
      // Keep 402 if you rely on it client-side; otherwise consider 403.
      return NextResponse.json(
        { error: "Free plan allows 1 session. Upgrade to Pro for unlimited." },
        { status: 402 }
      );
    }
  }

  // Try a few times in case of join_code collision
  let created: any = null;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const join = genJoinCode(4);
    const res = await supabaseAdmin
      .from("sessions")
      .insert({
        name,
        status: "Inactive",
        join_code: join,
        facilitator_user_id: user.id,
      })
      .select("id,name,status,join_code,created_at")
      .single();

    if (!res.error) {
      created = res.data;
      lastErr = null;
      break;
    }
    lastErr = res.error;
    const msg = (res.error?.message || "").toLowerCase();
    // if it's not a uniqueness conflict, stop retrying
    if (!(msg.includes("duplicate") || msg.includes("unique"))) break;
  }

  // Optional: second plan-limit check to reduce race (best is DB constraint)
  if (!created && lastErr == null) {
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
  if (!created) {
    return NextResponse.json({ error: lastErr.message || "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ session: created }, { status: 201 });
}