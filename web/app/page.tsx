"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Link from "next/link";
import pkg from "@/package.json";

export default function RootJoinPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const displayRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    // reset old error
    setErr(null);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setErr("Please enter a join code.");
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
    <div className="min-h-dvh flex flex-col p-6">
      {/* Version badge */}
      <div className="fixed right-3 bottom-3 z-50">
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-[var(--muted)]">
          v{(pkg as any)?.version || "dev"}
        </span>
      </div>
      {/* spacer above heading */}
      <div className="flex-1" />

      {/* logo / hero */}
      <div className="mb-2 text-center">
        <h1 className="whitespace-nowrap text-3xl font-semibold tracking-tight text-white md:text-5xl">
          <span className="text-white">Session</span>
          <span className="text-[var(--brand)]">Foundry</span>
        </h1>
      </div>

      {/* spacer between heading and card */}
      <div className="flex-1" />

      {/* join card */}
      <div className="w-full max-w-md self-center">
        <div className="rounded-[var(--radius)] border border-white/15 bg-white/10 p-6 text-left shadow-lg backdrop-blur-md">
          <h2 className="mb-4 text-lg font-semibold">
            Join a workshop
          </h2>

          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <div>
              <label
                htmlFor="join-code"
                className="mb-1 block text-sm"
              >
                Join code
              </label>
              <input
                id="join-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    displayRef.current?.focus();
                  }
                }}
                placeholder="Enter code (e.g., F7KM)"
                className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none focus:ring-[var(--ring)]"
                disabled={joining}
              />
            </div>

            <div>
              <label
                htmlFor="display-name"
                className="mb-1 block text-sm"
              >
                Your display name
              </label>
              <input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we display your name?"
                className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none focus:ring-[var(--ring)]"
                disabled={joining}
                ref={displayRef}
              />
            </div>

            {err && (
              <div className="text-sm text-red-300">
                {err}
              </div>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                className="w-full"
                disabled={joining}
              >
                {joining ? "Joining..." : "Join"}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-3 text-center">
          <Link href="/home">
            <Button variant="outline">
              Create workshop
            </Button>
          </Link>
        </div>
      </div>

      {/* spacer below card */}
      <div className="flex-[2]" />
    </div>
  );
}
