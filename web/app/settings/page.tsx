"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Me = { id: string; email?: string|null; plan: 'free'|'pro' } | null;

export default function SettingsPage() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await fetch('/api/auth/session', { cache:'no-store' }); const j = await r.json(); setMe(j.user || null); } catch {}
      setLoading(false);
    })();
  }, []);

  async function upgrade() {
    const r = await fetch('/api/auth/upgrade', { method: 'POST' });
    if (r.ok) { location.reload(); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Account and plan</p>
      </div>

      <Card>
        <CardHeader title="Plan" subtitle="Manage your facilitator plan" />
        <CardBody>
          {loading ? (
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          ) : !me ? (
            <div className="text-sm text-[var(--muted)]">You are not signed in.</div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{me.plan === 'pro' ? 'Pro' : 'Free'}</div>
                {me.plan === 'free' ? (
                  <div className="text-sm text-[var(--muted)]">Free: 1 session, no exports. Upgrade to unlock unlimited sessions and exports.</div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">Pro: Unlimited sessions, exports, and upcoming pro features.</div>
                )}
              </div>
              {me.plan === 'free' && (
                <Button onClick={upgrade}>Upgrade to Pro</Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Profile" subtitle="Basic info" />
        <CardBody>
          {loading ? (
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          ) : !me ? (
            <div className="text-sm text-[var(--muted)]">You are not signed in.</div>
          ) : (
            <div className="text-sm">
              <div><span className="text-[var(--muted)] mr-2">User ID:</span><span className="font-mono text-xs">{me.id}</span></div>
              <div className="mt-1"><span className="text-[var(--muted)] mr-2">Email:</span><span>{me.email || '-'}</span></div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

