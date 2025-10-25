import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  return NextResponse.json({ user });
}

