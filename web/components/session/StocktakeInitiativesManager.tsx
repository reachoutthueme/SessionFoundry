"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Init = { id: string; title: string };

export default function StocktakeInitiativesManager({
  activityId,
}: {
  activityId: string;
}) {
  const toast = useToast();

  const [items, setItems] = useState<Init[]>([]);
  const [loading, setLoading] = useState(true);

  // form / action state
  const [title, setTitle] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyRemoveId, setBusyRemoveId] = useState<string | null>(null);

  // central loader with error handling
  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch(
        `/api/stocktake/initiatives?activity_id=${activityId}`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error(
          "[StocktakeInitiativesManager] load error:",
          j.error
        );
        toast(j.error || "Failed to load initiatives", "error");
        // Keep old items if loading fails
        setLoading(false);
        return;
      }

      setItems(Array.isArray(j.initiatives) ? j.initiatives : []);
    } catch (err) {
      console.error(
        "[StocktakeInitiativesManager] load crash:",
        err
      );
      toast("Failed to load initiatives", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  async function add() {
    const t = title.trim();
    if (!t) return;
    if (t.length > 200) {
      toast("Keep it under ~200 chars for readability", "error");
      return;
    }

    setBusyAdd(true);
    try {
      const r = await apiFetch(`/api/stocktake/initiatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activityId,
          title: t,
        }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error(
          "[StocktakeInitiativesManager] add error:",
          j.error
        );
        toast(j.error || "Failed to add initiative", "error");
        return;
      }

      toast("Initiative added", "success");
      setTitle("");
      await load();
    } catch (err) {
      console.error(
        "[StocktakeInitiativesManager] add crash:",
        err
      );
      toast("Failed to add initiative", "error");
    } finally {
      setBusyAdd(false);
    }
  }

  async function remove(id: string) {
    // tiny safety check so you don't fat-finger delete
    const ok = window.confirm(
      "Remove this initiative? This can't be undone."
    );
    if (!ok) return;

    setBusyRemoveId(id);
    try {
      const r = await apiFetch(
        `/api/stocktake/initiatives/${id}`,
        { method: "DELETE" }
      );
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error(
          "[StocktakeInitiativesManager] remove error:",
          j.error
        );
        toast(j.error || "Failed to remove", "error");
        return;
      }

      toast("Removed", "success");
      await load();
    } catch (err) {
      console.error(
        "[StocktakeInitiativesManager] remove crash:",
        err
      );
      toast("Failed to remove", "error");
    } finally {
      setBusyRemoveId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Stocktake initiatives"
        subtitle="Add or remove items"
      />
      <CardBody>
        {/* Add new initiative row */}
        <div className="flex gap-2 mb-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add initiative"
            className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
            maxLength={200}
            aria-label="New initiative title"
          />
          <Button onClick={add} disabled={busyAdd}>
            {busyAdd ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Content state: loading / empty / list */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-white/10 animate-pulse" />
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No initiatives yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <span className="text-sm break-words">{it.title}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => remove(it.id)}
                  disabled={busyRemoveId === it.id}
                  aria-label={`Remove initiative "${it.title}"`}
                >
                  {busyRemoveId === it.id ? "..." : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
