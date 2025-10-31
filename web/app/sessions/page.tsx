"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Empty from "@/components/ui/Empty";
import Modal from "@/components/ui/Modal";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";

type Sess = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  join_code: string;
};

type Me = { id: string; plan: "free" | "pro" } | null;

export default function Page() {
  const toast = useToast();
  const router = useRouter();

  // Modal + form state
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Data loading state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Sess[]>([]);
  const [me, setMe] = useState<Me>(null);

  // Action states
  const [creating, setCreating] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  // Load current user's plan / id
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (!r.ok) {
          setMe(null);
          return;
        }
        const j = await r.json();
        if (j?.user) {
          setMe({ id: j.user.id, plan: j.user.plan || "free" });
        } else {
          setMe(null);
        }
      } catch (err) {
        console.error("Failed to load user session", err);
        setMe(null);
      }
    })();
  }, []);

  // Fetch sessions list
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      if (!res.ok) {
        let msg = "Failed to load sessions";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore parse fail
        }
        setLoadError(msg);
        setSessions([]);
        return;
      }
      const json = await res.json();
      setSessions(json.sessions ?? []);
    } catch (err) {
      console.error("Failed to load sessions", err);
      setLoadError("Network error loading sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Open create modal if query param ?new=1 is present
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("new") === "1") {
        if (reachedFreeLimit) {
          toast("Free plan allows 1 session. Upgrade to create more.", "error");
        } else {
          setOpen(true);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedFreeLimit]);

  const isFreePlan = me?.plan === "free";
  const reachedFreeLimit = isFreePlan && sessions.length >= 1;

  // Create a new session
  async function create() {
    const n = name.trim();
    if (!n || creating) return;

    // Don't allow creating more if on free and already at limit
    if (reachedFreeLimit) {
      toast("Free plan allows 1 session. Upgrade to create more.", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        toast(json.error || "Failed to create", "error");
        return;
      }

      toast("Session created", "success");
      setOpen(false);
      setName("");

      if (json.session?.id) {
        router.push(`/session/${json.session.id}`);
      } else {
        // fallback: reload list if we didn't get an ID
        load();
      }
    } catch (err) {
      console.error("Failed to create session", err);
      toast("Network error creating session", "error");
    } finally {
      setCreating(false);
    }
  }

  // Update one session status (Activate / Complete)
  async function updateStatus(id: string, status: "Active" | "Completed") {
    if (rowBusyId) return; // prevent double spam
    setRowBusyId(id);
    try {
      const r = await fetch(`/api/session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(
          j.error ||
            (status === "Active"
              ? "Failed to activate"
              : "Failed to complete"),
          "error"
        );
      } else {
        toast(
          status === "Active"
            ? "Session activated"
            : "Session completed",
          "success"
        );
        // reload sessions so UI stays up to date
        load();
      }
    } catch (err) {
      console.error("Failed to update session status", err);
      toast("Network error updating session", "error");
    } finally {
      setRowBusyId(null);
    }
  }

  // Clicking "New session"
  function onClickNewSession() {
    if (reachedFreeLimit) {
      toast("Free plan allows 1 session. Upgrade to create more.", "error");
      return;
    }
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sessions</h1>
          <p className="text-sm text-[var(--muted)]">
            All workshops in your org
          </p>
        </div>

        <Button onClick={onClickNewSession}>
          New session{" "}
          {reachedFreeLimit && (
            <ProTag className="border-white/80 bg-white text-[var(--brand)]" />
          )}
        </Button>
      </div>

      {/* Content area */}
      {loading ? (
        // skeletons
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-md bg-white/10" />
          <div className="h-20 animate-pulse rounded-md bg-white/10" />
        </div>
      ) : loadError ? (
        // error block
        <Card>
          <CardBody>
            <div className="text-sm text-[var(--muted)]">{loadError}</div>
          </CardBody>
        </Card>
      ) : sessions.length === 0 ? (
        // empty
        <Empty
          title="No sessions yet"
          hint="Create your first session to get started."
        />
      ) : (
        // sessions table
        <Card>
          <CardHeader title="All sessions" />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Join code</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                    onClick={() => {
                      router.push(`/session/${s.id}`);
                    }}
                  >
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">
                      {s.status === "Draft" ? "Inactive" : s.status}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{s.join_code}</td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(s.status === "Draft" ||
                          s.status === "Inactive") && (
                          <Button
                            variant="outline"
                            disabled={rowBusyId === s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(s.id, "Active");
                            }}
                          >
                            {rowBusyId === s.id
                              ? "Working..."
                              : "Activate"}
                          </Button>
                        )}

                        {s.status === "Active" && (
                          <Button
                            variant="outline"
                            disabled={rowBusyId === s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(s.id, "Completed");
                            }}
                          >
                            {rowBusyId === s.id
                              ? "Working..."
                              : "Complete"}
                          </Button>
                        )}

                        <Link
                          href={`/session/${s.id}`}
                          onClick={(e) => {
                            // Stop row click nav so <Link> handles it
                            e.stopPropagation();
                          }}
                        >
                          <Button variant="ghost">Open</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Create session modal */}
      <Modal
        open={open}
        onClose={() => {
          if (!creating) setOpen(false);
        }}
        title="Create session"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (!creating) setOpen(false);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={
                creating ||
                !name.trim() ||
                reachedFreeLimit
              }
            >
              {creating
                ? "Creating..."
                : reachedFreeLimit
                ? "Limit reached"
                : "Create"}
            </Button>
          </>
        }
      >
        <label
          htmlFor="session-name"
          className="mb-2 block text-sm"
        >
          Name
        </label>
        <input
          id="session-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Visioning Workshop"
          className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none focus:ring-[var(--ring)]"
          disabled={creating || reachedFreeLimit}
        />
        {reachedFreeLimit && (
          <div className="mt-2 text-xs text-[var(--muted)]">
            Free plan includes 1 session. Upgrade to Pro for
            unlimited sessions and exports.
          </div>
        )}
      </Modal>
    </div>
  );
}
