// components/ClientProviders.tsx
"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { supabase } from "@/app/lib/supabaseClient";
import { apiFetch } from "@/app/lib/apiFetch";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

// Types
// Token payload shape (refresh token omitted client-side)
interface TokenSyncPayload { access_token: string }

// Constants
const AUTH_SYNC_ENDPOINTS = {
  SET_TOKEN: "/api/auth/set-token",
  LOGOUT: "/api/auth/logout",
} as const;

const SYNC_TIMEOUT = 5000; // 5 seconds
const SYNC_CHANNEL = "sf-auth-sync";
const RECENT_SYNC_MS = 7000; // consider a sync "recent" within ~7s to reduce cross-tab dupes

export default function ClientProviders({ children }: PropsWithChildren) {
  // Track in-flight requests to prevent race conditions
  const syncInProgress = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastSyncAtRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Cross-tab coordination
    try {
      bcRef.current = new BroadcastChannel(SYNC_CHANNEL);
    } catch {
      bcRef.current = null;
    }

    const notifySync = () => {
      lastSyncAtRef.current = Date.now();
      try { bcRef.current?.postMessage({ type: "sync" }); } catch {}
      try { localStorage.setItem("sf_auth_last_sync", String(lastSyncAtRef.current)); } catch {}
    };

    const recentSyncExists = () => {
      const now = Date.now();
      const local = lastSyncAtRef.current;
      let fromLS = 0;
      try { fromLS = Number(localStorage.getItem("sf_auth_last_sync") || 0); } catch {}
      return now - Math.max(local, fromLS) < RECENT_SYNC_MS;
    };

    const onBroadcast = (e: MessageEvent) => {
      if (e?.data?.type === "sync") {
        lastSyncAtRef.current = Date.now();
      }
    };
    bcRef.current?.addEventListener("message", onBroadcast);

    // Auth token sync handler
    const syncTokens = async (
      accessToken: string,
      _refreshToken: string | undefined
    ): Promise<void> => {
      if (syncInProgress.current) {
        console.log("[auth sync] Sync already in progress, skipping");
        return;
      }

      // Avoid duplicate writes across tabs for a brief window
      if (recentSyncExists()) {
        console.log("[auth sync] Recent sync detected, skipping");
        return;
      }

      syncInProgress.current = true;
      controllerRef.current?.abort();
      try {
        // Controller + timeout
        const controller = new AbortController();
        controllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

        // Retry with simple backoff for transient errors (429/5xx)
        const maxAttempts = 3;
        const startedAt = Date.now();
        let attempt = 0;
        let ok = false;
        let lastStatus = 0;
        while (attempt < maxAttempts && !ok) {
          attempt++;
          try {
            // Include CSRF header from cookie
            const csrf = getCookie('sf_csrf');
            const response = await apiFetch(AUTH_SYNC_ENDPOINTS.SET_TOKEN, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-CSRF": csrf },
              body: JSON.stringify({ access_token: accessToken } satisfies Partial<TokenSyncPayload>),
              signal: controller.signal,
            });
            lastStatus = response.status;
            if (response.ok) {
              ok = true;
              break;
            }
            if (response.status === 401 || response.status === 403) {
              console.warn(`[auth sync] Server rejected token (${response.status}); signing out locally`);
              await supabase.auth.signOut();
              break;
            }
            if (response.status === 429 || response.status >= 500) {
              const elapsed = Date.now() - startedAt;
              if (elapsed > 2500) break; // cap total backoff ~2.5s
              const jitter = Math.random() * 200;
              await new Promise((r) => setTimeout(r, 200 * attempt + jitter));
            } else {
              break; // non-retryable
            }
          } catch (err) {
            if ((err as any)?.name === "AbortError") throw err;
            const elapsed = Date.now() - startedAt;
            if (elapsed > 2500) break;
            const jitter = Math.random() * 200;
            await new Promise((r) => setTimeout(r, 200 * attempt + jitter));
          }
        }
        clearTimeout(timeoutId);
        if (ok) notifySync();
        else console.error(`[auth sync] Token sync failed after retries (last status ${lastStatus})`);
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            console.error("[auth sync] Token sync timed out");
          } else {
            console.error("[auth sync] Token sync failed:", err.message);
          }
        } else {
          console.error("[auth sync] Token sync failed with unknown error");
        }
      } finally {
        syncInProgress.current = false;
        controllerRef.current = null;
      }
    };

    // Logout handler
    const handleLogout = async (): Promise<void> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);
        const csrf = getCookie('sf_csrf');
        // 1-2 quick retries on 5xx/429
        let attempts = 0;
        let ok = false;
        let resp: Response | null = null;
        while (attempts < 2 && !ok) {
          attempts++;
          resp = await apiFetch(AUTH_SYNC_ENDPOINTS.LOGOUT, {
            method: "POST",
            headers: { "X-CSRF": csrf },
            signal: controller.signal,
          });
          if (resp.ok || (resp.status !== 429 && resp.status < 500)) break;
          const jitter = Math.random() * 150;
          await new Promise((r) => setTimeout(r, 150 + jitter));
        }

        clearTimeout(timeoutId);

        if (!resp || !resp.ok) {
          console.error(`[auth sync] Logout failed${resp ? ` with status ${resp.status}` : ''}`);
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            console.error("[auth sync] Logout timed out");
          } else {
            console.error("[auth sync] Logout failed:", err.message);
          }
        } else {
          console.error("[auth sync] Logout failed with unknown error");
        }
      }
    };

    // Auth state change handler
    const handleAuthStateChange = async (
      event: AuthChangeEvent,
      session: Session | null
    ): Promise<void> => {
      try {
        // Offline? Defer sync until back online
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          console.warn("[auth sync] Offline, deferring token sync");
          const onOnline = () => {
            window.removeEventListener("online", onOnline);
            if (session?.access_token) void syncTokens(session.access_token, session.refresh_token);
          };
          window.addEventListener("online", onOnline);
          return;
        }
        switch (event) {
          case "INITIAL_SESSION": {
            const accessToken = session?.access_token;
            if (accessToken) await syncTokens(accessToken, session?.refresh_token);
            break;
          }
          case "SIGNED_IN":
          case "TOKEN_REFRESHED": {
            const accessToken = session?.access_token;
            const refreshToken = session?.refresh_token;

            if (accessToken) {
              await syncTokens(accessToken, refreshToken);
            } else {
              console.warn("[auth sync] No access token available in session");
            }
            break;
          }

          case "SIGNED_OUT": {
            await handleLogout();
            break;
          }

          case "USER_UPDATED":
          case "PASSWORD_RECOVERY":
          case "MFA_CHALLENGE_VERIFIED":
            // These events don't require token sync
            break;

          default:
            // Log unexpected events for debugging
            console.log(`[auth sync] Unhandled auth event: ${event}`);
        }
      } catch (err) {
        // Catch-all to prevent auth sync from crashing the app
        console.error("[auth sync] Unexpected error in auth handler:", err);
      }
    };

    // Subscribe to auth state changes (includes INITIAL_SESSION in supabase-js v2)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Cleanup
    return () => {
      try { subscription.unsubscribe(); } catch {}
      try { bcRef.current?.removeEventListener("message", onBroadcast as any); } catch {}
      bcRef.current = null;
      try { controllerRef.current?.abort(); } catch {}
    };
  }, []);

  // Util: robust cookie reader (decodeURIComponent)
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

  return <ToastProvider>{children}</ToastProvider>;
}
