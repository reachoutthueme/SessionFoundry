// Very small in-memory rate limiter (per server instance)
// For serverless/edge with multiple instances, prefer a shared KV.

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(key: string, opts?: { limit?: number; windowMs?: number }) {
  const limit = Math.max(1, opts?.limit ?? 10);
  const windowMs = Math.max(1000, opts?.windowMs ?? 60_000);
  const now = Date.now();
  const rec = store.get(key);
  if (!rec || rec.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }
  if (rec.count < limit) {
    rec.count += 1;
    return { allowed: true, remaining: limit - rec.count, reset: rec.resetAt };
  }
  return { allowed: false, remaining: 0, reset: rec.resetAt };
}

