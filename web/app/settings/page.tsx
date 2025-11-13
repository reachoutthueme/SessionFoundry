"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/app/lib/apiFetch";

type Me = { id: string; email?: string | null; plan: "free" | "pro"; is_admin?: boolean; } | null;

 

export default function SettingsPage() {
  const toast = useToast();

  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [downgradeBusy, setDowngradeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await apiFetch("/api/auth/session", { cache: "no-store" });

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
      const r = await apiFetch("/api/auth/upgrade", { method: "POST" });

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
    <div className="relative min-h-dvh overflow-hidden">
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

              {me?.is_admin && me.plan === "free" && (
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

      {/* Change password */}
      <Card>
        <CardHeader
          title="Change Password"
          subtitle="Update your account password"
        />
        <CardBody>
          {loading ? (
            <div className="h-24 animate-pulse rounded bg-white/10" />
          ) : !me ? (
            <div className="text-sm text-[var(--muted)]">
              {loadError ? loadError : "You are not signed in."}
            </div>
          ) : (
            <ChangePasswordForm />
          )}
        </CardBody>
      </Card>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const toast = useToast();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<{ old: boolean; n1: boolean; n2: boolean }>({ old: false, n1: false, n2: false });

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!oldPw || !newPw || !confirmPw) {
      toast("Please fill in all fields", "error");
      return;
    }
    if (newPw !== confirmPw) {
      toast("New passwords do not match", "error");
      return;
    }
    if (newPw.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        toast(j?.error || "Failed to change password", "error");
        return;
      }
      toast("Password updated", "success");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="flex items-center gap-3">
        <label className="w-40 text-sm text-[var(--muted)]">Current password</label>
        <input
          type={show.old ? "text" : "password"}
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
          className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
          autoComplete="current-password"
        />
        <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setShow((s)=>({ ...s, old: !s.old }))}>
          {show.old ? "Hide" : "Show"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="w-40 text-sm text-[var(--muted)]">New password</label>
        <input
          type={show.n1 ? "text" : "password"}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
          autoComplete="new-password"
        />
        <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setShow((s)=>({ ...s, n1: !s.n1 }))}>
          {show.n1 ? "Hide" : "Show"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="w-40 text-sm text-[var(--muted)]">Confirm new password</label>
        <input
          type={show.n2 ? "text" : "password"}
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
          autoComplete="new-password"
        />
        <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setShow((s)=>({ ...s, n2: !s.n2 }))}>
          {show.n2 ? "Hide" : "Show"}
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setOldPw(""); setNewPw(""); setConfirmPw(""); }}>
          Reset
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Change Password"}
        </Button>
      </div>
    </form>
  );
}





