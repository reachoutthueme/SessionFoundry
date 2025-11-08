"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";
import { apiFetch } from "@/app/lib/apiFetch";

type T = { id: string; name: string; blurb: string; activities: number };
type Sess = { id: string; name: string };
type Me = { id: string; plan: "free" | "pro" } | null;

export default function TemplatesPage() {
  const toast = useToast();
  const router = useRouter();

  const [list, setList] = useState<T[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [me, setMe] = useState<Me>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const [sessionId, setSessionId] = useState("");
  const [newName, setNewName] = useState("");

  const [applying, setApplying] = useState(false);

  // Load templates, sessions, and current user info in parallel
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [rt, rs, ra] = await Promise.all([
          apiFetch("/api/templates", { cache: "no-store" }),
          apiFetch("/api/sessions", { cache: "no-store" }),
          apiFetch("/api/auth/session", { cache: "no-store" }),
        ]);

        // templates
        let templates: T[] = [];
        if (rt.ok) {
          const jt = await rt.json();
          templates = jt.templates || [];
        } else {
          throw new Error("Failed to load templates");
        }

        // sessions
        let sessList: Sess[] = [];
        if (rs.ok) {
          const js = await rs.json();
          sessList = (js.sessions || []).map((s: any) => ({
            id: s.id as string,
            name: s.name as string,
          }));
        } else {
          throw new Error("Failed to load sessions");
        }

        // user
        let currUser: Me = null;
        if (ra.ok) {
          const ju = await ra.json();
          if (ju?.user) {
            currUser = {
              id: ju.user.id as string,
              plan: (ju.user.plan as "free" | "pro") || "free",
            };
          }
        }

        setList(templates);
        setSessions(sessList);
        setMe(currUser);
      } catch (err) {
        console.error("Failed to load templates page data", err);
        setLoadError("Something went wrong loading templates.");
        setList([]);
        setSessions([]);
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Form validity for Apply
  const formValid =
    (mode === "existing" && sessionId.trim() !== "") ||
    (mode === "new" && newName.trim() !== "");

  // Handle "Use template" click
  function onUseTemplateClick(t: T) {
    // gating: only Pro can apply templates
    if (!me || me.plan !== "pro") {
      toast(
        "Templates are Pro. Upgrade to apply.",
        "info"
      );
      router.push("/settings");
      return;
    }

    // reset modal state for a fresh start
    setSelected(t);
    setMode("existing");
    setSessionId("");
    setNewName("");
    setOpen(true);
  }

  // Apply template: maybe create new session, then apply template, then go to that session
  async function apply() {
    if (!selected) return;
    if (applying) return;
    if (!formValid) {
      toast("Please choose a destination", "error");
      return;
    }

    setApplying(true);
    try {
      let sid = sessionId;

      // 1) create a new session if needed
      if (mode === "new") {
        const cleanName = newName.trim();
        if (!cleanName) {
          toast("Enter a session name", "error");
          setApplying(false);
          return;
        }

        const rCreate = await apiFetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName }),
        });

        const jCreate = await rCreate
          .json()
          .catch(() => ({} as any));

        if (!rCreate.ok) {
          toast(
            jCreate.error || "Failed to create session",
            "error"
          );
          setApplying(false);
          return;
        }

        sid = jCreate.session?.id as string;
        if (!sid) {
          toast(
            "Session created but no ID returned",
            "error"
          );
          setApplying(false);
          return;
        }
      }

      // 2) apply the template to that session
      if (!sid) {
        toast("Please select a session", "error");
        setApplying(false);
        return;
      }

      const rApply = await apiFetch("/api/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selected.id,
          session_id: sid,
        }),
      });

      const jApply = await rApply
        .json()
        .catch(() => ({} as any));

      if (!rApply.ok) {
        toast(
          jApply.error || "Failed to apply template",
          "error"
        );
        setApplying(false);
        return;
      }

      // 3) success: close modal and go to session
      toast("Template applied", "success");
      setOpen(false);
      router.push(`/session/${sid}`);
    } catch (e) {
      console.error("Template apply failed", e);
      toast("Something went wrong", "error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Templates
          </h1>
          <div className="text-sm text-[var(--muted)]">
            Start fast with battle-tested flows
          </div>
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-20 animate-pulse rounded bg-white/10" />
          <div className="h-20 animate-pulse rounded bg-white/10" />
        </div>
      ) : loadError ? (
        <Card>
          <CardBody>
            <div className="text-sm text-[var(--muted)]">
              {loadError}
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((t) => (
            <Card key={t.id}>
              <CardHeader
                title={
                  <>
                    <span>{t.name}</span>{" "}
                    <ProTag />
                  </>
                }
                subtitle={`${t.activities} activities`}
              />
              <CardBody>
                <div className="mb-3 text-sm text-[var(--muted)]">
                  {t.blurb}
                </div>
                <Button
                  onClick={() => {
                    onUseTemplateClick(t);
                  }}
                  disabled={applying}
                >
                  {me && me.plan !== "pro"
                    ? "Upgrade to use"
                    : "Use template"}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for applying template */}
      <Modal
        open={open}
        onClose={() => {
          if (!applying) setOpen(false);
        }}
        title={
          selected
            ? `Use: ${selected.name}`
            : "Use template"
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (!applying) setOpen(false);
              }}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              onClick={apply}
              disabled={applying || !formValid}
            >
              {applying ? "Applying..." : "Apply"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Destination radio toggle */}
          <div className="flex items-center gap-3">
            <label
              className="w-28 text-sm"
              id="destination-label"
            >
              Destination
            </label>
            <div
              className="flex items-center gap-3"
              role="radiogroup"
              aria-labelledby="destination-label"
            >
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dest"
                  checked={mode === "existing"}
                  onChange={() => setMode("existing")}
                  disabled={applying}
                />
                <span>Existing session</span>
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dest"
                  checked={mode === "new"}
                  onChange={() => setMode("new")}
                  disabled={applying}
                />
                <span>New session</span>
              </label>
            </div>
          </div>

          {/* Existing session picker OR new session name */}
          {mode === "existing" ? (
            <div className="flex gap-3">
              <label
                htmlFor="session-select"
                className="w-28 pt-2 text-sm"
              >
                Session
              </label>
              <select
                id="session-select"
                value={sessionId}
                onChange={(e) =>
                  setSessionId(e.target.value)
                }
                disabled={applying}
                className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
              >
                <option value="">
                  Select a session
                </option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex gap-3">
              <label
                htmlFor="new-session-name"
                className="w-28 pt-2 text-sm"
              >
                Name
              </label>
              <input
                id="new-session-name"
                value={newName}
                onChange={(e) =>
                  setNewName(e.target.value)
                }
                disabled={applying}
                className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                placeholder="e.g. Strategy Workshop"
              />
            </div>
          )}

          <div className="text-xs text-[var(--muted)]">
            You can edit activities after applying the
            template.
          </div>
        </div>
      </Modal>
    </div>
  );
}
