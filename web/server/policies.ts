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
