// components/ClientProviders.tsx
"use client";

import type { PropsWithChildren } from "react";
import { useEffect } from "react";
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
              await fetch("/api/auth/set-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  access_token: at,
                  refresh_token: rt || "",
                }),
              }).catch(() => {
                /* swallow */
              });
            }
          } else if (event === "SIGNED_OUT") {
            await fetch("/api/auth/logout", {
              method: "POST",
            }).catch(() => {
              /* swallow */
            });
          }
        } catch {
          // ignore, we don't want to hard-crash the client if sync fails
        }
      }
    );

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
