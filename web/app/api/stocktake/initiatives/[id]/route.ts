import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsActivity } from "@/app/api/_util/auth";

const ParamsSchema = z.object({ id: z.string().uuid("Invalid id") });

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // Validate route param
  const { id } = ParamsSchema.parse(await ctx.params);

  // Auth
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Resolve initiative -> activity
  const { data: initRow, error: ie } = await supabaseAdmin
    .from("stocktake_initiatives")
    .select("activity_id")
    .eq("id", id)
    .maybeSingle();

  if (ie) {
    // Avoid leaking DB details
    return NextResponse.json({ error: "Failed to load initiative" }, { status: 500 });
  }
  const activity_id = initRow?.activity_id as string | undefined;
  if (!activity_id) {
    // Either not found or not visible; keep it generic
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership
  const owns = await userOwnsActivity(user.id, activity_id);
  if (!owns) {
    // Same 404 to avoid enumeration
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete (rely on FK ON DELETE CASCADE for dependent rows)
  const { error: de } = await supabaseAdmin
    .from("stocktake_initiatives")
    .delete()
    .eq("id", id);

  if (de) {
    // If you don’t have CASCADE and hit constraints, this will fail.
    // Consider moving deletion into a Postgres function if you need multi-table cleanup atomically.
    return NextResponse.json({ error: "Unable to delete initiative" }, { status: 500 });
  }

  // 204 No Content is conventional for successful deletes
  return new NextResponse(null, { status: 204 });
}
