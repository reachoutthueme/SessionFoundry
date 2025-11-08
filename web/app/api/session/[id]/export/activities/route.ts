import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { canExportSession } from "@/server/policies";
import { rateLimit } from "@/server/rateLimit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: session_id } = await params;

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const can = await canExportSession(user, session_id);
  if (!can) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rl = rateLimit(`export:activities:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many export requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) },
    });
  }

  const { data: sess, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id, name")
    .eq("id", session_id)
    .maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: activities, error } = await supabaseAdmin
    .from("activities")
    .select(
      "id, session_id, type, title, instructions, description, config, order_index, status, starts_at, ends_at, created_at"
    )
    .eq("session_id", session_id)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = [
    "order_index",
    "type",
    "title",
    "status",
    "instructions",
    "description",
    "starts_at",
    "ends_at",
    "config_json",
  ];

  const rows = (activities ?? []).map((a) => {
    const order_index = (a as any).order_index ?? "";
    const type = (a as any).type ?? "";
    const title = safeCell((a as any).title ?? "");
    const status = (a as any).status ?? "";
    const instructions = safeCell((a as any).instructions ?? "");
    const description = safeCell((a as any).description ?? "");
    const starts_at = (a as any).starts_at ?? "";
    const ends_at = (a as any).ends_at ?? "";
    const config_json = safeCell(JSON.stringify((a as any).config ?? {}));

    return [
      String(order_index),
      String(type),
      title,
      String(status),
      instructions,
      description,
      String(starts_at),
      String(ends_at),
      config_json,
    ].join(",");
  });

  // Add UTF-8 BOM for Excel & CRLF newlines
  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows].join("\r\n");

  const sessionName = sanitizeForFilename((sess as any).name ?? "session");
  const filename = `activities_${sessionName}_${session_id}.csv`;

  const res = new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });

  return res;
}

/**
 * Prevent CSV/Excel injection + normalize newlines + quote as needed.
 * - Escapes internal quotes
 * - Wraps in double-quotes if contains comma/quote/newline
 * - Prefixes dangerous leading chars with apostrophe
 */
function safeCell(value: string): string {
  const v = (value ?? "")
    .toString()
    // Normalize CRLF/CR to LF then we will emit CRLF lines
    .replace(/\r\n?/g, "\n");

  // Guard against CSV injection in Excel/Sheets
  const dangerous = /^[=+\-@ \t]/.test(v);
  const hardened = dangerous ? "'" + v : v;

  // Escape internal quotes
  const escaped = hardened.replace(/"/g, '""');

  // Quote if it contains comma, quote, or newline
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function sanitizeForFilename(s: string): string {
  return s.replace(/[\\\/:*?"<>|]+/g, "_").slice(0, 60).trim() || "session";
}
