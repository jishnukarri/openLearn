export type StepRevealData = {
  type: "step-reveal";
  title: string;
  steps: { label: string; content: string }[];
};

export type FillGapData = {
  type: "fill-gap";
  instruction: string;
  // template uses ___ as a placeholder for each gap in order
  template: string;
  answers: string[];
  hint?: string;
};

export type SortOrderData = {
  type: "sort-order";
  instruction: string;
  items: string[];   // shown in shuffled order
  correct: string[]; // the correct ordering of those same strings
};

export type MatchConnectData = {
  type: "match-connect";
  instruction: string;
  pairs: { left: string; right: string }[];
};

export type InteractiveComponent =
  | StepRevealData
  | FillGapData
  | SortOrderData
  | MatchConnectData;
