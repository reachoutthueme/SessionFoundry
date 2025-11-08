import { AuthedUser, userOwnsActivity, userOwnsSession } from "@/app/api/_util/auth";

export async function canViewSession(user: AuthedUser, sessionId: string): Promise<boolean> {
  if (!user || !sessionId) return false;
  return userOwnsSession(user.id, sessionId);
}

export async function canEditSession(user: AuthedUser, sessionId: string): Promise<boolean> {
  if (!user || !sessionId) return false;
  return userOwnsSession(user.id, sessionId);
}

export async function canManageActivity(user: AuthedUser, activityId: string): Promise<boolean> {
  if (!user || !activityId) return false;
  return userOwnsActivity(user.id, activityId);
}

export async function canExportSession(user: AuthedUser, sessionId: string): Promise<boolean> {
  if (!user || !sessionId) return false;
  if (user.plan !== "pro") return false;
  return userOwnsSession(user.id, sessionId);
}

// Admin helpers
export function isAdminUser(user: { id: string; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const adminIds = (process.env.ADMIN_USER_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAIL || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.length && adminIds.includes(user.id)) return true;
  const email = (user.email || "").toLowerCase();
  if (email && adminEmails.length && adminEmails.includes(email)) return true;
  return false;
}
