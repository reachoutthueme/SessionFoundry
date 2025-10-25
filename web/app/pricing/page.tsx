"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function PricingPage() {
  const [plan, setPlan] = useState<"free"|"pro"|null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const j = await r.json();
        setPlan(j?.user?.plan || "free");
      } catch {
        setPlan("free");
      }
    })();
  }, []);

  async function upgrade() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/upgrade", { method: "POST" });
      if (r.ok) setPlan("pro");
    } finally {
      setBusy(false);
    }
  }
  async function downgrade() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/downgrade", { method: "POST" });
      if (r.ok) setPlan("free");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius)] border border-white/10 bg-[var(--panel-2)] p-5">
        <h1 className="text-xl font-semibold">Choose your plan</h1>
        <p className="text-[var(--muted)] mt-1">Switch between plans any time. Pro unlocks exports and unlimited sessions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Free */}
        <div className="relative">
          <Card className="h-full">
            <CardHeader title="Free" subtitle="Get started" />
            <CardBody className="p-0">
              <div className="px-4 pt-3 pb-1">
                <div className="text-3xl font-semibold">$0<span className="text-base font-normal text-[var(--muted)]">/forever</span></div>
              </div>
              <ul className="text-sm px-6 pb-4 space-y-2">
                <li>• 1 session</li>
                <li>• Participants join for free</li>
                <li>• Exports disabled</li>
                <li>• Core activities</li>
              </ul>
              <div className="px-4 pb-4">
                {plan === "free" ? (
                  <Button variant="outline" disabled className="w-full">Current plan</Button>
                ) : (
                  <Button variant="outline" onClick={downgrade} disabled={busy} className="w-full">Switch to Free</Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Pro (featured) */}
        <div className="relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] px-2 py-0.5 rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/15">Most popular</div>
          <Card className="h-full ring-1 ring-[var(--brand)]/30">
            <CardHeader title={<div className="flex items-center gap-2"><span>Pro</span></div>} subtitle="Unlimited sessions and exports" />
            <CardBody className="p-0">
              <div className="px-4 pt-3 pb-1">
                <div className="text-3xl font-semibold">$19<span className="text-base font-normal text-[var(--muted)]">/month</span></div>
              </div>
              <ul className="text-sm px-6 pb-4 space-y-2">
                <li>• Unlimited sessions</li>
                <li>• Export all results</li>
                <li>• Advanced activities (soon)</li>
                <li>• Priority updates</li>
              </ul>
              <div className="px-4 pb-4">
                {plan === "pro" ? (
                  <Button disabled className="w-full">Current plan</Button>
                ) : (
                  <Button onClick={upgrade} disabled={busy} className="w-full">Become Pro</Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Enterprise */}
        <div className="relative">
          <Card className="h-full">
            <CardHeader title="Enterprise" subtitle="Custom needs & support" />
            <CardBody className="p-0">
              <div className="px-4 pt-3 pb-1">
                <div className="text-3xl font-semibold">Custom</div>
              </div>
              <ul className="text-sm px-6 pb-4 space-y-2">
                <li>• Everything in Pro</li>
                <li>• SSO and custom onboarding</li>
                <li>• SLA & prioritized support</li>
                <li>• Volume pricing</li>
              </ul>
              <div className="px-4 pb-4">
                <a href="#" className="block">
                  <Button variant="outline" className="w-full">Contact sales</Button>
                </a>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
