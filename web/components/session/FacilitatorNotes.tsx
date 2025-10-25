"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function FacilitatorNotes({ sessionId }: { sessionId: string }) {
  const key = `sf_notes_${sessionId}`;
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try { setText(localStorage.getItem(key) || ""); } catch {}
  }, [key]);

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(key, text); setSavedAt(new Date().toLocaleTimeString()); } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [key, text]);

  return (
    <Card>
      <CardHeader title="Notes" subtitle={savedAt ? `Auto-saved at ${savedAt}` : "Auto-saves locally"} />
      <CardBody>
        <textarea
          value={text}
          onChange={(e)=>setText(e.target.value)}
          placeholder="Jot down facilitation notes, observations, next steps..."
          className="w-full min-h-64 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none"
        />
      </CardBody>
    </Card>
  );
}

