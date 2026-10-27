// Shared shapes for the "attempt -> feedback -> remediation" flow on exam
// questions. Pure types, no server-only imports, so server actions, the
// generator and the practice UI all agree on them.
//
// Stored (generated lazily on first need, then cached) inside the question's
// existing `format` JSON: format.hints and format.remediation. No migration.
import type { Scene } from "@/lib/lesson-scene";

// A graded sub-question in a scaffold (procedural skills: maths, calculations).
export type ScaffoldStep = {
  prompt: string; // what to work out in this step, plain GCSE language
  kind: "numeric" | "text" | "fraction"; // fraction = two boxes (top / bottom)
  unit?: string;
  answer: string | number; // numeric/text answer; for fraction use "top/bottom"
  tolerancePercent?: number;
  accepted?: string[]; // extra accepted answers for text steps
  hint?: string; // shown after a wrong try on this step (never the answer)
  // The final step IS the original question's answer.
};

export type TransferCheck = {
  prompt: string; // same concept, different surface form
  kind: "mcq" | "short";
  options?: string[];
  correctIndex?: number;
  accepted?: string[];
};

export type Remediation =
  | { type: "scaffold"; steps: ScaffoldStep[] } // 3-5 steps, last = the answer
  | {
      type: "explain";
      content: string; // short teaching text (markdown/KaTeX allowed)
      scene?: Scene | null; // optional annotated diagram
      transferCheck: TransferCheck;
    };

// Escalating feedback per attempt, shared by every question type.
export type AttemptPhase =
  | "first-attempt"
  | "retry-1" // attempt 1 wrong: verdict + (non-maths) improvement hint, Try again
  | "second-chance" // attempt 2 wrong: banner + Skip becomes available
  | "remediation" // button reads "Let's learn it"
  | "complete"; // tab goes cross -> tick, Next appears
