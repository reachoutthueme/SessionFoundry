import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  // ---- CSRF: same-origin guard ----
  const url = new URL(req.url);
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const base = `${url.protocol}//${url.host}`;
  const sameOrigin = origin === base || (referer && referer.startsWith(base));
  if (!sameOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---- Parse & normalize input ----
  const body: any = await req.json().catch(() => ({}));
  const rawJoin = String(body?.join_code ?? "");
  const join_code = rawJoin.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();

  const rawName = String(body?.display_name ?? "").trim();
  const display_name =
    rawName.length > 0 ? (rawName.length <= 64 ? rawName : rawName.slice(0, 64)) : null;

  if (!join_code) {
    return NextResponse.json({ error: "join_code required" }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === "production";
  const getCookieVal = (name: string): string => req.cookies.get(name)?.value ?? "";

  // ---- Cookie-based throttling ----
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 3 * 60 * 1000;
  const BLOCK_MS = 5 * 60 * 1000;
  const now = Date.now();

  const blockUntil = Number(getCookieVal("sf_join_block_until") || 0) || 0;
  if (blockUntil && now < blockUntil) {
    const res = NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
    res.cookies.set("sf_join_block_until", String(blockUntil), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: Math.max(1, Math.floor((blockUntil - now) / 1000)),
    });
    return res;
  }

  // ---- Lookup session by join_code ----
  const { data: sessionRow, error: sesErr } = await supabaseAdmin
    .from("sessions")
    .select("id, name, status, join_code")
    .eq("join_code", join_code)
    .maybeSingle();

  if (sesErr || !sessionRow) {
    // Track failed attempts in a short-lived cookie
    let attempts: number[] = [];
    try {
      const raw = getCookieVal("sf_join_failures");
      attempts = raw
        ? raw
            .split(",")
            .map((chunk) => Number(chunk.trim()))
            .filter((ts) => Number.isFinite(ts) && ts > 0)
        : [];
    } catch {
      attempts = [];
    }

    const cutoff = now - WINDOW_MS;
    attempts = attempts.filter((ts) => ts >= cutoff);
    attempts.push(now);

    if (attempts.length >= MAX_ATTEMPTS) {
      const until = now + BLOCK_MS;
      const res = NextResponse.json({ error: "Invalid join code" }, { status: 404 });
      res.cookies.set("sf_join_block_until", String(until), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: Math.ceil(BLOCK_MS / 1000),
      });
      res.cookies.set("sf_join_failures", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 0,
      });
      return res;
    } else {
      const res = NextResponse.json({ error: "Invalid join code" }, { status: 404 });
      res.cookies.set("sf_join_failures", attempts.join(","), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: Math.ceil(WINDOW_MS / 1000),
      });
      return res;
    }
  }

  // ---- Enforce session join rules ----
  if ((sessionRow as any).status === "Completed") {
    return NextResponse.json({ error: "Session is closed" }, { status: 403 });
  }
  if ((sessionRow as any).status === "Draft") {
    return NextResponse.json({ error: "Session not open for joining yet" }, { status: 403 });
  }

  // ---- Reuse participant if cookie exists ----
  const existingPid = getCookieVal(`sf_pid_${sessionRow.id}`);
  if (existingPid) {
    const { data: existing, error: partErr } = await supabaseAdmin
      .from("participants")
      .select("id, session_id, display_name, group_id")
      .eq("id", existingPid)
      .eq("session_id", sessionRow.id)
      .maybeSingle();

    if (!partErr && existing) {
      if (display_name && display_name !== existing.display_name) {
        await supabaseAdmin.from("participants").update({ display_name }).eq("id", existing.id);
        existing.display_name = display_name;
      }

      const res = NextResponse.json({ session: sessionRow, participant: existing });
      res.cookies.set(`sf_pid_${sessionRow.id}`, existing.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      });
      // clear throttle cookies
      res.cookies.set("sf_join_failures", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 0,
      });
      res.cookies.set("sf_join_block_until", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 0,
      });
      return res;
    }
  }

  // ---- Create new participant ----
  const { data: participant, error: createErr } = await supabaseAdmin
    .from("participants")
    .insert({ session_id: sessionRow.id, display_name })
    .select("id, session_id, display_name, group_id")
    .single();

  if (createErr || !participant) {
    return NextResponse.json({ error: createErr?.message || "Failed to join" }, { status: 500 });
  }

  const res = NextResponse.json({ session: sessionRow, participant });
  res.cookies.set(`sf_pid_${sessionRow.id}`, participant.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
  });
  // clear throttling cookies
  res.cookies.set("sf_join_failures", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });
  res.cookies.set("sf_join_block_until", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });
  return res;
}