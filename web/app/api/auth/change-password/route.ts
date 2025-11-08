import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    const user = await getUserFromRequest(req as unknown as Request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!user.email) {
      return NextResponse.json({ error: "No email associated with this account" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const old_password = String(body?.old_password || "");
    const new_password = String(body?.new_password || "");
    const confirm_password = String(body?.confirm_password || "");

    if (!old_password || !new_password || !confirm_password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (new_password !== confirm_password) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: "Missing Supabase URL or anon key" }, { status: 500 });
    }

    // Verify old password by attempting a sign-in
    const verify = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: signInErr } = await verify.auth.signInWithPassword({ email: user.email, password: old_password });
    if (signInErr) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Update password using service role
    const { error: updErr } = await (supabaseAdmin as any).auth.admin.updateUserById(user.id, { password: new_password });
    if (updErr) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

