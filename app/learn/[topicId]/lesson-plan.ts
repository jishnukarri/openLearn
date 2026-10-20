import { lessonVocabCard } from "../../../lib/flashcard-quality";
import type { LessonCheck, LessonSection } from "@/lib/ai/lessons";

// ── Types ──────────────────────────────────────────────────────────────────
export type Step =
  // "explore" = a slider-sim explanation placed inside the teaching;
  // otherwise a consolidation activity placed after the teaching.
  | { phase: "interactive"; role?: "explore" | "consolidate" }
  | { phase: "practice" }
  | { phase: "hook" }
  | { phase: "teach"; sectionIndex: number }
  | { phase: "check"; sectionIndex: number }
  | { phase: "flashcard"; cardIndices: number[] }
  | { phase: "tutor"; sectionIndex: number }
  | { phase: "recap" }
  | { phase: "done" };

// Only a "short" check is phrased as a genuinely open-ended question — its
// text stands alone as a prompt. "matching" reads like "Match X with Y" and
// "mcq"/"multi" read like "Which of these…", both assuming visible options
// that never get shown in this free-text format, so reusing their question
// text here reads as broken/nonsensical rather than as an essay prompt.
export function isTutorFriendly(sec: LessonSection): boolean {
  return sec?.check?.kind === "short";
}

// Picks the best section index for a tutor step within a just-finished
// group of (up to) two sections, preferring the later one but falling
// back to the earlier one, or null if neither works as an essay prompt.
export function pickTutorIndex(sections: LessonSection[], i: number): number | null {
  if (isTutorFriendly(sections[i])) return i;
  if (i > 0 && isTutorFriendly(sections[i - 1])) return i - 1;
  return null;
}

// ── Lesson plan builder ────────────────────────────────────────────────────
// Sequence: hook → teach → check → (flashcard every even group) → (tutor every
// odd group) → Do it now → recap. The lesson always opens with teaching: the
// drag/sort activity (or personalised practice) comes only after it, and a
// slider-sim is an explanation placed right after the first teaching step.
// Reordering happens here at build time, so stored lessons keep working.
export function buildLessonPlan(
  hasInteractive: boolean,
  hasHook: boolean,
  sections: LessonSection[],
  opts: { interactiveKind?: string | null; hasPractice?: boolean } = {}
): Step[] {
  const plan: Step[] = [];
  const explore = hasInteractive && opts.interactiveKind === "slider_sim";
  const consolidate = hasInteractive && !explore && !opts.hasPractice;
  if (hasHook) plan.push({ phase: "hook" });
  if (hasInteractive && sections.length === 0) plan.push({ phase: "interactive", role: explore ? "explore" : "consolidate" });

  const N = sections.length;
  let lastWasTutor = false;
  // Only sections that make a genuine term -> definition card join the vocabulary check.
  const cardIndicesFor = (i: number) =>
    [i - 1, i].filter((k) => k >= 0 && sections[k] && vocabCardForSection(sections[k]) !== null);

  for (let i = 0; i < N; i++) {
    plan.push({ phase: "teach", sectionIndex: i });
    if (explore && i === 0) plan.push({ phase: "interactive", role: "explore" });
    plan.push({ phase: "check", sectionIndex: i });

    if (i < N - 1) {
      const isGroupEnd = (i + 1) % 2 === 0;
      const groupNum = Math.floor(i / 2);
      if (isGroupEnd) {
        if (groupNum % 2 === 0) {
          {
            const cardIndices = cardIndicesFor(i);
            if (cardIndices.length > 0) plan.push({ phase: "flashcard", cardIndices });
          }
          lastWasTutor = false;
        } else {
          const tutorIndex = pickTutorIndex(sections, i);
          if (tutorIndex !== null) {
            plan.push({ phase: "tutor", sectionIndex: tutorIndex });
            lastWasTutor = true;
          } else {
            {
            const cardIndices = cardIndicesFor(i);
            if (cardIndices.length > 0) plan.push({ phase: "flashcard", cardIndices });
          }
            lastWasTutor = false;
          }
        }
      } else {
        lastWasTutor = false;
      }
    }
  }

  if (N > 0 && !lastWasTutor) {
    const finalTutorIndex = pickTutorIndex(sections, N - 1);
    if (finalTutorIndex !== null) {
      plan.push({ phase: "tutor", sectionIndex: finalTutorIndex });
    }
  }
  if (N > 0 && opts.hasPractice) plan.push({ phase: "practice" });
  else if (N > 0 && consolidate) plan.push({ phase: "interactive", role: "consolidate" });
  plan.push({ phase: "recap" });
  return plan;
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function getCorrectAnswerLabel(check: LessonCheck): string {
  switch (check.kind) {
    case "multi":
      return check.correctIndexes.map((i) => check.options[i]).join(", ");
    case "short":
      return check.accepted[0] ?? "";
    case "matching":
      return "";
    default:
      return check.options[check.correctIndex] ?? "";
  }
}

// Vocabulary card for a section (heading = term, defining sentence = answer), or null if not card-shaped.
export function vocabCardForSection(sec: LessonSection): { term: string; def: string } | null {
  const c = lessonVocabCard(sec.heading, sec.explanation);
  return c ? { term: c.front, def: c.back } : null;
}

export function cardDefinition(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  if (match && match[0].length < 160) return match[0];
  return text.slice(0, 130) + (text.length > 130 ? "…" : "");
}


// ── Student-facing navigation helpers ──────────────────────────────────────
export type StageName = "Learn it" | "See an example" | "Try it" | "Do it now" | "Check yourself" | "Wrap up";

export function stepLabel(index: number, total: number): string {
  return `Step ${Math.min(index + 1, total)} of ${total}`;
}

// Kid-friendly name of the stage a step belongs to.
export function stageForStep(step: Step, exampleRevealed = false): StageName {
  switch (step.phase) {
    case "interactive":
      return step.role === "explore" ? "Learn it" : "Do it now";
    case "practice":
      return "Do it now";
    case "hook":
      return "Learn it";
    case "teach":
      return exampleRevealed ? "See an example" : "Learn it";
    case "check":
      return "Try it";
    case "flashcard":
    case "tutor":
      return "Check yourself";
    default:
      return "Wrap up";
  }
}

// One imperative line telling the student exactly what to do on this step.
export function stepInstruction(step: Step, sec?: LessonSection): string {
  switch (step.phase) {
    case "interactive":
      return step.role === "explore"
        ? "Move the sliders and watch what changes. This shows the idea you just read."
        : "Now you try: sort what you just learned. Tap a card, then tap the column it belongs in, then press Check.";
    case "practice":
      return "Now you try: answer each question using what you just learned, then reveal the answer and say how you did.";
    case "hook":
      return "Read this, then press Start.";
    case "teach":
      return "Read the idea below, then press Show me how to see it in action.";
    case "check": {
      const kind = sec?.check?.kind;
      if (kind === "multi") return "Tap every answer you think is right, then press Check my answer.";
      if (kind === "matching") return "Match each item on the left to the right one, then check.";
      if (kind === "short") return "Fill in the answer, then press Check my answer.";
      return "Tap the answer you think is right.";
    }
    case "flashcard":
      return "Tap the card to see the answer, then say how well you knew it.";
    case "tutor":
      return "Write your answer in your own words, then press Mark my answer.";
    case "recap":
      return "Look back over what you learned, then finish the lesson.";
    default:
      return "";
  }
}

// First-time hint shown under the primary button: what the step expects.
export function primaryHint(step: Step, sec?: LessonSection): string {
  switch (step.phase) {
    case "check": {
      const kind = sec?.check?.kind;
      if (kind === "multi" || kind === "short" || kind === "matching") return "Pick or write an answer, then press Check.";
      return "Tap an answer and you will see straight away if you got it.";
    }
    case "teach":
      return "No need to remember it all yet. You can look back any time.";
    case "tutor":
      return "There is no wrong way to write it. Marks tell you what to improve.";
    case "flashcard":
      return "Be honest. Cards you find hard come back sooner.";
    default:
      return "";
  }
}

// Why the primary action cannot be pressed yet, or null when it can.
export function disabledReason(step: Step, state: { hasAnswer: boolean; loading?: boolean }): string | null {
  if (state.loading) return "Hang on, marking in progress";
  if (state.hasAnswer) return null;
  switch (step.phase) {
    case "check":
      return "Pick an answer first";
    case "tutor":
      return "Write your answer first";
    case "flashcard":
      return "Tap the card, then rate it";
    default:
      return null;
  }
}

// Takeaway for one section, as a single short line.
export function takeawayFor(sec: LessonSection): { heading: string; line: string } {
  return { heading: sec.heading, line: cardDefinition(sec.explanation) };
}

// Takeaways for every section whose teach step the student has already passed.
export function recapSoFar(
  plan: Step[],
  planIdx: number,
  sections: LessonSection[]
): { heading: string; line: string }[] {
  const out: { heading: string; line: string }[] = [];
  plan.forEach((s, i) => {
    if (s.phase === "teach" && i <= planIdx && sections[s.sectionIndex]) {
      out.push(takeawayFor(sections[s.sectionIndex]));
    }
  });
  return out;
}

// Clamp navigation so Back/Next never leave the plan.
export function clampStep(index: number, total: number): number {
  return Math.max(0, Math.min(index, total - 1));
}

// True when this is the first time the student meets this kind of step, so
// the "what to do here" hint under the primary button is shown only once.
export function isFirstOfPhase(plan: Step[], index: number): boolean {
  const phase = plan[index]?.phase;
  return !!phase && plan.findIndex((s) => s.phase === phase) === index;
}

// ── "Your turn" question steps ─────────────────────────────────────────────
export type TryState = "empty" | "picked" | "correct" | "wrong";

// Visible state of a question step: Not answered yet, Answer picked, Checked.
export function tryState(hasDraft: boolean, result: boolean | null): TryState {
  if (result === true) return "correct";
  if (result === false) return "wrong";
  return hasDraft ? "picked" : "empty";
}

export function tryStateLabel(state: TryState): string {
  switch (state) {
    case "picked":
      return "Answer picked";
    case "correct":
      return "Checked: correct";
    case "wrong":
      return "Checked: not yet";
    default:
      return "Not answered yet";
  }
}

// Plain words saying what happens next, so nothing is a surprise.
export function afterCheckText(state: TryState, tapsToCheck: boolean): string {
  switch (state) {
    case "correct":
      return "Well done. Press Got it, next to carry on.";
    case "wrong":
      return "Not yet. Read the hint, then press Try again, or see the answer.";
    case "picked":
      return tapsToCheck ? "Press Check my answer to see if you are right." : "Press Check to see if you are right.";
    default:
      return tapsToCheck ? "Tap an answer. You will see straight away if it is right." : "Pick or write an answer. Then press Check.";
  }
}

// Hint offered after a first miss: points back at the idea, never the answer.
export function missHint(sec: LessonSection): string {
  return `Hint: think about this idea. ${takeawayFor(sec).line}`;
}

// After one miss the student may retry; a second miss shows the answer.
export function canRetry(misses: number): boolean {
  return misses < 2;
}
