export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = typeof input === "string" ? input : input.toString();
  const isAbsolute = /^https?:\/\//i.test(url);
  const sameOrigin = !isAbsolute || url.startsWith(location.origin);

  const withCreds: RequestInit = {
    credentials: sameOrigin ? "include" : (init.credentials ?? "omit"),
    ...init,
  };

  return fetch(input as any, withCreds);
}

