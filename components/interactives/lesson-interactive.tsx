"use client";

import type { LessonInteractive } from "@/lib/ai/lessons";
import { SliderSim } from "./slider-sim";
import { BranchingDilemma } from "./branching";
import { GraphTransformer } from "./graph-transformer";
import { BlockSort } from "./block-sort";
import { FlowchartSort } from "./flowchart-sort";
import { Categorize } from "./categorize";

const ARCHETYPE_LABELS: Record<string, string> = {
  slider_sim: "See how it works",
  branching: "Now you try: make a decision",
  graph: "Now you try: spot the pattern",
  block_sort: "Now you try: arrange what you learned",
  flowchart: "Now you try: put it in order",
  categorize: "Now you try: sort what you just learned",
};

export function LessonInteractiveWidget({
  interactive,
  onContinue,
  role = "consolidate",
}: {
  interactive: LessonInteractive;
  onContinue: () => void;
  role?: "explore" | "consolidate";
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {ARCHETYPE_LABELS[interactive.kind] ?? "Interactive"}
        </span>
        <span className="text-sm text-muted">{role === "explore" ? "an explanation to explore" : "using what you just learned"}</span>
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
