import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sf_at", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set("sf_rt", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

