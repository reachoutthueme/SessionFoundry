"use client";

import type { FC } from "react";
import { StandardAssignmentParticipantPanel, StocktakeParticipantPanel } from "@/components/activities/ParticipantPanels";
import BrainstormResults from "@/components/activities/results/BrainstormResults";
import StocktakeResults from "@/components/activities/results/StocktakeResults";

export type ActivityType = "brainstorm" | "stocktake" | "assignment";

export type Activity = {
  id: string;
  type: ActivityType;
  status: string;
  ends_at?: string | null;
  config?: any;
};

export type ParticipantPanelProps = {
  sessionId: string;
  activity: Activity;
  onComplete?: () => void;
};

const participantPanels: Record<ActivityType, FC<ParticipantPanelProps>> = {
  brainstorm: ({ sessionId, activity }) => (
    <StandardAssignmentParticipantPanel sessionId={sessionId} activity={activity} />
  ),
  assignment: ({ sessionId, activity }) => (
    <StandardAssignmentParticipantPanel sessionId={sessionId} activity={activity} />
  ),
  stocktake: ({ sessionId, activity, onComplete }) => (
    <StocktakeParticipantPanel sessionId={sessionId} activity={activity} onComplete={onComplete} />
  ),
};

export function getParticipantPanel(type: string | null | undefined): FC<ParticipantPanelProps> | null {
  if (!type) return null;
  return (participantPanels as any)[type] || null;
}

// Results components registry
export type ResultsRenderer =
  | { kind: "subs"; Component: FC<any> }
  | { kind: "stocktake"; Component: FC<any> };

export function getResultsRenderer(type: string | null | undefined): ResultsRenderer | null {
  if (!type) return null;
  const t = type as ActivityType;
  if (t === "stocktake") return { kind: "stocktake", Component: StocktakeResults };
  if (t === "brainstorm" || t === "assignment") return { kind: "subs", Component: BrainstormResults };
  return null;
}
