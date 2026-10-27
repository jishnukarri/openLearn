// Decides whether the Submit button should be live. It is disabled while there
// is no real answer (empty or only spaces) and, once feedback has been given,
// until the answer actually changes. Pure, so it is easy to test.
import { normaliseInput } from "./question-attempt-machine";

export type AnswerParts = {
  selected: number[];
  text: string;
  workingSteps: string[];
  matches: Record<number, number>;
  parts: Record<number, string>;
  imagePaths?: string[];
};

const norm = (s: string) => normaliseInput(s ?? "");

export function hasAnswer(a: AnswerParts): boolean {
  return (
    a.selected.length > 0 ||
    Object.keys(a.matches).length > 0 ||
    norm(a.text) !== "" ||
    a.workingSteps.some((s) => norm(s) !== "") ||
    Object.values(a.parts).some((s) => norm(s) !== "") ||
    (a.imagePaths?.length ?? 0) > 0
  );
}

// Two answers with the same signature count as "not changed": extra spaces,
// case and trailing punctuation don't make a new answer.
export function answerSignature(a: AnswerParts): string {
  return JSON.stringify({
    s: [...a.selected].sort((x, y) => x - y),
    t: norm(a.text),
    w: a.workingSteps.map(norm),
    m: Object.entries(a.matches).sort(([x], [y]) => Number(x) - Number(y)),
    p: Object.entries(a.parts)
      .sort(([x], [y]) => Number(x) - Number(y))
      .map(([k, v]) => [k, norm(v)]),
    i: [...(a.imagePaths ?? [])].sort(),
  });
}

export function submitLocked(a: AnswerParts, lastSubmittedSignature: string | null): boolean {
  if (!hasAnswer(a)) return true;
  return lastSubmittedSignature !== null && answerSignature(a) === lastSubmittedSignature;
}
