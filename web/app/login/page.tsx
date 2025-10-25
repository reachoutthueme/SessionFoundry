"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const toast = useToast();

  // mode: "signin" | "signup"
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // On first render in the browser, look at ?mode=signup
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const m = qs.get("mode");
      if (m === "signup") {
        setMode("signup");
      } else {
        setMode("signin");
      }
    } catch {
      // ignore if URLSearchParams blows up for some reason
    }
  }, []);

  // If already signed in, bounce to dashboard
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const j = await r.json();
        if (j?.user) {
          location.href = "/dashboard";
        }
      } catch {
        // ignore
      }
    })();
  }, []);

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
    } catch {
      // ignore sync failures
    }
    location.href = "/dashboard";
  }

  async function signIn() {
    if (!supabase) {
      toast("Supabase not configured", "error");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Signed in", "success");
    await afterAuth();
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

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { plan: "free" } },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Account created", "success");
    await signIn();
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
    <div className="max-w-sm mx-auto">
      <Card>
        <CardHeader title={title} subtitle={subtitle} />
        <CardBody>
          {/* toggle buttons */}
          <div className="flex gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded-md border ${
                mode === "signin"
                  ? "bg-white/10 border-white/20"
                  : "border-white/10 hover:bg-white/5"
              }`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              className={`px-3 py-1 rounded-md border ${
                mode === "signup"
                  ? "bg-white/10 border-white/20"
                  : "border-white/10 hover:bg-white/5"
              }`}
              onClick={() => setMode("signup")}
            >
              Create account
            </button>
          </div>

          {/* form */}
          <div className="space-y-3">
            <input
              className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {mode === "signup" && (
              <input
                type="password"
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}

            {mode === "signin" ? (
              <div className="flex gap-2">
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
              <div className="flex gap-2">
                <Button
                  onClick={signUp}
                  disabled={
                    loading ||
                    password !== confirm ||
                    password.length < 8
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
  );
}