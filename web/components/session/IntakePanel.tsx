"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type SubmissionItem = {
  id: string;
  text: string;
  created_at: string;
};

export default function IntakePanel({
  sessionId,
  activityId,
}: {
  sessionId: string;
  activityId?: string;
}) {
  const toast = useToast();

  const [text, setText] = useState("");
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);

    const url = activityId
      ? `/api/submissions?activity_id=${activityId}&group_only=1`
      : `/api/submissions?session_id=${sessionId}&group_only=1`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error(
          "[IntakePanel] Failed to load submissions:",
          json.error
        );
        toast(json.error || "Failed to load submissions", "error");
        setItems([]);
      } else {
        setItems(Array.isArray(json.submissions) ? json.submissions : []);
      }
    } catch (err) {
      console.error("[IntakePanel] load() crashed:", err);
      toast("Failed to load submissions", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, activityId]);

  async function add() {
    const t = text.trim();
    if (!t) {
      toast("Type something first", "error");
      return;
    }

    setSubmitting(true);

    const payload = activityId
      ? { activity_id: activityId, session_id: sessionId, text: t }
      : { session_id: sessionId, text: t };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // keep identifying cookie
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[IntakePanel] add() failed:", json.error);
        toast(json.error || "Failed to add idea", "error");
        return;
      }

      // success
      toast("Idea added", "success");
      setText("");

      // optimistic update: append new idea to the list
      if (json.submission) {
        setItems((prev) => [...prev, json.submission]);
      } else {
        // if backend didn't return the saved item for some reason,
        // we can fall back to reload to stay accurate
        load();
      }
    } catch (err) {
      console.error("[IntakePanel] add() crashed:", err);
      toast("Failed to add idea", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Submissions"
        subtitle="Add ideas and see them below"
      />
      <CardBody>
        {/* input area */}
        <div className="mb-3">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your idea. You can write multiple lines."
              aria-label="New idea text"
              rows={4}
              className="flex-1 min-h-24 resize-y rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none focus:ring-[var(--ring)]"
            />
            <Button
              onClick={add}
              className="h-10 self-start"
              disabled={submitting || text.trim() === ""}
            >
              {submitting ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>

        {/* list area */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-white/10 animate-pulse" />
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No submissions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-md border border-white/10 bg-white/5 p-3"
              >
                {it.text}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}