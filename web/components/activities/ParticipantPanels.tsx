"use client";

import { Card, CardBody } from "@/components/ui/Card";
import IntakePanel from "@/components/session/IntakePanel";
import VotingPanel from "@/components/session/VotingPanel.vibrant";
import StocktakePanel from "@/components/session/StocktakePanel";
import Timer from "@/components/ui/Timer";

type Activity = {
  id: string;
  type: "brainstorm" | "stocktake" | "assignment";
  status: "Draft" | "Active" | "Voting" | "Closed" | string;
  ends_at?: string | null;
  config?: any;
};

export function StandardAssignmentParticipantPanel({
  sessionId,
  activity,
}: {
  sessionId: string;
  activity: Activity;
}) {
  if (activity.status === "Voting") {
    return <VotingPanel sessionId={sessionId} activityId={activity.id} />;
  }
  if (activity.status === "Active") {
    return <IntakePanel sessionId={sessionId} activityId={activity.id} />;
  }
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-[var(--muted)]">This activity is not active.</div>
      </CardBody>
    </Card>
  );
}

export function StocktakeParticipantPanel({
  sessionId,
  activity,
  onComplete,
}: {
  sessionId: string;
  activity: Activity;
  onComplete?: () => void;
}) {
  return (
    <div className="space-y-2">
      {activity.ends_at && activity.status === "Active" && (
        <div className="mt-1">
          <Timer endsAt={activity.ends_at} />
        </div>
      )}
      <StocktakePanel
        sessionId={sessionId}
        activityId={activity.id}
        onComplete={onComplete}
      />
    </div>
  );
}
