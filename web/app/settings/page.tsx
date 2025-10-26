"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Me = {
  id: string;
  email?: string | null;
  plan: "free" | "pro";
} | null;

export default function SettingsPage() {
  const toast = useToast();

  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [upgradeBusy, setUpgradeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });

        if (!r.ok) {
          // could be 401 or server error
          setMe(null);
          setLoadError("Unable to load account info.");
          return;
        }

        const j = await r.json();
        setMe(j.user || null);
      } catch (err) {
        console.error("Failed to load session", err);
        setMe(null);
        setLoadError("Network error while loading account info.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function upgrade() {
    if (upgradeBusy) return;
    setUpgradeBusy(true);

    try {
      const r = await fetch("/api/auth/upgrade", { method: "POST" });

      if (!r.ok) {
        toast("Upgrade failed. Please try again.", "error");
        return;
      }

      // optimistic update to Pro in UI
      setMe((prev) =>
        prev ? { ...prev, plan: "pro" } : prev
      );
      toast("You're now on Pro 🎉", "success");
    } catch (err) {
      console.error("Upgrade failed", err);
      toast("Network error upgrading plan.", "error");
    } finally {
      setUpgradeBusy(false);
    }
  }

  const planLabel =
    me?.plan === "pro" ? "Pro" : "Free";

  const planDescription =
    me?.plan === "pro"
      ? "Pro: Unlimited sessions, exports, and upcoming pro features."
      : "Free: 1 session, no exports. Upgrade to unlock unlimited sessions and exports.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--muted)]">
          Account and plan
        </p>
      </div>

      {/* Plan card */}
      <Card>
        <CardHeader
          title="Plan"
          subtitle="Manage your facilitator plan"
        />
        <CardBody>
          {loading ? (
            <div className="h-10 animate-pulse rounded bg-white/10" />
          ) : !me ? (
            <div className="text-sm text-[var(--muted)]">
              {loadError
                ? loadError
                : "You are not signed in."}
            </div>
          ) : (
            <div
              className="flex items-center justify-between"
              aria-live="polite"
            >
              <div>
                <div className="font-medium">
                  {planLabel}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {planDescription}
                </div>
              </div>

              {me.plan === "free" && (
                <Button
                  onClick={upgrade}
                  disabled={upgradeBusy}
                >
                  {upgradeBusy
                    ? "Upgrading..."
                    : "Upgrade to Pro"}
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Profile card */}
      <Card>
        <CardHeader
          title="Profile"
          subtitle="Basic info"
        />
        <CardBody>
          {loading ? (
            <div className="h-10 animate-pulse rounded bg-white/10" />
          ) : !me ? (
            <div className="text-sm text-[var(--muted)]">
              {loadError
                ? loadError
                : "You are not signed in."}
            </div>
          ) : (
            <div className="text-sm">
              <div>
                <span className="mr-2 text-[var(--muted)]">
                  User ID:
                </span>
                <span className="font-mono text-xs">
                  {me.id}
                </span>
              </div>

              <div className="mt-1">
                <span className="mr-2 text-[var(--muted)]">
                  Email:
                </span>
                <span>{me.email || "-"}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}