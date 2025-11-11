import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { plan: "pro" },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, user: { id: data.user?.id, plan: (data.user?.user_metadata as any)?.plan || "pro" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to upgrade" }, { status: 500 });
  }
}


