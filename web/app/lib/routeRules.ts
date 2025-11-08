export const RESTRICTED_PREFIXES = [
  "/dashboard",
  "/sessions",
  "/templates",
  "/settings",
  "/session/",
] as const;

export function isRestrictedRoute(pathname: string): boolean {
  return RESTRICTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export function isParticipantRoute(pathname: string): boolean {
  return pathname.startsWith("/join") || pathname.startsWith("/participant");
}

export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/home" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/policies")
  );
}

