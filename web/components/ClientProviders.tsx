// components/ClientProviders.tsx
"use client";

import { useEffect, type PropsWithChildren } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { supabase } from "@/app/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function ClientProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!supabase) return;

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            const at = session?.access_token;
            const rt = session?.refresh_token;

            if (at) {
              try {
                const res = await fetch("/api/auth/set-token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    access_token: at,
                    refresh_token: rt || "",
                  }),
                });

                if (!res.ok) {
                  // Server didn't accept / didn't set cookie.
                  // We don't blow up the UI, but we log so you can debug auth sync issues.
                  console.error(
                    "[auth sync] /api/auth/set-token responded with",
                    res.status
                  );
                }
              } catch (err) {
                // Network or fetch error. Again: soft fail.
                console.error("[auth sync] Failed to call /api/auth/set-token", err);
              }
            }
          } else if (event === "SIGNED_OUT") {
            try {
              const res = await fetch("/api/auth/logout", {
                method: "POST",
              });
              if (!res.ok) {
                console.error(
                  "[auth sync] /api/auth/logout responded with",
                  res.status
                );
              }
            } catch (err) {
              console.error("[auth sync] Failed to call /api/auth/logout", err);
            }
          }
        } catch {
          // absolutely swallow anything unexpected
          // (we never want auth sync to crash the whole app render)
        }
      }
    );

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}