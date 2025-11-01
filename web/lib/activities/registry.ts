// Lightweight activity registry scaffold
// Centralizes display names and capabilities per activity type.

export type ActivityType = "brainstorm" | "stocktake" | "assignment";

export type ActivityDefinition = {
  id: ActivityType;
  displayName: string;
  capabilities: {
    supportsVoting?: boolean;
    usesInitiatives?: boolean; // stocktake
  };
};

const defs: Record<ActivityType, ActivityDefinition> = {
  brainstorm: {
    id: "brainstorm",
    displayName: "Standard activity",
    capabilities: { supportsVoting: true },
  },
  stocktake: {
    id: "stocktake",
    displayName: "Process stocktake",
    capabilities: { usesInitiatives: true },
  },
  assignment: {
    id: "assignment",
    displayName: "Prompt assignment",
    capabilities: { supportsVoting: false },
  },
};

export function getActivityDef(type: string | null | undefined): ActivityDefinition | null {
  if (!type) return null;
  const t = type as ActivityType;
  return (defs as any)[t] || null;
}

export function getActivityDisplayName(type: string | null | undefined): string {
  return getActivityDef(type)?.displayName || (type || "");
}

export const activityRegistry = defs;

