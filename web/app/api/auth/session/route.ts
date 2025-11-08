import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { isAdminUser } from "@/server/policies";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // keep responses snappy but avoid shared caching
  return NextResponse.json(
    { user: { ...user, is_admin: isAdminUser(user) } },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } }
  );
}
