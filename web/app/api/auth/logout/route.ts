import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit } from "@/server/rateLimit";

export async function POST(req: NextRequest) {
  // CSRF check
  try {
    const csrfHeader = req.headers.get("x-csrf") || "";
    const csrfCookie = cookies().get("sf_csrf")?.value || "";
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return NextResponse.json({ error: "CSRF mismatch" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const csrfKey = cookies().get("sf_csrf")?.value || "anon";
  const rl = rateLimit(`auth:logout:${csrfKey}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
  }

  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  const cookieOpts = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };

  // Clear auth cookies
  res.cookies.set("sf_at", "", cookieOpts);
  res.cookies.set("sf_rt", "", cookieOpts);

  // Clear any participant cookies like sf_pid_<sessionId>
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("sf_pid_")) {
      res.cookies.set(c.name, "", cookieOpts);
    }
  }

  return res;
}
