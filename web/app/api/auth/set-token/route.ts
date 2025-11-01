import { NextRequest, NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

/**
 * Accepts JSON:
 * {
 *   access_token: string,
 *   refresh_token?: string,
 *   expires_in?: number,          // seconds (from Supabase session)
 *   refresh_expires_in?: number   // optional, seconds
 * }
 */
export async function POST(req: NextRequest) {
  // --- CSRF guard (same-origin POSTs only) ---
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const url = new URL(req.url);
  const sameOrigin =
    origin === `${url.protocol}//${url.host}` ||
    (referer && referer.startsWith(`${url.protocol}//${url.host}`));
  if (!sameOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Parse body safely ---
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const access_token = typeof body?.access_token === "string" ? body.access_token : "";
  const refresh_token = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  const expires_in = Number.isFinite(body?.expires_in) ? Number(body.expires_in) : 55 * 60; // ~55m default
  const refresh_expires_in = Number.isFinite(body?.refresh_expires_in)
    ? Number(body.refresh_expires_in)
    : 30 * 24 * 60 * 60; // 30d default

  // basic sanity checks
  if (!access_token || access_token.length > 4096) {
    return NextResponse.json({ error: "access_token required" }, { status: 400 });
  }
  if (refresh_token && refresh_token.length > 4096) {
    return NextResponse.json({ error: "refresh_token too long" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  // Access token cookie — short-lived
  res.cookies.set("sf_at", access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: Math.max(60, Math.min(expires_in, 2 * 60 * 60)), // clamp 1m–2h
  });

  // Refresh token cookie — longer-lived (if provided)
  if (refresh_token) {
    res.cookies.set("sf_rt", refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: Math.max(60 * 60, Math.min(refresh_expires_in, 90 * 24 * 60 * 60)), // clamp 1h–90d
    });
  }

  return res;
}