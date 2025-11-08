"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Init = { id: string; title: string };

const choices = [
  { key: "stop", label: "Stop" },
  { key: "less", label: "Do less" },
  { key: "same", label: "Same" },
  { key: "more", label: "Do more" },
  { key: "begin", label: "Begin / Highly increase" },
] as const;

export default function StocktakePanel({
  sessionId,
  activityId,
  onComplete,
}: {
  sessionId: string;
  activityId: string;
  onComplete?: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Init[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Fetch initiatives + any previous selections for this participant
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1. Get initiatives
        const r = await apiFetch(
          `/api/stocktake/initiatives?activity_id=${activityId}`,
          { cache: "no-store" }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          console.error(
            "[StocktakePanel] initiatives load error:",
            j.error
          );
          toast(j.error || "Failed to load initiatives", "error");
          setItems([]);
          setSel({});
          setLoading(false);
          return;
        }

        const inits: Init[] = Array.isArray(j.initiatives)
          ? j.initiatives
          : [];
        setItems(inits);

        // 2. Get participant's previous responses (so we can pre-select)
        try {
          const rr = await apiFetch(
            `/api/stocktake/responses?session_id=${sessionId}&activity_id=${activityId}`,
            { cache: "no-store" }
          );
          const rj = await rr.json().catch(() => ({}));
          if (rr.ok && Array.isArray(rj.responses)) {
            const pre: Record<string, string> = {};
            rj.responses.forEach((x: any) => {
              if (x?.initiative_id && x?.choice) {
                pre[x.initiative_id] = x.choice;
              }
            });
            setSel(pre);
          } else if (!rr.ok) {
            console.error(
              "[StocktakePanel] responses load error:",
              rj.error
            );
            // Not fatal. We still show initiatives.
          }
        } catch (err) {
          console.error(
            "[StocktakePanel] responses load crash:",
            err
          );
        }
      } catch (err) {
        console.error(
          "[StocktakePanel] overall load crash:",
          err
        );
        toast("Failed to load stocktake", "error");
        setItems([]);
        setSel({});
      } finally {
        setLoading(false);
      }
    })();
  }, [activityId, sessionId, toast]);

  const allChosen =
    items.length > 0 && items.every((it) => !!sel[it.id]);

  async function submitAll() {
    if (!allChosen || loadingSubmit) return;

    setLoadingSubmit(true);
    try {
      // submit each choice
      await Promise.all(
        items.map(async (it) => {
          const choice = sel[it.id];
          const r = await apiFetch(`/api/stocktake/responses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // NOTE: we're intentionally NOT including participant_id here.
            // Server should infer participant from cookie/session.
            body: JSON.stringify({
              session_id: sessionId,
              activity_id: activityId,
              initiative_id: it.id,
              choice,
            }),
          });

          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            console.error(
              "[StocktakePanel] submit error for initiative",
              it.id,
              txt
            );
            throw new Error(txt || "Request failed");
          }
        })
      );

      toast("Responses submitted", "success");
      onComplete?.();
    } catch (e: any) {
      console.error("[StocktakePanel] submitAll crash:", e);
      toast(e?.message || "Failed to submit responses", "error");
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Process stocktake"
        subtitle="Pick a choice for each initiative"
      />
      <CardBody>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No initiatives yet.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="p-3 rounded-md bg-white/5 border border-white/10"
              >
                <div className="mb-2 font-medium">{it.title}</div>

                <div className="flex flex-wrap gap-2 items-center">
                  {choices.map((c) => {
                    const isSelected = sel[it.id] === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() =>
                          setSel((prev) => ({
                            ...prev,
                            [it.id]: c.key,
                          }))
                        }
                        aria-pressed={isSelected}
                        className={`h-9 px-3 rounded-md text-sm border ${
                          isSelected
                            ? "bg-white/10 border-white/20"
                            : "border-white/10 hover:bg-white/5"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex justify-end mt-2">
              <Button
                onClick={submitAll}
                disabled={!allChosen || loadingSubmit}
                variant={allChosen ? "primary" : "outline"}
              >
                {loadingSubmit
                  ? "Submitting..."
                  : "Submit all"}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
