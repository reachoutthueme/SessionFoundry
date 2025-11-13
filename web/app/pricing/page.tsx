"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
 
import { apiFetch } from "@/app/lib/apiFetch";

export default function PricingPage() {
  const toast = useToast();

  // plan: "free" | "pro" | null (null = not loaded yet / unknown)
  const [plan, setPlan] = useState<"free" | "pro" | null>(null);

  // busy = currently upgrading/downgrading
  const [busy, setBusy] = useState(false);

  // planLoading = currently fetching plan info from server
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/auth/session", { cache: "no-store" });
        if (!r.ok) {
          // not signed in or server error: treat as "free"
          setPlan("free");
          setPlanLoading(false);
          return;
        }
        const j = await r.json();
        const p = j?.user?.plan === "pro" ? "pro" : "free";
        setPlan(p);
      } catch (err) {
        console.error("Failed to load plan", err);
        setPlan("free");
      } finally {
        setPlanLoading(false);
      }
    })();
  }, []);

  async function upgrade() {
    // If we still don't know the plan (not loaded), or we're already pro, or we're busy: bail
    if (planLoading || busy || plan === "pro") return;

    setBusy(true);
    try {
      const r = await apiFetch("/api/auth/upgrade", { method: "POST" });

      if (!r.ok) {
        toast("Upgrade failed. Please sign in and try again.", "error");
        return;
      }

      setPlan("pro");
      toast("You're now on Pro 🎉", "success");
      // Optional: redirect to dashboard here if you want
      // router.push("/dashboard");
    } catch (err) {
      console.error("upgrade failed", err);
      toast("Upgrade failed. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function downgrade() {
    // If not loaded yet, or we're already free, or we're busy: bail
    if (planLoading || busy || plan === "free") return;

    setBusy(true);
    try {
      const r = await apiFetch("/api/auth/downgrade", { method: "POST" });

      if (!r.ok) {
        toast("Downgrade failed. Please sign in and try again.", "error");
        return;
      }

      setPlan("free");
      toast("You’re now on Free", "success");
    } catch (err) {
      console.error("downgrade failed", err);
      toast("Downgrade failed. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  // helpful booleans for readability
  const isFree = plan === "free";
  const isPro = plan === "pro";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="space-y-6">
      {/* Hero / intro */}
      <div className="rounded-[var(--radius)] border border-white/10 bg-[var(--panel-2)] p-5">
        <h1 className="text-xl font-semibold">Choose your plan</h1>
        <p className="mt-1 text-[var(--muted)]">
          Switch between plans any time. Pro unlocks exports and unlimited sessions.
        </p>
      </div>

      {/* Plans grid */}
      <section
        className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3"
        aria-labelledby="plans-heading"
      >
        <h2 id="plans-heading" className="sr-only">
          Pricing plans
        </h2>

        {/* Free */}
        <div className="relative">
          <Card className="h-full">
            <CardHeader
              title={<span className="text-base font-medium">Free</span>}
              subtitle="Get started"
            />
            <CardBody className="p-0">
              <div className="px-4 pb-1 pt-3">
                <div className="text-3xl font-semibold">
                  $0
                  <span className="text-base font-normal text-[var(--muted)]">
                    /forever
                  </span>
                </div>
              </div>

              <ul className="space-y-2 px-6 pb-4 text-sm">
                <li>• 1 session</li>
                <li>• Participants join for free</li>
                <li>• Exports disabled</li>
                <li>• Core activities</li>
              </ul>

              <div className="px-4 pb-4">
                {isFree ? (
                  <Button
                    variant="outline"
                    disabled
                    className="w-full"
                  >
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={downgrade}
                    disabled={busy || planLoading}
                    className="w-full"
                  >
                    {busy && !isFree ? "Working..." : "Switch to Free"}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Pro (featured) */}
        <div className="relative">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--brand)]/60 bg-[var(--brand)] text-[var(--btn-on-brand)] px-2 py-0.5 text-[11px] shadow"
            aria-label="Most popular plan"
          >
            Most popular
          </div>

          <Card className="h-full ring-1 ring-[var(--brand)]/30">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium">Pro</span>
                </div>
              }
              subtitle="Unlimited sessions and exports"
            />
            <CardBody className="p-0">
              <div className="px-4 pb-1 pt-3">
                <div className="text-3xl font-semibold">
                  $19
                  <span className="text-base font-normal text-[var(--muted)]">
                    /month
                  </span>
                </div>
              </div>

              <ul className="space-y-2 px-6 pb-4 text-sm">
                <li>• Unlimited sessions</li>
                <li>• Export all results</li>
                <li>• Advanced activities (soon)</li>
                <li>• Priority updates</li>
              </ul>

              <div className="px-4 pb-4">
                {isPro ? (
                  <Button
                    disabled
                    className="w-full"
                  >
                    Current plan
                  </Button>
                ) : (
                  <Button
                    onClick={upgrade}
                    disabled={busy || planLoading}
                    className="w-full"
                  >
                    {busy && !isPro ? "Working..." : "Become Pro"}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Enterprise */}
        <div className="relative">
          <Card className="h-full">
            <CardHeader
              title={
                <span className="text-base font-medium">Enterprise</span>
              }
              subtitle="Custom needs & support"
            />
            <CardBody className="p-0">
              <div className="px-4 pb-1 pt-3">
                <div className="text-3xl font-semibold">Custom</div>
              </div>

              <ul className="space-y-2 px-6 pb-4 text-sm">
                <li>• Everything in Pro</li>
                <li>• SSO and custom onboarding</li>
                <li>• SLA &amp; prioritized support</li>
                <li>• Volume pricing</li>
              </ul>

              <div className="px-4 pb-4">
                <a href="#" className="block">
                  <Button
                    variant="outline"
                    className="w-full"
                  >
                    Contact sales
                  </Button>
                </a>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
      </div>
    </div>
  );
}
