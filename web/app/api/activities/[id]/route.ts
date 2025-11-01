import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";
import { validateConfig } from "@/lib/activities/schemas";

// Route params typing (no Promise)
type Ctx = { params: { id: string } };

const PatchSchema = z.object({
  title: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(4000).optional(),
  description: z.string().trim().max(4000).optional(),
  order_index: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(["Draft", "Active", "Voting", "Closed"]).optional(),
  // Allow the server to *optionally* accept timestamps, but validate them.
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  // Config is validated against the activity type later
  config: z.unknown().optional(),
});

// Small helper to no-store the response
function noStore<T>(payload: T, init?: number | ResponseInit) {
  const res = NextResponse.json(payload as any, init as any);
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const activityId = ctx.params?.id || "";
  if (!activityId) return noStore({ error: "Invalid activity id" }, { status: 400 });

  // Auth
  const user = await getUserFromRequest(req);
  if (!user) return noStore({ error: "Sign in required" }, { status: 401 });

  const owns = await userOwnsActivity(user.id, activityId);
  if (!owns) return noStore({ error: "Not found" }, { status: 404 });

  // Parse & validate body
  const rawBody = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return noStore({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Load current activity for type & existing status/config/session_id
  const { data: current, error: ce } = await supabaseAdmin
    .from("activities")
    .select("id, session_id, type, status, config")
    .eq("id", activityId)
    .maybeSingle();

  if (ce) return noStore({ error: ce.message }, { status: 500 });
  if (!current) return noStore({ error: "Not found" }, { status: 404 });

  const activityType = current.type as "brainstorm" | "stocktake" | "assignment";
  const currentStatus = (current.status as string) || "Draft";
  const sessionId = current.session_id as string;

  // Build the patch object from allow-list + schema
  const patch: Record<string, any> = {};

  if (body.title !== undefined) patch.title = body.title;
  if (body.instructions !== undefined) patch.instructions = body.instructions;
  if (body.description !== undefined) patch.description = body.description;
  if (body.order_index !== undefined) patch.order_index = body.order_index;
  if (body.status !== undefined) patch.status = body.status;

  // Optional: only allow starts_at/ends_at when status is moving to Active
  if (body.starts_at && body.ends_at && body.status === "Active") {
    const starts = new Date(body.starts_at).getTime();
    const ends = new Date(body.ends_at).getTime();
    if (Number.isFinite(starts) && Number.isFinite(ends) && ends > starts) {
      patch.starts_at = body.starts_at;
      patch.ends_at = body.ends_at;
    }
  }

  // Validate and merge config if provided
  if (body.config !== undefined) {
    const v = validateConfig(activityType, body.config);
    if (!v.ok) return noStore({ error: v.error || "Invalid config" }, { status: 400 });
    patch.config = v.value;
  }

  // If transitioning into Active (from anything that isn't Active), do assignment logic
  const transitioningToActive = body.status === "Active" && currentStatus !== "Active";

  if (transitioningToActive && activityType === "assignment") {
    // We need merged config to see prompts & existing assignments
    const mergedCfg = {
      ...(current.config || {}),
      ...(patch.config || {}),
    } as { prompts?: unknown; assignments?: Record<string, string> };

    const prompts = Array.isArray(mergedCfg.prompts)
      ? (mergedCfg.prompts as string[]).map((s) => (s ?? "").trim()).filter(Boolean)
      : [];

    if (prompts.length > 0) {
      const { data: groups, error: ge } = await supabaseAdmin
        .from("groups")
        .select("id")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }); // deterministic order

      if (ge) return noStore({ error: ge.message }, { status: 500 });

      const existing = (mergedCfg.assignments || {}) as Record<string, string>;
      const assignments: Record<string, string> = { ...existing };

      let i = 0;
      for (const g of groups || []) {
        const gid = g?.id as string | undefined;
        if (!gid) continue;
        if (!assignments[gid]) {
          assignments[gid] = prompts[i % prompts.length];
          i++;
        }
      }

      patch.config = { ...mergedCfg, assignments };
    }
  }

  if (Object.keys(patch).length === 0) {
    return noStore({ error: "No valid fields to update" }, { status: 400 });
  }

  // Persist
  const { data, error } = await supabaseAdmin
    .from("activities")
    .update(patch)
    .eq("id", activityId)
    .select(
      "id, session_id, type, title, instructions, description, config, order_index, status, starts_at, ends_at, created_at"
    )
    .single();

  if (error) return noStore({ error: error.message }, { status: 500 });

  return noStore({ activity: data }, { status: 200 });
}