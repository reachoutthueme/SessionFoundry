"use client";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { IconDashboard, IconVote, IconResults } from "@/components/ui/Icons";

export default function HomeLandingPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <div className="relative min-h-dvh overflow-hidden bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[var(--brand)]/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#5aa8ff]/25 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 min-h-dvh flex flex-col">
          {/* Center hero */}
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
                <span className="text-white">Session</span>
                <span className="text-[var(--brand)]">Foundry</span>
              </h1>
              <p className="mt-3 text-[var(--muted)] max-w-2xl mx-auto">
                Capture ideas from every group, prioritize them with live voting, and instantly turn the winners into owned actions with deadlines — all in the same session, all in one place.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link href="/login?mode=signup"><Button>Get started free</Button></Link>
                <Link href="/login"><Button variant="outline">Sign in</Button></Link>
              </div>
            </div>
          </div>

          {/* Features at bottom */}
          <div className="pb-10">
            <div className="grid gap-6 md:grid-cols-3">
              <Feature title="Facilitate with ease" text="Create activities, set timers and keep everyone focused." icon={<IconDashboard className="text-[var(--brand)]" />} />
              <Feature title="Real-time participation" text="Participants join with a code, submit ideas and vote." icon={<IconVote className="text-[var(--brand)]" />} />
              <Feature title="Export results" text="One-click CSV, JSON and slide-ready markdown (Pro)." icon={<IconResults className="text-[var(--brand)]" />} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, text, icon }: { title: string; text: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 font-medium">
        <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-white/10 border border-white/10">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <div className="mt-1 text-sm text-[var(--muted)]">{text}</div>
    </div>
  );
}

