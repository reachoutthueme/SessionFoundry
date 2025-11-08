import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { TemplateApply } from "@/contracts";
import { canExportSession } from "@/server/policies";
import { templates, normalizeActivity } from "../data";
import { validateConfig } from "@/lib/activities/schemas";

// Contract is shared via @/contracts

const MAX_ACTIVITIES = 50;
const MAX_INITIATIVES_PER_STOCKTAKE = 200;

// Soft caps for strings to avoid pathological inserts
const TITLE_MAX = 200;
const INSTR_MAX = 2000;
const DESC_MAX = 4000;

export async function POST(req: Request) {
  // Auth & plan
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Parse body
  const parsed = TemplateApply.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid body" }, { status: 400 });
  }
  const { template_id, session_id } = parsed.data;

  // Ensure ownership of session
  const can = await canExportSession(user, session_id);
  if (!can) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch session status (used below)
  const { data: sessRow, error: sessErr } = await supabaseAdmin
    .from("sessions")
    .select("id, status")
    .eq("id", session_id)
    .maybeSingle();
  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  // Optional safety: only allow applying to Inactive sessions
  const sessionStatus = (sessRow as any).status as string | undefined;
  if (sessionStatus && sessionStatus !== "Inactive") {
    return NextResponse.json({ error: "Session must be Inactive to apply a template" }, { status: 409 });
  }

  // Get template
  const t = templates.find((x) => x.id === template_id);
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Size/sanity checks
  if (!Array.isArray(t.activities) || t.activities.length === 0) {
    return NextResponse.json({ error: "Template is empty" }, { status: 400 });
  }
  if (t.activities.length > MAX_ACTIVITIES) {
    return NextResponse.json({ error: `Template too large (>${MAX_ACTIVITIES} activities)` }, { status: 400 });
  }

  // Idempotency: refuse if session already has activities
  {
    const { count, error } = await supabaseAdmin
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Session already has activities. Clear them first or use a different session." },
        { status: 409 }
      );
    }
  }

  // Determine starting order_index (after idempotency this will be 0, but stay defensive)
  const { data: maxRow } = await supabaseAdmin
    .from("activities")
    .select("order_index")
    .eq("session_id", session_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  let order = ((maxRow as any)?.order_index ?? -1) + 1;

  const createdActivities: string[] = [];

  try {
    for (const raw of t.activities) {
      // Normalize & cap
      const a = normalizeActivity(raw);
      // If you didn't add normalizeActivity, replace the line above with:
      // const a = {
      //   type: String(raw.type),
      //   title: String(raw.title ?? "").trim(),
      //   instructions: raw.instructions ? String(raw.instructions) : "",
      //   description: raw.description ? String(raw.description) : "",
      //   config: raw.config ?? {},
      //   initiatives: Array.isArray((raw as any).initiatives) ? (raw as any).initiatives : [],
      // };

      const title = a.title.slice(0, TITLE_MAX);
      const instructions = (a.instructions ?? "").slice(0, INSTR_MAX);
      const description = (a.description ?? "").slice(0, DESC_MAX);
      const type = a.type;

      if (!["brainstorm", "stocktake", "assignment"].includes(type)) {
        throw new Error(`Unsupported activity type: ${type}`);
      }

      // Validate + normalize config with your schemas
      const v = validateConfig(type, a.config ?? {});
      if (!v.ok) throw new Error(v.error || "Invalid activity config");
      const safeConfig = v.value;

      // Insert activity
      const { data: act, error: ae } = await supabaseAdmin
        .from("activities")
        .insert({
          session_id,
          type,
          title,
          instructions,
          description,
          config: safeConfig,
          order_index: order++,
        })
        .select("id, type, title")
        .single();

      if (ae) throw new Error(ae.message);
      const activityId = (act as any).id as string;
      createdActivities.push(activityId);

      // If stocktake: bulk insert initiatives (validated + capped)
      if (type === "stocktake" && Array.isArray((a as any).initiatives) && (a as any).initiatives.length) {
        const rawInits: unknown[] = (a as any).initiatives;
        if (rawInits.length > MAX_INITIATIVES_PER_STOCKTAKE) {
          throw new Error(`Too many initiatives (>${MAX_INITIATIVES_PER_STOCKTAKE})`);
        }
        const rows = rawInits
          .map((s) => String(s ?? "").trim())
          .filter((s) => s.length > 0)
          .slice(0, MAX_INITIATIVES_PER_STOCKTAKE)
          .map((title) => ({ activity_id: activityId, title: title.slice(0, TITLE_MAX) }));

        if (rows.length) {
          const { error: ie } = await supabaseAdmin.from("stocktake_initiatives").insert(rows);
          if (ie) throw new Error(ie.message);
        }
      }
    }

    const res = NextResponse.json(
      { ok: true, activities: createdActivities.map((id) => ({ id })) },
      { status: 201 }
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    // Best-effort rollback (child rows first)
    if (createdActivities.length) {
      await supabaseAdmin.from("stocktake_initiatives").delete().in("activity_id", createdActivities);
      await supabaseAdmin.from("activities").delete().in("id", createdActivities);
    }
    return NextResponse.json({ error: e?.message || "Failed to apply template" }, { status: 500 });
  }
}
