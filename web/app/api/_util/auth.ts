import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export type AuthedUser = { id: string; email?: string | null; plan: "free" | "pro" } | null;

export async function getUserFromRequest(req: Request): Promise<AuthedUser> {
  try {
    // 1) Authorization: Bearer <token>
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    let token = "";
    if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
    // 2) Cookie
    if (!token) {
      const c = await cookies();
      token = c.get("sf_at")?.value || "";
    }
    if (!token) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    const plan = ((u.user_metadata as any)?.plan as string) === "pro" ? "pro" : "free";
    return { id: u.id, email: u.email, plan };
  } catch {
    return null;
  }
}

// Authorization helpers

export async function userOwnsSession(userId: string, sessionId: string): Promise<boolean> {
  if (!userId || !sessionId) return false;
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id,facilitator_user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return false;
  return !!data && (data as any).facilitator_user_id === userId;
}

export async function userOwnsActivity(userId: string, activityId: string): Promise<boolean> {
  if (!userId || !activityId) return false;
  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("session_id")
    .eq("id", activityId)
    .maybeSingle();
  if (error || !data) return false;
  const sessionId = (data as any).session_id as string | undefined;
  if (!sessionId) return false;
  return userOwnsSession(userId, sessionId);
}

// Participant + session helpers for participant-facing routes
export type ParticipantRow = { id: string; session_id: string; group_id: string | null; display_name?: string | null };

export async function getParticipantInSession(req: Request, sessionId: string): Promise<ParticipantRow | null> {
  try {
    if (!sessionId) return null;
    const c = await cookies();
    const pid = c.get(`sf_pid_${sessionId}`)?.value || '';
    if (!pid) return null;
    const { data, error } = await supabaseAdmin
      .from('participants')
      .select('id, session_id, group_id, display_name')
      .eq('id', pid)
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as any;
  } catch {
    return null;
  }
}

export async function getSessionStatus(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as any).status as string;
}
