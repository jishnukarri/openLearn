// Pure state machine for the escalating-feedback attempt flow on one exam
// question. UI drives it with events and reads the derived flags; no side
// effects, no server imports.
import type { AttemptPhase } from "./question-remediation";

export type AttemptState = {
  phase: AttemptPhase;
  attempts: number; // wrong submissions so far
  lastWrongInput: string | null; // raw text of the previous wrong attempt
  inScaffold: boolean; // remediation is a scaffold (steps cannot be skipped)
};

export type AttemptEvent =
  | { type: "submitWrong"; input: string }
  | { type: "submitRight" }
  | { type: "tryAgain" } // dismisses the feedback, back to editing
  | { type: "skip" }
  | { type: "startRemediation"; scaffold?: boolean }
  | { type: "remediationPassed" };

export function initialAttemptState(): AttemptState {
  return { phase: "first-attempt", attempts: 0, lastWrongInput: null, inScaffold: false };
}

export function normaliseInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

// False when the input is empty or just repeats the previous wrong attempt,
// which blocks blind resubmits.
export function canSubmit(prevInput: string | null | undefined, input: string): boolean {
  const n = normaliseInput(input);
  if (!n) return false;
  if (prevInput == null) return true;
  return n !== normaliseInput(prevInput);
}

// Skip is offered from the second chance onwards, never inside a scaffold,
// and never once the question is done.
export function canSkip(state: AttemptState): boolean {
  return state.phase === "second-chance" && !state.inScaffold;
}

export function attemptReducer(state: AttemptState, event: AttemptEvent): AttemptState {
  if (state.phase === "complete") return state;
  switch (event.type) {
    case "submitRight":
      return { ...state, phase: "complete" };
    case "submitWrong": {
      if (state.phase === "remediation") return state;
      const attempts = state.attempts + 1;
      // Attempt 1 wrong => retry-1; attempt 2 (or later) wrong => second-chance.
      return { ...state, attempts, lastWrongInput: event.input, phase: attempts === 1 ? "retry-1" : "second-chance" };
    }
    case "tryAgain":
      // Feedback is dismissed; the phase stays so the UI keeps its escalated
      // copy, only blind resubmits are blocked via lastWrongInput.
      return state;
    case "skip":
      return canSkip(state) ? { ...state, phase: "remediation" } : state;
    case "startRemediation":
      // Reachable from second-chance (Skip / "Let's learn it"); a student may
      // also opt in from retry-1 via the explicit button.
      if (state.phase === "first-attempt") return state;
      return { ...state, phase: "remediation", inScaffold: event.scaffold ?? state.inScaffold };
    case "remediationPassed":
      return state.phase === "remediation" ? { ...state, phase: "complete" } : state;
  }
}

// What the UI should show for a phase.
export type PhaseView = {
  showVerdict: boolean; // tick/cross verdict (numeric answers)
  showHowToImprove: boolean; // 'How to improve' feedback (free text)
  canTryAgain: boolean;
  canSkip: boolean;
  showNext: boolean;
  primaryLabel: string;
};

export function phaseView(state: AttemptState, opts: { numeric: boolean }): PhaseView {
  const p = state.phase;
  return {
    showVerdict: opts.numeric && (p === "retry-1" || p === "second-chance"),
    showHowToImprove: !opts.numeric && (p === "retry-1" || p === "second-chance"),
    canTryAgain: p === "retry-1" || p === "second-chance",
    canSkip: canSkip(state),
    showNext: p === "complete",
    primaryLabel:
      p === "remediation" ? "Let's learn it" : p === "retry-1" || p === "second-chance" ? "Try again" : p === "complete" ? "Next" : "Check",
  };
}
