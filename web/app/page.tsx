"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function RootJoinPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const r = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ join_code: code.trim().toUpperCase(), display_name: name.trim() || undefined }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "Failed to join"); return; }
    location.href = `/participant/${j.session.id}`;
  }

  return (
    <div className="min-h-dvh flex flex-col p-6">
      <div className="flex-1" />
      <div className="text-center mb-2">
<h1 className="text-3xl md:text-5xl font-semibold tracking-tight whitespace-nowrap">
  <span className="text-white">Session</span>
  <span className="text-[var(--brand)]">Foundry</span>
</h1>
      </div>
      <div className="flex-1" />

      <div className="w-full max-w-md self-center">
        <div className="rounded-[var(--radius)] border border-white/15 bg-white/10 backdrop-blur-md shadow-lg p-6 text-left">
          <h1 className="text-lg font-semibold mb-4">Join a workshop</h1>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Join code</label>
              <input
                value={code}
                onChange={e=>setCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g., F7KM)"
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Your name (optional)</label>
              <input
                value={name}
                onChange={e=>setName(e.target.value)}
                placeholder="How should we show your name?"
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none focus:ring-[var(--ring)]"
              />
            </div>
            {err && <div className="text-sm text-red-300">{err}</div>}
            <div className="pt-1">
              <Button onClick={submit} className="w-full">Join</Button>
            </div>
          </div>
        </div>
        <div className="text-center mt-3">
          <Link href="/home"><Button variant="outline">Create workshop</Button></Link>
        </div>
      </div>
      <div className="flex-[2]" />
    </div>
  );
}


