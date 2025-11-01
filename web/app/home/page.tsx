import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import {
  IconDashboard,
  IconVote,
  IconResults,
  IconPresentation,
  IconChevronRight,
} from "@/components/ui/Icons";

export default function HomeLandingPage() {
  const primaryCtaRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || tag === "button";
      if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isTyping) {
        primaryCtaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <div
        className="relative min-h-dvh overflow-hidden"
        aria-label="Marketing hero background"
      >
        {/* Background depth layers */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          {/* faint grid/grain */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.7) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
            aria-hidden
          />
          {/* soft radial behind hero */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(700px 460px at 45% 40%, rgba(155,107,255,.10), transparent 60%)",
            }}
            aria-hidden
          />
          {/* gentle brand sweep */}
          <div
            className="absolute inset-0 opacity-[.06] animate-gradient-drift"
            style={{
              background:
                "linear-gradient(120deg, rgba(155,107,255,.35), rgba(90,168,255,.25), rgba(99,62,214,.28))",
              filter: "blur(50px)",
            }}
            aria-hidden
          />
        </div>

        <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
          {/* Center hero */}
          <div className="grid flex-1 place-items-center text-center">
            <div className="animate-fade-up">
              <h1 className="text-4xl font-semibold tracking-[-0.01em] text-balance md:text-6xl">
                Run structured workshops. Leave with owned actions.
              </h1>

              <p className="mx-auto mt-4 max-w-[70ch] text-[var(--muted)] text-balance leading-[1.7]">
                Capture ideas from every group, prioritize them with live
                voting, and instantly turn the winners into owned actions
                with deadlines — all in the same session, all in one place.
              </p>

              {/* CTA block */}
              <div className="mt-7 flex items-center justify-center gap-4">
                <Link href="/login?mode=signup" ref={primaryCtaRef} className="focus:outline-none">
                  <Button className="h-11 px-5 text-base">Get started free</Button>
                </Link>
                <Link href="/login" className="text-sm text-[var(--muted)] hover:underline">
                  Sign in
                </Link>
              </div>
              <div className="mt-2 text-xs text-[var(--muted)]">No credit card • 2-min setup</div>

              {/* Guided path */}
              <div className="mt-6 flex items-center justify-center gap-3 text-sm text-[var(--muted)]">
                <Step icon={<IconPresentation className="text-[var(--brand)]" aria-hidden />} label="Create session" />
                <IconChevronRight className="opacity-60" aria-hidden />
                <Step icon={<IconVote className="text-[var(--brand)]" aria-hidden />} label="Participants join with a code" />
                <IconChevronRight className="opacity-60" aria-hidden />
                <Step icon={<IconResults className="text-[var(--brand)]" aria-hidden />} label="Vote & export actions" />
              </div>
            </div>
          </div>

          {/* Features */}
          <section
            className="pb-12"
            aria-labelledby="features-heading"
          >
            <h2 id="features-heading" className="sr-only">
              Key features
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              <Feature
                title="Facilitate with ease"
                text="Create activities, set timers and keep everyone focused."
                icon={<IconDashboard className="text-[var(--brand)]" aria-hidden />}
                delayMs={0}
              />
              <Feature
                title="Real-time participation"
                text="Participants join with a code, submit ideas and vote."
                icon={<IconVote className="text-[var(--brand)]" aria-hidden />}
                delayMs={80}
              />
              <Feature
                title="Export results"
                text="One-click CSV, JSON and slide-ready markdown (Pro)."
                icon={<IconResults className="text-[var(--brand)]" aria-hidden />}
                delayMs={160}
              />
            </div>
          </section>
        </div>
      </div>
      <style jsx>{`
        @keyframes fade-up { from { opacity: 0; transform: translateY(6px) scale(.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-up { animation: fade-up 160ms ease-out both; }
        @keyframes slide-in { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slide-in 160ms ease-out both; }
        @keyframes gradient-drift { 0%{ transform: translate3d(0,0,0) } 100%{ transform: translate3d(0,-2%,0) } }
        .animate-gradient-drift { animation: gradient-drift 12s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-up, .animate-slide-in, .animate-gradient-drift { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

function Feature({
  title,
  text,
  icon,
  delayMs = 0,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
  delayMs?: number;
}) {
  return (
    <div
      className="group h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,.35)] focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--panel)] animate-slide-in"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3 font-medium">
        <span className="inline-grid h-10 w-10 place-items-center rounded-full bg-white/4 ring-1 ring-white/10">
          {icon}
        </span>
        <span className="text-left">{title}</span>
      </div>
      <div className="mt-2 text-left text-sm text-[var(--muted)] line-clamp-2">{text}</div>
      <div className="mt-3 text-left">
        <Link href="/home#how-it-works" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline focus:outline-none">
          Learn more <IconChevronRight className="opacity-70" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-grid h-6 w-6 place-items-center rounded-md bg-white/5 ring-1 ring-white/10">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}
