"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Link from "next/link";
import pkg from "@/package.json";
import Modal from "@/components/ui/Modal";

export default function RootJoinPage() {
  const router = useRouter();

  // Segmented join code (4 boxes)
  const [codeSegs, setCodeSegs] = useState<string[]>(["", "", "", ""]);
  const code = useMemo(() => codeSegs.join("").toUpperCase(), [codeSegs]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const displayRef = useRef<HTMLInputElement | null>(null);
  const codeRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  // Do not prefill display name on first visit
  useEffect(() => {
    try {
      if (name) localStorage.setItem("sf_display_name", name);
    } catch {}
  }, [name]);

  async function submit() {
    // reset old error
    setErr(null);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (cleanCode.length !== 4) {
      setErr("That code doesn't look right.");
      return;
    }

    setJoining(true);

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

      // we try parsing JSON either way because server gives us errors in JSON too
      const j = await r.json().catch(() => ({} as any));

      if (!r.ok) {
        setErr(j.error || "Failed to join");
        setJoining(false);
        return;
      }

      if (!j?.session?.id) {
        setErr("Joined, but no session returned.");
        setJoining(false);
        return;
      }

      // navigate to participant view without full reload
      router.push(`/participant/${j.session.id}`);
    } catch (e) {
      console.error("Join failed", e);
      setErr("Network error. Please try again.");
      setJoining(false);
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col p-6 overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* soft radial vignette behind card */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 380px at 50% 55%, rgba(155,107,255,.14), transparent 60%)",
          }}
        />
        {/* gentle brand gradient sweep */}
        <div
          className="absolute inset-0 opacity-20 animate-gradient-drift"
          style={{
            background:
              "linear-gradient(120deg, rgba(155,107,255,.25), rgba(90,168,255,.18), rgba(99,62,214,.22))",
            filter: "blur(40px)",
          }}
        />
      </div>
      {/* spacer above heading */}
      <div className="flex-1" />

      {/* logo / hero */}
      <div className="mb-2 text-center">
        <h1 className="whitespace-nowrap text-3xl font-semibold tracking-tight text-white md:text-5xl">
          <span className="text-white">Session</span>
          <span className="text-[var(--brand)] drop-shadow-[0_0_24px_rgba(155,107,255,.35)]">Foundry</span>
        </h1>
        <div className="mt-2 text-[15px] text-[var(--muted)]">
          Real-time workshops, structured outcomes.
        </div>
      </div>

      {/* spacer between heading and card */}
      <div className="flex-1" />

      {/* Headline above card */}
      <div className="text-center mb-2 text-[17px] text-[var(--ink-dim,rgba(255,255,255,.72))]">
        Join a workshop
      </div>

      {/* join card */}
      <div className="w-full max-w-md self-center animate-fade-up">
        <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-6 text-left shadow-2xl backdrop-blur-md">

          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <div>
              <label className="mb-1 block text-sm">Join code</label>
              <div className="grid grid-cols-4 gap-2" aria-describedby={err ? "code-error" : undefined}>
                {codeSegs.map((val, idx) => (
                  <input
                    key={idx}
                    ref={codeRefs[idx]}
                    inputMode="text"
                    autoComplete="one-time-code"
                    aria-label={`Code character ${idx + 1}`}
                    aria-invalid={!!err && code.length !== 4}
                    maxLength={1}
                    value={val}
                    onChange={(e) => {
                      const ch = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setErr(null);
                      setCodeSegs((prev) => {
                        const next = [...prev];
                        next[idx] = ch.slice(-1) || "";
                        return next;
                      });
                      if (ch) {
                        const nextEl = codeRefs[idx + 1]?.current;
                        nextEl?.focus();
                        nextEl?.select?.();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !codeSegs[idx]) {
                        const prevEl = codeRefs[idx - 1]?.current;
                        prevEl?.focus();
                        prevEl?.select?.();
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        displayRef.current?.focus();
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
                      if (text && text.length >= 1) {
                        e.preventDefault();
                        const chars = text.slice(0, 4).split("");
                        setCodeSegs((prev) => prev.map((_, i) => chars[i] || ""));
                        // focus last filled or name input
                        const last = Math.min(chars.length, 4) - 1;
                        if (last >= 0 && last < 3) codeRefs[last + 1]?.current?.focus();
                        else displayRef.current?.focus();
                      }
                    }}
                    className="h-10 w-full text-center rounded-md border border-white/10 bg-[var(--panel)] outline-none focus:ring-[var(--ring)] text-lg tracking-widest [font-variant-numeric:tabular-nums]"
                    disabled={joining}
                  />
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="display-name"
                className="mb-1 block text-sm"
              >
                Display name
              </label>
              <div className="flex items-center gap-2">
                <div className="grid place-items-center h-9 w-9 rounded-full bg-white/10 border border-white/10 text-sm">
                  {name.trim() ? name.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join("") : "?"}
                </div>
                <input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we display your name?"
                  className="h-10 flex-1 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none focus:ring-[var(--ring)]"
                  disabled={joining}
                  ref={displayRef}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {err && (
              <div id="code-error" aria-live="polite" className="text-sm text-red-300">
                {err}
              </div>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                className={`w-full ${joining ? 'opacity-80' : ''}`}
                disabled={joining || code.length !== 4 || name.trim().length === 0}
              >
                {joining ? "Joining..." : "Join"}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-3 text-center">
          <Link href="/login">
            <Button variant="outline">
              Create workshop
            </Button>
          </Link>
        </div>
      </div>

      {/* spacer below card */}
      <div className="flex-[2]" />

      {/* footer links (pinned bottom) */}
      <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 text-center text-sm text-[var(--muted)]">
        <button type="button" className="hover:underline" onClick={() => setShowTerms(true)}>Terms</button>
        <span className="mx-2">|</span>
        <button type="button" className="hover:underline" onClick={() => setShowPrivacy(true)}>Privacy</button>
        <span className="mx-2">|</span>
        <span>v{(pkg as any)?.version || "dev"}</span>
      </footer>

      {/* Policy modals (match app chrome) */}
      <Modal
        open={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
        size="lg"
        footer={
          <button
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => setShowPrivacy(false)}
          >
            Close
          </button>
        }
      >
        <div className="w-full h-[70vh]">
          <iframe src="/privacy" className="w-full h-full rounded" />
        </div>
      </Modal>
      <Modal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms & Conditions"
        size="lg"
        footer={
          <button
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => setShowTerms(false)}
          >
            Close
          </button>
        }
      >
        <div className="w-full h-[70vh]">
          <iframe src="/terms" className="w-full h-full rounded" />
        </div>
      </Modal>

      {/* animations moved to globals.css */}
    </div>
  );
}
