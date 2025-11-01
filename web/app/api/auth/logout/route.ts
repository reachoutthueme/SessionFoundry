import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );

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