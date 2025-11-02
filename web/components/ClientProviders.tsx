// components/ClientProviders.tsx
"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { supabase } from "@/app/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

// Types
interface TokenSyncPayload {
  access_token: string;
  refresh_token: string;
}

// Constants
const AUTH_SYNC_ENDPOINTS = {
  SET_TOKEN: "/api/auth/set-token",
  LOGOUT: "/api/auth/logout",
} as const;

const SYNC_TIMEOUT = 5000; // 5 seconds

export default function ClientProviders({ children }: PropsWithChildren) {
  // Track in-flight requests to prevent race conditions
  const syncInProgress = useRef(false);

  useEffect(() => {
    // Auth token sync handler
    const syncTokens = async (
      accessToken: string,
      refreshToken: string | undefined
    ): Promise<void> => {
      if (syncInProgress.current) {
        console.log("[auth sync] Sync already in progress, skipping");
        return;
      }

      syncInProgress.current = true;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

        const response = await fetch(AUTH_SYNC_ENDPOINTS.SET_TOKEN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          } satisfies TokenSyncPayload),
          signal: controller.signal,
          credentials: "include",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            `[auth sync] Token sync failed with status ${response.status}`
          );
        }
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
      }
    };

    // Logout handler
    const handleLogout = async (): Promise<void> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

        const response = await fetch(AUTH_SYNC_ENDPOINTS.LOGOUT, {
          method: "POST",
          signal: controller.signal,
          credentials: "include",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            `[auth sync] Logout failed with status ${response.status}`
          );
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
        switch (event) {
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

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}