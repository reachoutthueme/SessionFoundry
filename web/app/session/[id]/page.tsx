"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { IconCopy } from "@/components/ui/Icons";
import ProTag from "@/components/ui/ProTag";
import { Tabs } from "@/components/ui/Tabs";
import ResultsPanel from "@/components/session/ResultsPanel.vibrant";
import ActivitiesManager from "@/components/session/ActivitiesManager";
import GroupsManager from "@/components/session/GroupsManager";
import FacilitatorNotes from "@/components/session/FacilitatorNotes";

type Sess = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  created_at: string;
};

export default function Page() {
  const params = useParams();
  const id = Array.isArray(params.id)
    ? (params.id[0] as string)
    : (params.id as string);

  const toast = useToast();

  // session state
  const [s, setS] = useState<Sess | null>(null);

  // loading / error around initial fetch
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // editing state
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // export dropdown state
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  // busy state for actions (rename / status update)
  const [saving, setSaving] = useState(false);

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!exportOpen) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const el = exportRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [exportOpen]);

  // Fetch session details
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/session/${id}`, { cache: "no-store" });

        if (!res.ok) {
          // 401 / 403 / 500 etc.
          let msg = "Failed to load session";
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            // ignore json parse errors
          }
          setLoadError(msg);
          setS(null);
          return;
        }

        const json = await res.json();
        setS(json.session ?? null);
      } catch (err) {
        console.error("Failed to fetch session", err);
        setLoadError("Network error loading session");
        setS(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Helper to PATCH session safely
  async function updateSession(patch: Record<string, unknown>) {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/session/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        console.error("Session update failed", j);
        toast(j.error || "Update failed", "error");
        return null;
      }

      // success
      const updated = j.session || null;
      setS(updated);
      toast("Saved", "success");
      return updated;
    } catch (err) {
      console.error("Session update threw", err);
      toast("Network error", "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  // --- Render states --------------------------------------------------------

  if (loading) {
    // basic skeleton-ish fallback
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-md border border-white/10 bg-white/5 animate-pulse" />
        <div className="h-64 rounded-md border border-white/10 bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (loadError || !s) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-white/10 bg-[var(--panel)] p-4">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--brand)]">
            Session
          </h1>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {loadError || "Session not found or access denied."}
          </div>
        </div>
      </div>
    );
  }

  // --- Main content ---------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {editing ? (
              <span className="inline-flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-9 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                />
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    const n = nameInput.trim();
                    if (!n || !s) return;
                    const updated = await updateSession({ name: n });
                    if (updated) {
                      setEditing(false);
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setNameInput(s?.name || "");
                  }}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <span>
                <span className="text-[var(--brand)]">Session:</span>{" "}
                {s.name}
              </span>
            )}
          </h1>

          <div className="text-xs text-[var(--muted)] flex items-center gap-1">
            <span>ID {id?.slice(0, 8)}</span>
            {s.join_code && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-[1px] text-[var(--text)]">
                <span className="opacity-80">Join</span>
                <span className="font-mono text-[11px] leading-none">
                  {s.join_code}
                </span>
                <button
                  className="rounded p-0.5 hover:bg-white/5"
                  title="Copy join code"
                  aria-label="Copy join code"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(s.join_code);
                      toast("Join code copied", "success");
                    } catch {
                      toast("Copy failed", "error");
                    }
                  }}
                >
                  <IconCopy size={12} />
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          {!editing && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setEditing(true);
                setNameInput(s.name);
              }}
            >
              Rename
            </Button>
          )}

          {s.status === "Draft" || s.status === "Inactive" ? (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                await updateSession({ status: "Active" });
              }}
            >
              Activate
            </Button>
          ) : null}

          {s.status === "Active" ? (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                await updateSession({ status: "Completed" });
              }}
            >
              Complete
            </Button>
          ) : null}

          <div
            className="relative"
            ref={exportRef}
          >
            <Button
              variant="outline"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((o) => !o)}
            >
              <span className="inline-flex items-center gap-1">
                Export <span className="opacity-80">▾</span>
              </span>{" "}
              <ProTag />
            </Button>

            {exportOpen && (
              <div
                className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-white/10 bg-[var(--panel)] shadow-lg"
                role="menu"
                aria-label="Export options"
              >
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.open(
                      `/api/session/${id}/export/results`,
                      "_blank"
                    );
                  }}
                >
                  <span>Results CSV</span>
                  <ProTag />
                </button>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.open(
                      `/api/session/${id}/export/activities`,
                      "_blank"
                    );
                  }}
                >
                  <span>Activities CSV</span>
                  <ProTag />
                </button>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.open(
                      `/api/session/${id}/export/json`,
                      "_blank"
                    );
                  }}
                >
                  <span>JSON</span>
                  <ProTag />
                </button>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.open(
                      `/api/session/${id}/export/deck`,
                      "_blank"
                    );
                  }}
                >
                  <span>Deck (MD)</span>
                  <ProTag />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            label: "Activities",
            content: (
              <ActivitiesManager
                sessionId={id}
                sessionStatus={s.status}
              />
            ),
          },
          {
            label: "Participants",
            content: <GroupsManager sessionId={id} />,
          },
          {
            label: "Results",
            content: <ResultsPanel sessionId={id} />,
          },
          {
            label: "Notes",
            content: <FacilitatorNotes sessionId={id} />,
          },
        ]}
      />
    </div>
  );
}