import { describe, expect, it } from "vitest";
import {
  attemptReducer as r,
  canSkip,
  canSubmit,
  initialAttemptState,
  phaseView,
  type AttemptState,
} from "./question-attempt-machine";

const wrong = (s: AttemptState, input = "x") => r(s, { type: "submitWrong", input });

describe("attempt machine", () => {
  it("escalates first-attempt -> retry-1 -> second-chance", () => {
    const s1 = wrong(initialAttemptState(), "a");
    expect(s1.phase).toBe("retry-1");
    expect(canSkip(s1)).toBe(false);
    const s2 = wrong(s1, "b");
    expect(s2.phase).toBe("second-chance");
    expect(canSkip(s2)).toBe(true);
    expect(s2.lastWrongInput).toBe("b");
  });
  it("right at any attempt completes", () => {
    expect(r(initialAttemptState(), { type: "submitRight" }).phase).toBe("complete");
    expect(r(wrong(initialAttemptState()), { type: "submitRight" }).phase).toBe("complete");
    expect(r(wrong(wrong(initialAttemptState())), { type: "submitRight" }).phase).toBe("complete");
  });
  it("skip only from second-chance, then remediation passes to complete", () => {
    const s1 = wrong(initialAttemptState());
    expect(r(s1, { type: "skip" }).phase).toBe("retry-1");
    const s2 = wrong(s1, "b");
    const rem = r(s2, { type: "skip" });
    expect(rem.phase).toBe("remediation");
    expect(r(rem, { type: "remediationPassed" }).phase).toBe("complete");
  });
  it("startRemediation works from second-chance but not first attempt", () => {
    expect(r(initialAttemptState(), { type: "startRemediation" }).phase).toBe("first-attempt");
    expect(r(wrong(wrong(initialAttemptState())), { type: "startRemediation" }).phase).toBe("remediation");
  });
  it("scaffold remediation cannot be skipped", () => {
    const rem = r(wrong(wrong(initialAttemptState())), { type: "startRemediation", scaffold: true });
    expect(rem.inScaffold).toBe(true);
    expect(r(rem, { type: "skip" }).phase).toBe("remediation");
    expect(canSkip(rem)).toBe(false);
  });
  it("remediationPassed is ignored outside remediation; complete is terminal", () => {
    expect(r(initialAttemptState(), { type: "remediationPassed" }).phase).toBe("first-attempt");
    const done = r(initialAttemptState(), { type: "submitRight" });
    expect(wrong(done).phase).toBe("complete");
  });
  it("tryAgain keeps state", () => {
    const s = wrong(initialAttemptState());
    expect(r(s, { type: "tryAgain" })).toEqual(s);
  });
});

describe("canSubmit", () => {
  it("blocks empty and repeated input", () => {
    expect(canSubmit(null, "")).toBe(false);
    expect(canSubmit(null, "8")).toBe(true);
    expect(canSubmit("Osmosis", "  osmosis. ")).toBe(false);
    expect(canSubmit("osmosis", "diffusion")).toBe(true);
  });
});

describe("phaseView", () => {
  it("verdict for numeric, improve for free text", () => {
    const s = wrong(initialAttemptState());
    expect(phaseView(s, { numeric: true }).showVerdict).toBe(true);
    expect(phaseView(s, { numeric: false }).showHowToImprove).toBe(true);
    expect(phaseView(r(wrong(s), { type: "skip" }), { numeric: true }).primaryLabel).toBe("Let's learn it");
  });
});
