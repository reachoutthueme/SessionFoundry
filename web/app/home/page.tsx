import Button from "@/components/ui/Button";
import Link from "next/link";
import {
  IconDashboard,
  IconVote,
  IconResults,
} from "@/components/ui/Icons";

export default function HomeLandingPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <div
        className="relative min-h-dvh overflow-hidden bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90"
        aria-label="Marketing hero background"
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[var(--brand)]/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#5aa8ff]/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
          {/* Center hero */}
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <h1
                className="text-3xl font-semibold tracking-tight text-balance md:text-5xl"
                aria-label="Session Foundry"
              >
                <span className="text-[var(--text)]">Session</span>
                <span className="text-[var(--brand)]">Foundry</span>
              </h1>

              <p className="mx-auto mt-3 max-w-2xl text-[var(--muted)] text-balance">
                Capture ideas from every group, prioritize them with live
                voting, and instantly turn the winners into owned actions
                with deadlines — all in the same session, all in one place.
              </p>

              {/* CTA buttons */}
              <div className="mt-6 flex items-center justify-center gap-3">
                {/* NOTE: Long term, Button should support rendering as <a> to avoid nesting interactive elements */}
                <Link href="/login?mode=signup">
                  <Button>Get started free</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline">Sign in</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Features */}
          <section
            className="pb-10"
            aria-labelledby="features-heading"
          >
            <h2 id="features-heading" className="sr-only">
              Key features
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              <Feature
                title="Facilitate with ease"
                text="Create activities, set timers and keep everyone focused."
                icon={
                  <IconDashboard
                    className="text-[var(--brand)]"
                    aria-hidden="true"
                  />
                }
              />
              <Feature
                title="Real-time participation"
                text="Participants join with a code, submit ideas and vote."
                icon={
                  <IconVote
                    className="text-[var(--brand)]"
                    aria-hidden="true"
                  />
                }
              />
              <Feature
                title="Export results"
                text="One-click CSV, JSON and slide-ready markdown (Pro)."
                icon={
                  <IconResults
                    className="text-[var(--brand)]"
                    aria-hidden="true"
                  />
                }
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Feature({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 font-medium">
        <span className="inline-grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/10">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <div className="mt-1 text-sm text-[var(--muted)]">{text}</div>
    </div>
  );
}
