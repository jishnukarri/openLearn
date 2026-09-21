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
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-highlight/15 px-2.5 py-0.5 text-xs font-semibold text-highlight">
          {ARCHETYPE_LABELS[interactive.kind] ?? "Interactive"}
        </span>
        <span className="text-xs text-muted">before the lesson</span>
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
