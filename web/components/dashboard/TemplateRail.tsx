"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";

type PublicTemplate = {
  id: string;
  name: string;
  blurb: string;
  activities: number;
};

type Me = { id: string; plan: "free" | "pro" } | null;

export default function TemplateRail() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [me, setMe] = useState<Me>(null);

  // Modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PublicTemplate | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [busy, setBusy] = useState(false);

  const isPro = me?.plan === "pro";

  useEffect(() => {
    (async () => {
      try {
        const [tRes, uRes] = await Promise.all([
          fetch("/api/templates", { cache: "force-cache" }),
          fetch("/api/auth/session", { cache: "no-store" }).catch(() => null),
        ]);

        if (!tRes.ok) throw new Error("Failed to load templates");
        const tj = await tRes.json();
        setTemplates(Array.isArray(tj.templates) ? tj.templates.slice(0, 6) : []);

        if (uRes && uRes.ok) {
          const uj = await uRes.json();
          if (uj?.user) setMe({ id: uj.user.id, plan: uj.user.plan || "free" });
        }
      } catch (e) {
        console.error("templates load error", e);
        setError("Failed to load templates");
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const top = useMemo(() => templates.slice(0, 4), [templates]);

  async function createFromTemplate() {
    const t = selected;
    const name = sessionName.trim();
    if (!t || !name || busy) return;

    setBusy(true);
    try {
      // Create session
      const cr = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const cj = await cr.json().catch(() => ({} as any));
      if (!cr.ok) {
        toast(cj.error || "Failed to create session", "error");
        return;
      }
      const sessionId = cj.session?.id as string | undefined;
      if (!sessionId) {
        toast("Missing session id", "error");
        return;
      }

      // Apply template (Pro only)
      const ar = await fetch("/api/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: t.id, session_id: sessionId }),
      });
      if (!ar.ok) {
        const aj = await ar.json().catch(() => ({} as any));
        toast(aj.error || "Failed to apply template", "error");
        // Navigate to session anyway so user can proceed manually
        router.push(`/session/${sessionId}`);
        return;
      }

      toast("Template applied", "success");
      router.push(`/session/${sessionId}`);
    } catch (e) {
      console.error("createFromTemplate error", e);
      toast("Network error", "error");
    } finally {
      setBusy(false);
      setOpen(false);
      setSelected(null);
      setSessionName("");
    }
  }

  return (
    <Card>
      <CardHeader title="Start with these templates" subtitle="Pick a workflow and get going fast" />
      <CardBody className="p-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <div className="p-2 text-sm text-[var(--muted)]">{error}</div>
        ) : top.length === 0 ? (
          <div className="p-2 text-sm text-[var(--muted)]">No templates available.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {top.map((t) => (
                <div
                  key={t.id}
                  className="group relative overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-3 hover:border-white/20"
                >
                  <div className="text-[13px] font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {t.activities} activities
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{t.blurb}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelected(t);
                        setSessionName(t.name);
                        setOpen(true);
                      }}
                    >
                      Create from template
                    </Button>
                    {!isPro && <ProTag />}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => router.push("/templates")}>Browse all templates</Button>
            </div>
          </>
        )}

        {open && selected && (
          <Modal open={open} onClose={() => !busy && setOpen(false)} title={`New session from "${selected.name}"`}>
            <div className="space-y-3">
              <div>
                <label htmlFor="t-name" className="block text-xs text-[var(--muted)]">Session name</label>
                <input
                  id="t-name"
                  autoFocus
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Team Retro — April"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--muted)]">
                  {isPro ? "Template activities will be added." : "Applying templates requires Pro."}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={busy || !sessionName.trim()} onClick={createFromTemplate}>
                    {busy ? "Creating…" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </CardBody>
    </Card>
  );
}
