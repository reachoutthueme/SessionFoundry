"use client";

import StandardAssignmentConfig from "./StandardAssignmentConfig";
import StocktakeConfig from "./StocktakeConfig";

export default function FacilitatorConfig({
  type,
  draft,
  onChange,
  onManageInitiatives,
}: {
  type: "brainstorm" | "assignment" | "stocktake";
  draft: any;
  onChange: (fn: (prev: any) => any) => void;
  onManageInitiatives?: () => void;
}) {
  if (type === "stocktake") {
    return (
      <StocktakeConfig draft={draft} onChange={onChange} onManageInitiatives={onManageInitiatives} />
    );
  }
  // brainstorm and assignment share the same shape, assignment optionally shows prompts
  return <StandardAssignmentConfig draft={draft} onChange={onChange} />;
}

