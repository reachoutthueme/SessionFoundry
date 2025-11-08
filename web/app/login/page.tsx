"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { apiFetch } from "@/app/lib/apiFetch";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

// Types
type AuthMode = "signin" | "signup";

interface SessionResponse {
  user?: {
    id: string;
    email?: string;
  } | null;
}

// Constants
const PASSWORD_MIN_LENGTH = 8;
const DEFAULT_REDIRECT = "/dashboard";

// Helper functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeRedirect = (redirect: string | null): string => {
  if (!redirect) return DEFAULT_REDIRECT;
  
  // Only allow relative paths to prevent open redirect vulnerability
  if (redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  
  return DEFAULT_REDIRECT;
};

// Login form component (uses useSearchParams)
function LoginForm() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Get redirect URL from query params
  const redirectUrl = useMemo(() => {
    return sanitizeRedirect(searchParams?.get("redirect"));
  }, [searchParams]);

  // Read mode from URL on mount
  useEffect(() => {
    const modeParam = searchParams?.get("mode");
    setMode(modeParam === "signup" ? "signup" : "signin");
  }, [searchParams]);

  // Check if already signed in
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const response = await apiFetch("/api/auth/session", { 
          cache: "no-store",
        });
        
        if (!isMounted) return;

        if (response.ok) {
          const data: SessionResponse = await response.json();
          if (data?.user) {
            router.replace(redirectUrl);
            return;
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router, redirectUrl]);

  // Sync auth tokens with backend
  const syncAuthTokens = useCallback(async (): Promise<boolean> => {
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error("No access token available");
      }

      const response = await apiFetch("/api/auth/set-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only send the access_token; refresh token stays client-side
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync tokens");
      }

      return true;
    } catch (err) {
      console.error("Token sync failed:", err);
      toast("Authentication sync failed. Please try again.", "error");
      return false;
    }
  }, [toast]);

  // Handle post-authentication flow
  const handlePostAuth = useCallback(async () => {
    const synced = await syncAuthTokens();
    if (synced) {
      router.push(redirectUrl);
    }
  }, [syncAuthTokens, router, redirectUrl]);

  // Sign in handler
  const handleSignIn = useCallback(async () => {
    // Validation
    if (!email.trim()) {
      toast("Please enter your email", "error");
      return;
    }

    if (!isValidEmail(email.trim())) {
      toast("Please enter a valid email address", "error");
      return;
    }

    if (!password) {
      toast("Please enter your password", "error");
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

      toast("Signed in successfully", "success");
      await handlePostAuth();
    } catch (err) {
      console.error("Sign in error:", err);
      toast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }, [email, password, toast, handlePostAuth]);

  // Sign up handler
  const handleSignUp = useCallback(async () => {
    // Validation
    if (!email.trim()) {
      toast("Please enter your email", "error");
      return;
    }

    if (!isValidEmail(email.trim())) {
      toast("Please enter a valid email address", "error");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, "error");
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
        options: { 
          data: { plan: "free" },
          emailRedirectTo: window.location.origin + redirectUrl
        },
      });

      if (error) {
        toast(error.message, "error");
        return;
      }

      toast("Account created successfully", "success");
      await handlePostAuth();
    } catch (err) {
      console.error("Sign up error:", err);
      toast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirm, acceptTerms, toast, handlePostAuth, redirectUrl]);

  // Form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (mode === "signin") {
        handleSignIn();
      } else {
        handleSignUp();
      }
    },
    [mode, handleSignIn, handleSignUp]
  );

  // Toggle mode
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    // Reset form state when switching modes
    setPassword("");
    setConfirm("");
    setAcceptTerms(false);
    setShowPassword(false);
    setShowConfirm(false);
  }, []);

  // Computed values
  const title = mode === "signin" ? "Sign In" : "Create Account";
  const subtitle = mode === "signin" ? "Facilitator access" : "Start on the Free plan";
  
  const isSignUpValid = 
    password === confirm && 
    password.length >= PASSWORD_MIN_LENGTH && 
    acceptTerms &&
    isValidEmail(email.trim());

  // Show loading state while checking session
  if (!sessionChecked) {
    return (
      <div className="fixed inset-0 z-10 grid place-items-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title={title} subtitle={subtitle} />
          <CardBody>
            <form className="space-y-3" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none transition-colors focus:border-white/20 focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 pr-10 outline-none transition-colors focus:border-white/20 focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {mode === "signup" && (
                <div className="space-y-1">
                  <label htmlFor="confirm" className="sr-only">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 pr-10 outline-none transition-colors focus:border-white/20 focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      disabled={loading}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? "Hide" : "Show"}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>
              )}

              {/* Terms acceptance (signup only) */}
              {mode === "signup" && (
                <div className="flex items-start gap-2 text-xs text-[var(--muted)]">
                  <input
                    id="accept_terms"
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border border-white/20 bg-[var(--panel)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    disabled={loading}
                    required
                  />
                  <label htmlFor="accept_terms" className="cursor-pointer">
                    I accept the{" "}
                    <Link
                      className="underline hover:text-[var(--text)] transition-colors"
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Terms & Conditions
                    </Link>
                    {" "}and acknowledge the{" "}
                    <Link
                      className="underline hover:text-[var(--text)] transition-colors"
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
              )}

              {/* Action buttons */}
              {mode === "signin" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleMode}
                    disabled={loading}
                    className="flex-1"
                  >
                    Create Account
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={loading || !isSignUpValid}
                    className="flex-1"
                  >
                    {loading ? "Creating..." : "Create Account"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleMode}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back to Sign In
                  </Button>
                </div>
              )}

              {/* Plan info */}
              <div className="text-xs text-center text-[var(--muted)]">
                Free plan: 1 session, no exports. Pro: unlimited + exports.
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-10 grid place-items-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
