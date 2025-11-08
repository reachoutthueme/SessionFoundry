import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Security headers for all routes (API and pages)
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Core headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");

  // Basic CSP: keep conservative to avoid breaking Next runtime
  // - Default only allows same-origin
  // - For images, allow data/blob for inlined avatars/placeholders
  // - Disallow plugins (object-src none)
  // - Disallow framing (also set via X-Frame-Options)
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

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

