import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

// --- Schemas ---
const getQuerySchema = z.object({
  activity_id: z.string().min(1, "activity_id required"),
});

// Normalize (trim + collapse spaces) BEFORE validating lengths
const createSchema = z.object({
  activity_id: z.string().min(1),
  title: z.preprocess(
    (val) =>
      typeof val === "string"
        ? val.trim().replace(/\s+/g, " ")
        : "",
    z.string().min(1, "title required").max(200, "title max 200 chars")
  ),
});

// GET /api/stocktake/initiatives?activity_id=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = getQuerySchema.safeParse({
      activity_id: url.searchParams.get("activity_id") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }

    const { activity_id } = parsed.data;

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const owns = await userOwnsActivity(user.id, activity_id);
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("stocktake_initiatives")
      .select("id,title")
      .eq("activity_id", activity_id)
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const res = NextResponse.json({ initiatives: data ?? [] });
    res.headers.set(
      "Cache-Control",
      "private, max-age=10, stale-while-revalidate=60"
    );
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

// POST /api/stocktake/initiatives
// { activity_id, title }
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse({
      activity_id: String(body?.activity_id ?? ""),
      title: body?.title, // preprocessing handles non-strings
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const { activity_id, title } = parsed.data;

    const owns = await userOwnsActivity(user.id, activity_id);
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Optional duplicate check (case-insensitive)
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("stocktake_initiatives")
      .select("id")
      .eq("activity_id", activity_id)
      .ilike("title", title);
    if (!exErr && (existing?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: "An initiative with this title already exists" },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("stocktake_initiatives")
      .insert({ activity_id, title })
      .select("id,title")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ initiative: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}