type Cached = { user: { id: string; email?: string | null; plan: "free" | "pro" } | null; expiresAt: number };
const store = new Map<string, Cached>();

export function getCachedUser(token: string): Cached["user"] | undefined {
  const now = Date.now();
  const hit = store.get(token);
  if (!hit) return undefined;
  if (hit.expiresAt <= now) {
    store.delete(token);
    return undefined;
  }
  return hit.user ?? null;
}

export function setCachedUser(token: string, user: Cached["user"], ttlMs = 20_000) {
  store.set(token, { user, expiresAt: Date.now() + Math.max(1000, ttlMs) });
}

