import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const access_token = (body?.access_token ?? "").toString();
  const refresh_token = (body?.refresh_token ?? "").toString();
  if (!access_token) return NextResponse.json({ error: "access_token required" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sf_at", access_token, { httpOnly: true, sameSite: "lax", path: "/" });
  if (refresh_token) res.cookies.set("sf_rt", refresh_token, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

