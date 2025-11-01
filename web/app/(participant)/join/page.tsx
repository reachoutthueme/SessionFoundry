"use client";
import { useEffect, useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill from ?code= and remembered name
  useEffect(() => {
    const c = (params.get("code") || "").toUpperCase().trim();
    if (c) setCode(c);
    try {
      const saved = localStorage.getItem("sf_display_name") || "";
      if (saved) setName(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codeIsValid = /^[A-Z0-9]{4,8}$/.test(code.trim());

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!codeIsValid || loading) return;
    setErr(null);
    setLoading(true);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    try {
      const r = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          join_code: cleanCode,
          display_name: cleanName || undefined,
        }),
      });

      const text = await r.text();
      const j = text ? JSON.parse(text) : {};

      if (!r.ok) {
        const message =
          j?.error ||
          (r.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "Failed to join");
        setErr(message);
        return;
      }

      try {
        if (cleanName) localStorage.setItem("sf_display_name", cleanName);
      } catch {}

      const sessionId = j?.session?.id as string | undefined;
      if (sessionId) {
        try {
          if (j?.session?.name) localStorage.setItem(`sf_last_session_name_${sessionId}`, String(j.session.name));
          if (j?.session?.join_code) localStorage.setItem(`sf_last_join_code_${sessionId}`, String(j.session.join_code));
        } catch {}
        router.push(`/participant/${sessionId}`);
      } else {
        setErr("Unexpected response. Please try again.");
      }
    } catch {
      setErr("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col p-6">
      <div className="flex-1" />
      <div className="text-center mb-2">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          <span className="text-white dark:text-white light:text-black">Session</span>
          <span className="text-[var(--brand)]">Foundry</span>
        </h1>
      </div>
      <div className="flex-1" />

      <div className="w-full max-w-md self-center">
        <form
          onSubmit={submit}
          className="rounded-[var(--radius)] border border-white/15 bg-white/10 backdrop-blur-md shadow-lg p-6 text-left"
          noValidate
        >
          <h1 className="text-lg font-semibold mb-4">Join a workshop</h1>
          <div className="space-y-3">
            <div>
              <label htmlFor="join-code" className="block text-sm mb-1">
                Join code
              </label>
              <input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter join code (e.g., F7KM)"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={8}
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none focus:ring-[var(--ring)] placeholder:opacity-70"
                aria-invalid={!codeIsValid && code.length > 0}
              />
              <div className="mt-1 text-xs text-[var(--muted)]">
                Use the 4-8 letter code from your facilitator.
              </div>
            </div>

            <div>
              <label htmlFor="display-name" className="block text-sm mb-1">
                Your display name
              </label>
              <input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we display your name?"
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none focus:ring-[var(--ring)]"
                autoComplete="name"
              />
            </div>

            {err && (
              <div className="text-sm text-red-300" role="alert" aria-live="polite">
                {err}
              </div>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                onClick={(e) => void submit(e as any)}
                className="w-full"
                disabled={!codeIsValid || loading}
              >
                {loading ? "Joining..." : "Join"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <div className="flex-[2]" />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh grid place-items-center text-[var(--muted)]">Loading…</div>}>
      <JoinForm />
    </Suspense>
  );
}

