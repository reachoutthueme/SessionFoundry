"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // read ?mode=signup on mount
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const m = qs.get("mode");
      setMode(m === "signup" ? "signup" : "signin");
    } catch {
      // ignore
    }
  }, []);

  // if already signed in, go to dashboard
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.user) {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("session check failed", err);
      }
    })();
  }, [router]);

  async function afterAuth() {
    try {
      const s = await supabase.auth.getSession();
      const at = s.data.session?.access_token;
      const rt = s.data.session?.refresh_token;

      if (at) {
        await fetch("/api/auth/set-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: at,
            refresh_token: rt,
          }),
        });
      }
    } catch (err) {
      console.error("afterAuth sync failed", err);
    }

    router.push("/dashboard");
  }

  async function signIn() {
    if (!supabase) {
      toast("Supabase not configured", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast(error.message, "error");
        return;
      }

      toast("Signed in", "success");
      await afterAuth();
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    if (!supabase) {
      toast("Supabase not configured", "error");
      return;
    }

    if (password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    if (!acceptTerms) {
      toast("Please accept the Terms & Conditions", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { plan: "free" } },
      });

      if (error) {
        toast(error.message, "error");
        return;
      }

      toast("Account created", "success");
      await afterAuth();
    } finally {
      setLoading(false);
    }
  }

  const title = useMemo(
    () => (mode === "signin" ? "Sign in" : "Create account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "signin"
        ? "Facilitator access"
        : "Start on the Free plan",
    [mode]
  );

  return (
    // fixed overlay that fills the viewport and centers content
    <div className="fixed inset-0 z-10 grid place-items-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title={title} subtitle={subtitle} />
          <CardBody>
            <div className="space-y-3">
              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                  placeholder="Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                  placeholder="Password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Confirm password (signup only) */}
              {mode === "signup" && (
                <div className="space-y-1">
                  <label htmlFor="confirm" className="sr-only">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  />
                </div>
              )}

              {mode === "signup" && (
                <div className="mt-1 flex items-start gap-2 text-xs text-[var(--muted)]">
                  <input
                    id="accept_terms"
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border border-white/20 bg-[var(--panel)]"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    disabled={loading}
                  />
                  <label htmlFor="accept_terms">
                    I accept the {" "}
                    <Link className="underline" href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms & Conditions
                    </Link>
                    {" "}and acknowledge the {" "}
                    <Link className="underline" href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
              )}

              {/* Action row */}
              {mode === "signin" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={signIn} disabled={loading}>
                    Sign in
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMode("signup")}
                    disabled={loading}
                  >
                    Create account
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={signUp}
                    disabled={
                      loading ||
                      password !== confirm ||
                      password.length < 8 ||
                      !acceptTerms
                    }
                  >
                    Create account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMode("signin")}
                    disabled={loading}
                  >
                    Back to sign in
                  </Button>
                </div>
              )}

              <div className="text-xs text-[var(--muted)]">
                Free plan: 1 session, no exports. Pro: unlimited +
                exports.
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
