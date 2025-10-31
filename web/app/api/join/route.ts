import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw = (body?.join_code ?? "").toString();
  const join_code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  const display_name = (body?.display_name ?? "").toString().trim() || null;
  if (!join_code) return NextResponse.json({ error: "join_code required" }, { status: 400 });

  // Temporary throttle via cookies: 5 invalid attempts within 3 minutes => 5 minute cool-down
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 3 * 60 * 1000;
  const BLOCK_MS = 5 * 60 * 1000;
  const cookieStore = await cookies();
  const now = Date.now();
  const blockUntil = Number(cookieStore.get("sf_join_block_until")?.value || 0) || 0;
  if (blockUntil && now < blockUntil) {
    const res = NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    res.cookies.set("sf_join_block_until", String(blockUntil), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(1, Math.floor((blockUntil - now) / 1000)),
    });
    return res;
  }

  const { data: ses, error: se } = await supabaseAdmin
    .from("sessions")
    .select("id, name, status, join_code")
    .eq("join_code", join_code)
    .single();
  if (se || !ses) {
    // Count failed attempt in cookie
    let attempts: number[] = [];
    try {
      attempts = (cookieStore.get("sf_join_failures")?.value || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch { attempts = []; }
    const cutoff = now - WINDOW_MS;
    attempts = attempts.filter((t) => t >= cutoff);
    attempts.push(now);

    if (attempts.length >= MAX_ATTEMPTS) {
      const until = now + BLOCK_MS;
      const res = NextResponse.json({ error: "Invalid join code" }, { status: 404 });
      res.cookies.set("sf_join_block_until", String(until), { httpOnly: true, sameSite: "lax", path: "/", maxAge: Math.ceil(BLOCK_MS / 1000) });
      res.cookies.set("sf_join_failures", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
      return res;
    } else {
      const res = NextResponse.json({ error: "Invalid join code" }, { status: 404 });
      res.cookies.set("sf_join_failures", attempts.join(","), { httpOnly: true, sameSite: "lax", path: "/", maxAge: Math.ceil(WINDOW_MS / 1000) });
      return res;
    }
  }
  if ((ses as any).status === 'Completed') {
    return NextResponse.json({ error: "Session is closed" }, { status: 403 });
  }

  const { data: part, error: pe } = await supabaseAdmin
    .from("participants")
    .insert({ session_id: ses.id, display_name })
    .select("id, session_id, display_name, group_id")
    .single();
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const res = NextResponse.json({ session: ses, participant: part });
  // Set a per-session participant cookie (scoped to path /)
  res.cookies.set(`sf_pid_${ses.id}`, part.id, { httpOnly: true, sameSite: "lax", path: "/" });
  // Clear throttle cookies on success
  res.cookies.set("sf_join_failures", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set("sf_join_block_until", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
