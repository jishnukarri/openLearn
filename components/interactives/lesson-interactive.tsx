"use client";

import type { LessonInteractive } from "@/lib/ai/lessons";
import { SliderSim } from "./slider-sim";
import { BranchingDilemma } from "./branching";
import { GraphTransformer } from "./graph-transformer";
import { BlockSort } from "./block-sort";
import { FlowchartSort } from "./flowchart-sort";
import { Categorize } from "./categorize";

const ARCHETYPE_LABELS: Record<string, string> = {
  slider_sim: "Explore first",
  branching: "Make a decision",
  graph: "Discover the pattern",
  block_sort: "Arrange the pieces",
  flowchart: "Put it in order",
  categorize: "Sort it out",
};

export function LessonInteractiveWidget({
  interactive,
  onContinue,
}: {
  interactive: LessonInteractive;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {ARCHETYPE_LABELS[interactive.kind] ?? "Interactive"}
        </span>
        <span className="text-sm text-muted">before the lesson</span>
      </div>

      {interactive.kind === "slider_sim" && (
        <SliderSim interactive={interactive} onContinue={onContinue} />
      )}
      {interactive.kind === "branching" && (
        <BranchingDilemma interactive={interactive} onContinue={onContinue} />
      )}
      {interactive.kind === "graph" && (
        <GraphTransformer interactive={interactive} onContinue={onContinue} />
      )}
      {interactive.kind === "block_sort" && (
        <BlockSort interactive={interactive} onContinue={onContinue} />
      )}
      {interactive.kind === "flowchart" && (
        <FlowchartSort interactive={interactive} onContinue={onContinue} />
      )}
      {interactive.kind === "categorize" && (
        <Categorize interactive={interactive} onContinue={onContinue} />
      )}
    </div>
  );
}
