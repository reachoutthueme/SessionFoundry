"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function FacilitatorNotes({ sessionId }: { sessionId: string }) {
  const storageKey = `sf_notes_${sessionId}`;

  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // we keep a ref of the last saved text so we don't re-save identical content
  const lastSavedRef = useRef<string>("");

  // Load notes on mount / when sessionId changes
  useEffect(() => {
    try {
      const existing = localStorage.getItem(storageKey) || "";
      setText(existing);
      lastSavedRef.current = existing;
      setSavedAt(null); // fresh load, not yet saved this session
      setSaveError(null);
    } catch (err) {
      // localStorage may fail in private mode or restricted env
      setSaveError("Storage not available");
    }
  }, [storageKey]);

  // Debounced auto-save whenever text changes
  useEffect(() => {
    // If text hasn't changed from last saved version, skip
    if (text === lastSavedRef.current) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, text);
        lastSavedRef.current = text;
        setSavedAt(new Date().toLocaleTimeString());
        setSaveError(null);
      } catch (err) {
        console.error("[FacilitatorNotes] Failed to save notes:", err);
        setSaveError("Could not save locally");
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [text, storageKey]);

  // Subtitle logic
  const subtitle = saveError
    ? saveError // e.g. "Could not save locally"
    : savedAt
    ? `Auto-saved at ${savedAt}`
    : "Auto-saves in this browser only";

  return (
    <Card>
      <CardHeader title="Notes" subtitle={subtitle} />
      <CardBody>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jot down facilitation notes, observations, next steps..."
          aria-label="Facilitator notes for this session (only stored on this browser)"
          className="w-full min-h-64 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none resize-y"
        />
        <div className="mt-2 text-[10px] text-[var(--muted)] leading-snug">
          These notes are private to you and never leave your browser.
        </div>
      </CardBody>
    </Card>
  );
}