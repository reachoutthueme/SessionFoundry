import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";
import { getAdminOverviewMetrics } from "@/server/admin/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    const metrics = await getAdminOverviewMetrics();
    return NextResponse.json(metrics, { status: 200 });
  }

  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const metrics = await getAdminOverviewMetrics();
  return NextResponse.json(metrics, { status: 200 });
}

