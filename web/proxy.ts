import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isRestrictedRoute, isPublicRoute, isParticipantRoute } from "@/app/lib/routeRules";

// Next 16 proxy: apply security headers (CSP with nonce) on all routes
export default function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;
  const allowEmbed = pathname === "/privacy" || pathname === "/terms";

  // Core headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", allowEmbed ? "SAMEORIGIN" : "DENY");

  // HSTS in production & https
  if (process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // CSP with per-request nonce (Next injects x-nonce header)
  const nonce = req.headers.get("x-nonce");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseOrigin = "";
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {}

  const directives: string[] = [];
  directives.push("default-src 'self'");
  // Scripts: use nonce when available to avoid 'unsafe-inline'
  if (nonce) {
    directives.push(`script-src 'self' 'nonce-${nonce}'`);
  } else {
    // Fallback for environments without nonce propagation
    directives.push("script-src 'self' 'unsafe-inline'");
  }
  directives.push("style-src 'self' 'unsafe-inline'");
  directives.push("font-src 'self' data:");
  directives.push("img-src 'self' data: blob: https:");
  const connectSrc = ["'self'", "https:", "wss:"];
  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
    try {
      const u = new URL(supabaseOrigin);
      connectSrc.push(`wss://${u.host}`);
    } catch {}
  }
  connectSrc.push("https://vitals.vercel-insights.com");
  directives.push(`connect-src ${connectSrc.join(" ")}`);
  directives.push("object-src 'none'");
  directives.push("base-uri 'self'");
  directives.push(`frame-ancestors ${allowEmbed ? "'self'" : "'none'"}`);

  res.headers.set("Content-Security-Policy", directives.join("; "));

  // Ensure CSRF double-submit cookie exists (readable by JS)
  try {
    const hasCsrf = req.cookies.has("sf_csrf");
    if (!hasCsrf) {
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const secure = process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:";
      res.cookies.set("sf_csrf", token, {
        httpOnly: false,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
  } catch {}

  // Simple auth gate: redirect unauthenticated users from restricted routes to login
  try {
    const { pathname, search } = req.nextUrl;
    if (!isPublicRoute(pathname) && !isParticipantRoute(pathname) && isRestrictedRoute(pathname)) {
      const hasToken = req.cookies.has("sf_at");
      if (!hasToken) {
        const redirectTo = `/login?redirect=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(new URL(redirectTo, req.url));
      }
    }
  } catch {}

  return res;
}

export const config = {
  matcher: ["/:path*"],
};
