import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Security headers for all routes (API and pages)
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Core headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");

  // Build a CSP that works with Next.js + Supabase while remaining strict.
  // Allowlist Supabase origin from env for client-side `connect-src` and `img-src`.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseOrigin = "";
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {}

  const directives: string[] = [];
  directives.push("default-src 'self'");
  // Next may inject inline styles/classes; allow inline styles, and fonts from self/data
  directives.push("style-src 'self' 'unsafe-inline'");
  directives.push("font-src 'self' data:");
  // Images: self + data/blob and https (covers Supabase storage and external avatars)
  directives.push("img-src 'self' data: blob: https:");
  // Scripts: keep self; allow eval in dev to avoid breaking HMR/React dev tools
  if (process.env.NODE_ENV !== "production") {
    directives.push("script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'");
  } else {
    directives.push("script-src 'self'");
  }
  // XHR/fetch/websocket endpoints required by app (self + Supabase)
  const connectSrc = ["'self'", "https:", "wss:"];
  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
    // Supabase realtime/websocket
    const u = new URL(supabaseOrigin);
    connectSrc.push(`wss://${u.host}`);
  }
  // Common analytics endpoint (optional; harmless if unused)
  connectSrc.push("https://vitals.vercel-insights.com");
  directives.push(`connect-src ${connectSrc.join(" ")}`);

  directives.push("object-src 'none'");
  directives.push("base-uri 'self'");
  directives.push("frame-ancestors 'none'");

  res.headers.set("Content-Security-Policy", directives.join("; "));

  // HSTS only in production & HTTPS
  if (process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return res;
}

export const config = {
  matcher: ["/:path*"],
};
