"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Group = { id: string; name: string };
type Participant = {
  id: string;
  display_name: string | null;
  group_id: string | null;
};

export default function GroupsManager({ sessionId }: { sessionId: string }) {
  const toast = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [rg, rp] = await Promise.all([
        apiFetch(`/api/groups?session_id=${sessionId}`, { cache: "no-store" }),
        apiFetch(`/api/participants?session_id=${sessionId}`, { cache: "no-store" }),
      ]);

      const jg = await rg.json().catch(() => ({}));
      const jp = await rp.json().catch(() => ({}));

      if (!rg.ok) {
        console.error("[GroupsManager] Failed to load groups:", jg.error);
        toast(jg.error || "Failed to load groups", "error");
      }
      if (!rp.ok) {
        console.error("[GroupsManager] Failed to load participants:", jp.error);
        toast(jp.error || "Failed to load participants", "error");
      }

      setGroups(Array.isArray(jg.groups) ? jg.groups : []);
      setParticipants(
        Array.isArray(jp.participants)
          ? jp.participants.map((p: any) => ({
              id: p.id,
              display_name: p.display_name,
              group_id: p.group_id,
            }))
          : []
      );
    } catch (err) {
      console.error("[GroupsManager] load() crashed:", err);
      toast("Failed to load data", "error");
      setGroups([]);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function create() {
    const clean = name.trim();
    if (!clean) {
      toast("Enter a group name", "error");
      return;
    }
    setCreating(true);
    try {
      const r = await apiFetch(`/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          name: clean,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error("[GroupsManager] create() failed:", j.error);
        toast(j.error || "Failed to create group", "error");
        return;
      }

      toast("Group created", "success");
      setName("");
      await load();
    } catch (err) {
      console.error("[GroupsManager] create() crashed:", err);
      toast("Failed to create group", "error");
    } finally {
      setCreating(false);
    }
  }

  // we want to show "Unassigned" if there are any participants without group_id
  const unassigned = participants.filter((p) => !p.group_id);

  return (
    <Card>
      <CardHeader
        title="Participants"
        subtitle="Create and manage groups"
      />
      <CardBody>
        {/* Create group row */}
        <div className="mb-3 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New group name"
            aria-label="New group name"
            className="h-10 flex-1 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
          />
          <Button
            onClick={create}
            disabled={!name.trim() || creating}
          >
            {creating ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </div>
        ) : groups.length === 0 && unassigned.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No groups yet.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Each group card */}
            {groups.map((g) => {
              const members = participants.filter(
                (p) => p.group_id === g.id
              );
              return (
                <div
                  key={g.id}
                  className="rounded-md border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {g.name}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {members.length}{" "}
                      {members.length === 1
                        ? "member"
                        : "members"}
                    </div>
                  </div>

                  {members.length > 0 && (
                    <ul className="mt-2 text-sm text-[var(--muted)]">
                      {members.map((p) => (
                        <li key={p.id}>
                          •{" "}
                          {p.display_name ||
                            `Anon ${p.id.slice(
                              0,
                              4
                            )}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {/* Unassigned block */}
            {unassigned.length > 0 && (
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="font-medium">
                  Unassigned
                </div>
                <ul className="mt-2 text-sm text-[var(--muted)]">
                  {unassigned.map((p) => (
                    <li key={p.id}>
                      •{" "}
                      {p.display_name ||
                        `Anon ${p.id.slice(
                          0,
                          4
                        )}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
