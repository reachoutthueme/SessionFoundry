export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = typeof input === "string" ? input : input.toString();
  const isAbsolute = /^https?:\/\//i.test(url);
  const sameOrigin = !isAbsolute || url.startsWith(location.origin);

  // Ensure cookies for same-origin
  const withCreds: RequestInit = {
    credentials: sameOrigin ? "include" : (init.credentials ?? "omit"),
    ...init,
  };

  // Auto attach CSRF header for same-origin non-GET if not provided
  if (sameOrigin) {
    const method = (withCreds.method || "GET").toString().toUpperCase();
    if (method !== "GET") {
      const headers = new Headers(withCreds.headers || {});
      if (!headers.has("X-CSRF")) {
        try {
          const csrf = getCookie("sf_csrf");
          if (csrf) headers.set("X-CSRF", csrf);
        } catch {}
      }
      withCreds.headers = headers;
    }
  }

  return fetch(input as any, withCreds);
}

function getCookie(name: string): string {
  try {
    const prefix = name + "=";
    const parts = document.cookie.split(";");
    for (const part of parts) {
      const p = part.trim();
      if (p.startsWith(prefix)) return decodeURIComponent(p.slice(prefix.length));
    }
    return "";
  } catch {
    return "";
  }
}
